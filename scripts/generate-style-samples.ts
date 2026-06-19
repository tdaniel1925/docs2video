/**
 * Generate 5 different slide style samples using Gemini.
 * Same content, different visual designs.
 * Run: npx tsx scripts/generate-style-samples.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const MODEL = 'gemini-3-pro-image-preview'
const outDir = path.join(process.cwd(), 'teaser-output', 'style-samples')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// Same content for all styles
const SAMPLE_CONTENT = `Create a professional presentation content slide.

CONTENT TO DISPLAY:
- Company name "Summit Financial Group" in the top-left
- Headline: "YOUR RETIREMENT AT A GLANCE"
- Key metrics in visual containers:
  * Total Portfolio: $1,250,000
  * Monthly Income: $6,200
  * Growth Rate: 7.2%
  * Years to Retirement: 12
- 3 bullet points:
  * Tax-advantaged growth strategy
  * Diversified across 4 asset classes
  * Protected floor on market downturns
- Footer bar with: www.summitfinancial.com | (480) 555-1234

Use brand colors: primary navy (#1B2D5B), secondary red (#C62828).
Maximum 25 words of visible text. Short labels and big numbers.
1920x1080 landscape. Fill the entire canvas.`

const styles = [
  {
    name: '1-glass-morphism',
    label: 'Glass Morphism',
    prompt: `STYLE: Modern glass morphism design. Frosted glass panels with blur effect floating over a deep gradient background (navy to dark blue). Translucent white containers with subtle borders. Soft glowing accents. Rounded corners on everything. Clean sans-serif typography. Data displayed in floating glass cards. Feels like a premium fintech dashboard — sleek, modern, Apple-inspired.\n\n${SAMPLE_CONTENT}`,
  },
  {
    name: '2-minimal-swiss',
    label: 'Minimal Swiss',
    prompt: `STYLE: Ultra-minimal Swiss design. Pure white background with maximum whitespace. Bold black headline typography (Helvetica-style). Data presented in a strict grid system with thin hairline dividers. Accent color used ONLY for key numbers (red). No gradients, no shadows, no decorative elements. Feels like a high-end design annual report — Dieter Rams meets financial services.\n\n${SAMPLE_CONTENT}`,
  },
  {
    name: '3-dark-executive',
    label: 'Dark Executive',
    prompt: `STYLE: Premium dark executive style. Rich charcoal (#1a1a2e) background with gold (#d4af37) accent highlights. Elegant serif headlines (Playfair-style). Data in sophisticated card layouts with thin gold borders. Subtle texture overlay. Key numbers in large gold text. Small decorative line accents. Feels like a luxury private banking presentation — Rolls Royce of slide decks.\n\n${SAMPLE_CONTENT}`,
  },
  {
    name: '4-gradient-modern',
    label: 'Gradient Modern',
    prompt: `STYLE: Bold gradient modern design. Background features a smooth gradient from deep navy (#0f0c29) through purple (#302b63) to blue (#24243e). Content in clean white text. Key metrics displayed in large bold numbers with subtle glow. Bullet points with small colorful gradient icons. Geometric accent shapes — circles, diagonal lines. Feels like a tech startup pitch deck — Stripe, Linear, Vercel aesthetic.\n\n${SAMPLE_CONTENT}`,
  },
  {
    name: '5-corporate-blocks',
    label: 'Corporate Color Blocks',
    prompt: `STYLE: Bold corporate color block design. White background with large solid color block sections — navy rectangles, red accent bars, light gray content areas. Strong geometric layout with clear zones. Flat design icons in colored circles. Headlines in extra-bold sans-serif. Data in colored stat cards arranged in a grid. Bottom bar in solid navy. Feels like a Fortune 500 quarterly report — McKinsey meets IBM design language.\n\n${SAMPLE_CONTENT}`,
  },
]

async function generateStyle(style: typeof styles[0]) {
  console.log(`Generating: ${style.label}...`)
  try {
    const response = await genai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: style.prompt }] }],
      config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } } as any,
    })
    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const p of parts) {
      if (p.inlineData) {
        const outPath = path.join(outDir, `${style.name}.png`)
        fs.writeFileSync(outPath, Buffer.from(p.inlineData.data!, 'base64'))
        console.log(`  ✓ ${outPath}`)
        return
      }
    }
    console.log(`  ✗ No image returned`)
  } catch (err: any) {
    console.error(`  ✗ Error: ${err.message?.slice(0, 100)}`)
  }
}

async function main() {
  console.log('Generating 5 slide style samples...\n')
  for (const style of styles) {
    await generateStyle(style)
  }
  console.log(`\nDone! Check ${outDir}`)
}

main().catch(console.error)
