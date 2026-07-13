/**
 * TEXT-TO-COMMERCIAL autopilot. Topic in → finished video out.
 *   1. WRITER (Claude): topic → structured shot script (narration + scene intent)
 *   2. DIRECTOR (Claude): scenes + available visual sources → full production plan
 *      (visual source, camera move, text treatment, transitions per scene)
 *   3. ASSETS: generate what the plan needs (Gemini stills), synth VO (ElevenLabs)
 *   4. RENDER: the Remotion DirectedVideo composition consumes the plan JSON
 *
 * Run: npx tsx scripts/director/make-video.ts "how to get started in life insurance"
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { writeFileSync } from 'fs'
import { join } from 'path'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const PUB = join(__dirname, '..', '..', 'remotion', 'public')
const topic = process.argv.slice(2).join(' ') || 'how to get started in the life insurance business'

// visual sources the director may choose from (Veo intentionally omitted for
// cost in this first run; it plugs in here as another 'type').
const VISUAL_SOURCES = `
- "gemini": generate an original photorealistic image. Provide an image "prompt". Use for scenes needing a specific depicted scene we don't have footage for.
- "kinetic": pure animated typography on a shader/gradient backdrop, no image. Use for hooks, big statements, numbered steps, stats, the close.
`
const CAMERA_MOVES = `"pushIn" (slow zoom to a focal point), "kenBurns" (drift+zoom across an image), "pullBack" (reveal), "static-alive" (locked but breathing). Kinetic scenes ignore camera.`
const ENTRANCES = `"rise", "wipe", "punchIn", "typewriter", "wordPan" (fast pan), "assemble" (per-char). Vary them — NEVER the same entrance twice in a row.`

async function writer(): Promise<any> {
  const sys = `You are a commercial SCRIPTWRITER. Write a ~30-second educational/promotional video script on the given topic. Return ONLY JSON:
{
  "title": "...",
  "voice_tone": "one line describing the VO delivery",
  "scenes": [
    { "id": 1, "beat": "hook|context|step|payoff|cta", "narration": "what the voice says (1 sentence, spoken, natural)", "on_screen": "the SHORT headline text for this scene (2-5 words)", "intent": "what this scene should SHOW/FEEL" }
  ]
}
Rules: 6-8 scenes. Scene 1 = a hook. Last scene = a call to action. The narration across scenes must flow as ONE story with real transitions, not disconnected blurbs. Ground it in genuinely useful, accurate steps for the topic. No invented statistics or company names.`
  const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 3000, system: sys, messages: [{ role: 'user', content: `Topic: ${topic}` }] })
  return JSON.parse(extract((r.content[0] as any).text))
}

async function director(script: any): Promise<any> {
  const sys = `You are the DIRECTOR of a commercial. Given the writer's scenes, decide the VISUAL PRODUCTION for each. Return ONLY JSON:
{ "palette": { "bg": "#hex deep dark", "accent": "#hex", "accent2": "#hex", "text": "#f4f6fb" },
  "scenes": [ { "id": 1, "visual": { "type": "gemini|kinetic", "prompt": "(gemini only) detailed photorealistic image prompt, dark/moody so text reads on top, NO text in image" }, "camera": "${'pushIn|kenBurns|pullBack|static-alive'}", "entrance": "rise|wipe|punchIn|typewriter|wordPan|assemble", "text_style": "big|lower-third|centered" } ] }
Visual sources: ${VISUAL_SOURCES}
Camera moves: ${CAMERA_MOVES}
Entrances (VARY, never repeat consecutively): ${ENTRANCES}
Direction rules: match the move to the message. Use "kinetic" for the hook, any step that's really a statement/number, and the CTA. Use "gemini" when a scene benefits from a depicted human/real scene (an advisor, a client meeting, studying, a handshake). Aim for a MIX — not all kinetic, not all image. Every gemini prompt must be dark/cinematic so white text stays legible. Choose ONE cohesive palette fitting the topic (insurance = trustworthy navy/gold or deep blue).`
  const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 3500, system: sys, messages: [{ role: 'user', content: JSON.stringify(script.scenes) }] })
  return JSON.parse(extract((r.content[0] as any).text))
}

function extract(t: string): string { const s = t.indexOf('{'); const e = t.lastIndexOf('}'); return t.slice(s, e + 1) }

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.32 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}`)
  writeFileSync(join(PUB, file), Buffer.from(await res.arrayBuffer()))
}

async function gemini(prompt: string, file: string, attempt = 1): Promise<void> {
  try {
    const res = await genai.models.generateContent({ model: process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview', contents: [{ role: 'user', parts: [{ text: prompt + ' Cinematic, photorealistic, dark and moody, 16:9. No text, no words, no logos.' }] }], config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } } as any })
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
    if (!part) throw new Error('no image')
    writeFileSync(join(PUB, file), Buffer.from(part.inlineData!.data!, 'base64'))
  } catch (e) { if (attempt < 3) { await new Promise(r => setTimeout(r, 4000)); return gemini(prompt, file, attempt + 1) } throw e }
}

async function main() {
  console.log(`\n▶ TOPIC: ${topic}\n`)
  console.log('[1/4] WRITER (Opus) → shot script...')
  const script = await writer()
  console.log(`      "${script.title}" — ${script.scenes.length} scenes`)
  script.scenes.forEach((s: any) => console.log(`      ${s.id}. [${s.beat}] ${s.on_screen} — "${s.narration.slice(0, 60)}..."`))

  console.log('\n[2/4] DIRECTOR (Opus) → production plan...')
  const plan = await director(script)
  console.log(`      palette: ${plan.palette.bg} / ${plan.palette.accent}`)
  plan.scenes.forEach((s: any) => console.log(`      ${s.id}. ${s.visual.type.padEnd(8)} cam=${s.camera || '-'} enter=${s.entrance}`))

  // merge writer + director into one production doc
  const doc = { title: script.title, palette: plan.palette, scenes: script.scenes.map((w: any, i: number) => ({ ...w, ...plan.scenes[i], visual: plan.scenes[i].visual })) }

  console.log('\n[3/4] Generating assets (VO + Gemini images)...')
  for (let i = 0; i < doc.scenes.length; i++) {
    const sc = doc.scenes[i]
    await tts(sc.narration, `dir-vo-${sc.id}.mp3`)
    if (sc.visual.type === 'gemini' && sc.visual.prompt) { await gemini(sc.visual.prompt, `dir-img-${sc.id}.png`); sc.visual.file = `dir-img-${sc.id}.png` }
    process.stdout.write(`      scene ${sc.id} ✓  `)
  }
  console.log('')

  writeFileSync(join(PUB, 'dir-plan.json'), JSON.stringify(doc, null, 2))
  console.log('\n[4/4] Wrote dir-plan.json — render with: npx remotion render DirectedVideo out/directed.mp4')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
