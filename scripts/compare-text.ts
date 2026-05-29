import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const outDir = path.join(process.cwd(), 'public', 'model-compare')

const prompt = `Create a professional illustrated infographic scene for a video presentation. 1920x1080 landscape.

The scene should include these data points integrated into the illustration:
- Bold headline: "Policy Overview"
- Key number: "$500,000" (death benefit) displayed large and prominent
- Three stats in a row: "30-Year Term" | "$45/month" | "4.2% Growth Rate"
- A visual metaphor of financial protection — shield, family, or tree growing

Style: Modern corporate illustration with deep navy blue (#1B365D) dominant, warm gold accents. Rich depth, professional feel. The text and numbers should be crisp, readable, and beautifully integrated into the design — not just floating text but part of the visual composition.

Leave bottom 100px dark for a branded bar.`

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  // 1. GPT-Image-2
  console.log('1. GPT-Image-2 with text...')
  try {
    const res = await openai.images.generate({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'high', n: 1 })
    fs.writeFileSync(path.join(outDir, 'text-gpt-image-2.png'), Buffer.from(res.data![0].b64_json!, 'base64'))
    console.log('   Done!')
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 100)) }

  // 2. Imagen 4
  console.log('2. Imagen 4 with text...')
  try {
    const res = await genai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: { numberOfImages: 1, aspectRatio: '16:9' },
    })
    if (res.generatedImages?.[0]?.image?.imageBytes) {
      fs.writeFileSync(path.join(outDir, 'text-imagen-4.png'), Buffer.from(res.generatedImages[0].image.imageBytes, 'base64'))
      console.log('   Done!')
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  // 3. Imagen 4 Ultra
  console.log('3. Imagen 4 Ultra with text...')
  try {
    const res = await genai.models.generateImages({
      model: 'imagen-4.0-ultra-generate-001',
      prompt,
      config: { numberOfImages: 1, aspectRatio: '16:9' },
    })
    if (res.generatedImages?.[0]?.image?.imageBytes) {
      fs.writeFileSync(path.join(outDir, 'text-imagen-4-ultra.png'), Buffer.from(res.generatedImages[0].image.imageBytes, 'base64'))
      console.log('   Done!')
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  // 4. Gemini 3 Pro Image
  console.log('4. Gemini 3 Pro Image with text...')
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-3-pro-image',
      contents: 'Generate this image: ' + prompt,
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })
    for (const part of res.candidates![0].content!.parts!) {
      if (part.inlineData) {
        fs.writeFileSync(path.join(outDir, 'text-gemini-3-pro.png'), Buffer.from(part.inlineData.data!, 'base64'))
        console.log('   Done!')
      }
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  // 5. Gemini 3.1 Flash Image
  console.log('5. Gemini 3.1 Flash Image with text...')
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: 'Generate this image: ' + prompt,
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })
    for (const part of res.candidates![0].content!.parts!) {
      if (part.inlineData) {
        fs.writeFileSync(path.join(outDir, 'text-gemini-31-flash.png'), Buffer.from(part.inlineData.data!, 'base64'))
        console.log('   Done!')
      }
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  console.log('\nAll done! Check public/model-compare/')
}

main().catch(console.error)
