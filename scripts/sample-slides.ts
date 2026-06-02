/**
 * Generate 3 sample slides matching the corporate split-layout style.
 * Usage: npx tsx scripts/sample-slides.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { GoogleGenAI } from '@google/genai'
import { writeFileSync, mkdirSync } from 'fs'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const STYLE = `Premium corporate presentation slide, 1920x1080 landscape. Split layout: left side is clean white/light gray with bold text, right side features a stunning high-resolution photograph. Navy blue (#1B365D) and gold (#C8A84E) color scheme. Modern sans-serif typography — large bold headlines with gold accent words. Bottom section has a navy blue bar with 3 icon-and-text columns. Clean, professional, magazine-quality design. NO logos. NO brand marks.`

const slides = [
  {
    name: 'slide-1-cover',
    prompt: `${STYLE}

SLIDE CONTENT:
Top subtitle: "PROTECTING FAMILIES | SECURING FUTURES"
Main headline: Three lines stacked large and bold:
"PROTECT"  (navy)
"SECURE" (gold)
"THRIVE" (navy)
Below headline: "Your policy. Your peace of mind."
Right side photo: Beautiful sunset over a family home with warm golden light.
Bottom bar with 3 items:
1. Shield icon + "COVERAGE" + "Comprehensive protection for your family"
2. Growth chart icon + "GROWTH" + "Build lasting financial security"
3. Handshake icon + "TRUST" + "Backed by decades of experience"`,
  },
  {
    name: 'slide-2-data',
    prompt: `${STYLE}

SLIDE CONTENT:
Top subtitle: "POLICY OVERVIEW | KEY NUMBERS"
Main headline:
"$500,000" (very large, navy)
"DEATH BENEFIT" (gold, medium)
Below: "Annual Premium: $4,200 | Payment Mode: Monthly"
Right side photo: Dramatic mountain landscape at golden hour with lake reflection.
Bottom bar with 3 items:
1. Dollar icon + "PREMIUM" + "$350 per month builds your safety net"
2. Chart icon + "CASH VALUE" + "Grows tax-deferred over time"
3. Shield icon + "GUARANTEED" + "Minimum values locked in from day one"`,
  },
  {
    name: 'slide-3-closing',
    prompt: `${STYLE}

SLIDE CONTENT:
Top subtitle: "TAKE THE NEXT STEP"
Main headline:
"THANK" (navy)
"YOU" (gold, large)
Below headline: "Ready to secure your family's future?"
Right side photo: Peaceful ocean sunset with golden reflections on calm water.
Bottom bar with 3 items:
1. Phone icon + "CALL US" + "Schedule your policy review today"
2. Globe icon + "VISIT" + "Learn more about your options"
3. Calendar icon + "BOOK" + "Set up a consultation"`,
  },
]

async function generate() {
  mkdirSync('public/sample-style', { recursive: true })

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
          writeFileSync(`public/sample-style/${slide.name}.png`, buffer)
          console.log(`  ✓ Saved public/sample-style/${slide.name}.png (${(buffer.length / 1024).toFixed(0)} KB)`)
          break
        }
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
  console.log('\nDone!')
}

generate()
