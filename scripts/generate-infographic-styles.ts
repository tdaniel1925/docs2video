/**
 * Generate 5 creative infographic slide styles using Gemini.
 * Run: npx tsx scripts/generate-infographic-styles.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const MODEL = 'gemini-3-pro-image-preview'
const outDir = path.join(process.cwd(), 'teaser-output', 'infographic-styles')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const CONTENT = `
CONTENT TO DISPLAY:
- Company: "Apex Affinity Group" (top-left with star logo accent)
- Headline: "YOUR IUL POLICY BENEFITS"
- 4 key metrics with icons:
  * Death Benefit: $500,000
  * Monthly Premium: $350
  * Cash Value Year 10: $47,200
  * Guaranteed Floor: 0% (never lose money)
- 3 feature highlights:
  * Tax-free retirement income
  * Living benefits included
  * Flexible premium payments
- Footer: www.apexaffinitygroup.com | (480) 725-4677
- Brand colors: primary navy (#1B2D5B), secondary red (#C62828)
- 1920x1080 landscape, fill entire canvas
- Maximum 25 words of visible text — big numbers, short labels, icons
`

const styles = [
  {
    name: '1-isometric-3d',
    label: 'Isometric 3D',
    prompt: `STYLE: Isometric 3D infographic design. Data visualized as colorful 3D isometric buildings, charts, and objects floating on a clean white surface. Each metric is represented by a different 3D element — stacked coins for money, a shield tower for protection, a growing plant for cash value. Soft shadows, vibrant but professional color palette. Isometric grid layout. Think Slack/Asana marketing illustrations meets data dashboard. Playful but corporate.\n\n${CONTENT}`,
  },
  {
    name: '2-neon-dashboard',
    label: 'Neon Dashboard',
    prompt: `STYLE: Neon data dashboard on dark background. Pure black (#0a0a0a) background with glowing neon data visualizations — circular progress rings, glowing bar charts, pulsing metric cards. Neon blue (#00d4ff) and electric pink (#ff2d7a) accent colors with subtle glow effects. Data displayed in sleek rounded cards with thin neon borders. Futuristic HUD-style layout. Feels like a sci-fi command center dashboard — Tron meets Bloomberg Terminal.\n\n${CONTENT}`,
  },
  {
    name: '3-editorial-magazine',
    label: 'Editorial Magazine',
    prompt: `STYLE: High-end editorial magazine layout. Elegant asymmetric composition with a large hero number on the left, supporting data in a column on the right. Mix of serif headlines (bold, impactful) and clean sans-serif body text. Sophisticated color palette — deep navy background with cream/off-white text and copper (#b87333) accent highlights. Thin rule lines separating sections. Pull-quote style feature callouts. Feels like The Economist or Bloomberg Businessweek — editorial authority meets data storytelling.\n\n${CONTENT}`,
  },
  {
    name: '4-paper-cutout',
    label: 'Paper Cutout / Layered',
    prompt: `STYLE: Layered paper cutout infographic design. Elements appear as stacked paper layers with realistic shadows between them — cards, tabs, and panels at different depths. Soft pastel accent colors (mint green, coral, light blue) on white paper backgrounds. Rounded shapes, friendly icons with thick outlines. Data in circular badges and pill-shaped labels. Subtle paper texture. Feels like a premium Dribbble design — Material Design meets handcrafted paper art. Warm, approachable, trustworthy.\n\n${CONTENT}`,
  },
  {
    name: '5-blueprint-technical',
    label: 'Blueprint Technical',
    prompt: `STYLE: Technical blueprint infographic design. Deep blue (#0d1b2a) background with white and cyan (#00b4d8) line work — like an engineering blueprint or architectural drawing. Data connected by thin dotted lines and arrows showing relationships. Metrics in circular gauges and technical readout displays. Monospace font for numbers, clean sans-serif for labels. Grid lines visible in background. Corner registration marks. Feels like a NASA mission control display or engineering spec sheet — precise, technical, authoritative.\n\n${CONTENT}`,
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
  console.log('Generating 5 creative infographic styles...\n')
  for (const style of styles) {
    await generateStyle(style)
  }
  console.log(`\nDone! Open: ${outDir}`)
}

main().catch(console.error)
