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
  const logoBase64 = logoBuffer.toString('base64')

  // ========================================
  // OPTION 1: Logo-Centered Hero Cover
  // Generate illustrated background, then composite logo large + centered
  // ========================================
  console.log('Generating Option 1: Logo-Centered Hero Cover...')
  const bg1Res = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: `Create a premium cinematic background for a video title card. 1920x1080 landscape. Deep navy blue (#1B3A6B) gradient background with subtle abstract geometric patterns — angular shapes, light rays, and a subtle star motif. Professional, corporate, powerful. Rich depth with soft glows and bokeh effects. The center area (800x400px) should be slightly lighter/clearer to allow a logo to be placed on top with good contrast. NO TEXT, NO LOGOS — just the background atmosphere. Brand colors: navy blue and red.`,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })

  const bg1Buffer = Buffer.from(bg1Res.data![0].b64_json!, 'base64')

  // Resize background to 1920x1080
  const bg1Resized = await sharp(bg1Buffer).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()

  // Resize logo to be large and centered (500px wide)
  const logoResized = await sharp(logoBuffer)
    .resize(500, null, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const logoMeta = await sharp(logoResized).metadata()
  const logoW = logoMeta.width || 500
  const logoH = logoMeta.height || 200

  // Composite logo centered, slightly above middle
  const option1 = await sharp(bg1Resized)
    .composite([
      {
        input: logoResized,
        top: Math.round((1080 - logoH) / 2) - 60,
        left: Math.round((1920 - logoW) / 2),
      },
    ])
    .png()
    .toBuffer()

  // Add subtitle text via a second composite with SVG overlay
  const subtitleSvg = Buffer.from(`
    <svg width="1920" height="1080">
      <text x="960" y="${Math.round((1080 + logoH) / 2) + 20}"
        font-family="Arial, sans-serif" font-size="36" font-weight="bold"
        fill="white" text-anchor="middle" opacity="0.9">
        Your Financial Future, Secured
      </text>
      <text x="960" y="${Math.round((1080 + logoH) / 2) + 60}"
        font-family="Arial, sans-serif" font-size="22"
        fill="rgba(255,255,255,0.7)" text-anchor="middle">
        Personalized Insurance Solutions
      </text>
    </svg>
  `)

  const option1Final = await sharp(option1)
    .composite([{ input: subtitleSvg, top: 0, left: 0 }])
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(outDir, 'cover-option1-hero.png'), option1Final)
  console.log('  Saved cover-option1-hero.png')

  // ========================================
  // OPTION 3: AI-Generated with Logo Reference
  // Send logo to GPT-Image and let it design around it
  // ========================================
  console.log('Generating Option 3: AI-Generated with Logo Reference...')
  const cover3Res = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: `Design a premium, cinematic video title card at 1920x1080 for "Apex Affinity Group", a financial services/insurance company. The card should feature:

- A bold, professional design with deep navy blue (#1B3A6B) as the dominant color
- Red (#CC0000) as an accent color — used sparingly for star/geometric accents
- The company name "APEX AFFINITY GROUP" displayed prominently in large, clean white or silver text
- A stylized star motif (the brand's icon) integrated into the design
- Subtle background: abstract geometric shapes, light rays, corporate sophistication
- Subtitle below the name: "Your Financial Future, Secured"
- Leave bottom 100px dark for a contact bar

This should look like the opening frame of a premium corporate video — like a Fortune 500 keynote opening. Cinematic, powerful, trustworthy.`,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })

  const cover3Buffer = Buffer.from(cover3Res.data![0].b64_json!, 'base64')
  const cover3Resized = await sharp(cover3Buffer).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()

  // Now composite the REAL logo on top (since AI-drawn logos are imperfect)
  const logoForOverlay = await sharp(logoBuffer)
    .resize(350, null, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const overlayMeta = await sharp(logoForOverlay).metadata()
  const olW = overlayMeta.width || 350
  const olH = overlayMeta.height || 140

  const option3Final = await sharp(cover3Resized)
    .composite([
      {
        input: logoForOverlay,
        top: 40,
        left: Math.round((1920 - olW) / 2),
      },
    ])
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(outDir, 'cover-option3-ai.png'), option3Final)
  console.log('  Saved cover-option3-ai.png')

  // ========================================
  // BONUS: Option 1 variant with dark cinematic style
  // ========================================
  console.log('Generating Bonus: Dark cinematic variant...')
  const bg3Res = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: `Create an ultra-premium dark cinematic background for a video title card. 1920x1080. Nearly black background (#0A0F1A) with dramatic light rays coming from behind center — like a movie poster reveal. Subtle navy blue and red color accents in the light beams. Particle effects, lens flare, atmospheric fog. The center should have a bright focal point where a logo would be placed. NO TEXT, NO LOGOS — just cinematic atmosphere. Think Marvel Studios logo reveal moment.`,
    size: '1536x1024',
    quality: 'high',
    n: 1,
  })

  const bg3Buffer = Buffer.from(bg3Res.data![0].b64_json!, 'base64')
  const bg3Resized = await sharp(bg3Buffer).resize(1920, 1080, { fit: 'cover' }).png().toBuffer()

  const logoLarge = await sharp(logoBuffer)
    .resize(600, null, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const lgMeta = await sharp(logoLarge).metadata()
  const lgW = lgMeta.width || 600
  const lgH = lgMeta.height || 240

  const bonusFinal = await sharp(bg3Resized)
    .composite([
      {
        input: logoLarge,
        top: Math.round((1080 - lgH) / 2) - 40,
        left: Math.round((1920 - lgW) / 2),
      },
    ])
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(outDir, 'cover-bonus-cinematic.png'), bonusFinal)
  console.log('  Saved cover-bonus-cinematic.png')

  console.log('\nDone! Check public/cover-examples/')
}

main().catch(console.error)
