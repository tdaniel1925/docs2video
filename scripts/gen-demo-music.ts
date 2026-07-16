/**
 * Generate a ~30s instrumental track via Lyria-2 (same Gemini key the app
 * uses) and save it locally for the kinetic-typography demo render.
 * Run: npx tsx scripts/gen-demo-music.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { GoogleGenAI } from '@google/genai'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
mkdirSync(OUT, { recursive: true })

const PROMPT = 'Modern upbeat corporate electronic track at exactly 120 BPM. Strong clear four-on-the-floor kick drum with a punchy beat, driving synth bass, bright plucks, building energy with a clear pulse. Instrumental only, no vocals. Confident, premium, energetic — like a product launch commercial. Approximately 35 seconds.'

async function main() {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      console.log(`[demo-music] Lyria attempt ${attempt}...`)
      const response = await genai.models.generateContent({
        model: 'lyria-2',
        contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
        config: { responseModalities: ['AUDIO'] } as any,
      })
      const parts = response.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/')) {
          const buffer = Buffer.from(part.inlineData.data!, 'base64')
          if (buffer.length < 1000) throw new Error(`audio too small: ${buffer.length}b`)
          const ext = part.inlineData.mimeType.includes('wav') ? 'wav' : 'mp3'
          const file = join(OUT, `demo-music.${ext}`)
          writeFileSync(file, buffer)
          console.log(`[demo-music] saved ${file} (${(buffer.length / 1024 / 1024).toFixed(1)} MB, ${part.inlineData.mimeType})`)
          return
        }
      }
      throw new Error('no audio part in response')
    } catch (e) {
      console.error(`[demo-music] attempt ${attempt} failed:`, e instanceof Error ? e.message.slice(0, 200) : e)
      if (attempt < 4) await new Promise(r => setTimeout(r, 8000))
    }
  }
  process.exit(1)
}

main()
