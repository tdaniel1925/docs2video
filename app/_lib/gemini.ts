import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData, SlideStyleId } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'
import { SLIDE_STYLES } from './types'
import { buildStructuredPrompt } from './prompt-builder'
import { INDUSTRIES, detectIndustry, type IndustryId } from './industries'
import { classifyDocument, type DocumentClassification } from './document-classifier'
import { extractInsuranceWithOpus } from './insurance-extractor'
import { reconcileInsuranceExtraction, type ReconciliationResult } from './insurance-reconciler'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Image generation model — switch between models via env var without code changes
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

// Generate a simple fallback slide when Gemini fails to return an image
async function generateFallbackSlide(title: string, primaryColor: string): Promise<Buffer> {
  const sharp = (await import('sharp')).default ?? (await import('sharp'))
  // Escape XML special characters in title
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const svg = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1920" height="1080" fill="${primaryColor}"/>
    <text x="960" y="540" text-anchor="middle" font-size="48" fill="white" font-family="sans-serif">${safeTitle}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

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
    "additionalNotes": ["string - any other important information"],
    "disclaimers": ["string - full text of any disclaimer, disclosure, legal notice, or compliance text"],
    "industry": "string — detect the industry from content. One of: insurance, financial, real_estate, mortgage, healthcare, legal, consulting, education, accounting, technology, hr, sales, general"
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
  "additionalNotes": ["string"],
  "disclaimers": ["string - full text of any disclaimer, disclosure, legal notice, or compliance text"]
}

IMPORTANT: If the document is very long (more than 20 pages), focus on the first 20 pages and summarize the rest.

Rules for the general format:
- keyMetrics should contain the most important numerical or categorical data points (up to 10)
- Mark the most important 2-3 metrics with highlight: true
- sections should summarize the main content areas of the document
- bulletPoints should list key findings, conclusions, or actionable items
- additionalNotes for any caveats, disclaimers, or other important context
- disclaimers: Extract ALL disclaimer, disclosure, legal notice, and compliance text found anywhere in the document. Include the full text of each disclaimer exactly as written. If none found, use an empty array.

Rules for insurance (if applicable):
- For cashValueProjections, include years 1, 5, 10, 15, 20, 25, 30 (or as many as available)
- For surrenderValueProjections, include the same years
- All monetary values should be plain numbers (no dollar signs, no commas)
- If a field is not found in the document, use null for optional fields or 0 for numbers
- Include any important riders or features in the riders array
- disclaimers: Extract ALL disclaimer, disclosure, legal notice, and compliance text found anywhere in the document. Include the full text of each disclaimer exactly as written. If none found, use an empty array.`

export async function extractDocumentData(pdfBase64: string, mimeType: string = 'application/pdf', preserveAllPages: boolean = false): Promise<{ general: ExtractedData; insurance?: ExtractedPolicyData; classification?: DocumentClassification; reconciliation?: ReconciliationResult }> {
  // PASS 1: Classify the document (fast, cheap — Gemini Flash)
  let classification: DocumentClassification | undefined
  try {
    classification = await classifyDocument(pdfBase64, mimeType)
    console.log(`[classify] Type: ${classification.documentType} (${(classification.confidence * 100).toFixed(0)}% confidence), perspective: ${classification.perspective}`)
  } catch (e) {
    console.error('[classify] Classification failed, using generic extraction:', e)
  }

  // PASS 2: Deep extraction with targeted prompt based on classification
  let prompt = buildTargetedExtractionPrompt(classification, preserveAllPages)

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: pdfBase64 } },
        ],
      },
    ],
  })

  const text = response.text?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    const result: { general: ExtractedData; insurance?: ExtractedPolicyData; classification?: DocumentClassification } = {
      general: parsed.general as ExtractedData,
      classification,
    }

    // Enrich general data with classification insights
    if (classification) {
      result.general.industry = result.general.industry || classification.industry
      // Add red flags and action items to bullet points if not already present
      if (classification.redFlags.length > 0 && result.general.bulletPoints.length < 10) {
        result.general.bulletPoints = [
          ...result.general.bulletPoints,
          ...classification.redFlags.map(rf => `⚠ ${rf}`),
        ]
      }
      if (classification.actionItems.length > 0) {
        result.general.additionalNotes = [
          ...(result.general.additionalNotes || []),
          ...classification.actionItems.map(ai => `Action: ${ai}`),
        ]
      }
    }

    // Validate we got meaningful data
    if (!result.general.title && result.general.keyMetrics.length === 0 && result.general.sections.length === 0) {
      throw new Error('Could not extract meaningful data from this document. The file may be image-only, password-protected, or in an unsupported format.')
    }

    // Insurance routing trigger: true OR — either classification says insurance OR Gemini found deathBenefit > 0
    // This ensures a misclassified-but-real illustration still gets the Opus path.
    const isInsuranceDoc = classification?.category === 'insurance' ||
      classification?.documentType === 'life_insurance_illustration' ||
      (parsed.insurance && parsed.insurance.deathBenefit > 0)

    if (isInsuranceDoc) {
      console.log(`[extract] Insurance detected (classification=${classification?.category}, geminiDB=${parsed.insurance?.deathBenefit}) — running Claude Opus extraction`)
      const opusResult = await extractInsuranceWithOpus(pdfBase64, mimeType)
      if (opusResult) {
        result.insurance = opusResult
        console.log(`[extract] Opus insurance extraction succeeded: ${opusResult.policyType}, DB=${opusResult.deathBenefit}, confidence=${opusResult.extractionConfidence}`)

        // RECONCILIATION: Gemini 2.5 Pro cross-checks Opus output against the PDF (different model family)
        console.log(`[extract] Running Gemini reconciliation pass...`)
        const reconciliation = await reconcileInsuranceExtraction(pdfBase64, mimeType, opusResult)
        ;(result as any).reconciliation = reconciliation

        if (reconciliation.overallVerdict === 'fail') {
          console.error(`[extract] RECONCILIATION FAILED — mismatches: ${reconciliation.mismatches.map(m => m.field).join(', ')}`)
          result.insurance.sanityFlags = [
            ...(result.insurance.sanityFlags || []),
            `RECONCILIATION_FAILED: ${reconciliation.mismatches.length} mismatches found. ${reconciliation.mismatches.map(m => `${m.field}: ${m.issue}`).join('; ')}`,
          ]
        } else if (reconciliation.overallVerdict === 'review') {
          console.warn(`[extract] Reconciliation flagged for REVIEW — ${reconciliation.unverifiable.length} unverifiable, ${reconciliation.mismatches.length} minor mismatches`)
          result.insurance.sanityFlags = [
            ...(result.insurance.sanityFlags || []),
            `RECONCILIATION_REVIEW: ${reconciliation.unverifiable.length} unverifiable fields, ${reconciliation.mismatches.length} minor discrepancies`,
          ]
        } else {
          console.log(`[extract] Reconciliation PASSED — all numbers verified`)
        }
      } else {
        // Opus failed — route to REVIEW state. Do NOT silently auto-proceed on Gemini's metadata-less output.
        // Gemini output is included but flagged as unverified — must pass through reconciliation + sanity checks.
        console.warn(`[extract] Opus extraction failed — flagging for REVIEW (no column metadata available)`)
        if (parsed.insurance && parsed.insurance.deathBenefit > 0) {
          const geminiInsurance = parsed.insurance as ExtractedPolicyData
          geminiInsurance.extractionConfidence = 0
          geminiInsurance.lowConfidenceFields = ['ALL — Opus extraction failed, Gemini fallback has no column metadata']
          geminiInsurance.sanityFlags = ['OPUS_EXTRACTION_FAILED: Column metadata unavailable. Requires human review before video generation.']
          result.insurance = geminiInsurance
        }
      }
    }
    return result
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 200)}`)
    }
    throw err
  }
}

/**
 * Build a targeted extraction prompt based on the document classification.
 * Each document type gets specific extraction guidance so the AI knows exactly
 * what to look for instead of trying to fit everything into a generic schema.
 */
function buildTargetedExtractionPrompt(classification: DocumentClassification | undefined, preserveAllPages: boolean): string {
  const docType = classification?.documentType || 'unknown'

  // Document-type-specific extraction guidance
  const typeGuidance: Record<string, string> = {
    // Insurance
    life_insurance_illustration: `This is a LIFE INSURANCE ILLUSTRATION. Focus on:
- Policy type, carrier, insured name/age
- Death benefit amount and any changes over time
- Annual premium and payment mode
- Cash value projections (guaranteed vs current) at years 1, 5, 10, 15, 20, 25, 30
- Surrender value projections at the same intervals
- Riders and their costs
- Loan rate and provisions
- Key guarantees and what happens if they expire
- All disclaimers verbatim`,

    annuity_contract: `This is an ANNUITY CONTRACT. Focus on:
- Contract type (fixed, variable, indexed, immediate, deferred)
- Carrier and contract holder
- Premium/contribution amount
- Guaranteed minimum interest rate
- Current crediting rate
- Accumulation value projections
- Payout schedule and options (life, period certain, joint)
- Surrender schedule (charges by year)
- Death benefit provisions
- Fees (M&E, admin, rider charges)
- Free withdrawal provisions
- All disclaimers verbatim
IMPORTANT: This is NOT a life insurance illustration. Do NOT extract death benefit as the primary metric.`,

    health_insurance_eob: `This is a HEALTH INSURANCE EOB (Explanation of Benefits). Focus on:
- Provider name and date of service
- Procedure codes and descriptions
- Billed amount vs allowed amount vs insurance paid vs patient responsibility
- Deductible applied, copay, coinsurance
- In-network vs out-of-network status
- Claim status (paid, denied, pending)
- Any denied services and denial reasons
- Appeal instructions and deadlines
- Year-to-date deductible and out-of-pocket totals`,

    bank_statement: `This is a BANK STATEMENT. Focus on:
- Account holder and account type (checking, savings)
- Statement period
- Opening and closing balance
- Total deposits and withdrawals
- Top spending categories (if discernible from transaction descriptions)
- Recurring charges and subscriptions
- Any fees charged (overdraft, maintenance, ATM)
- Interest earned
- Unusual or large transactions
- Average daily balance`,

    credit_report: `This is a CREDIT REPORT. Focus on:
- Credit scores (and which bureau)
- Number of accounts (open, closed, delinquent)
- Total credit utilization percentage
- Payment history summary
- Hard inquiries (last 2 years)
- Collections or negative items
- Oldest account age
- Public records (bankruptcies, liens, judgments)
- Factors helping and hurting the score`,

    mortgage_statement: `This is a MORTGAGE STATEMENT. Focus on:
- Lender and loan number
- Property address
- Original loan amount and current balance
- Interest rate (fixed or ARM, if ARM: next adjustment date)
- Monthly payment breakdown (principal, interest, escrow, PMI)
- Year-to-date interest and principal paid
- Escrow balance and upcoming disbursements
- Maturity date
- Prepayment penalty provisions
- Late payment terms`,

    tax_return: `This is a TAX RETURN. Focus on:
- Filing status and tax year
- Total income (W-2, 1099, other sources)
- Adjusted Gross Income (AGI)
- Deductions (standard vs itemized, and major items)
- Tax credits claimed
- Total tax liability
- Payments and withholdings
- Refund or amount owed
- Effective tax rate
- Self-employment income if applicable`,

    investment_statement: `This is an INVESTMENT/BROKERAGE STATEMENT. Focus on:
- Account type (brokerage, IRA, 401k, etc.)
- Total portfolio value
- Holdings by asset class (stocks, bonds, funds, cash)
- Top positions by value
- Period performance (return %, dollar change)
- Dividends and distributions received
- Contributions and withdrawals
- Fees charged
- Asset allocation percentages
- Unrealized gains/losses`,

    loan_agreement: `This is a LOAN AGREEMENT. Focus on:
- Lender and borrower
- Loan amount and purpose
- Interest rate (APR) and type (fixed/variable)
- Repayment schedule and term
- Monthly payment amount
- Total cost of the loan over the full term
- Origination fees and other closing costs
- Prepayment penalty terms
- Default and late payment provisions
- Collateral requirements
- Balloon payment if applicable`,

    earnings_report: `This is a PUBLIC COMPANY EARNINGS REPORT (10-K/10-Q). Focus on:
- Company name and reporting period
- Revenue (total and by segment)
- Net income and EPS
- Year-over-year and quarter-over-quarter changes
- Gross margin, operating margin, net margin
- Cash and debt positions
- Guidance (forward-looking statements)
- Key risk factors
- Major business developments
- Share buyback and dividend info`,

    pitch_deck: `This is a PITCH DECK / INVESTOR PRESENTATION. Focus on:
- Company name and what they do (one sentence)
- Problem being solved
- Solution and value proposition
- Target market and market size (TAM, SAM, SOM)
- Business model and pricing
- Traction and key metrics (users, revenue, growth rate)
- Competitive landscape and differentiation
- Team highlights
- The ask (funding amount, use of funds)
- Timeline and milestones`,

    lease_agreement: `This is a LEASE AGREEMENT. Focus on:
- Landlord and tenant names
- Property address and description
- Lease term (start, end, renewal options)
- Monthly rent and when it's due
- Security deposit amount and return conditions
- Rent increase provisions
- Maintenance responsibilities (landlord vs tenant)
- Early termination clause and penalties
- Pet policy
- Subletting rules
- Utilities included/excluded`,

    employment_contract: `This is an EMPLOYMENT CONTRACT. Focus on:
- Employer and employee
- Job title and responsibilities
- Compensation (salary, bonus structure, equity)
- Benefits (health, retirement, PTO)
- Start date and term (at-will or fixed)
- Non-compete scope (geography, duration, industry)
- Non-solicitation terms
- IP assignment and confidentiality
- Termination provisions (cause, severance)
- Change of control provisions`,

    lab_results: `This is a LAB RESULTS / MEDICAL TEST report. Focus on:
- Patient name and date of tests
- Each test name, result value, reference range, and flag (normal/high/low)
- Any critical or out-of-range values (highlight these prominently)
- Ordering physician
- Specimen type and collection date
- Any notes or comments from the lab
Do NOT give medical advice, but DO clearly flag which results are outside normal range.`,

    medical_bill: `This is a MEDICAL BILL. Focus on:
- Provider/facility name
- Patient name and account number
- Date of service
- Itemized charges (procedure, quantity, charge)
- Insurance adjustments and payments
- Patient responsibility (total due)
- Payment due date
- Payment plan options
- Look for: duplicate charges, unbundled codes, out-of-network markups`,

    social_security_statement: `This is a SOCIAL SECURITY STATEMENT. Focus on:
- Estimated monthly benefits at age 62, full retirement age, and age 70
- Full retirement age for this person
- Earnings record (yearly earnings history)
- Disability benefit estimate
- Survivor benefit estimates
- Medicare eligibility
- Credits earned vs credits needed`,

    property_tax_assessment: `This is a PROPERTY TAX ASSESSMENT. Focus on:
- Property address and parcel number
- Assessed value (land + improvements)
- Market value comparison
- Tax rate and mill levy
- Annual tax amount
- Exemptions applied (homestead, senior, etc.)
- Assessment change from prior year
- Appeal deadline and process`,
  }

  // Get specific guidance or use generic
  const specific = typeGuidance[docType] || ''

  // Build empathy layer based on classification
  const perspectiveInstruction = classification
    ? `\nVIDEO PERSPECTIVE: This video explains the document to a "${classification.perspective}". Frame everything from THEIR point of view. Use "your" not "the policyholder's". Example: "Your monthly payment is $1,247" not "The borrower's monthly payment is $1,247".`
    : ''

  const toneInstruction = classification
    ? `\nNARRATION TONE: ${classification.tone}. The key question this video answers: "${classification.keyQuestion}"`
    : ''

  let prompt = `You are an expert document analyzer. Analyze this document and extract ALL key information.
${specific ? `\nDOCUMENT TYPE DETECTED: ${classification?.documentType || 'unknown'}\n${specific}\n` : ''}
${perspectiveInstruction}
${toneInstruction}

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
    "additionalNotes": ["string - any other important information"],
    "disclaimers": ["string - full text of any disclaimer, disclosure, legal notice, or compliance text"],
    "industry": "string — one of: insurance, financial, real_estate, mortgage, healthcare, legal, consulting, education, accounting, technology, hr, sales, general"
  },
  "insurance": null
}

IMPORTANT: If this is a LIFE INSURANCE ILLUSTRATION (NOT an annuity, NOT a financial report), ALSO populate the "insurance" field with this structure (otherwise leave it null):
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
  "additionalNotes": ["string"],
  "disclaimers": ["string"]
}

${preserveAllPages ? '' : 'IMPORTANT: If the document is very long (more than 20 pages), focus on the first 20 pages and summarize the rest.'}

Rules for the general format:
- keyMetrics should contain the most important numerical or categorical data points (up to 10)
- Mark the most important 2-3 metrics with highlight: true
- sections should summarize the main content areas of the document
- bulletPoints should list key findings, conclusions, or actionable items
- additionalNotes for any caveats, disclaimers, or other important context
- disclaimers: Extract ALL disclaimer text found in the document verbatim`

  if (preserveAllPages) {
    prompt += `

=== OVERRIDE — PRESERVE ALL PAGES ===
CRITICAL: This is a slide deck or presentation being redesigned. You MUST:
1. Create EXACTLY one section for EVERY page/slide in the document
2. Do NOT summarize, combine, merge, or skip ANY pages
3. Each section title should reflect that page's actual heading or topic
4. Each section content should capture ALL text and data from that specific page
5. The total number of sections in your output MUST equal the total number of pages in the document
6. If a page has minimal content, still create a section for it
This is NOT optional. The user specifically requested every page be preserved.`
  }

  return prompt
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

BRAND-FREE ZONE (CRITICAL — ZERO TOLERANCE):
- DO NOT include ANY company name, brand name, logo, lettermark, monogram, emblem, or brand mark ANYWHERE on the slide
- DO NOT write any company name as text — not in headers, footers, corners, watermarks, or anywhere else
- DO NOT attempt to spell, render, or display any brand name even if one is mentioned in the context — IGNORE IT completely
- If you see a brand name in the prompt context, DO NOT put it on the slide. The brand name will be added separately later.
- DO NOT create any text that looks like a logo or brand identity element
- Use the FULL canvas for your design — do not leave any empty areas, reserved zones, or placeholder spaces
- Focus ONLY on the CONTENT: data, metrics, charts, icons, section headings, and visual storytelling
- Use TOPICAL icons (gears, globes, charts, industry symbols) for visual interest — never brand marks
${isFirstSlide && hasPhoto ? `\n- Reserve a clean area (~200x200px) in the BOTTOM-RIGHT corner for a photo overlay. Keep it clear of important content.` : ''}`
}

// Helper to build content summary from either data format
function buildContentSummary(data: ExtractedPolicyData | ExtractedData): { headline: string; subline: string; metrics: string } {
  if (isInsuranceData(data)) {
    // Insurance data — never include carrier name
    return {
      headline: `"${data.policyType} Policy Overview"`,
      subline: `"Prepared for ${data.insuredName}"`,
      metrics: `- Death Benefit: ${formatCurrency(data.deathBenefit)}\n- Annual Premium: ${formatCurrency(data.annualPremium)}`,
    }
  }
  // General data
  const gd = data as ExtractedData
  const topMetrics = (gd.keyMetrics ?? []).slice(0, 4).map(m => `- ${m.label}: ${m.value}`).join('\n')
  return {
    headline: `"${gd.title}"`,
    subline: gd.subtitle ? `"${gd.subtitle}"` : '',
    metrics: topMetrics || '- Key information from the document',
  }
}

function getDocumentTypeLabel(data: ExtractedPolicyData | ExtractedData): string {
  if (isInsuranceData(data)) return 'a life insurance policy overview'
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
        model: IMAGE_MODEL,
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
  totalSlides: number = 5,
  customStylePrompt?: string,
  colorSwatchBuffer?: Buffer | null,
  previousSlideBuffer?: Buffer | null,
  templateRefBuffer?: Buffer | null,
  assetBuffer?: Buffer | null
): Promise<Buffer> {
  const style = SLIDE_STYLES.find(s => s.id === styleId) ?? SLIDE_STYLES[0]
  // Custom style prompt overrides the built-in style
  const stylePromptText = customStylePrompt || style.prompt
  const isInsurance = isInsuranceData(data)

  // Detect industry for visual style guidance
  const industryId = isInsurance ? 'insurance' : ((data as any).industry || detectIndustry((data as ExtractedData).title || '', JSON.stringify(data))) as IndustryId
  const industryConfig = INDUSTRIES[industryId] || INDUSTRIES.general

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
    // Cover slide: Gemini generates a DECORATIVE BACKGROUND FRAME only.
    // Logo + title text will be composited on top by GPT Image overlay.
    visualContent = `Create a beautiful DECORATIVE BACKGROUND for a cover slide.
This is ONLY a background frame — do NOT include any text, titles, logos, or brand names.
Design an elegant, premium background with:
- Rich visual textures, patterns, or abstract shapes that match the style
- A clear central area (roughly 800x600px in the middle) left relatively clean for an overlay
- Decorative borders, corner elements, or framing that adds visual polish
- Use the brand colors provided to create a cohesive look
Do NOT write ANY text on this slide. No titles, no names, no words at all.
This is purely a decorative visual backdrop.`
  } else if (isLast) {
    // Closing slide: Same approach — decorative background only.
    visualContent = `Create a beautiful DECORATIVE BACKGROUND for a closing/thank-you slide.
This is ONLY a background frame — do NOT include any text, titles, logos, or brand names.
Design an elegant, professional background with:
- A warm, conclusive feel (subtle gradients, elegant patterns)
- A clear central area left clean for an overlay with logo and contact info
- Decorative elements that signal "conclusion" or "thank you" without using words
- Use the brand colors provided
Do NOT write ANY text on this slide. No titles, no "thank you", no contact info, no words at all.
This is purely a decorative visual backdrop.`
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

  // Build the structured prompt using the 6-component formula
  const structuredPrompt = buildStructuredPrompt({
    subject: visualContent,
    action: isFirst ? 'Elegant title card with premium typography and visual hierarchy'
      : isLast ? 'Professional closing card with call-to-action feel'
      : isDisclaimer ? 'Clean legal disclaimer with prominent readable text'
      : 'Data-driven content slide with clear headline, key data points, and supporting icons',
    environment: isFirst && hasPhoto
      ? 'Professional presentation canvas with a reserved clean 200x200px area in the bottom-right for a photo overlay'
      : 'Full-bleed professional presentation canvas, no empty reserved areas',
    artStyle: stylePromptText,
    brandColors: colors,
  })

  // Build the complete prompt — clean separation of concerns
  const promptText = `You are generating a presentation slide image. Follow these instructions precisely.

=== DATA FIDELITY (CRITICAL) ===
- ONLY display text, numbers, and facts that are explicitly provided in the description below.
- Do NOT invent, hallucinate, or add any information not given.
- Do NOT add insurance/financial terminology unless the content explicitly discusses insurance/finance.

=== STRUCTURED IMAGE DESCRIPTION ===
${structuredPrompt}

=== RULES ===
- Output exactly 1920x1080 pixels, landscape, 16:9
- BOTTOM BAR ZONE: Keep ALL content (text, icons, data, visuals) within the top 980 pixels. The bottom 100 pixels will be covered by a branded bar — do NOT place any important content there.
- Fill the ENTIRE canvas — no black bars or empty borders
- All text must be large enough to read on a phone (minimum 36pt equivalent)
- Use ONLY the design style described above — do not switch to a generic corporate look
- Use the FULL canvas — do not leave empty areas, reserved zones, or placeholder boxes
- VERIFY: Every number, dollar amount, and percentage on the slide MUST exactly match the data provided. Do not round, estimate, or change any numbers.
- TEXT LIMIT: Maximum 50 words of visible text per slide. Use large numbers, short labels, and icons instead of paragraphs.
- VISUAL STYLE GUIDANCE: ${industryConfig.slideHints}
${previousSlideBuffer || templateRefBuffer ? '- VISUAL CONSISTENCY: Match the exact same color palette, font style, layout grid, and visual language as the reference image provided. The slides must look like they belong to the same deck.' : ''}
${isInsurance ? '- LEGAL: Do NOT display any insurance carrier or company name anywhere on the slide. This is a legal requirement.' : ''}

=== FORBIDDEN (DO NOT DO ANY OF THESE) ===
- Do NOT render raw field labels like "Headline:", "Subheadline:", "slidePrompt:", "narration:" etc.
- Do NOT render any prompt instructions, JSON, or metadata as visible text
- Do NOT generate or draw any company logos, lettermarks, or brand marks from scratch (a logo image may be provided separately — use it as-is if attached)
- Do NOT generate photographs of human faces
- Do NOT leave empty reserved areas, placeholder boxes, or transparent zones on the slide
- Do NOT render "300x100px" or any pixel dimension text on the slide
- Do NOT include any dates, times, event dates, or calendar references on the slide
- Do NOT include placeholder dates like "March 2025" or "Friday Night" from the template style
${isInsurance ? '- Do NOT write any insurance carrier name, company name, or brand name on the slide' : ''}

${templateRefBuffer ? '=== TEMPLATE REFERENCE DESIGN ===\nREFERENCE DESIGN (match this EXACTLY): A reference image is attached showing the visual style to follow. Replicate the same textures, borders, decorative elements, background treatment, icon style, and overall mood. Match the EXACT visual style, textures, decorative elements, and mood of this reference slide. Use the same design DNA — borders, patterns, backgrounds, icon style. Only change the DATA content.' : ''}
${referenceSlides && referenceSlides.length > 0 ? '\n=== VISUAL REFERENCE ===\nReference slides are attached. Match their EXACT visual style — same background, colors, textures, typography, and effects. The new slide must look like it belongs in the same deck.' : ''}
${colorSwatchBuffer ? '\n=== COLOR PALETTE REFERENCE ===\nA color swatch image is attached showing the exact brand colors. Match these exact brand colors in your design.' : ''}
${previousSlideBuffer ? '\n=== PREVIOUS SLIDE REFERENCE ===\nThe previous slide image is attached. Maintain the same visual style as this previous slide for consistency.' : ''}
${assetBuffer ? '\n=== PRODUCT/BRAND ASSET ===\nPRODUCT/BRAND ASSET: Feature this product image prominently in the slide. Show the EXACT product as-is — do not modify, redesign, or recreate it. Integrate it naturally into the slide layout within the template\'s design style.' : ''}

=== CONSISTENCY ===
This is slide ${slideIndex + 1} of ${totalSlides}. ALL slides must share identical visual treatment.`

  // Build the content parts — template reference first (so model sees style before content), then text, then logo
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = []

  // Add template reference image FIRST so the model sees the target style before the content prompt
  if (templateRefBuffer) {
    parts.push(
      { text: 'REFERENCE DESIGN (match this EXACTLY): This image shows the visual style to follow. Replicate the same textures, borders, decorative elements, background treatment, icon style, and overall mood. The data/text content will be different, but the DESIGN must match this reference.' },
      { inlineData: { mimeType: 'image/png', data: templateRefBuffer.toString('base64') } },
    )
  }

  parts.push({ text: promptText })

  // Logo is NOT passed to Gemini — Sharp composites the actual logo afterward.
  // This prevents Gemini from redrawing/reinterpreting the logo.

  // Add color swatch reference if available
  if (colorSwatchBuffer) {
    parts.push(
      { text: 'Match these exact brand colors in your design:' },
      { inlineData: { mimeType: 'image/png', data: colorSwatchBuffer.toString('base64') } },
    )
  }

  // Add previous slide for style consistency
  if (previousSlideBuffer) {
    parts.push(
      { text: 'Maintain the same visual style as this previous slide for consistency:' },
      { inlineData: { mimeType: 'image/png', data: previousSlideBuffer.toString('base64') } },
    )
  }

  // Add product/brand asset if available
  if (assetBuffer) {
    parts.push(
      { text: 'PRODUCT/BRAND ASSET: Feature this product image prominently in the slide. Show the EXACT product as-is — do not modify, redesign, or recreate it. Integrate it naturally into the slide layout within the template\'s design style.' },
      { inlineData: { mimeType: 'image/png', data: assetBuffer.toString('base64') } },
    )
  }

  // Add reference slides if available
  if (referenceSlides) {
    for (const ref of referenceSlides) {
      parts.push({
        inlineData: { mimeType: 'image/png', data: ref.toString('base64') },
      })
    }
  }

  // Attempt generation with one retry if no image returned
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await genai.models.generateContent({
      model: IMAGE_MODEL,
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

    if (attempt === 0) {
      console.warn(`[gemini] No image returned for slide ${slideIndex + 1}, retrying...`)
    }
  }

  // Both attempts failed — generate a fallback slide so video assembly never fails
  console.error(`[gemini] Generating fallback slide for slide ${slideIndex + 1}`)
  const fallbackTitle = slidePrompt?.split('.')[0] ?? `Slide ${slideIndex + 1}`
  return generateFallbackSlide(fallbackTitle, colors.primary)
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

  const structuredInfographic = buildStructuredPrompt({
    subject: `Professional infographic for ${getDocumentTypeLabel(data)}.\n${dataBlock}\nFOOTER: "Generated by Docs2Video"`,
    action: 'Presented as a data-rich infographic with bar charts, icons, and clear sections',
    environment: `${orientation} canvas, high-end magazine quality layout`,
    artStyle: 'Clean modern infographic design with professional typography, structured data sections, and visual hierarchy',
    lighting: 'Flat design lighting with subtle gradients and drop shadows for depth',
    details: `${orientation} orientation, crisp vector-style icons, readable data labels`,
    brandColors: colors,
  })

  const prompt = `Create a professional, visually stunning infographic image. Follow these instructions precisely.

${structuredInfographic}

${getStrictRules()}

Make it ${orientation}.`

  const response = await genai.models.generateContent({
    model: IMAGE_MODEL,
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
