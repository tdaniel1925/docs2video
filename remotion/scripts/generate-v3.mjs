/**
 * End-to-end v3 generator (the Remotion equivalent of the v1 pipeline):
 *   topic -> Claude writes an N-scene script -> Gemini full-bleed image per scene
 *   -> OpenAI TTS per scene (+probe duration) -> writes public/v3.json
 *
 * Usage: node scripts/generate-v3.mjs "Your topic here" [sceneCount]
 * Keys read from ../.env.local (ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY).
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')

const TOPIC = process.argv[2] || 'AI in the insurance market'
const COUNT = parseInt(process.argv[3] || '10', 10)

// Shared "look bible" appended to EVERY image prompt so all scenes feel like one
// film, not 10 random stock photos. This is what makes images read cinematic.
const LOOK = 'Cinematic film still, shot on 35mm anamorphic lens, shallow depth of field f/1.4, dramatic low-key lighting with strong rim light and volumetric haze, muted moody color grade with deep teal shadows and warm highlights, subtle film grain, gentle lens bloom, rule-of-thirds composition with deliberate negative space, foreground bokeh for depth, premium editorial mood. Photoreal, NOT illustration, NOT flat stock photography. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, charts, or logos anywhere.'

// Executive Light theme (corporate/insurance). Kept here so the JSON is self-contained.
const THEME = {
  name: 'Executive Light', ink: '#070D1A', inkSoft: '#0C1730',
  glass: 'rgba(120,170,255,0.06)', glassEdge: 'rgba(120,170,255,0.22)',
  textPrimary: '#EAF2FF', textMuted: '#8FA6C8',
  accents: ['#3B82F6', '#22D3EE', '#8B5CF6'], mode: 'dark',
}

async function env(name) {
  if (process.env[name]) return process.env[name]
  const e = await readFile(join(ROOT, '..', '.env.local'), 'utf8')
  const m = e.match(new RegExp('^' + name + '=(.+)$', 'm'))
  if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  throw new Error(`${name} not found`)
}

function probe(file) {
  return new Promise((res) => execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 10000 }, (e, o) => {
    const d = parseFloat((o || '').trim()); res(Number.isFinite(d) && d > 0 ? d : 0)
  }))
}

async function writeScript() {
  const anthropic = new Anthropic({ apiKey: await env('ANTHROPIC_API_KEY') })
  const sys = `You are a video scriptwriter AND a cinematographer. Write a ${COUNT}-scene explainer video about the given topic for a professional/corporate audience. Return ONLY JSON (no fences): an array of ${COUNT} objects, each: {"eyebrow": short label (2-3 words), "title": punchy on-screen headline (3-7 words), "accentWord": the index (0-based) of the ONE word in the title to emphasize, "body": one short supporting line (max 14 words, shown on screen), "narration": 1-2 spoken sentences (warm, confident, human, no greetings), "imagePrompt": a SPECIFIC, evocative description of a single CINEMATIC scene for the background — describe the subject, the lighting, the camera angle, and the mood like a film director (e.g. "a lone analyst silhouetted against glowing data screens in a dark room, dramatic blue rim light, seen from a low angle"). Make it a real photographic MOMENT, not a generic stock concept. Each scene's imagery must be visually distinct from the others}. Scene 1 = hook/cover, last scene = call to action.`
  const resp = await anthropic.messages.create({
    model: 'claude-opus-4-8', max_tokens: 4000, thinking: { type: 'adaptive' },
    system: sys,
    messages: [{ role: 'user', content: `Topic: ${TOPIC}` }],
  })
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
  return JSON.parse(json)
}

async function main() {
  await mkdir(PUBLIC, { recursive: true })
  console.log(`Writing ${COUNT}-scene script for: ${TOPIC}`)
  const script = await writeScript()
  console.log(`Got ${script.length} scenes.`)

  const ai = new GoogleGenAI({ apiKey: await env('GEMINI_API_KEY') })
  const openaiKey = await env('OPENAI_API_KEY')
  const scenes = []

  for (let i = 0; i < script.length; i++) {
    const s = script[i]
    process.stdout.write(`Scene ${i + 1}: image... `)
    // image
    let imgFile = `v3-${i}.png`
    let imgOk = false
    for (let a = 1; a <= 3 && !imgOk; a++) {
      try {
        const r = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: `${s.imagePrompt}\n\n${LOOK}` }] }],
          config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '2K' } } },
        })
        const img = (r.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData)
        if (!img) throw new Error('no image')
        await writeFile(join(PUBLIC, imgFile), Buffer.from(img.inlineData.data, 'base64'))
        imgOk = true
      } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 3000 * a)) }
    }
    process.stdout.write('tts... ')
    // narration
    const tts = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: s.narration, response_format: 'mp3', speed: 0.98 }),
    })
    if (!tts.ok) throw new Error(`TTS scene ${i}: ${tts.status}`)
    const audioFile = `v3-${i}.mp3`
    await writeFile(join(PUBLIC, audioFile), Buffer.from(await tts.arrayBuffer()))
    const dur = await probe(join(PUBLIC, audioFile))
    const durationInFrames = Math.round((dur + 0.8) * 30)
    // Main slides (first = hook, last = CTA) centered so they land hard;
    // supporting scenes rotate through varied placements.
    const isMain = i === 0 || i === script.length - 1
    const variety = ['bottom', 'left', 'bottom', 'right', 'center', 'left', 'bottom', 'right']
    const placement = isMain ? 'center' : variety[i % variety.length]
    scenes.push({
      eyebrow: s.eyebrow, title: s.title, body: s.body,
      accentWordIndex: typeof s.accentWord === 'number' ? s.accentWord : undefined,
      image: imgFile, audio: audioFile, durationInFrames, placement,
    })
    console.log(`done (${(dur + 0.8).toFixed(1)}s)`)
  }

  await writeFile(join(PUBLIC, 'v3.json'), JSON.stringify({ theme: THEME, brandName: TOPIC, scenes }, null, 2))
  console.log(`Wrote public/v3.json (${scenes.length} scenes, ${Math.round(scenes.reduce((a, b) => a + b.durationInFrames, 0) / 30)}s total)`)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
