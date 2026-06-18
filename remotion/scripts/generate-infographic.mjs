/**
 * extracted.json (real ExtractedData) -> infographic.json for InfographicVideo.
 * Claude STRUCTURES the real data into scenes (metrics/steps/cards + narration),
 * using ONLY facts present in the source. No images (the infographic theme draws
 * its own visuals). OpenAI TTS per scene drives durations.
 *
 * Usage: node scripts/generate-infographic.mjs public/extracted.json [sceneCount]
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')
const DOC_PATH = process.argv[2] || join(PUBLIC, 'extracted.json')
const COUNT = parseInt(process.argv[3] || '8', 10)

const THEME = {
  name: 'Modern Fintech', ink: '#070D1A', inkSoft: '#0C1730',
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
function brief(d) {
  const L = []
  if (d.title) L.push(`TITLE: ${d.title}`)
  if (d.subtitle) L.push(`SUBTITLE: ${d.subtitle}`)
  if (d.companyName) L.push(`COMPANY: ${d.companyName}`)
  if (Array.isArray(d.keyMetrics)) L.push('METRICS:\n' + d.keyMetrics.map((m) => `  - ${m.label}: ${m.value}${m.highlight ? ' [highlight]' : ''}`).join('\n'))
  if (Array.isArray(d.sections)) L.push('SECTIONS:\n' + d.sections.map((s) => `  ## ${s.title}\n  ${s.content}`).join('\n'))
  if (Array.isArray(d.bulletPoints)) L.push('KEY POINTS:\n' + d.bulletPoints.map((b) => `  - ${b}`).join('\n'))
  return L.join('\n\n')
}

const SYS = `You structure a real document's extracted content into an animated INFOGRAPHIC video. Return ONLY JSON: an array of ${COUNT} scene objects.

Each scene has a "kind" that determines its visual:
- "hero": ONE dominant number. Fields: eyebrow, title, metrics:[{label,value}] (exactly 1), body (short support line).
- "kpis": 2-4 metric cards. Fields: eyebrow, title (a heading), metrics:[{label,value,highlight?}].
- "iconrow": exactly 3 small numeric metrics. Fields: eyebrow, title, metrics:[{label,value}].
- "timeline": an ordered process (2-6 steps). Fields: eyebrow, title, steps:[{label,sub?}].
- "cards": 1-3 descriptive points (NON-numeric). Fields: eyebrow, title, cards:[{title,body}].
- "statement": a plain headline (hook or CTA). Fields: eyebrow, title, body.

EVERY scene also has "narration": 1-2 warm, human spoken sentences (no greetings), grounded in the real content.

CRITICAL FACTUAL RULES:
- Use ONLY facts, numbers, names from the provided content. NEVER invent figures, dollar amounts, or product names.
- "value" strings keep their real units exactly as given (e.g. "$176,204", "$10,000/yr", "20 years", "100% S&P 500").
- Mark the 1-2 most important metrics highlight:true in kpis scenes.
- Scene 1 = a "statement" or "hero" hook using the document's subject. Last scene = a "statement" call to action.
- Prefer "kpis"/"hero"/"iconrow" for anything with numbers; "timeline" only for genuine sequences; "cards" for qualitative features/disclosures.
Return ONLY the JSON array, no prose, no code fences.`

async function main() {
  await mkdir(PUBLIC, { recursive: true })
  const data = JSON.parse(await readFile(resolve(DOC_PATH), 'utf8'))
  console.log(`Source: "${data.title}" — structuring ${COUNT} infographic scenes...`)
  const anthropic = new Anthropic({ apiKey: await env('ANTHROPIC_API_KEY') })
  const resp = await anthropic.messages.create({
    model: 'claude-opus-4-8', max_tokens: 5000, thinking: { type: 'adaptive' },
    system: SYS, messages: [{ role: 'user', content: `EXTRACTED DOCUMENT CONTENT:\n\n${brief(data)}` }],
  })
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1))
  console.log(`Got ${arr.length} scenes: ${arr.map((s) => s.kind).join(', ')}`)

  const openaiKey = await env('OPENAI_API_KEY')
  const scenes = []
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i]
    process.stdout.write(`Scene ${i + 1} (${s.kind}): tts... `)
    const tts = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: s.narration || s.title, response_format: 'mp3', speed: 0.98 }),
    })
    if (!tts.ok) throw new Error(`TTS scene ${i}: ${tts.status}`)
    const audioFile = `info-${i}.mp3`
    await writeFile(join(PUBLIC, audioFile), Buffer.from(await tts.arrayBuffer()))
    const dur = await probe(join(PUBLIC, audioFile))
    const durationInFrames = Math.round((dur + 0.9) * 30)
    const { narration, ...rest } = s
    scenes.push({ ...rest, audio: audioFile, durationInFrames })
    console.log(`done (${(dur + 0.9).toFixed(1)}s)`)
  }

  // Optional brand logo: a {light,dark,chip} object passed via the document JSON
  // under `brandLogo`, OR local logo-light.png/logo-dark.png in public/ for tests.
  // Production wires the brand's logo_light_url/logo_dark_url here.
  let logo, logoChip
  if (data.brandLogo?.light || data.brandLogo?.dark) {
    logo = { light: data.brandLogo.light, dark: data.brandLogo.dark }
    logoChip = !!data.brandLogo.chip
  } else if (existsSync(join(PUBLIC, 'logo-light.png'))) {
    logo = { light: 'logo-light.png', dark: existsSync(join(PUBLIC, 'logo-dark.png')) ? 'logo-dark.png' : undefined }
  }

  const out = { theme: THEME, brandName: data.companyName || data.title, ...(logo ? { logo, logoChip } : {}), scenes }
  await writeFile(join(PUBLIC, 'infographic.json'), JSON.stringify(out, null, 2))
  console.log(`Wrote public/infographic.json (${scenes.length} scenes, ${Math.round(scenes.reduce((a, b) => a + b.durationInFrames, 0) / 30)}s)`)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
