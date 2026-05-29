import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const outDir = path.join(process.cwd(), 'public', 'model-compare')

const prompts = [
  {
    name: 'cover',
    text: `Create a stunning, vibrant illustrated background for a premium video title card. 1920x1080 landscape. Deep navy blue (#1B365D) as primary, red (#CC0000) as accent. Rich depth, layered composition, golden light. Abstract shapes and visual metaphors — paths, horizons, stars. The CENTER should have lighter space for a logo. NO TEXT NO LOGOS NO WORDS. Pure illustrated artwork.`,
  },
  {
    name: 'scene-protection',
    text: `Professional business illustration. Warm illustrated style with rich depth. A visual metaphor showing protection — a glowing shield materializing around a family silhouette, warm golden light radiating outward. Navy blue (#1B365D) and warm amber tones. Rich textures, painterly quality. 1920x1080 landscape. NO TEXT NO LOGOS. Pure illustrated scene.`,
  },
  {
    name: 'scene-growth',
    text: `Professional business illustration. Bold corporate style. A visual metaphor showing financial growth — a tree growing from coins, its branches reaching upward with golden leaves, sunrise behind it. Deep navy (#1B365D) with green and gold accents. Modern, sophisticated. 1920x1080 landscape. NO TEXT NO LOGOS. Pure illustrated scene.`,
  },
]

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  for (const prompt of prompts) {
    console.log(`\n=== ${prompt.name} ===`)

    // GPT-Image-2
    console.log('  Generating with GPT-Image-2...')
    try {
      const gptRes = await openai.images.generate({
        model: 'gpt-image-2',
        prompt: prompt.text,
        size: '1536x1024',
        quality: 'high',
        n: 1,
      })
      const gptBuf = Buffer.from(gptRes.data![0].b64_json!, 'base64')
      fs.writeFileSync(path.join(outDir, `${prompt.name}-gpt.png`), gptBuf)
      console.log('  GPT done!')
    } catch (e: any) {
      console.log('  GPT failed:', e.message?.slice(0, 100))
    }

    // Gemini Imagen 3
    console.log('  Generating with Gemini Imagen 3...')
    try {
      const gemRes = await genai.models.generateImages({
        model: 'imagen-3.0-generate-001',
        prompt: prompt.text,
        config: {
          numberOfImages: 1,
          aspectRatio: '16:9',
        },
      })
      if (gemRes.generatedImages && gemRes.generatedImages.length > 0) {
        const imgBytes = gemRes.generatedImages[0].image?.imageBytes
        if (imgBytes) {
          const gemBuf = Buffer.from(imgBytes, 'base64')
          fs.writeFileSync(path.join(outDir, `${prompt.name}-gemini.png`), gemBuf)
          console.log('  Gemini done!')
        }
      }
    } catch (e: any) {
      console.log('  Gemini failed:', e.message?.slice(0, 200))
    }
  }

  console.log('\nAll done! Check public/model-compare/')
}

main().catch(console.error)
