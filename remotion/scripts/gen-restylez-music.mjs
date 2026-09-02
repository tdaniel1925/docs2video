// Upbeat bed for the Restylez launch video via Lyria 2 (Gemini). Writes public/restylez/music-raw.wav
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
import { writeFileSync } from 'fs'
import { GoogleGenAI } from '@google/genai'
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const prompt = process.argv[2] || 'Upbeat modern electro-pop instrumental, 128 BPM, driving four-on-the-floor kick, punchy claps, bright plucky synth hook, energetic and fun, launch-ad energy, confident, no vocals, no piano ballad, loops cleanly, steady tempo from the first beat'
const r = await genai.models.generateContent({ model: 'lyria-2', contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseModalities: ['AUDIO'] } })
const parts = r.candidates?.[0]?.content?.parts ?? []
const p = parts.find((x) => x.inlineData?.mimeType?.startsWith('audio/'))
if (!p) throw new Error('no audio: ' + JSON.stringify(r).slice(0, 400))
const ext = p.inlineData.mimeType.includes('wav') ? 'wav' : 'mp3'
writeFileSync(`public/restylez/music-raw.${ext}`, Buffer.from(p.inlineData.data, 'base64'))
console.log('ok', p.inlineData.mimeType, ext)
