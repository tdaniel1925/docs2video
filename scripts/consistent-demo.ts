import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const logoPath = String.raw`c:\Users\tdani\One World Dropbox\Trent Daniel\1 - BotMakers\Clients\Apex Affinity Group\Logos\Apex Affinity Grop Logo - Full Color PNG.png`
const outDir = path.join(process.cwd(), 'public', 'consistent-demo')

// ONE style definition used across ALL slides
const STYLE = `Modern corporate illustration style. Deep navy blue (#1B365D) background. Gold (#C9A84C) accent elements. Clean flat design with subtle depth and soft shadows. Minimal, professional, premium. Consistent color palette across every frame — navy dominates, gold highlights key elements. Icons and visual elements use thin gold line art on navy. Typography is large, bold, white. Think: premium financial services brand deck, not a children's book.`

const slides = [
  {
    name: '01-cover',
    prompt: `${STYLE} This is a COVER/TITLE frame. Full navy blue (#1B365D) background with subtle geometric patterns — thin gold lines forming abstract angular shapes. A central focal area that is clean navy (no busy elements) where a logo will be placed via overlay. Subtle gold light rays emanating from center. NO TEXT NO LOGOS NO WORDS. 1920x1080 landscape.`,
    type: 'cover' as const,
    title: 'Understanding Your Life Insurance Policy',
    subtitle: 'A Personalized Video Presentation',
  },
  {
    name: '02-welcome',
    prompt: `${STYLE} Content slide. Navy blue background. Scene: An open golden doorway in the center with warm light streaming through, symbolizing opportunity. Small gold icons flanking the door: family silhouette, shield, growing tree. Bold white headline at top: "Your Financial Future Starts Here". White subtitle: "Personalized Protection for What Matters Most". Clean, balanced layout. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '03-protection',
    prompt: `${STYLE} Content slide. Navy blue background. Scene: A large golden shield in center-left with a family silhouette inside it. Right side has the data: Bold white headline "Protection That Lasts". Massive gold number "$500,000" with white label "Death Benefit" below. Three gold-bordered stat boxes at bottom: "30-Year Term" | "$45/month" | "Guaranteed Coverage". Clean data visualization. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '04-growth',
    prompt: `${STYLE} Content slide. Navy blue background. Scene: A gold money tree growing from coins on the left, branches with dollar-sign leaves. An upward-trending gold chart line behind it. Right side data: Bold white headline "Cash Value Growth". Large gold "4.2%" with "Annual Growth Rate" below. Two stat boxes: "$127,000 by Year 20" | "Tax-Deferred Accumulation". Clean layout. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '05-benefits',
    prompt: `${STYLE} Content slide. Navy blue background. Bold white headline at top: "Built-In Benefits". Four equal cards in a 2x2 grid, each with a gold icon and white text: Top-left: heart icon + "Living Benefits". Top-right: shield icon + "Waiver of Premium". Bottom-left: clock icon + "Accelerated Death Benefit". Bottom-right: arrows icon + "Conversion Option". Cards have subtle gold borders on navy. Clean, organized. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '06-closing',
    prompt: `${STYLE} This is a CLOSING frame. Full navy blue (#1B365D) background matching the cover exactly. Same subtle geometric gold line patterns as the cover. A central focal area that is clean navy where a logo and contact text will be placed via overlay. Warm gold accent at bottom. Mirror the cover's design language. NO TEXT NO LOGOS NO WORDS. 1920x1080 landscape.`,
    type: 'closing' as const,
    title: 'Thank You',
    subtitle: 'Ready to take the next step?',
    contact: 'www.apexaffinity.com  ·  (800) 555-1234  ·  info@apexaffinity.com',
  },
]

async function makeLogoWhite(logoBuf: Buffer): Promise<Buffer> {
  // Tint logo to white while preserving transparency
  return sharp(logoBuf)
    .resize(500, null, { fit: 'inside', withoutEnlargement: false })
    .tint({ r: 255, g: 255, b: 255 })
    .png()
    .toBuffer()
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const logoBuffer = fs.readFileSync(logoPath)

  // Pre-make white logo
  const whiteLogo = await makeLogoWhite(logoBuffer)
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

      // Resize to exact 1920x1080
      imgBuf = Buffer.from(await sharp(imgBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer())

      // Composite logo + text for cover/closing
      if (slide.type === 'cover' || slide.type === 'closing') {
        const logoTop = Math.round((1080 - lh) / 2) - 80
        const composites: sharp.OverlayOptions[] = []

        // Logo-shaped shadow (logo tinted black + blurred)
        const shadowLogo = Buffer.from(await sharp(logoBuffer)
          .resize(500, null, { fit: 'inside', withoutEnlargement: false })
          .tint({ r: 0, g: 0, b: 0 })
          .ensureAlpha(0.5)
          .blur(12)
          .png()
          .toBuffer())

        composites.push({
          input: shadowLogo,
          top: logoTop + 4,
          left: Math.round((1920 - lw) / 2) + 4,
        })

        // White logo
        composites.push({
          input: whiteLogo,
          top: logoTop,
          left: Math.round((1920 - lw) / 2),
        })

        // Title text
        const textY = logoTop + lh + 40
        let svgParts = `<text x="960" y="${textY}" font-family="Arial,sans-serif" font-size="34" font-weight="800" fill="white" text-anchor="middle" letter-spacing="1">${slide.title}</text>`
        svgParts += `<text x="960" y="${textY + 40}" font-family="Arial,sans-serif" font-size="20" font-weight="500" fill="white" opacity="0.75" text-anchor="middle">${slide.subtitle}</text>`

        if (slide.contact) {
          const contactY = textY + 90
          svgParts += `<rect x="410" y="${contactY - 20}" width="1100" height="40" rx="6" fill="rgba(255,255,255,0.1)"/>`
          svgParts += `<text x="960" y="${contactY + 5}" font-family="Arial,sans-serif" font-size="16" font-weight="500" fill="white" opacity="0.7" text-anchor="middle">${slide.contact}</text>`
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

  console.log('\nAll done! Check public/consistent-demo/')
}

main().catch(console.error)
