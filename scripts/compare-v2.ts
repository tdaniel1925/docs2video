import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const outDir = path.join(process.cwd(), 'public', 'model-compare')

const prompt = `Create a stunning, vibrant illustrated scene for a premium video. A visual metaphor showing protection — a glowing shield materializing around a family, warm golden light radiating outward. Deep navy blue (#1B365D) dominant with warm amber accents. Rich textures, painterly quality, layered depth. 1920x1080 landscape. NO TEXT NO LOGOS NO WORDS. Pure illustrated artwork.`

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  // 1. GPT-Image-2
  console.log('1. GPT-Image-2...')
  try {
    const res = await openai.images.generate({ model: 'gpt-image-2', prompt, size: '1536x1024', quality: 'high', n: 1 })
    fs.writeFileSync(path.join(outDir, 'compare-gpt-image-2.png'), Buffer.from(res.data![0].b64_json!, 'base64'))
    console.log('   Done!')
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 100)) }

  // 2. Imagen 4
  console.log('2. Imagen 4...')
  try {
    const res = await genai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt,
      config: { numberOfImages: 1, aspectRatio: '16:9' },
    })
    if (res.generatedImages?.[0]?.image?.imageBytes) {
      fs.writeFileSync(path.join(outDir, 'compare-imagen-4.png'), Buffer.from(res.generatedImages[0].image.imageBytes, 'base64'))
      console.log('   Done!')
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  // 3. Imagen 4 Ultra
  console.log('3. Imagen 4 Ultra...')
  try {
    const res = await genai.models.generateImages({
      model: 'imagen-4.0-ultra-generate-001',
      prompt,
      config: { numberOfImages: 1, aspectRatio: '16:9' },
    })
    if (res.generatedImages?.[0]?.image?.imageBytes) {
      fs.writeFileSync(path.join(outDir, 'compare-imagen-4-ultra.png'), Buffer.from(res.generatedImages[0].image.imageBytes, 'base64'))
      console.log('   Done!')
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  // 4. Gemini 3 Pro Image (native)
  console.log('4. Gemini 3 Pro Image...')
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-3-pro-image',
      contents: 'Generate this image: ' + prompt,
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })
    for (const part of res.candidates![0].content!.parts!) {
      if (part.inlineData) {
        fs.writeFileSync(path.join(outDir, 'compare-gemini-3-pro.png'), Buffer.from(part.inlineData.data!, 'base64'))
        console.log('   Done!')
      }
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  // 5. Gemini 3.1 Flash Image (native)
  console.log('5. Gemini 3.1 Flash Image...')
  try {
    const res = await genai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: 'Generate this image: ' + prompt,
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })
    for (const part of res.candidates![0].content!.parts!) {
      if (part.inlineData) {
        fs.writeFileSync(path.join(outDir, 'compare-gemini-31-flash.png'), Buffer.from(part.inlineData.data!, 'base64'))
        console.log('   Done!')
      }
    }
  } catch (e: any) { console.log('   Failed:', e.message?.slice(0, 150)) }

  console.log('\nAll done! Check public/model-compare/')
}

main().catch(console.error)
