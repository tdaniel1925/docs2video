import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
const outDir = path.join(process.cwd(), 'public', 'style-samples')

const styles = [
  {
    id: 'warm-story',
    prompt: 'Warm, cozy illustration style. Soft golden lighting, nature scenes, families, organic shapes. Rich earth tones with warm amber, terracotta, and cream. Characters have friendly, simple features. Scenes feel like a storybook — inviting, safe, hopeful. Subtle textures like watercolor wash or soft grain.',
  },
  {
    id: 'corporate-clean',
    prompt: 'Clean corporate flat vector illustration style. Professional blue (#1B365D) and teal palette on white/light gray backgrounds. Simple geometric shapes, clean icons, organized grid layouts. Characters are minimal, faceless silhouettes or simple figures. Data-forward with clean typography. Feels polished, trustworthy, Fortune 500.',
  },
  {
    id: 'bold-infographic',
    prompt: 'Bold high-contrast infographic style. Dark navy or black background with vibrant accent colors — electric blue, bright orange, vivid green. Massive numbers that dominate the frame. Strong visual hierarchy with thick borders and color blocks. Data visualization as art. Feels powerful, impactful, impossible to ignore.',
  },
  {
    id: 'watercolor',
    prompt: 'Soft watercolor illustration style. Pastel palette — lavender, peach, mint, sky blue. Flowing organic shapes with gentle color bleeds. Scenes feel hand-painted with visible brush strokes. Botanical accents, soft light, dreamy atmosphere. Data overlaid in clean serif typography. Feels artistic, premium, calming.',
  },
  {
    id: 'dark-cinematic',
    prompt: 'Cinematic dark illustration style. Deep navy (#0A1628) and charcoal backgrounds with rich gold (#C5A55A) and champagne accents. Dramatic lighting with glows and light rays. Elegant serif typography for headings. Scenes feel like movie posters — epic scale, dramatic composition. Subtle texture and depth. Feels luxurious, prestigious, powerful.',
  },
  {
    id: 'playful-cartoon',
    prompt: 'Bright playful cartoon illustration style. Vibrant primary colors — red, blue, yellow, green on white backgrounds. Friendly round characters with big expressions. Fun shapes, speech bubbles, stars, confetti. Simple but engaging compositions. Data presented in colorful cards and badges. Feels young, energetic, approachable, fun.',
  },
]

async function gen(name: string, prompt: string) {
  const res = await genai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: 'Generate this image: ' + prompt,
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  })
  for (const part of res.candidates![0].content!.parts!) {
    if (part.inlineData) {
      fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(part.inlineData.data!, 'base64'))
      console.log('  Saved ' + name + '.png')
      return
    }
  }
  console.log('  No image for ' + name)
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  for (const style of styles) {
    console.log('Style: ' + style.id)

    // Cover
    await gen(style.id + '-cover', `${style.prompt} 1920x1080 landscape.

This is a VIDEO COVER SLIDE. Display this text exactly:
- Company name: "APEX AFFINITY GROUP" — large, bold, centered, prominent
- Title: "Understanding Your Life Insurance Policy" — medium, below company name
- Subtitle: "A Personalized Video Presentation" — smaller, below title

Beautiful typography integrated into the artwork. No logos. No brand marks.`)

    // Content
    await gen(style.id + '-content', `${style.prompt} 1920x1080 landscape.

HEADLINE: "Protection That Lasts"
KEY DATA: $500,000

Create a professional infographic showing:
- Headline "Protection That Lasts" at top
- "$500,000" large and prominent, labeled "Death Benefit"
- Three stats at bottom: "30-Year Term" | "$45/month" | "Guaranteed"
- Visual elements: shield, family silhouette, or protection metaphor
- Icons matching the data points`)
  }

  console.log('\nAll done! Check public/style-samples/')
}

main().catch(console.error)
