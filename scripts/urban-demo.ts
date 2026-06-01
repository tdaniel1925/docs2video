import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const logoPath = String.raw`c:\Users\tdani\One World Dropbox\Trent Daniel\1 - BotMakers\Clients\Apex Affinity Group\Logos\Apex Affinity Grop Logo - Full Color PNG.png`
const outDir = path.join(process.cwd(), 'public', 'urban-demo')

const STYLE = `Urban gritty poster style. Jet black (#0A0A0A) background with gold (#C9A84C) dust particles, paint splatters, and distressed textures scattered across the frame. Bold mixed typography — large impactful sans-serif headings in off-white/cream (#F5F0E1), accent words in gold brush script. Raw, edgy, high-energy. Think street art meets luxury brand. Gold metallic accents, scratched textures, spray paint effects. Grungy but premium — like a high-end streetwear brand or music festival poster.`

const slides = [
  {
    name: '01-cover',
    prompt: `${STYLE} Cover frame. Pure black background with heavy gold dust/particle effects concentrated at edges and corners. Gold paint splatters and scratches. Center area relatively clean for a logo overlay. Subtle gold geometric lines or angular shapes in background. Raw energy. NO TEXT NO LOGOS NO WORDS. 1920x1080 landscape.`,
    type: 'cover' as const,
    title: 'Understanding Your Life Insurance Policy',
  },
  {
    name: '02-welcome',
    prompt: `${STYLE} Content slide. Black background with gold particles. Bold cream headline at top: "YOUR FUTURE STARTS NOW". Gold brush script accent underneath. Center: a stylized golden door or gateway with light streaming through, done in a gritty artistic style — not realistic, more like gold spray paint art. Small gold icons for family, shield, growth. Raw, powerful. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '03-protection',
    prompt: `${STYLE} Content slide. Black background with gold dust. Large cream headline: "PROTECTION THAT LASTS". Massive gold number "$500,000" dominating the frame, slightly distressed/textured. White label "DEATH BENEFIT" below. A golden shield shape with family silhouette inside, spray-paint style. Three stat blocks at bottom with gold borders: "30-YEAR TERM" | "$45/MONTH" | "GUARANTEED". Bold, impactful. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '04-growth',
    prompt: `${STYLE} Content slide. Black background with gold particles. Bold cream headline: "CASH VALUE GROWTH". Huge gold "4.2%" in distressed bold type. A stylized upward arrow or chart made of gold paint splatters. Gold coins and dollar signs scattered artistically. Stats: "$127,000 BY YEAR 20" and "TAX-DEFERRED" in white with gold accents. Raw energy, big numbers. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '05-benefits',
    prompt: `${STYLE} Content slide. Black background with gold dust. Bold cream headline: "BUILT-IN BENEFITS". Four benefit blocks in a grid, each with a gold icon and cream text on dark cards with gold borders: "LIVING BENEFITS" (heart) | "WAIVER OF PREMIUM" (shield) | "ACCELERATED DEATH BENEFIT" (clock) | "CONVERSION OPTION" (arrows). Gritty textures on each card. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '06-closing',
    prompt: `${STYLE} Closing frame. Black background matching the cover — same gold dust particles, same energy. Center area clean for logo overlay. Gold paint splatters at edges. Subtle gold line at bottom for contact info. Mirror the cover's design. NO TEXT NO LOGOS NO WORDS. 1920x1080 landscape.`,
    type: 'closing' as const,
    title: 'THANK YOU',
  },
]

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const logoBuffer = fs.readFileSync(logoPath)

  const whiteLogo = await sharp(logoBuffer)
    .resize(500, null, { fit: 'inside', withoutEnlargement: false })
    .tint({ r: 255, g: 255, b: 255 })
    .png()
    .toBuffer()
  const logoMeta = await sharp(whiteLogo).metadata()
  const lw = logoMeta.width || 500
  const lh = logoMeta.height || 200

  for (const slide of slides) {
    console.log(`Generating: ${slide.name}...`)
    try {
      const res = await genai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: 'Generate this image: ' + slide.prompt,
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      })

      let imgBuf: Buffer | null = null
      for (const part of res.candidates![0].content!.parts!) {
        if (part.inlineData) {
          imgBuf = Buffer.from(part.inlineData.data!, 'base64')
        }
      }
      if (!imgBuf) { console.log('  No image returned'); continue }

      imgBuf = Buffer.from(await sharp(imgBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer())

      if (slide.type === 'cover' || slide.type === 'closing') {
        const logoTop = Math.round((1080 - lh) / 2) - 60
        const composites: sharp.OverlayOptions[] = []

        // White logo
        composites.push({
          input: whiteLogo,
          top: logoTop,
          left: Math.round((1920 - lw) / 2),
        })

        // Title text
        const textY = logoTop + lh + 40
        const titleText = slide.title || ''
        const contactText = slide.type === 'closing' ? 'www.apexaffinity.com  ·  (800) 555-1234  ·  info@apexaffinity.com' : ''

        let svgParts = `<text x="960" y="${textY}" font-family="Arial Black,Arial,sans-serif" font-size="36" font-weight="900" fill="#F5F0E1" text-anchor="middle" letter-spacing="3">${titleText}</text>`
        if (slide.type === 'closing') {
          svgParts += `<text x="960" y="${textY + 50}" font-family="Arial,sans-serif" font-size="20" font-weight="600" fill="#C9A84C" text-anchor="middle">READY TO TAKE THE NEXT STEP?</text>`
          svgParts += `<rect x="410" y="${textY + 75}" width="1100" height="35" rx="4" fill="rgba(201,168,76,0.15)"/>`
          svgParts += `<text x="960" y="${textY + 98}" font-family="Arial,sans-serif" font-size="15" font-weight="500" fill="#C9A84C" opacity="0.8" text-anchor="middle">${contactText}</text>`
        }

        const textSvg = Buffer.from(`<svg width="1920" height="1080">${svgParts}</svg>`)
        composites.push({ input: textSvg, top: 0, left: 0 })

        imgBuf = Buffer.from(await sharp(imgBuf).composite(composites).png().toBuffer())
      }

      fs.writeFileSync(path.join(outDir, `${slide.name}.png`), imgBuf)
      console.log(`  Saved!`)
    } catch (e: any) {
      console.log(`  Failed: ${e.message?.slice(0, 150)}`)
    }
  }

  console.log('\nAll done! Check public/urban-demo/')
}

main().catch(console.error)
