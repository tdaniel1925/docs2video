/**
 * Generate affiliate marketing banners with Gemini.
 * Brand: warm cream (#F4F1EC) + mint (#C7E8A8), Plus Jakarta Sans / Instrument
 * Serif, max 10px radius, NO fake logos. Outputs to public/affiliate/.
 *
 * Run: npx tsx scripts/generate-affiliate-banners.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
const outDir = path.join(process.cwd(), 'public', 'affiliate')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const BRAND = `BRAND STYLE (follow exactly):
- Product: Docs2Video — an app that turns documents (PDFs, web pages, notes) into polished explainer videos in minutes.
- Palette: warm cream background (#F4F1EC), soft mint green accents (#C7E8A8), deep charcoal/navy text (#1B2D3B). Optional muted peach (#E8A87C) as a secondary accent.
- Typography: clean modern geometric sans-serif for headlines (Plus Jakarta Sans feel); an elegant serif (Instrument Serif feel) may be used for a single accent word.
- Shapes: gentle rounded corners (small radius, ~8-10px), soft shadows, generous whitespace, friendly and premium — NOT corporate-cold, NOT neon, NOT dark.
- Visual motif: a document/page transforming into a play button / video frame. Subtle, tasteful iconography. A clean "play" triangle in a mint rounded square works well.
- Do NOT invent or draw any company logo, brand mark, phone number, email, or URL. Spell any visible words EXACTLY as given, no other text.`

const banners = [
  {
    name: 'banner-social-16x9',
    aspectRatio: '16:9' as const,
    prompt: `Design a polished social-share / link-preview banner for an affiliate to post.
Headline text (spell exactly): "Turn documents into videos"
Sub text (spell exactly): "in minutes"
A small mint rounded-square play button motif and an abstract page-to-video transformation illustration. Balanced composition, lots of warm cream space. Premium, inviting, modern.`,
  },
  {
    name: 'banner-square-4x3',
    aspectRatio: '4:3' as const,
    prompt: `Design a clean square-ish feed banner (Instagram/LinkedIn) for an affiliate.
Big headline text (spell exactly): "Docs → Videos"
Small sub text (spell exactly): "in minutes"
Centered composition with a document morphing into a video frame with a mint play button. Warm cream background, mint accents, friendly premium look.`,
  },
  {
    name: 'banner-story-9x16',
    aspectRatio: '9:16' as const,
    prompt: `Design a vertical mobile story banner (Instagram/TikTok story) for an affiliate to share.
Top headline text (spell exactly): "Make videos from any document"
Bottom call-to-action text (spell exactly): "Try Docs2Video"
Vertical flow: a stack of document pages at the top transforming downward into a glowing mint video frame with a play button at the bottom. Warm cream background, generous spacing, bold but elegant.`,
  },
]

async function generate(b: typeof banners[0]) {
  console.log(`Generating: ${b.name} (${b.aspectRatio})...`)
  try {
    const response = await genai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: `${b.prompt}\n\n${BRAND}` }] }],
      config: { responseFormat: { image: { aspectRatio: b.aspectRatio, imageSize: '4K' } } } as any,
    })
    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const p of parts) {
      if (p.inlineData) {
        const outPath = path.join(outDir, `${b.name}.png`)
        fs.writeFileSync(outPath, Buffer.from(p.inlineData.data!, 'base64'))
        console.log(`  ✓ ${outPath}`)
        return true
      }
    }
    console.log(`  ✗ No image returned for ${b.name}`)
    return false
  } catch (err: any) {
    console.error(`  ✗ Error (${b.name}): ${err.message?.slice(0, 160)}`)
    return false
  }
}

async function main() {
  console.log(`Generating ${banners.length} affiliate banners with ${MODEL}...\n`)
  for (const b of banners) await generate(b)
  console.log(`\nDone! Check ${outDir}`)
}

main().catch(console.error)
