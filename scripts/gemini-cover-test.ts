import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const outDir = path.join(process.cwd(), 'public', 'gemini-cover-test')

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  // Cover slide — all Gemini, no Sharp
  console.log('Generating cover...')
  const coverRes = await genai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: `Generate this image: Create a premium video cover slide. 1920x1080 landscape.

Style: Modern corporate illustration. Deep navy blue (#1B365D) background with subtle geometric patterns, thin gold (#C9A84C) accent lines. Clean, professional, premium.

This is the OPENING FRAME of a professional video presentation.

Display this text exactly as written, large and centered:
- Company name: "APEX AFFINITY GROUP" — large, bold, white, uppercase, centered, prominent
- Below that a thin gold horizontal line divider
- Title: "Understanding Your Life Insurance Policy" — medium size, white, centered
- Subtitle: "A Personalized Video Presentation" — smaller, white, slightly transparent

The text should be beautifully typeset — crisp, clean, professional. The background should complement the text, not compete with it. Navy background ensures white text is perfectly readable.

DO NOT include any logos or brand marks. Text only.`,
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  })

  for (const part of coverRes.candidates![0].content!.parts!) {
    if (part.inlineData) {
      fs.writeFileSync(path.join(outDir, 'cover.png'), Buffer.from(part.inlineData.data!, 'base64'))
      console.log('  Saved cover.png')
    }
  }

  // Content slide — all Gemini
  console.log('Generating content slide...')
  const contentRes = await genai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: `Generate this image: Create a professional illustrated infographic slide. 1920x1080 landscape.

Style: Modern corporate illustration. Deep navy blue (#1B365D) background. Gold (#C9A84C) accent elements. Clean flat design with subtle depth. White text, gold icons.

HEADLINE: "Protection That Lasts"
KEY DATA to show prominently: $500,000

SCENE CONTENT (illustrate THIS specifically):
Your policy provides a death benefit of five hundred thousand dollars, ensuring your family's financial security. This coverage remains in effect for a thirty-year term at just forty-five dollars per month. The guaranteed coverage means your premium will never increase.

Create a professional illustrated infographic that visually represents the narration above. Include:
- The headline "Protection That Lasts" large at the top
- The number "$500,000" displayed large and prominent
- Label "Death Benefit" below the number
- Three stat boxes at bottom: "30-Year Term" | "$45/month" | "Guaranteed"
- Relevant visual elements: a shield, family silhouette, or protection metaphor
- Gold icons, navy background, white text

Every visual element should connect to what the narration is saying.`,
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  })

  for (const part of contentRes.candidates![0].content!.parts!) {
    if (part.inlineData) {
      fs.writeFileSync(path.join(outDir, 'content.png'), Buffer.from(part.inlineData.data!, 'base64'))
      console.log('  Saved content.png')
    }
  }

  console.log('\nDone! Check public/gemini-cover-test/')
}

main().catch(console.error)
