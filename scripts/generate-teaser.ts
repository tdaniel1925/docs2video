/**
 * Generate a dramatic teaser video using Veo 3.1 via Gemini API.
 * 3 clips stitched together:
 *   1. "LIFE INSURANCE AGENTS" zoom text on black
 *   2. "OWN YOUR BOOK OF BUSINESS. DAY 1" text on black
 *   3. Apex logo with glow/light animation
 *
 * Run: npx tsx scripts/generate-teaser.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  console.error('Set GEMINI_API_KEY in .env.local')
  process.exit(1)
}

const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
const outDir = path.join(process.cwd(), 'teaser-output')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

// Load logo
const logoPath = String.raw`c:\Users\tdani\One World Dropbox\Trent Daniel\1 - BotMakers\Clients\Apex Affinity Group\Logos\Apex Affinity Grop Logo - Full Color PNG.png`
const logoBuffer = fs.readFileSync(logoPath)
const logoBase64 = logoBuffer.toString('base64')

const clips = [
  {
    name: 'clip1-text-zoom',
    prompt: `Cinematic motion graphics on a pure black background. The words "LIFE INSURANCE AGENTS" in bold white capital letters dramatically zoom from far away toward the camera, growing larger and larger until they fill the frame. The text has a slight metallic sheen and subtle lens flare as it approaches. Camera is static, text flies toward viewer. Dramatic, epic feel. No other elements, just black and white text. Professional broadcast quality.`,
  },
  {
    name: 'clip2-own-business',
    prompt: `Cinematic motion graphics on a pure black background. Text animation: first "OWN YOUR BOOK OF BUSINESS" fades in with a powerful reveal effect in bold white capital letters, centered on screen. Then after a brief pause, "DAY 1" appears below it with a golden glow pulse effect. The text has elegant serif typography. Subtle particle effects or light streaks in the background. Dramatic, motivational, premium broadcast feel. Dark and cinematic.`,
  },
  {
    name: 'clip3-logo-glow',
    prompt: `A dramatic logo reveal animation on a pure black background. The logo (provided as reference image) materializes from darkness with a stunning light animation — cool blue and red energy lines trace the outline of the logo, then it fills in with a bright glow pulse. Lens flares and light particles emanate from the logo. The star element in the logo glows with red energy. Cinematic, premium, epic reveal. The logo floats centered on screen with subtle ambient light rays behind it.`,
    useLogoAsRef: true,
  },
]

async function generateClip(clip: typeof clips[0], index: number) {
  console.log(`\nGenerating ${clip.name}...`)

  const parts: any[] = []

  if (clip.useLogoAsRef) {
    parts.push({
      inlineData: { mimeType: 'image/png', data: logoBase64 },
    })
  }

  parts.push({ text: clip.prompt })

  try {
    // Generate video with Veo
    const response = await genai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: clip.prompt,
      config: {
        aspectRatio: '16:9',
        numberOfVideos: 1,
        durationSeconds: 8,
        // If logo reference, pass as image
        ...(clip.useLogoAsRef ? {
          image: {
            imageBytes: logoBase64,
            mimeType: 'image/png',
          },
        } : {}),
      },
    } as any)

    // Poll for completion
    console.log(`  Waiting for generation...`)
    let operation = response as any
    while (!operation.done) {
      await new Promise(r => setTimeout(r, 10000))
      operation = await genai.operations.getVideosOperation({ operation }) as any
      console.log(`  Still generating...`)
    }

    // Download the video
    if (operation.response?.generatedVideos?.[0]) {
      const video = operation.response.generatedVideos[0]
      const outPath = path.join(outDir, `${clip.name}.mp4`)
      await genai.files.download({ file: video.video, downloadPath: outPath } as any)
      const stats = fs.statSync(outPath)
      console.log(`  ✓ Saved: ${outPath} (${Math.round(stats.size / 1024)}KB)`)
      return outPath
    }

    console.error(`  ✗ No video returned for ${clip.name}`)
    return null
  } catch (err: any) {
    console.error(`  ✗ Error generating ${clip.name}:`, err.message?.slice(0, 200))
    return null
  }
}

async function stitchClips(clipPaths: string[]) {
  const validPaths = clipPaths.filter(Boolean) as string[]
  if (validPaths.length === 0) {
    console.error('No clips to stitch')
    return
  }

  // Create concat file
  const concatFile = path.join(outDir, 'concat.txt')
  const concatContent = validPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n')
  fs.writeFileSync(concatFile, concatContent)

  const outputPath = path.join(outDir, 'apex-teaser-final.mp4')
  try {
    execSync(`ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy -y "${outputPath}"`, {
      stdio: 'inherit',
    })
    console.log(`\n✓ FINAL TEASER: ${outputPath}`)
  } catch {
    // If concat copy fails, try re-encoding
    const inputs = validPaths.map(p => `-i "${p}"`).join(' ')
    const filter = validPaths.map((_, i) => `[${i}:v][${i}:a]`).join('') + `concat=n=${validPaths.length}:v=1:a=1[outv][outa]`
    execSync(`ffmpeg ${inputs} -filter_complex "${filter}" -map "[outv]" -map "[outa]" -y "${outputPath}"`, {
      stdio: 'inherit',
    })
    console.log(`\n✓ FINAL TEASER: ${outputPath}`)
  }
}

async function main() {
  console.log('=== APEX AFFINITY GROUP TEASER GENERATOR ===\n')

  const clipPaths: (string | null)[] = []
  for (let i = 0; i < clips.length; i++) {
    const result = await generateClip(clips[i], i)
    clipPaths.push(result)
  }

  await stitchClips(clipPaths as string[])
  console.log('\nDone! Check teaser-output/ for all files.')
}

main().catch(console.error)
