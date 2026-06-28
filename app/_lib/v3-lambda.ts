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
import { synthesizeSpeech } from './tts'

const REGION = (process.env.REMOTION_AWS_REGION || 'us-east-1') as any
const FUNCTION = process.env.REMOTION_LAMBDA_FUNCTION
const SERVE_URL = process.env.REMOTION_SERVE_URL

export function isLambdaConfigured(): boolean {
  return !!(FUNCTION && SERVE_URL && process.env.REMOTION_AWS_ACCESS_KEY_ID && process.env.REMOTION_AWS_SECRET_ACCESS_KEY)
}

const LOOK = 'High-end cinematic corporate photography with a RICH, MOODY, PREMIUM grade — like a polished Apple or Bloomberg commercial. Dramatic but expensive-looking lighting, deep controlled shadows, sophisticated color, shallow depth of field, strong sense of place. Confident and modern, NOT bright flat stock photography and NOT depressing. Specific, editorial, characterful real scenes — avoid generic stock-photo clichés. Stay strictly ON TOPIC for the described subject. AVOID: cheesy stock smiles, candlelit/antique/castle/vintage settings, lone sad figures, anything melancholy or off-story. Photoreal, NOT illustration. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, charts, or logos.'

const BUCKET = 'videos'

// TTS for the Lambda path. Uses the SHARED engine (ElevenLabs primary → OpenAI
// fallback, with retries + money/percent normalization) — same as the VPS path.
// The old version called OpenAI directly with NO fallback, so an OpenAI 429
// killed the whole render at the narration step even though ElevenLabs is the
// configured voice. Routes through synthesizeSpeech so both paths behave alike.
async function tts(text: string, voiceId: string): Promise<Buffer> {
  return synthesizeSpeech(text || ' ', voiceId || 'nova')
}

/** Art-direct each scene (cinematographer step) — one Gemini-flash call returns
 *  a bespoke, on-story image prompt per scene. Falls back to title prompts. */
async function artDirectScenes(scenes: { title: string; narration: string }[]): Promise<string[]> {
  const fallback = scenes.map((s) => `A real, professional business scene clearly illustrating: "${(s.title || s.narration || 'business concept').slice(0, 160)}".`)
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
    const brief = scenes.map((s, i) => `${i}: ${s.title || ''} — ${(s.narration || '').slice(0, 160)}`).join('\n')
    const sys = 'You are a cinematographer for a PREMIUM, high-end corporate explainer video with a RICH, MOODY, cinematic look (think Apple/Bloomberg commercial). For each numbered scene, write ONE specific photographic image prompt describing a real ON-TOPIC business scene: subject, modern setting, dramatic expensive-looking lighting, deep controlled shadows, confident composition, strong sense of place. Sophisticated and modern — NOT bright flat stock photography, NOT cheesy stock smiles, NOT vintage/candlelit/sad. Be specific and editorial to avoid generic-stock clichés. No text/logos. Return ONLY a JSON array of strings, one per scene, same order.'
    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `${sys}\n\nSCENES:\n${brief}` }] }],
    } as any)
    const text = (r.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('')
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1))
    if (Array.isArray(arr) && arr.length === scenes.length) return arr.map((x: any, i: number) => String(x || fallback[i]))
    return fallback
  } catch { return fallback }
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

  // Art-direct all scenes up front (cinematographer step) for bespoke on-story prompts.
  const artPrompts = await artDirectScenes(payload.scenes.map((s) => ({ title: s.title, narration: s.narration })))

  // 1) Build scenes with PUBLIC asset URLs (Lambda fetches these over HTTP).
  const previews: { idx: number; url: string }[] = []
  const outScenes: any[] = []
  for (let i = 0; i < payload.scenes.length; i++) {
    const s = payload.scenes[i]
    const audioBuf = await tts(s.narration || s.title || ' ', voiceId)
    const durationInFrames = estimateFrames(audioBuf)
    const audioUrl = await uploadPublic(admin, `${userId}/${videoId}_a${i}.mp3`, audioBuf, 'audio/mpeg')

    await setProgress(30 + Math.round((i / payload.scenes.length) * 40), `Painting scene ${i + 1}/${payload.scenes.length}...`)
    // Use the art-directed per-scene prompt (cinematographer step).
    const imgPrompt = artPrompts[i] || `A real, professional business scene clearly illustrating: "${(s.title || s.narration || 'business concept').slice(0, 180)}".`
    const imgBuf = await geminiBg(imgPrompt)
    let imageUrl: string | undefined
    if (imgBuf) {
      imageUrl = await uploadPublic(admin, `${userId}/${videoId}_s${i}.png`, imgBuf, 'image/png')
      previews.push({ idx: i, url: imageUrl })
      await admin.from('videos').update({ preview_thumbs: previews, progress_updated_at: new Date().toISOString() }).eq('id', videoId).then(() => {}, () => {})
    }
    const isEnd = i === 0 || i === payload.scenes.length - 1
    const isLast = i === payload.scenes.length - 1
    const sceneMetrics = (s.metrics || []).filter((x) => x && x.label && x.value && /\d/.test(x.value)).slice(0, 3)
    const placement = isEnd ? 'center' : ['bottom', 'left', 'right', 'bottom'][i % 4]
    // PowerPoint-style bullets for middle scenes (metric bullets + text bullets).
    const textBullets = (s.bullets || []).slice(0, 2).map((b) => ({ text: String(b) }))
    const metricBullets = sceneMetrics.map((x) => ({ text: x.label, value: x.value }))
    const bullets = !isEnd ? [...metricBullets, ...textBullets].slice(0, 4) : []
    // Closing scene shows the contact line (item 6).
    const body = (isLast && payload.contactLine) ? payload.contactLine : s.bullets?.[0]
    outScenes.push({
      title: s.title || '', body,
      ...(imageUrl ? { image: imageUrl } : {}),
      audio: audioUrl, durationInFrames, placement,
      ...(bullets.length ? { bullets } : {}),
      // A hero-number scene shows ONE giant figure instead of bullets/metrics.
      ...((s as any).heroMetric ? { heroMetric: (s as any).heroMetric } : {}),
    })
  }

  // Background music (item 3): get a music URL (provided or Lyria-gen), upload it
  // public, and pass it as the `music` prop — V3Video plays it low under the VO.
  let musicUrl: string | undefined
  if (payload.musicUrl) {
    musicUrl = payload.musicUrl
  } else if (payload.aiMusic || payload.musicPrompt) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
      const mPrompt = payload.musicPrompt || 'Create background music. Instrumental only, no vocals. Upbeat, polished, modern corporate presentation music — piano, light synth, soft percussion. Fade out at the end.'
      // lyria-3-pro-preview + string contents (matches the working pipeline).
      const mr: any = await ai.models.generateContent({ model: 'lyria-3-pro-preview', contents: mPrompt } as any).catch(() => null)
      const parts = mr ? (mr.candidates?.[0]?.content?.parts ?? []) : []
      const part = parts.find((p: any) => p.inlineData && (p.inlineData.mimeType?.includes('audio') || p.inlineData.mimeType?.includes('mpeg')))
      if (part) musicUrl = await uploadPublic(admin, `${userId}/${videoId}_music.mp3`, Buffer.from(part.inlineData.data, 'base64'), 'audio/mpeg')
    } catch { /* music best-effort */ }
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
    ...(payload.frame ? { frame: payload.frame } : {}),
    ...(payload.logo?.light || payload.logo?.dark ? { logo: { light: payload.logo.light, dark: payload.logo.dark }, logoChip: !!payload.logo.chip } : {}),
    ...(musicUrl ? { music: musicUrl } : {}),
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
