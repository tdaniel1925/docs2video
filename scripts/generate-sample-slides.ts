/**
 * Generate 3 sample slides using the apex-corporate template as reference.
 * Run: npx tsx scripts/generate-sample-slides.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { GoogleGenAI } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  console.error('Set GEMINI_API_KEY env var')
  process.exit(1)
}

const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
const MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

// Load the template reference image
const templatePath = path.join(process.cwd(), 'public', 'style-previews', 'apex-corporate.png')
const templateBuffer = fs.readFileSync(templatePath)
const templateBase64 = templateBuffer.toString('base64')

// Sample brand colors (navy + red like the template)
const colors = {
  primary: '#1B2D5B',
  secondary: '#C62828',
  accent: '#E8E8E8',
}

const slides = [
  {
    name: 'front-cover',
    prompt: `Create a professional FRONT COVER presentation slide.

CONTENT TO DISPLAY:
- Company name: "Summit Financial Group" (top left, large and bold)
- Below company name: a star/burst logo accent shape
- Main title: "RETIREMENT PLANNING GUIDE" (large, bold, centered)
- Subtitle: "SECURE YOUR FUTURE. PROTECT YOUR FAMILY."
- Tagline below title: "Your personalized retirement strategy overview with key milestones, projected growth, and action steps."
- Section: "WHAT'S INSIDE" with 4 icon items in a row:
  1. Portfolio Overview
  2. Growth Projections
  3. Risk Analysis
  4. Next Steps
- Right side: a large circular graphic with a play button icon and gear/document icons around it
- Footer bar: "www.summitfinancial.com | info@summitfinancial.com | (480) 555-1234"
- Small text bottom right: "FOR CLIENT USE ONLY"

DESIGN STYLE:
- Match the EXACT layout, geometric shapes, diagonal color blocks, icon circles, and visual language of the reference image
- Use brand primary color (${colors.primary}) for main elements and secondary (${colors.secondary}) for accents
- White background with bold colored geometric accent shapes cutting across corners
- Professional corporate infographic style`,
  },
  {
    name: 'content-slide',
    prompt: `Create a professional CONTENT presentation slide about retirement portfolio allocation.

CONTENT TO DISPLAY:
- Title: "YOUR PORTFOLIO BREAKDOWN" (large, bold, top area)
- Subtitle: "How your investments are allocated for maximum growth with managed risk"

LEFT SIDE - Key metrics in colored cards/containers:
- "Total Portfolio Value: $1,250,000"
- "Annual Contribution: $24,000"
- "Projected Growth Rate: 7.2%"
- "Time to Retirement: 18 Years"

RIGHT SIDE - Allocation breakdown with icon circles:
- Stocks: 55% (with chart icon)
- Bonds: 25% (with shield icon)
- Real Estate: 12% (with building icon)
- Cash: 8% (with dollar icon)

- Footer bar: "www.summitfinancial.com | info@summitfinancial.com | (480) 555-1234"

DESIGN STYLE:
- Match the EXACT layout, geometric shapes, diagonal color blocks, icon circles, and visual language of the reference image
- Use brand primary color (${colors.primary}) for headers and containers, secondary (${colors.secondary}) for accent shapes
- Flat vector icons inside colored circles
- Clean grid layout with clear visual hierarchy
- Professional corporate infographic style`,
  },
  {
    name: 'back-cover',
    prompt: `Create a professional BACK COVER / CLOSING presentation slide.

CONTENT TO DISPLAY:
- Company name and logo area: "Summit Financial Group" (top left, with star accent)
- Main heading: "READY TO TAKE THE NEXT STEP?" (large, bold, centered)
- Subheading: "Let's build your personalized retirement roadmap together."

CONTACT SECTION with icon circles:
- Phone icon: "(480) 555-1234"
- Email icon: "info@summitfinancial.com"
- Website icon: "www.summitfinancial.com"
- Calendar icon: "Book a Free Consultation"

RIGHT SIDE:
- A large circular graphic showing a handshake or growth chart icon
- Decorative geometric shapes matching the template

- Quote: "YOUR FUTURE STARTS TODAY"
- Footer bar: "www.summitfinancial.com | info@summitfinancial.com | (480) 555-1234"
- Small text: "FOR CLIENT USE ONLY | Not for Distribution"

DESIGN STYLE:
- Match the EXACT layout, geometric shapes, diagonal color blocks, icon circles, and visual language of the reference image
- Use brand primary color (${colors.primary}) for main elements and secondary (${colors.secondary}) for accents
- Warm, conclusive feel while maintaining the same geometric corporate infographic style
- Professional closing slide`,
  },
]

async function generateSlide(slideConfig: typeof slides[0], index: number) {
  console.log(`Generating ${slideConfig.name}...`)

  const parts: any[] = [
    { text: 'REFERENCE DESIGN (match this EXACTLY): This image shows the visual style to follow. Replicate the same layout structure, geometric shapes, diagonal color blocks, icon circles, decorative elements, background treatment, and overall mood. The data/text content will be different, but the DESIGN must match this reference.' },
    { inlineData: { mimeType: 'image/png', data: templateBase64 } },
    { text: `You are generating a presentation slide image. Follow these instructions precisely.

=== SLIDE CONTENT ===
${slideConfig.prompt}

=== RULES ===
- Output exactly 1920x1080 pixels, landscape, 16:9
- Fill the ENTIRE canvas — no black bars or empty borders
- All text must be large enough to read on a phone (minimum 36pt equivalent)
- Use the FULL canvas — do not leave empty areas
- TEXT LIMIT: Maximum 60 words of visible text per slide
- Match the reference image's visual style EXACTLY — same geometric shapes, diagonal cuts, icon circles, footer bar, color block patterns
- The ONLY things that change are: the actual text content and the brand colors

=== FORBIDDEN ===
- Do NOT generate photographs of human faces
- Do NOT leave empty placeholder boxes
- Do NOT include any dates or calendar references
- Do NOT deviate from the reference design's layout language

This is slide ${index + 1} of 3.` },
  ]

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      responseFormat: {
        image: {
          aspectRatio: '16:9',
          imageSize: '4K',
        },
      },
    } as any,
  })

  const responseParts = response.candidates?.[0]?.content?.parts ?? []
  for (const rp of responseParts) {
    if (rp.inlineData) {
      const outPath = path.join(process.cwd(), 'public', 'style-previews', `apex-corporate-${slideConfig.name}.png`)
      fs.writeFileSync(outPath, Buffer.from(rp.inlineData.data!, 'base64'))
      console.log(`  ✓ Saved: ${outPath}`)
      return
    }
  }
  console.error(`  ✗ No image returned for ${slideConfig.name}`)
}

async function main() {
  console.log('Generating 3 sample slides with apex-corporate template...\n')
  for (let i = 0; i < slides.length; i++) {
    await generateSlide(slides[i], i)
  }
  console.log('\nDone! Check public/style-previews/ for the output.')
}

main().catch(console.error)
