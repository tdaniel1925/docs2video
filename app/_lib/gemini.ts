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
    // Insurance data
    return {
      headline: `"${data.carrier}" as the carrier name (plain text, no logo)`,
      subline: `"${data.policyType}" as the policy type`,
      metrics: `- Death Benefit: ${formatCurrency(data.deathBenefit)}\n- Annual Premium: ${formatCurrency(data.annualPremium)}`,
    }
  }
  // General data
  const topMetrics = data.keyMetrics.slice(0, 4).map(m => `- ${m.label}: ${m.value}`).join('\n')
  return {
    headline: `"${data.title}" as the document title`,
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
  referenceSlides?: Buffer[]
): Promise<Buffer> {
  const style = SLIDE_STYLES.find(s => s.id === styleId) ?? SLIDE_STYLES[0]
  const isInsurance = 'deathBenefit' in data

  let slideContents: Record<number, string>
  let contextBlock: string

  if (isInsurance) {
    const insuranceData = data as ExtractedPolicyData
    const cvRows = insuranceData.cashValueProjections
      .map(p => `Year ${p.year}: ${formatCurrency(p.current)}`)
      .join(', ')
    const cvRowsDetailed = insuranceData.cashValueProjections
      .map(p => `Year ${p.year}: Guaranteed ${formatCurrency(p.guaranteed)}, Illustrated ${formatCurrency(p.current)}`)
      .join('\n')

    slideContents = {
      0: `SLIDE 1 — TITLE CARD
Show prominently:
- "${insuranceData.carrier}" as carrier name (PLAIN TEXT ONLY — no logo)
- "${insuranceData.policyType}" as policy type
- "Prepared for ${insuranceData.insuredName}"
${brandName ? `- Display "${brandName}" prominently as part of the title card design — it should be the presenting company/agent name, styled elegantly to match the slide aesthetic` : ''}
Make this feel like a premium title card / cover slide. Elegant and inviting.`,

      1: `SLIDE 2 — CLIENT OVERVIEW
Show the client's information in a clear, organized layout:
- Insured: ${insuranceData.insuredName}
- Age: ${insuranceData.insuredAge ?? 'N/A'}
- Policy Type: ${insuranceData.policyType}
- Carrier: ${insuranceData.carrier}
- Payment Mode: ${insuranceData.paymentMode}
Use a clean card or profile-style layout. Professional and personal.`,

      2: `SLIDE 3 — DEATH BENEFIT
Make the death benefit the hero of this slide:
- Death Benefit: ${formatCurrency(insuranceData.deathBenefit)} — display this very large and prominent
- Add a brief visual element suggesting family protection (use icons or abstract shapes, NOT photos)
- Subtitle: "Total Protection for Your Family"
This should feel impactful and reassuring.`,

      3: `SLIDE 4 — PREMIUM BREAKDOWN
Show the cost details clearly:
- Annual Premium: ${formatCurrency(insuranceData.annualPremium)} — large and prominent
- Payment Mode: ${insuranceData.paymentMode}
${insuranceData.loanRate ? `- Policy Loan Rate: ${insuranceData.loanRate}%` : ''}
- Show a simple cost-to-benefit visual comparison
Make it feel transparent and straightforward.`,

      4: `SLIDE 5 — CASH VALUE GROWTH
Create a clear bar chart or growth visualization:
${cvRows}
Show the growth trajectory over time. Use bars or a line chart.
Label each data point clearly. Make the upward trend obvious.
Title: "Your Cash Value Over Time"`,

      5: `SLIDE 6 — GUARANTEED VS ILLUSTRATED
Create a comparison visual showing guaranteed vs illustrated values side by side:
${cvRowsDetailed}
Use a dual-bar chart, split comparison, or table format.
Title: "Guaranteed vs. Illustrated Values"
Make clear which is guaranteed and which is projected.`,

      6: `SLIDE 7 — RIDERS & FEATURES
List the policy riders and features in an organized, easy-to-scan layout:
${insuranceData.riders.map(r => `- ${r}`).join('\n')}
${insuranceData.additionalNotes.length > 0 ? `\nAdditional notes:\n${insuranceData.additionalNotes.map(n => `- ${n}`).join('\n')}` : ''}
Use checkmarks, icons, or cards for each feature. Make it scannable.
Title: "Your Policy Features"`,

      7: `SLIDE 8 — SUMMARY & CONTACT
Create a closing slide with:
- 3-4 key takeaways from the policy (death benefit, cash value growth, key riders)
- A clear call-to-action section
${brandName ? `- Feature "${brandName}" prominently in the call-to-action area as the contact/presenter name` : '- "Contact your agent" in prominent text'}
- "Powered by Docs2Video" in small footer text
Make it feel like a warm, confident closing. Inviting the client to take the next step.`,
    }

    contextBlock = `DOCUMENT CONTEXT (use for data accuracy):
- Carrier: ${insuranceData.carrier}
- Policy Type: ${insuranceData.policyType}
- Insured: ${insuranceData.insuredName}, Age ${insuranceData.insuredAge ?? 'N/A'}
- Death Benefit: ${formatCurrency(insuranceData.deathBenefit)}
- Annual Premium: ${formatCurrency(insuranceData.annualPremium)}
${brandName ? `- Agent/Agency: ${brandName}` : ''}`
  } else {
    const genData = data as ExtractedData
    const metricsText = genData.keyMetrics.map(m => `- ${m.label}: ${m.value}`).join('\n')
    const sectionsText = genData.sections.map(s => `- ${s.title}: ${s.content}`).join('\n')
    const bulletText = genData.bulletPoints.map(b => `- ${b}`).join('\n')

    slideContents = {
      0: `SLIDE 1 — TITLE CARD
Show prominently:
- "${genData.title}" as the main title
${genData.subtitle ? `- "${genData.subtitle}" as subtitle` : ''}
${genData.source ? `- "Source: ${genData.source}"` : ''}
${brandName ? `- Display "${brandName}" prominently as part of the title card design — it should be the presenting company/agent name, styled elegantly to match the slide aesthetic` : ''}
Make this feel like a premium title card / cover slide. Elegant and inviting.`,

      1: `SLIDE 2 — KEY METRICS OVERVIEW
Show the most important metrics in a clear, organized grid or card layout:
${metricsText}
Use large, prominent numbers for highlighted values. Professional and data-forward.`,

      2: `SLIDE 3 — DETAILED SECTIONS
Present the key sections of the document:
${sectionsText}
Use clear headings and concise text. Make it scannable and informative.`,

      3: `SLIDE 4 — KEY TAKEAWAYS
List the most important findings or conclusions:
${bulletText}
Use checkmarks, icons, or numbered items. Make each point stand out clearly.`,

      4: `SLIDE 5 — SUMMARY & CONTACT
Create a closing slide with:
- 3-4 key takeaways from the document
- A clear call-to-action section
${brandName ? `- Feature "${brandName}" prominently in the call-to-action area as the contact/presenter name` : '- "Contact us" in prominent text'}
- "Powered by Docs2Video" in small footer text
Make it feel like a warm, confident closing.`,
    }

    contextBlock = `DOCUMENT CONTEXT (use for data accuracy):
- Title: ${genData.title}
${genData.subtitle ? `- Subtitle: ${genData.subtitle}` : ''}
${genData.source ? `- Source: ${genData.source}` : ''}
- Key Metrics: ${genData.keyMetrics.slice(0, 4).map(m => `${m.label}: ${m.value}`).join(', ')}
${brandName ? `- Brand: ${brandName}` : ''}`
  }

  // Always force cover page for slide 0 and closing page for last slide
  // The AI script's slidePrompt is used for middle slides only
  let content: string
  if (slideIndex === 0) {
    // Always a branded cover/title page
    content = slideContents[0] + (slidePrompt ? `\n\nAdditional context from script: ${slidePrompt}` : '')
  } else if (slideContents[slideIndex] && !slidePrompt) {
    // Use hardcoded content if no AI prompt
    content = slideContents[slideIndex]
  } else {
    // Use AI-generated slidePrompt for middle slides
    content = slidePrompt ?? slideContents[slideIndex] ?? slideContents[0]
  }

  const hasLogo = !!(logoBuffer || logoUrl)

  // Use the new look-variant prompt system
  const { getLookPrompt, getDefaultLookId } = await import('./prompts/look-variants')
  const { assessLogoQuality, shouldUseFallback } = await import('./logo-quality')

  // Check logo quality to decide prompt family
  let useLogoPrompts = hasLogo
  if (logoBuffer) {
    const quality = await assessLogoQuality(logoBuffer)
    if (shouldUseFallback(quality)) {
      console.log(`[gemini] Logo failed quality check: ${quality.reasons.join(', ')}. Using fallback prompts.`)
      useLogoPrompts = false
    }
  }

  // Derive company name from brand or document data
  const derivedCompanyName = brandName
    ?? (isInsurance ? (data as ExtractedPolicyData).carrier : null)
    ?? (data as ExtractedData).source
    ?? (data as ExtractedData).title?.split(/[-–—:|]/)[0]?.trim()
    ?? ''

  // Build brand context for the prompt templates
  const brandCtx = {
    companyName: derivedCompanyName,
    primaryHex: colors.primary,
    secondaryHex: colors.secondary,
    accentHex: colors.accent,
    phone: contactInfo?.phone ?? '',
    website: contactInfo?.website ?? '',
    hasLogo: useLogoPrompts,
  }

  // Determine slide type
  const totalSlides = 5 // default deck size
  let slideType: 'cover' | 'content' | 'data' | 'quote' | 'closing' = 'content'
  if (slideIndex === 0) slideType = 'cover'
  else if (slideIndex >= totalSlides - 1) slideType = 'closing'

  // Build slide content for the template
  const slideContent = {
    slideType,
    headline: content.split('\n')[0]?.replace(/^SLIDE \d+ —\s*/i, '').replace(/^[A-Z ]+\n/m, '').trim().slice(0, 100) || 'Key Information',
    subheadline: undefined as string | undefined,
    bodyBlocks: content.split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim()).slice(0, 5),
    stats: undefined as { value: string; label: string }[] | undefined,
  }

  // If no body blocks found, split content into chunks
  if (slideContent.bodyBlocks.length === 0) {
    slideContent.bodyBlocks = content.split('\n').filter(l => l.trim().length > 10).slice(0, 5).map(l => l.trim())
  }

  // Get the look variant prompt
  const lookId = getDefaultLookId(useLogoPrompts)
  const lookVariant = getLookPrompt(useLogoPrompts, lookId)
  const lookPromptText = lookVariant.fn(brandCtx, slideContent)

  // Add style and consistency instructions
  const promptText = `${lookPromptText}

ADDITIONAL DESIGN GUIDANCE:
${style.prompt}

${contextBlock}

${referenceSlides && referenceSlides.length > 0 ? 'VISUAL REFERENCE: Reference slides have been provided. Match their exact visual style, layout patterns, color usage, and typography. The new slide must look like it belongs in the same deck.' : ''}

CONSISTENCY: This slide is part of a series. Maintain the SAME visual style, layout grid, color usage, and typography across all slides.`

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
