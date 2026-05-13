import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData, SlideStyleId } from './types'
import type { ExtractedData } from './extract-types'
import { SLIDE_STYLES } from './types'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const GENERIC_EXTRACTION_PROMPT = `You are an expert document analyzer. Analyze this document and extract ALL key information.

First, identify the document type (e.g. life insurance illustration, financial report, contract, proposal, medical record, legal document, business plan, etc.).

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "documentType": "string describing the type of document",
  "general": {
    "title": "string - a clear title summarizing the document",
    "subtitle": "string or null - a subtitle or secondary description",
    "source": "string or null - the organization or source of the document",
    "keyMetrics": [
      { "label": "string - metric name", "value": "string - metric value", "highlight": true/false }
    ],
    "sections": [
      { "title": "string - section heading", "content": "string - section summary" }
    ],
    "bulletPoints": ["string - key takeaway or finding"],
    "additionalNotes": ["string - any other important information"]
  },
  "insurance": null
}

IMPORTANT: If this is a life insurance illustration, ALSO populate the "insurance" field with this structure (otherwise leave it null):
{
  "policyType": "string (e.g. Whole Life, IUL, Universal Life, Term, VUL)",
  "carrier": "string (insurance company name)",
  "insuredName": "string",
  "insuredAge": number or null,
  "deathBenefit": number (initial face amount),
  "annualPremium": number,
  "paymentMode": "string (Annual, Monthly, etc.)",
  "cashValueProjections": [
    { "year": number, "guaranteed": number, "current": number }
  ],
  "surrenderValueProjections": [
    { "year": number, "guaranteed": number, "current": number }
  ],
  "riders": ["string"],
  "loanRate": number or null,
  "additionalNotes": ["string"]
}

Rules for the general format:
- keyMetrics should contain the most important numerical or categorical data points (up to 10)
- Mark the most important 2-3 metrics with highlight: true
- sections should summarize the main content areas of the document
- bulletPoints should list key findings, conclusions, or actionable items
- additionalNotes for any caveats, disclaimers, or other important context

Rules for insurance (if applicable):
- For cashValueProjections, include years 1, 5, 10, 15, 20, 25, 30 (or as many as available)
- For surrenderValueProjections, include the same years
- All monetary values should be plain numbers (no dollar signs, no commas)
- If a field is not found in the document, use null for optional fields or 0 for numbers
- Include any important riders or features in the riders array`

export async function extractDocumentData(pdfBase64: string): Promise<{ general: ExtractedData; insurance?: ExtractedPolicyData }> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          { text: GENERIC_EXTRACTION_PROMPT },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBase64,
            },
          },
        ],
      },
    ],
  })

  const text = response.text?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    const result: { general: ExtractedData; insurance?: ExtractedPolicyData } = {
      general: parsed.general as ExtractedData,
    }
    // Only include insurance data if it was detected and has meaningful values
    if (parsed.insurance && parsed.insurance.deathBenefit > 0) {
      result.insurance = parsed.insurance as ExtractedPolicyData
    }
    return result
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 200)}`)
  }
}

/** @deprecated Use extractDocumentData instead */
export async function extractPolicyData(pdfBase64: string): Promise<ExtractedPolicyData> {
  const result = await extractDocumentData(pdfBase64)
  if (result.insurance) return result.insurance
  // Fallback: convert general data to policy data shape for backward compat
  return {
    policyType: 'Unknown',
    carrier: result.general.source ?? 'Unknown',
    insuredName: 'Unknown',
    insuredAge: null,
    deathBenefit: 0,
    annualPremium: 0,
    paymentMode: 'Unknown',
    cashValueProjections: [],
    surrenderValueProjections: [],
    riders: [],
    loanRate: null,
    additionalNotes: result.general.additionalNotes,
  }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// NUCLEAR MODE: Gemini knows NOTHING about the brand.
// All branding (logo, company name, bottom bar, contact info) is handled by Sharp after generation.
// Gemini only gets COLOR PALETTE hex values for visual consistency.
function getStrictRules(hasPhoto: boolean = false, isFirstSlide: boolean = false, contactInfo?: { phone?: string; website?: string }): string {
  return `
STRICT RULES (MUST FOLLOW):
- Output EXACTLY 1920x1080 pixels, landscape orientation, 16:9 aspect ratio
- Fill the ENTIRE canvas — no black bars, no empty space, no letterboxing
- DO NOT draw, generate, or include any human faces, portraits, headshots, or photographs of people
- All text must be large enough to read on a phone screen (minimum 36pt equivalent)
- The image must look sharp and high resolution at 1920x1080

BRAND-FREE ZONE (CRITICAL):
- DO NOT include ANY company name, brand name, logo, lettermark, monogram, emblem, or brand mark ANYWHERE
- DO NOT write any company name as text on the slide — not in headers, corners, or anywhere
- The TOP-LEFT 300x100px area must be EMPTY or have simple background — a logo overlay goes there
- The BOTTOM 60px must be EMPTY or have simple background — a branded info bar goes there
- Focus ONLY on the CONTENT: data, metrics, charts, icons, section headings, and visual storytelling
- Use TOPICAL icons (gears, globes, charts, industry symbols) for visual interest — never brand marks
${isFirstSlide && hasPhoto ? `\n- Reserve a clean area (~200x200px) in the BOTTOM-RIGHT corner for a photo overlay. Keep it clear of important content.` : ''}`
}

// Helper to build content summary from either data format
function buildContentSummary(data: ExtractedPolicyData | ExtractedData): { headline: string; subline: string; metrics: string } {
  if ('deathBenefit' in data) {
    // Insurance data — never include carrier name
    return {
      headline: `"${data.policyType} Policy Overview"`,
      subline: `"Prepared for ${data.insuredName}"`,
      metrics: `- Death Benefit: ${formatCurrency(data.deathBenefit)}\n- Annual Premium: ${formatCurrency(data.annualPremium)}`,
    }
  }
  // General data
  const topMetrics = data.keyMetrics.slice(0, 4).map(m => `- ${m.label}: ${m.value}`).join('\n')
  return {
    headline: `"${data.title}"`,
    subline: data.subtitle ? `"${data.subtitle}"` : '',
    metrics: topMetrics || '- Key information from the document',
  }
}

function getDocumentTypeLabel(data: ExtractedPolicyData | ExtractedData): string {
  if ('deathBenefit' in data) return 'a life insurance policy overview'
  return 'a professional document presentation'
}

// Generate style preview thumbnails (4 styles for user to choose)
export async function generateStylePreviews(
  data: ExtractedPolicyData | ExtractedData,
  brandName: string | null,
  logoUrl: string | null,
  colors: { primary: string; secondary: string; accent: string; background: string; text: string }
): Promise<{ styleId: string; image: Buffer }[]> {
  const results: { styleId: string; image: Buffer }[] = []
  const summary = buildContentSummary(data)

  for (const style of SLIDE_STYLES) {
    const prompt = `Create a professional presentation slide for ${getDocumentTypeLabel(data)}.

DESIGN STYLE: ${style.prompt}

BRAND COLORS:
- Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}
- Background: ${colors.background}, Text: ${colors.text}

CONTENT TO SHOW:
- ${summary.headline}
${summary.subline ? `- ${summary.subline}` : ''}
${summary.metrics}
${brandName ? `- "${brandName}" as agent/agency name in styled text` : ''}

${getStrictRules()}`

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: prompt,
        config: {
          responseFormat: {
            image: {
              aspectRatio: '16:9',
              imageSize: '4K',
            },
          },
        } as any,
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []
      for (const part of parts) {
        if (part.inlineData) {
          results.push({ styleId: style.id, image: Buffer.from(part.inlineData.data!, 'base64') })
          break
        }
      }
    } catch (err) {
      console.error(`[gemini] Style preview "${style.id}" failed:`, err)
    }
  }

  return results
}

// Download an image URL to a buffer
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// Generate a single slide with specific style and content
export async function generateSlide(
  data: ExtractedPolicyData | ExtractedData,
  slideIndex: number,
  styleId: SlideStyleId,
  brandName: string | null,
  logoUrl: string | null,
  colors: { primary: string; secondary: string; accent: string; background: string; text: string },
  slidePrompt?: string,
  hasPhoto: boolean = false,
  contactInfo?: { phone?: string; website?: string },
  logoBuffer?: Buffer | null,
  referenceSlides?: Buffer[],
  totalSlides: number = 5
): Promise<Buffer> {
  const style = SLIDE_STYLES.find(s => s.id === styleId) ?? SLIDE_STYLES[0]
  const isInsurance = 'deathBenefit' in data

  // Determine slide position
  const isFirst = slideIndex === 0
  const isLast = slideIndex >= totalSlides - 1
  const isDisclaimer = slidePrompt?.toLowerCase().includes('before we begin, please note') ||
    slidePrompt?.toLowerCase().includes('educational and informational purposes')

  // Build the visual content description for this specific slide
  // This tells Gemini WHAT to show — not HOW (that's the style prompt's job)
  let visualContent: string

  if (isDisclaimer) {
    visualContent = `Create a clean, professional DISCLAIMER slide.
Display this text prominently and legibly on the slide:
"Important Disclosure"
Then in smaller but readable text:
"This video is for educational and informational purposes only. It is not legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. Please consult with your licensed professional before making decisions."
Use a subtle icon like a shield or document seal for visual interest.`
  } else if (isFirst) {
    if (isInsurance) {
      const ins = data as ExtractedPolicyData
      visualContent = `Create an elegant TITLE/COVER slide for a life insurance policy overview.
Show this text on the slide:
Title: "${ins.policyType} Policy Overview"
Subtitle: "Prepared for ${ins.insuredName}"
${brandName ? `Small text: "Presented by ${brandName}"` : ''}
Make it feel premium and trustworthy. Use appropriate icons like a shield or family silhouette.`
    } else {
      const gen = data as ExtractedData
      visualContent = `Create an elegant TITLE/COVER slide.
Show this text on the slide:
Title: "${gen.title}"
${gen.subtitle ? `Subtitle: "${gen.subtitle}"` : ''}
${brandName ? `Small text: "Presented by ${brandName}"` : ''}
Make it feel professional and polished.`
    }
  } else if (isLast) {
    visualContent = `Create a professional CLOSING slide.
Show this text on the slide:
Title: "Thank You"
${brandName ? `Subtitle: "Presented by ${brandName}"` : 'Subtitle: "Questions? Let\'s connect."'}
${contactInfo?.phone ? `Phone: ${contactInfo.phone}` : ''}
${contactInfo?.website ? `Website: ${contactInfo.website}` : ''}
Include a subtle call-to-action feel.`
  } else if (slidePrompt) {
    // AI-generated scene — extract the TOPIC from the slidePrompt, not visual instructions
    // The slidePrompt describes what the slide should show conceptually
    visualContent = `Create a professional CONTENT slide about the following topic.
The narration for this slide discusses: ${slidePrompt}
Design a visually engaging slide that illustrates this topic.
Use icons, shapes, or abstract graphics to represent the concept — NOT photographs of people.
Include a clear headline and 2-4 key data points or bullet points as readable text on the slide.
The text on the slide should be the KEY FACTS only — short phrases, not full sentences.`
  } else {
    visualContent = `Create a professional content slide. Use placeholder content about the document topic.`
  }

  // Build the complete prompt — clean separation of concerns
  const promptText = `You are generating a presentation slide image. Follow these instructions precisely.

=== DESIGN STYLE (HIGHEST PRIORITY) ===
${style.prompt}

=== COLORS ===
Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}

=== WHAT TO SHOW ON THIS SLIDE ===
${visualContent}

=== RULES ===
- Output exactly 1920x1080 pixels, landscape, 16:9
- Fill the ENTIRE canvas — no black bars or empty borders
- All text must be large enough to read on a phone (minimum 36pt equivalent)
- Use ONLY the design style described above — do not switch to a generic corporate look
- TOP-LEFT 300x100px must be empty (logo overlay goes there later)
- BOTTOM 60px must be empty (info bar overlay goes there later)
${isInsurance ? '- LEGAL: Do NOT display any insurance carrier or company name anywhere on the slide. This is a legal requirement.' : ''}
${isFirst && hasPhoto ? '- Reserve a clean 200x200px area in the bottom-right for a photo overlay.' : ''}

=== FORBIDDEN (DO NOT DO ANY OF THESE) ===
- Do NOT render raw field labels like "Headline:", "Subheadline:", "slidePrompt:", "narration:" etc.
- Do NOT render any prompt instructions, JSON, or metadata as visible text
- Do NOT include any company logos, lettermarks, or brand marks
- Do NOT generate photographs of human faces
${isInsurance ? '- Do NOT write any insurance carrier name, company name, or brand name on the slide' : ''}

${referenceSlides && referenceSlides.length > 0 ? '=== VISUAL REFERENCE ===\nReference slides are attached. Match their EXACT visual style — same background, colors, textures, typography, and effects. The new slide must look like it belongs in the same deck.' : ''}

=== CONSISTENCY ===
This is slide ${slideIndex + 1} of ${totalSlides}. ALL slides must share identical visual treatment.`

  // Build the content parts — text first, then logo image, then reference slides
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: promptText },
  ]

  // Add logo image if available
  if (logoBuffer) {
    parts.push({
      inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') },
    })
  }

  // Add reference slides if available
  if (referenceSlides) {
    for (const ref of referenceSlides) {
      parts.push({
        inlineData: { mimeType: 'image/png', data: ref.toString('base64') },
      })
    }
  }

  const response = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
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
      return Buffer.from(rp.inlineData.data!, 'base64')
    }
  }

  throw new Error(`Gemini did not return an image for slide ${slideIndex + 1}`)
}

// Keep the infographic generation for backward compatibility
export async function generateInfographicImage(
  data: ExtractedPolicyData | ExtractedData,
  brandName: string | null,
  colors: { primary: string; secondary: string; accent: string; background: string; text: string },
  pageSize: 'portrait' | 'landscape'
): Promise<Buffer> {
  const orientation = pageSize === 'portrait' ? 'portrait (8.5" x 11")' : 'landscape (11" x 8.5")'
  const aspectRatio = pageSize === 'portrait' ? '9:16' : '16:9'
  const isInsurance = 'deathBenefit' in data

  let dataBlock: string

  if (isInsurance) {
    const insuranceData = data as ExtractedPolicyData
    const cvRows = insuranceData.cashValueProjections
      .map(p => `  Year ${p.year}: Guaranteed ${formatCurrency(p.guaranteed)}, Current ${formatCurrency(p.current)}`)
      .join('\n')
    const riders = insuranceData.riders.length > 0 ? insuranceData.riders.join(', ') : 'None listed'

    dataBlock = `POLICY DATA:
- Carrier: ${insuranceData.carrier}
- Policy Type: ${insuranceData.policyType}
- Insured: ${insuranceData.insuredName}, Age ${insuranceData.insuredAge ?? 'N/A'}
- Death Benefit: ${formatCurrency(insuranceData.deathBenefit)}
- Annual Premium: ${formatCurrency(insuranceData.annualPremium)}
- Payment Mode: ${insuranceData.paymentMode}
${insuranceData.loanRate ? `- Loan Rate: ${insuranceData.loanRate}%` : ''}
- Cash Value Projections:\n${cvRows}
- Riders: ${riders}`
  } else {
    const genData = data as ExtractedData
    const metricsText = genData.keyMetrics.map(m => `- ${m.label}: ${m.value}`).join('\n')
    const sectionsText = genData.sections.slice(0, 4).map(s => `- ${s.title}: ${s.content}`).join('\n')
    const bulletText = genData.bulletPoints.slice(0, 6).map(b => `- ${b}`).join('\n')

    dataBlock = `DOCUMENT DATA:
- Title: ${genData.title}
${genData.subtitle ? `- Subtitle: ${genData.subtitle}` : ''}
${genData.source ? `- Source: ${genData.source}` : ''}
Key Metrics:
${metricsText}
Sections:
${sectionsText}
Key Points:
${bulletText}`
  }

  const prompt = `Create a professional, visually stunning infographic for ${getDocumentTypeLabel(data)}.

BRAND COLORS:
- Primary: ${colors.primary}, Secondary: ${colors.secondary}, Accent: ${colors.accent}
- Background: ${colors.background}, Text: ${colors.text}
${brandName ? `- Display "${brandName}" as plain styled text — DO NOT create a logo graphic` : ''}

${dataBlock}

FOOTER: "Generated by Docs2Video"
${getStrictRules()}

Make it ${orientation}. High-end magazine quality, clean sections, bar charts, icons, professional typography.`

  const response = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: prompt,
    config: {
      responseFormat: {
        image: {
          aspectRatio,
          imageSize: '4K',
        },
      },
    } as any,
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part.inlineData) {
      return Buffer.from(part.inlineData.data!, 'base64')
    }
  }

  throw new Error('Gemini did not return an image')
}
