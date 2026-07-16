/**
 * Generate abstract, non-literal Gemini backdrops for the commercial demo.
 * Soft/blurred/dark — decorative only, so no text-fidelity risk. One hero
 * backdrop + a couple of tonal variants for per-section palette shifts.
 * Run: npx tsx scripts/gen-commercial-bg.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { GoogleGenAI } from '@google/genai'
import { writeFileSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

const BGS = [
  { file: 'bg-hero.png', prompt: 'Abstract dark cinematic background, deep navy-to-black gradient with soft out-of-focus teal and mint bokeh light orbs, subtle volumetric haze, faint diagonal light streaks, premium tech commercial aesthetic. NO text, NO objects, NO logos. Very dark overall so white text reads on top. Moody, atmospheric, high-end. 16:9.' },
  { file: 'bg-warm.png', prompt: 'Abstract dark cinematic background, deep charcoal with soft out-of-focus warm amber and orange bokeh glow in the lower area, subtle haze, moody. NO text, NO objects. Very dark so white text is legible on top. 16:9.' },
  { file: 'bg-mint.png', prompt: 'Abstract dark cinematic background, near-black with a soft mint-green glow rising from the bottom center, faint particle bokeh, volumetric light, premium and calm. NO text, NO objects. Very dark overall. 16:9.' },
]

async function one(spec: { file: string; prompt: string }, attempt = 1): Promise<void> {
  try {
    const res = await genai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: spec.prompt }] }],
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } } as any,
    })
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
    if (!part) throw new Error('no image: ' + JSON.stringify(res.candidates?.[0]?.finishReason))
    writeFileSync(join(OUT, spec.file), Buffer.from(part.inlineData!.data!, 'base64'))
    console.log('OK  ' + spec.file)
  } catch (e) {
    if (attempt < 3) { await new Promise(r => setTimeout(r, 5000)); return one(spec, attempt + 1) }
    console.error('FAIL ' + spec.file + ': ' + (e instanceof Error ? e.message.slice(0, 150) : e))
  }
}

;(async () => { for (const b of BGS) await one(b); console.log('done') })()
