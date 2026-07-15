/**
 * Footage stills for the Apex VOX-STYLE ad. Vox layers motion-graphic
 * annotations (circles/arrows/highlights/callouts) over REAL, neutral,
 * documentary-looking media. So these images must be photojournalistic and
 * un-stylized — the annotations provide the energy + color.
 * Run: npx tsx scripts/gen-apexvox-assets.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { GoogleGenAI } from '@google/genai'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public', 'c-apexVOX')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const SPINE = `Photorealistic, documentary/editorial photography, natural lighting, realistic depth of field, neutral muted color grade, shot on a full-frame camera. Clean, un-stylized, journalistic — like a photo in a news explainer video. NO text overlays, NO graphics, NO logos, NO watermark. 16:9.`

const SHOTS: { id: string; prompt: string }[] = [
  { id: 'desk-chaos', prompt: `${SPINE} Over-the-shoulder view of an insurance agent at a desk buried under stacks of paper policy documents and multiple spreadsheets open on the monitor, cluttered, slightly overwhelmed. Warm office light. Shallow focus on the papers.` },
  { id: 'agent-think', prompt: `${SPINE} A mid-40s professional insurance agent sitting back at their desk, looking thoughtfully at a laptop, hand on chin, considering a decision. Modern small office, soft window light. Candid, real.` },
  { id: 'laptop-data', prompt: `${SPINE} Close-up of hands typing on a laptop at a clean desk, a coffee cup beside it, a blurred spreadsheet-like glow on the screen (no readable text). Calm, focused, morning light.` },
  { id: 'handshake', prompt: `${SPINE} An insurance agent shaking hands with a happy client family across a desk in a bright office, a deal closed, genuine smiles. Warm, aspirational, real people.` },
  { id: 'office-wide', prompt: `${SPINE} Wide establishing shot of a modern insurance agency office, a few agents working, big windows, plants, clean and professional, golden-hour light coming in.` },
]

async function gen(s: { id: string; prompt: string }) {
  const res = await genai.models.generateContent({
    model: IMAGE_MODEL, contents: s.prompt,
    config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } } as any,
  })
  const parts = res.candidates?.[0]?.content?.parts ?? []
  for (const p of parts) if (p.inlineData) { writeFileSync(join(OUT, `${s.id}.png`), Buffer.from(p.inlineData.data!, 'base64')); console.log(`[img] ${s.id}.png`); return }
  throw new Error(`no image for ${s.id}`)
}

async function main() {
  for (const s of SHOTS) { try { await gen(s) } catch (e) { console.error(`[img] ${s.id} FAILED:`, (e as Error).message) } }
  console.log('done')
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
