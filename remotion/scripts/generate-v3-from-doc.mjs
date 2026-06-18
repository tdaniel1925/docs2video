/**
 * PDF/document -> V3 video generator. The data-grounded sibling of
 * generate-v3.mjs: instead of inventing a script from a topic, this reads REAL
 * ExtractedData (the output of the live /extract-document endpoint) and writes
 * a script that uses ONLY the facts in that data — no fabrication. This is the
 * end-to-end PDF->V3 test path.
 *
 *   extracted.json (ExtractedData) -> Claude writes an N-scene script grounded
 *   in the real data -> Gemini full-bleed image per scene -> OpenAI TTS per
 *   scene (+probe duration) -> writes public/v3.json
 *
 * Usage: node scripts/generate-v3-from-doc.mjs <path-to-extracted.json> [sceneCount]
 * Keys read from ../.env.local (ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY).
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')

const DOC_PATH = process.argv[2]
const COUNT = parseInt(process.argv[3] || '8', 10)
if (!DOC_PATH) { console.error('Usage: node scripts/generate-v3-from-doc.mjs <extracted.json> [sceneCount]'); process.exit(1) }

// Same cinematic "look bible" as generate-v3.mjs so all scenes feel like one film.
const LOOK = 'Cinematic film still, shot on 35mm anamorphic lens, shallow depth of field f/1.4, dramatic low-key lighting with strong rim light and volumetric haze, muted moody color grade with deep teal shadows and warm highlights, subtle film grain, gentle lens bloom, rule-of-thirds composition with deliberate negative space, foreground bokeh for depth, premium editorial mood. Photoreal, NOT illustration, NOT flat stock photography. 16:9, fills 1920x1080. ABSOLUTELY NO text, words, letters, numbers, charts, or logos anywhere.'

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

// Turn ExtractedData into a compact, faithful brief for the scriptwriter.
function dataBrief(d) {
  const lines = []
  if (d.title) lines.push(`TITLE: ${d.title}`)
  if (d.subtitle) lines.push(`SUBTITLE: ${d.subtitle}`)
  if (d.companyName) lines.push(`COMPANY: ${d.companyName}`)
  if (d.industry) lines.push(`INDUSTRY: ${d.industry}`)
  if (d.source) lines.push(`SOURCE: ${d.source}`)
  if (Array.isArray(d.keyMetrics) && d.keyMetrics.length)
    lines.push('KEY METRICS:\n' + d.keyMetrics.map((m) => `  - ${m.label}: ${m.value}${m.qualifier ? ` (${m.qualifier})` : ''}`).join('\n'))
  if (Array.isArray(d.sections) && d.sections.length)
    lines.push('SECTIONS:\n' + d.sections.map((s) => `  ## ${s.title}\n  ${s.content}`).join('\n'))
  if (Array.isArray(d.bulletPoints) && d.bulletPoints.length)
    lines.push('KEY POINTS:\n' + d.bulletPoints.map((b) => `  - ${b}`).join('\n'))
  if (Array.isArray(d.additionalNotes) && d.additionalNotes.length)
    lines.push('NOTES:\n' + d.additionalNotes.map((n) => `  - ${n}`).join('\n'))
  return lines.join('\n\n')
}

async function writeScript(brief) {
  const anthropic = new Anthropic({ apiKey: await env('ANTHROPIC_API_KEY') })
  const sys = `You are a video scriptwriter AND a cinematographer. You are given the EXTRACTED CONTENT of a real document. Write a ${COUNT}-scene explainer video that presents THIS document's actual content for a professional/corporate audience.

CRITICAL FACTUAL RULES:
- Use ONLY facts, numbers, names, and claims that appear in the provided content. Do NOT invent statistics, dollar amounts, dates, or product names.
- If the document has metrics, feature at least one of them on a metric-style scene (put the real number in "body").
- If a fact is not in the content, do not state it. Never fabricate to fill a scene.

Return ONLY JSON (no fences): an array of ${COUNT} objects, each: {"eyebrow": short label (2-3 words), "title": punchy on-screen headline (3-7 words), "accentWord": the 0-based index of the ONE word in the title to emphasize, "body": one short supporting line drawn from the real content (max 14 words, shown on screen), "narration": 1-2 spoken sentences (warm, confident, human, no greetings, grounded in the real content), "imagePrompt": a SPECIFIC, evocative description of a single CINEMATIC background scene — describe subject, lighting, camera angle, and mood like a film director. A real photographic MOMENT, not generic stock. Each scene visually distinct. The imagery sets MOOD for the topic; it must contain NO text/numbers/logos}. Scene 1 = hook/cover (use the document title/subject), last scene = call to action.`
  const resp = await anthropic.messages.create({
    model: 'claude-opus-4-8', max_tokens: 4000, thinking: { type: 'adaptive' },
    system: sys,
    messages: [{ role: 'user', content: `EXTRACTED DOCUMENT CONTENT:\n\n${brief}` }],
  })
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
  return JSON.parse(json)
}

async function main() {
  await mkdir(PUBLIC, { recursive: true })
  const data = JSON.parse(await readFile(resolve(DOC_PATH), 'utf8'))
  const brief = dataBrief(data)
  console.log(`Source doc: "${data.title || 'untitled'}" — ${brief.length} chars of brief`)
  console.log(`Writing ${COUNT}-scene grounded script...`)
  const script = await writeScript(brief)
  console.log(`Got ${script.length} scenes.`)

  const ai = new GoogleGenAI({ apiKey: await env('GEMINI_API_KEY') })
  const openaiKey = await env('OPENAI_API_KEY')
  const scenes = []

  for (let i = 0; i < script.length; i++) {
    const s = script[i]
    process.stdout.write(`Scene ${i + 1}: image... `)
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
    const tts = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: s.narration, response_format: 'mp3', speed: 0.98 }),
    })
    if (!tts.ok) throw new Error(`TTS scene ${i}: ${tts.status}`)
    const audioFile = `v3-${i}.mp3`
    await writeFile(join(PUBLIC, audioFile), Buffer.from(await tts.arrayBuffer()))
    const dur = await probe(join(PUBLIC, audioFile))
    const durationInFrames = Math.round((dur + 0.8) * 30)
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

  const brandName = data.companyName || data.title || 'Document'
  await writeFile(join(PUBLIC, 'v3.json'), JSON.stringify({ theme: THEME, brandName, scenes }, null, 2))
  console.log(`Wrote public/v3.json (${scenes.length} scenes, ${Math.round(scenes.reduce((a, b) => a + b.durationInFrames, 0) / 30)}s total)`)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
