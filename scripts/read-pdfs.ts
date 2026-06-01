import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const files = [
  String.raw`c:\Users\tdani\Downloads\Teacher's Pension - Retirement Education for District Employees Explainer.pdf`,
  String.raw`c:\Users\tdani\Downloads\Docs2Video_ Transform Documents into Explainer Videos Explainer.pdf`,
  String.raw`c:\Users\tdani\Downloads\Demo_ iHostPoker Casino Parties.pdf`,
  String.raw`c:\Users\tdani\Downloads\Crown Heights Jewish Community Council (CHJCC) Services Explainer.pdf`,
]

async function main() {
  for (const f of files) {
    const name = path.basename(f)
    console.log('=== ' + name + ' ===')

    const buf = fs.readFileSync(f)
    const b64 = buf.toString('base64')

    const res = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: b64 } },
          { text: 'Describe the COVER SLIDE (first page) of this PDF in extreme visual detail. What does the background look like? What colors? What visual elements (illustrations, icons, shapes)? Where is the text positioned? What typography style? What is the overall mood/aesthetic? Then describe 2 content slides briefly. Be very specific — I need to recreate this exact style.' }
        ]
      }]
    })

    console.log(res.candidates![0].content!.parts![0].text!.slice(0, 1200))
    console.log('\n')
  }
}

main().catch(e => console.log('Error:', e.message?.slice(0, 300)))
