import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const logoPath = String.raw`c:\Users\tdani\One World Dropbox\Trent Daniel\1 - BotMakers\Clients\Apex Affinity Group\Logos\Apex Affinity Grop Logo - Full Color PNG.png`
const outDir = path.join(process.cwd(), 'public', 'flash31-demo')

const slides = [
  {
    name: 'cover-bg',
    prompt: `Create a stunning vibrant illustrated background for a premium video title card. 1920x1080 landscape. Deep navy blue (#1B365D) as primary color, red (#CC0000) as accent, warm golden light. Rich depth, layered composition with abstract geometric shapes, light rays, and a star motif. The CENTER of the image should be slightly lighter and clearer — a natural focal point where a logo will be placed. Cinematic, inspiring, premium. NO TEXT NO LOGOS NO WORDS NO BRAND NAMES. Pure illustrated artwork.`,
    iscover: true,
  },
  {
    name: 'slide-welcome',
    prompt: `Create a professional illustrated infographic for a video presentation. 1920x1080 landscape. Style: Modern corporate with deep navy blue (#1B365D) dominant, warm gold accents. Scene: A welcoming opening — a grand doorway opening to reveal a golden sunrise, symbolizing new possibilities. Bold headline at top: "Your Financial Future Starts Here". Subtitle: "Personalized Protection for What Matters Most". Beautiful icons of a family, shield, and growing tree integrated into the design. Premium, warm, inviting. Leave bottom 100px dark for branding bar.`,
    iscover: false,
  },
  {
    name: 'slide-protection',
    prompt: `Create a professional illustrated infographic for a video presentation. 1920x1080 landscape. Style: Modern corporate with deep navy blue (#1B365D) dominant, warm gold accents. Scene: A visual metaphor for protection — a glowing golden shield protecting a family silhouette. Bold headline: "Protection That Lasts". Key number displayed large: "$500,000 Death Benefit". Three stats at bottom: "30-Year Term" | "$45/month" | "Guaranteed Coverage". Rich depth, professional icons. Leave bottom 100px dark for branding bar.`,
    iscover: false,
  },
  {
    name: 'slide-growth',
    prompt: `Create a professional illustrated infographic for a video presentation. 1920x1080 landscape. Style: Modern corporate with deep navy blue (#1B365D) dominant, warm gold accents. Scene: A tree growing from golden coins, branches reaching upward with leaves turning to dollar signs, chart trending upward in background. Bold headline: "Cash Value Growth". Key number: "4.2% Annual Growth Rate". Two supporting stats: "$127,000 by Year 20" | "Tax-Deferred Accumulation". Rich illustration with data beautifully integrated. Leave bottom 100px dark for branding bar.`,
    iscover: false,
  },
  {
    name: 'slide-benefits',
    prompt: `Create a professional illustrated infographic for a video presentation. 1920x1080 landscape. Style: Modern corporate with deep navy blue (#1B365D) dominant, warm gold accents. Scene: A toolkit or Swiss army knife unfolding, each tool representing a benefit. Bold headline: "Built-In Benefits". Four feature cards with icons: "Living Benefits" (heart icon) | "Waiver of Premium" (shield) | "Accelerated Death Benefit" (clock) | "Conversion Option" (arrows). Clean professional layout with beautiful icons. Leave bottom 100px dark for branding bar.`,
    iscover: false,
  },
  {
    name: 'slide-closing',
    prompt: `Create a stunning illustrated background for a video closing card. 1920x1080 landscape. Style: Warm, hopeful with deep navy blue (#1B365D) and golden sunset tones. Scene: A path leading toward a bright horizon with warm light, an open door or gateway, sense of invitation and hope. The CENTER should have clear space for a logo and contact information overlay. Warm, inviting, actionable. NO TEXT NO LOGOS NO WORDS. Pure illustrated artwork.`,
    iscover: true,
  },
]

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const logoBuffer = fs.readFileSync(logoPath)

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

      if (!imgBuf) {
        console.log(`  No image returned for ${slide.name}`)
        continue
      }

      // Resize to 1920x1080
      imgBuf = Buffer.from(await sharp(imgBuf).resize(1920, 1080, { fit: 'cover' }).png().toBuffer())

      if (slide.iscover) {
        // Composite logo large + centered + title text
        const logo = await sharp(logoBuffer)
          .resize(550, null, { fit: 'inside', withoutEnlargement: false })
          .png()
          .toBuffer()
        const meta = await sharp(logo).metadata()
        const lw = meta.width || 550
        const lh = meta.height || 220
        const logoTop = Math.round((1080 - lh) / 2) - 60

        // Shadow behind logo
        const shadow = Buffer.from(`
          <svg width="${lw + 80}" height="${lh + 60}">
            <defs><filter id="b"><feGaussianBlur stdDeviation="20"/></filter></defs>
            <rect x="10" y="10" width="${lw + 60}" height="${lh + 40}" rx="20" fill="rgba(0,0,0,0.4)" filter="url(#b)"/>
          </svg>
        `)

        const titleText = slide.name === 'cover-bg' ? 'Understanding Your Life Insurance Policy' : 'Thank You'
        const subtitleText = slide.name === 'cover-bg' ? 'A Personalized Video Presentation' : 'Ready to take the next step?'
        const contactText = slide.name === 'cover-bg' ? '' : 'www.apexaffinity.com  ·  (800) 555-1234  ·  info@apexaffinity.com'

        const textSvg = Buffer.from(`
          <svg width="1920" height="1080">
            <text x="960" y="${logoTop + lh + 50}" font-family="Arial,sans-serif" font-size="36" font-weight="800" fill="white" text-anchor="middle" letter-spacing="1">${titleText}</text>
            <text x="960" y="${logoTop + lh + 90}" font-family="Arial,sans-serif" font-size="22" font-weight="600" fill="white" opacity="0.85" text-anchor="middle">${subtitleText}</text>
            ${contactText ? `<rect x="360" y="${logoTop + lh + 110}" width="1200" height="45" rx="8" fill="rgba(0,0,0,0.3)"/><text x="960" y="${logoTop + lh + 140}" font-family="Arial,sans-serif" font-size="18" font-weight="600" fill="white" opacity="0.8" text-anchor="middle">${contactText}</text>` : ''}
          </svg>
        `)

        imgBuf = Buffer.from(await sharp(imgBuf)
          .composite([
            { input: shadow, top: logoTop - 20, left: Math.round((1920 - lw) / 2) - 40 },
            { input: logo, top: logoTop, left: Math.round((1920 - lw) / 2) },
            { input: textSvg, top: 0, left: 0 },
          ])
          .png()
          .toBuffer())
      }

      fs.writeFileSync(path.join(outDir, `${slide.name}.png`), imgBuf)
      console.log(`  Saved ${slide.name}.png`)
    } catch (e: any) {
      console.log(`  Failed: ${e.message?.slice(0, 150)}`)
    }
  }

  console.log('\nAll done! Check public/flash31-demo/')
}

main().catch(console.error)
