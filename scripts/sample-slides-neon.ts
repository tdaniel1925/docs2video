/**
 * Generate 3 sample slides in neon nightclub/event style.
 * Usage: npx tsx scripts/sample-slides-neon.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { GoogleGenAI } from '@google/genai'
import { writeFileSync, mkdirSync } from 'fs'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const STYLE = `Ultra-vibrant nightclub event flyer style, 1920x1080 landscape. Deep electric blue and hot magenta/pink color scheme with neon glow effects. Bold stylized typography with mix of block letters and script/cursive. Dramatic lighting — neon rim lights, lens flares, glowing edges. Dark background with vivid color splashes. High contrast, saturated colors. Features a stylish person/model with dramatic blue-pink lighting on their face. Urban nightlife energy. Professional graphic design quality like a premium club flyer.`

const slides = [
  {
    name: 'neon-1-cover',
    prompt: `${STYLE}

SLIDE CONTENT:
Create a dramatic event-style cover slide. Feature a confident woman with stylish sunglasses lit by intense blue and pink neon lights. Large bold text "BLUE" in electric blue block letters and "NIGHT" in flowing neon script below it. Top corner shows "SHOW" and a date. Right side has event details in smaller text with neon accents. Glowing light streaks and lens flares throughout. The overall mood is high-energy nightlife meets premium brand.`,
  },
  {
    name: 'neon-2-content',
    prompt: `${STYLE}

SLIDE CONTENT:
Create a content/data slide in the same neon nightclub style. Feature a different angle of a stylish person with dramatic blue-magenta lighting. Large bold numbers "$2.4M" glowing in electric blue neon. Below it "REVENUE GROWTH" in hot pink script lettering. Left side has 3 key stats stacked vertically with neon glow: "18% UP" "Q4 RECORD" "$500K PROFIT". Neon light trails and color splashes in the background. Same electric blue and magenta palette.`,
  },
  {
    name: 'neon-3-closing',
    prompt: `${STYLE}

SLIDE CONTENT:
Create a closing/CTA slide in the same neon nightclub style. Feature a person silhouetted against intense blue and pink neon backlighting. Large "THANK YOU" with "THANK" in bold electric blue block letters and "YOU" in glowing magenta script. Below: "THE FUTURE IS BRIGHT" in smaller neon text. Bottom section has 3 action items with neon icons: a phone icon with "CALL NOW", a globe icon with "VISIT US", a calendar icon with "BOOK TODAY". Lens flares and neon glow effects throughout.`,
  },
]

async function generate() {
  mkdirSync('public/sample-neon', { recursive: true })

  for (const slide of slides) {
    console.log(`Generating ${slide.name}...`)
    try {
      const result = await genai.models.generateContent({
        model: 'gemini-3-pro-image',
        contents: `Generate this image: ${slide.prompt}`,
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      })

      for (const part of (result as any).candidates[0].content.parts) {
        if (part.inlineData) {
          const buffer = Buffer.from(part.inlineData.data, 'base64')
          writeFileSync(`public/sample-neon/${slide.name}.png`, buffer)
          console.log(`  ✓ Saved public/sample-neon/${slide.name}.png (${(buffer.length / 1024).toFixed(0)} KB)`)
          break
        }
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
  console.log('\nDone! View at: public/sample-neon/')
}

generate()
