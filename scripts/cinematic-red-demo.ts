import { GoogleGenAI } from '@google/genai'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const logoPath = String.raw`c:\Users\tdani\One World Dropbox\Trent Daniel\1 - BotMakers\Clients\Apex Affinity Group\Logos\Apex Affinity Grop Logo - Full Color PNG.png`
const outDir = path.join(process.cwd(), 'public', 'cinematic-red-demo')

const STYLE = `Cinematic dark dramatic style. Deep black/dark charcoal background with intense red (#CC0000) and crimson glow effects. Photorealistic elements mixed with digital/holographic accents — glowing neon outlines, particle effects, lens flares, light trails. Red energy rings and waves at the bottom. Split layout: left side for text/data (dark panel), right side for dramatic illustrated scene. Typography: bold white headlines, red accent numbers, clean sans-serif. Glass-morphism cards with red-tinted borders for stats. Think: movie poster meets premium tech presentation. Dramatic, cinematic, high-impact.`

const slides = [
  {
    name: '01-cover',
    prompt: `${STYLE} Cover frame. Dark dramatic background with intense red glow emanating from center-right. Red particle effects and light rays. A large glowing neon shield shape on the right side with warm light behind it. Left side clean and dark for logo placement. Red energy waves at bottom. Cinematic atmosphere. NO TEXT NO LOGOS NO WORDS. 1920x1080 landscape.`,
    type: 'cover' as const,
    title: 'Secure Your Family\'s Future',
  },
  {
    name: '02-welcome',
    prompt: `${STYLE} Content slide. Dark background. Right side: dramatic silhouette of a family (parents + 2 children) standing together, backlit by intense red-orange glow, looking toward a bright horizon. A faint glowing shield outline surrounds them. Left side: Bold white headline "YOUR FUTURE STARTS HERE" with red accent line. Subtitle in lighter text. Red particle effects and energy rings at bottom. Cinematic, emotional. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '03-protection',
    prompt: `${STYLE} Content slide. Dark background with red glow. Right side: large glowing red neon shield with family silhouette inside, dramatic backlighting. Left side data panel: Bold white headline "PROTECTION THAT LASTS". Massive red number "$500,000" with glass-morphism card behind it labeled "DEATH BENEFIT". Three stat icons at bottom in glass cards with red borders: checkmark "30-YEAR TERM" | dollar "45/MONTH" | lock "GUARANTEED". Cinematic. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '04-growth',
    prompt: `${STYLE} Content slide. Dark background with red glow. Right side: a dramatic upward-trending holographic chart made of red light, with floating data points and particles. A golden tree growing through the chart. Left side: Bold white headline "CASH VALUE GROWTH". Huge red "4.2%" number. Glass cards: "$127,000 BY YEAR 20" and "TAX-DEFERRED ACCUMULATION". Red energy effects. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '05-benefits',
    prompt: `${STYLE} Content slide. Dark background with subtle red glow. Bold white headline at top: "BUILT-IN BENEFITS". Four glass-morphism cards in a 2x2 grid with red-tinted borders and subtle red glow behind each. Each card has a glowing red icon and white text: Top-left: heart "LIVING BENEFITS" | Top-right: shield "WAIVER OF PREMIUM" | Bottom-left: clock "ACCELERATED DEATH BENEFIT" | Bottom-right: arrows "CONVERSION OPTION". Clean, organized, cinematic. 1920x1080 landscape.`,
    type: 'content' as const,
  },
  {
    name: '06-closing',
    prompt: `${STYLE} Closing frame. Dark dramatic background matching the cover — same red glow, same energy. Red particle effects at edges. Center area clean and dark for logo overlay. Warm red/orange light at horizon line. Mirror the cover's cinematic atmosphere. NO TEXT NO LOGOS NO WORDS. 1920x1080 landscape.`,
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

        composites.push({
          input: whiteLogo,
          top: logoTop,
          left: Math.round((1920 - lw) / 2),
        })

        const textY = logoTop + lh + 40
        let svgParts = `<text x="960" y="${textY}" font-family="Arial Black,Arial,sans-serif" font-size="38" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">${slide.title}</text>`
        if (slide.type === 'closing') {
          svgParts += `<text x="960" y="${textY + 50}" font-family="Arial,sans-serif" font-size="20" font-weight="600" fill="#CC0000" text-anchor="middle">READY TO TAKE THE NEXT STEP?</text>`
          svgParts += `<rect x="410" y="${textY + 75}" width="1100" height="35" rx="4" fill="rgba(204,0,0,0.15)" stroke="rgba(204,0,0,0.3)" stroke-width="1"/>`
          svgParts += `<text x="960" y="${textY + 98}" font-family="Arial,sans-serif" font-size="15" font-weight="500" fill="white" opacity="0.7" text-anchor="middle">www.apexaffinity.com  ·  (800) 555-1234  ·  info@apexaffinity.com</text>`
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

  console.log('\nAll done!')
}

main().catch(console.error)
