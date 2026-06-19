/**
 * V3 render via Remotion Lambda (fast, parallel cloud rendering).
 *
 * Unlike the VPS path (which renders from local public/ files), Lambda fetches
 * every asset over HTTP. So this path:
 *   1. Generates per-scene Gemini background images + OpenAI TTS narration,
 *      uploads each to Supabase Storage, and uses the PUBLIC URLs as inputProps.
 *   2. Calls renderMediaOnLambda against the deployed V3Video site.
 *   3. Polls progress (updating the videos row), then copies the rendered MP4
 *      from Remotion's S3 output bucket into our Supabase 'videos' bucket so the
 *      app serves it from one place.
 *
 * Env (set after running remotion/scripts/deploy-lambda.mjs):
 *   REMOTION_LAMBDA_FUNCTION, REMOTION_SERVE_URL, REMOTION_AWS_REGION,
 *   REMOTION_AWS_ACCESS_KEY_ID, REMOTION_AWS_SECRET_ACCESS_KEY
 *
 * isLambdaConfigured() lets callers fall back to the VPS when these are absent.
 */
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client'
import { createAdminClient } from './supabase/admin'
import { GoogleGenAI } from '@google/genai'
import type { V3Payload } from './v3-render'

const REGION = (process.env.REMOTION_AWS_REGION || 'us-east-1') as any
const FUNCTION = process.env.REMOTION_LAMBDA_FUNCTION
const SERVE_URL = process.env.REMOTION_SERVE_URL

export function isLambdaConfigured(): boolean {
  return !!(FUNCTION && SERVE_URL && process.env.REMOTION_AWS_ACCESS_KEY_ID && process.env.REMOTION_AWS_SECRET_ACCESS_KEY)
}

const LOOK = 'Cinematic film still, 35mm anamorphic, shallow depth of field, dramatic low-key lighting with rim light and volumetric haze, muted moody grade, subtle grain, premium editorial mood. Photoreal, NOT illustration. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, charts, or logos.'

const BUCKET = 'videos'

async function tts(text: string, voiceId: string): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1-hd', voice: voiceId || 'nova', input: text || ' ', response_format: 'mp3', speed: 0.98 }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function geminiBg(prompt: string): Promise<Buffer | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n${LOOK}` }] }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } } as any,
      })
      const img = (r.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData)
      if (!img) throw new Error('no image')
      return Buffer.from((img as any).inlineData.data, 'base64')
    } catch (e) { if (a === 3) return null; await new Promise((r) => setTimeout(r, 2500 * a)) }
  }
  return null
}

/** ffprobe-free duration estimate from mp3 byte length (tts-1-hd ≈ 24kbps mono). */
function estimateFrames(mp3: Buffer): number {
  const seconds = Math.max(2, mp3.length / (24000 / 8))
  return Math.round((seconds + 0.9) * 30)
}

async function uploadPublic(admin: any, path: string, buf: Buffer, contentType: string): Promise<string> {
  await admin.storage.from(BUCKET).upload(path, new Uint8Array(buf), { contentType, upsert: true })
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/**
 * Render a V3 video on Lambda. Builds inputProps with public asset URLs, kicks
 * off the Lambda render, polls to completion, copies the MP4 to Supabase, and
 * marks the videos row completed. Throws on failure (caller refunds + fails row).
 */
export async function renderV3OnLambda(payload: V3Payload): Promise<void> {
  if (!isLambdaConfigured()) throw new Error('Lambda not configured')
  const admin = createAdminClient()
  const { videoId, userId, voiceId } = payload
  const setProgress = (pct: number, detail: string) =>
    admin.from('videos').update({ progress_pct: pct, progress_detail: detail, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})

  await admin.from('videos').update({ total_scenes: payload.scenes.length, preview_thumbs: [] }).eq('id', videoId).then(() => {}, () => {})
  await setProgress(25, 'Generating narration...')

  // 1) Build scenes with PUBLIC asset URLs (Lambda fetches these over HTTP).
  const previews: { idx: number; url: string }[] = []
  const outScenes: any[] = []
  for (let i = 0; i < payload.scenes.length; i++) {
    const s = payload.scenes[i]
    const audioBuf = await tts(s.narration || s.title || ' ', voiceId)
    const durationInFrames = estimateFrames(audioBuf)
    const audioUrl = await uploadPublic(admin, `${userId}/${videoId}_a${i}.mp3`, audioBuf, 'audio/mpeg')

    await setProgress(30 + Math.round((i / payload.scenes.length) * 40), `Painting scene ${i + 1}/${payload.scenes.length}...`)
    const imgPrompt = (s.title ? `A cinematic scene evoking: ${s.title}. ${s.narration || ''}` : (s.narration || 'abstract corporate background')).slice(0, 400)
    const imgBuf = await geminiBg(imgPrompt)
    let imageUrl: string | undefined
    if (imgBuf) {
      imageUrl = await uploadPublic(admin, `${userId}/${videoId}_s${i}.png`, imgBuf, 'image/png')
      previews.push({ idx: i, url: imageUrl })
      await admin.from('videos').update({ preview_thumbs: previews, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})
    }
    const isEnd = i === 0 || i === payload.scenes.length - 1
    const m = (s.metrics || []).find((x) => x && x.label && x.value && /\d/.test(x.value))
    const placement = isEnd ? 'center' : ['bottom', 'left', 'right', 'bottom'][i % 4]
    outScenes.push({
      title: s.title || '', body: s.bullets?.[0],
      ...(imageUrl ? { image: imageUrl } : {}),
      audio: audioUrl, durationInFrames, placement,
      ...(!isEnd && m ? { metric: { label: m.label, value: m.value } } : {}),
    })
  }

  // 2) Theme (dark Modern-Fintech + brand accents, contrast-guarded for legibility).
  const accents = (payload.brandAccents || []).map(guardDark)
  const theme = {
    name: 'Modern Fintech', ink: '#070D1A', inkSoft: '#0C1730',
    glass: 'rgba(120,170,255,0.06)', glassEdge: 'rgba(120,170,255,0.22)',
    textPrimary: '#EAF2FF', textMuted: '#8FA6C8',
    accents: [accents[0] || '#3B82F6', accents[1] || '#22D3EE', accents[2] || '#8B5CF6'],
    mode: 'dark' as const,
  }
  const inputProps = {
    theme, brandName: payload.brandName,
    ...(payload.logo?.light || payload.logo?.dark ? { logo: { light: payload.logo.light, dark: payload.logo.dark }, logoChip: !!payload.logo.chip } : {}),
    scenes: outScenes,
  }

  // 3) Kick off the Lambda render.
  // framesPerLambda controls fan-out. A fresh AWS account's concurrency cap is
  // very low (~10 or less), and Remotion also spins helper/encoder Lambdas — so
  // even ~6 still tripped "Rate Exceeded". 1000 frames/Lambda splits a ~1-2min
  // video into just ~2-3 Lambdas, which renders under even a tiny cap (slower,
  // but it completes). Once the AWS "Concurrent executions" quota is raised,
  // drop this to ~150 for fast (~1min) parallel renders.
  const FRAMES_PER_LAMBDA = parseInt(process.env.REMOTION_FRAMES_PER_LAMBDA || '1000', 10)
  await setProgress(70, 'Rendering video...')
  const { renderId, bucketName } = await renderMediaOnLambda({
    region: REGION, functionName: FUNCTION!, serveUrl: SERVE_URL!,
    composition: 'V3Video', inputProps, codec: 'h264',
    imageFormat: 'jpeg', privacy: 'public',
    framesPerLambda: FRAMES_PER_LAMBDA,
    maxRetries: 3,
  })

  // 4) Poll to completion (update progress 70 -> 92).
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000))
    const p = await getRenderProgress({ renderId, bucketName, functionName: FUNCTION!, region: REGION })
    if (p.fatalErrorEncountered) throw new Error(`Lambda render error: ${p.errors?.[0]?.message?.slice(0, 200) || 'unknown'}`)
    if (p.done) break
    await setProgress(70 + Math.round((p.overallProgress || 0) * 22), `Rendering — ${Math.round((p.overallProgress || 0) * 100)}%`)
  }

  // 5) Copy the rendered MP4 from Remotion's S3 output into Supabase.
  await setProgress(94, 'Finalizing...')
  const final = await getRenderProgress({ renderId, bucketName, functionName: FUNCTION!, region: REGION })
  const outUrl = final.outputFile
  if (!outUrl) throw new Error('Lambda render produced no output file')
  const mp4 = Buffer.from(await (await fetch(outUrl, { signal: AbortSignal.timeout(120000) })).arrayBuffer())
  const videoPath = `${userId}/${videoId}.mp4`
  await admin.storage.from(BUCKET).upload(videoPath, new Uint8Array(mp4), { contentType: 'video/mp4', upsert: true })
  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(videoPath).data.publicUrl

  await admin.from('videos').update({
    status: 'completed', video_url: publicUrl,
    ...(previews[0] ? { thumbnail_url: previews[0].url } : {}),
    progress_pct: 100, progress_detail: null, progress_updated_at: new Date().toISOString(),
  }).eq('id', videoId)
}

/** Lighten a too-dark accent so it reads on the dark V3 ground. */
function guardDark(hex: string): string {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return hex
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 >= 0.42) return hex
  r = Math.round(r + (255 - r) * 0.55); g = Math.round(g + (255 - g) * 0.55); b = Math.round(b + (255 - b) * 0.55)
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}
