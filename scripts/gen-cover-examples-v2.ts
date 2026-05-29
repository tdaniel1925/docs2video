import OpenAI from 'openai'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const logoPath = String.raw`c:\Users\tdani\One World Dropbox\Trent Daniel\1 - BotMakers\Clients\Apex Affinity Group\Logos\Apex Affinity Grop Logo - Full Color PNG.png`
const outDir = path.join(process.cwd(), 'public', 'cover-examples')

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const logoBuffer = fs.readFileSync(logoPath)

  // Cover 1: Warm illustrated — family protection theme
  console.log('1. Generating warm illustrated cover...')
  const bg1 = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `Create a stunning, vibrant illustrated cover image for a professional video presentation. 1920x1080 landscape.

Style: Warm, rich illustration with depth and dimension. Bold colors — deep navy blue (#1B3A6B) as primary, vivid red (#CC0000) as accent, warm golden light.

Scene: A beautiful panoramic landscape at golden hour — rolling hills, a winding path leading toward a glowing horizon. In the foreground, abstract geometric shapes (stars, shields) subtly integrated into the landscape. Light rays streaming from the horizon creating a sense of hope and possibility.

The CENTER of the image (roughly 700x350px area) should be a slightly lighter, cleaner zone — like a natural clearing or sky area — where a logo can be placed with excellent contrast.

This is the OPENING FRAME of a premium corporate video. It must feel cinematic, inspiring, and premium — like a Super Bowl ad opening. Rich textures, painterly quality, layered depth.

NO TEXT. NO LOGOS. NO WORDS of any kind. Pure illustrated artwork.`,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })
  const buf1 = Buffer.from(bg1.data![0].b64_json!, 'base64')
  await compositecover(buf1, logoBuffer, 'cover-v2-warm.png', 'Your Financial Future, Secured')
  console.log('  Done!')

  // Cover 2: Corporate power — geometric/architectural
  console.log('2. Generating corporate power cover...')
  const bg2 = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `Create a stunning, premium illustrated cover image for a corporate video presentation. 1920x1080 landscape.

Style: Bold corporate illustration with rich depth. Navy blue (#1B3A6B) dominant, red (#CC0000) accent highlights, silver/white clean elements. Glossy, polished finish.

Scene: An impressive abstract cityscape or architectural composition — towering geometric structures reaching upward, connected by bridges of light. A central grand archway or gateway structure that frames an open sky. Dynamic composition with diagonal lines creating energy and movement. Subtle star shapes integrated into the architecture.

The CENTER-TOP area should have clear sky or light space where a logo will be placed.

Premium quality — this should look like it belongs on a Bloomberg terminal splash screen or a Fortune 500 annual report cover. Sophisticated, powerful, trustworthy.

NO TEXT. NO LOGOS. NO WORDS. Pure illustrated artwork.`,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })
  const buf2 = Buffer.from(bg2.data![0].b64_json!, 'base64')
  await compositecover(buf2, logoBuffer, 'cover-v2-corporate.png', 'Protecting What Matters Most')
  console.log('  Done!')

  // Cover 3: Cinematic reveal — dramatic light
  console.log('3. Generating cinematic reveal cover...')
  const bg3 = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `Create a breathtaking cinematic cover image for a premium video. 1920x1080 landscape.

Style: Dramatic, cinematic illustration. Deep rich navy (#0D1B3E) with vibrant red (#CC0000) and gold accents. Volumetric light, atmospheric depth.

Scene: A dramatic reveal moment — massive light beams breaking through clouds or an opening in dark dramatic sky. A central bright focal point with rays extending outward like a starburst. The bottom half has a subtle landscape silhouette — mountains or cityscape. Particles of light floating in the air. The whole image feels like the moment before something epic is revealed.

The CENTER should have the brightest, most dramatic light — this is where the logo will sit, emerging from the light.

Think: movie studio logo reveal, Marvel opening, luxury car commercial opening shot. Maximum drama, maximum impact.

NO TEXT. NO LOGOS. NO WORDS. Pure cinematic artwork.`,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })
  const buf3 = Buffer.from(bg3.data![0].b64_json!, 'base64')
  await compositecover(buf3, logoBuffer, 'cover-v2-cinematic.png', 'Excellence in Financial Planning')
  console.log('  Done!')

  // Cover 4: Vibrant modern — gradient + shapes
  console.log('4. Generating vibrant modern cover...')
  const bg4 = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `Create a vibrant, modern illustrated cover for a professional video. 1920x1080 landscape.

Style: Bold modern illustration. Rich gradient from deep navy blue (#1B3A6B) on left to vibrant royal blue (#2858A0) on right, with bright red (#CC0000) accent elements. Clean, contemporary.

Scene: Abstract flowing shapes and curves creating dynamic movement across the frame. Floating geometric elements — circles, triangles, stars — with glass-like translucency. Subtle grid pattern in the background. Bright accent elements that pop — red stars, gold dots, white line art. The right side has a dramatic diagonal slash of red creating visual energy.

Center area should be relatively clean for logo placement — a natural calm point amid the dynamic shapes.

Modern, energetic, professional. Like a premium fintech app splash screen or a tech conference keynote opening.

NO TEXT. NO LOGOS. NO WORDS. Pure illustrated artwork.`,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })
  const buf4 = Buffer.from(bg4.data![0].b64_json!, 'base64')
  await compositecover(buf4, logoBuffer, 'cover-v2-modern.png', 'Smart Solutions for Your Future')
  console.log('  Done!')

  console.log('\nAll 4 covers generated! Check public/cover-examples/')
}

async function compositecover(bgBuffer: Buffer, logoBuffer: Buffer, filename: string, subtitle: string) {
  // Resize background to 1920x1080
  const bg = await sharp(bgBuffer).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()

  // Resize logo large (600px wide)
  const logo = await sharp(logoBuffer)
    .resize(600, null, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const meta = await sharp(logo).metadata()
  const w = meta.width || 600
  const h = meta.height || 240

  // Create subtitle SVG
  const svgOverlay = Buffer.from(`
    <svg width="1920" height="1080">
      <rect x="0" y="${Math.round((1080 + h) / 2) - 20}" width="1920" height="80" fill="rgba(0,0,0,0.3)" rx="0"/>
      <text x="960" y="${Math.round((1080 + h) / 2) + 28}"
        font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold"
        fill="white" text-anchor="middle" letter-spacing="2">
        ${subtitle.toUpperCase()}
      </text>
    </svg>
  `)

  const result = await sharp(bg)
    .composite([
      { input: logo, top: Math.round((1080 - h) / 2) - 50, left: Math.round((1920 - w) / 2) },
      { input: svgOverlay, top: 0, left: 0 },
    ])
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(outDir, filename), result)
}

main().catch(console.error)
