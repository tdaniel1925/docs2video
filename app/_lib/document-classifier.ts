/**
 * Document Classifier — Pass 1 of the two-pass extraction system.
 * Uses Gemini Flash to quickly classify a document before deep extraction.
 * Returns document type, perspective, sensitivity, red flags, and suggested tone.
 */
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/** All supported document types grouped by category */
export const DOCUMENT_TYPES = {
  // Insurance
  life_insurance_illustration: { label: 'Life Insurance Illustration', category: 'insurance', sensitivity: 'high' as const },
  annuity_contract: { label: 'Annuity Contract', category: 'insurance', sensitivity: 'high' as const },
  health_insurance_eob: { label: 'Health Insurance EOB', category: 'insurance', sensitivity: 'high' as const },
  auto_home_policy: { label: 'Auto/Home Insurance Policy', category: 'insurance', sensitivity: 'medium' as const },
  insurance_claims_denial: { label: 'Insurance Claims Denial', category: 'insurance', sensitivity: 'high' as const },
  disability_policy: { label: 'Disability Insurance Policy', category: 'insurance', sensitivity: 'high' as const },
  long_term_care: { label: 'Long Term Care Policy', category: 'insurance', sensitivity: 'high' as const },

  // Finance / Personal
  bank_statement: { label: 'Bank Statement', category: 'finance', sensitivity: 'high' as const },
  credit_report: { label: 'Credit Report', category: 'finance', sensitivity: 'high' as const },
  mortgage_statement: { label: 'Mortgage Statement', category: 'finance', sensitivity: 'high' as const },
  tax_return: { label: 'Tax Return', category: 'finance', sensitivity: 'high' as const },
  investment_statement: { label: 'Investment/Brokerage Statement', category: 'finance', sensitivity: 'high' as const },
  loan_agreement: { label: 'Loan Agreement', category: 'finance', sensitivity: 'high' as const },
  retirement_plan: { label: '401k/IRA/Retirement Plan', category: 'finance', sensitivity: 'high' as const },

  // Business
  earnings_report: { label: 'Earnings Report (10-K/10-Q)', category: 'business', sensitivity: 'low' as const },
  annual_report: { label: 'Annual Report', category: 'business', sensitivity: 'low' as const },
  business_plan: { label: 'Business Plan', category: 'business', sensitivity: 'medium' as const },
  pitch_deck: { label: 'Pitch Deck / Investor Presentation', category: 'business', sensitivity: 'medium' as const },
  profit_loss: { label: 'Profit & Loss Statement', category: 'business', sensitivity: 'medium' as const },
  balance_sheet: { label: 'Balance Sheet', category: 'business', sensitivity: 'medium' as const },
  marketing_report: { label: 'Marketing/Media Report', category: 'business', sensitivity: 'low' as const },
  sales_proposal: { label: 'Sales Proposal', category: 'business', sensitivity: 'low' as const },

  // Legal / Contracts
  lease_agreement: { label: 'Lease Agreement', category: 'legal', sensitivity: 'medium' as const },
  employment_contract: { label: 'Employment Contract', category: 'legal', sensitivity: 'high' as const },
  nda_noncompete: { label: 'NDA / Non-Compete Agreement', category: 'legal', sensitivity: 'high' as const },
  terms_of_service: { label: 'Terms of Service / Privacy Policy', category: 'legal', sensitivity: 'low' as const },
  divorce_decree: { label: 'Divorce Decree / Family Law', category: 'legal', sensitivity: 'high' as const },
  court_document: { label: 'Court Document / Legal Filing', category: 'legal', sensitivity: 'high' as const },

  // Medical / Healthcare
  lab_results: { label: 'Lab Results / Medical Test', category: 'healthcare', sensitivity: 'high' as const },
  treatment_plan: { label: 'Treatment Plan', category: 'healthcare', sensitivity: 'high' as const },
  medical_bill: { label: 'Medical Bill / Hospital Statement', category: 'healthcare', sensitivity: 'high' as const },
  prescription_info: { label: 'Prescription / Medication Info', category: 'healthcare', sensitivity: 'high' as const },

  // Government / Official
  social_security_statement: { label: 'Social Security Statement', category: 'government', sensitivity: 'high' as const },
  property_tax_assessment: { label: 'Property Tax Assessment', category: 'government', sensitivity: 'medium' as const },
  immigration_document: { label: 'Immigration Document', category: 'government', sensitivity: 'high' as const },
  benefits_statement: { label: 'Government Benefits Statement', category: 'government', sensitivity: 'high' as const },

  // Education
  transcript: { label: 'Academic Transcript', category: 'education', sensitivity: 'medium' as const },
  course_material: { label: 'Course Material / Textbook', category: 'education', sensitivity: 'low' as const },
  research_paper: { label: 'Research Paper / Academic Study', category: 'education', sensitivity: 'low' as const },

  // Generic
  presentation: { label: 'General Presentation', category: 'general', sensitivity: 'low' as const },
  report: { label: 'General Report', category: 'general', sensitivity: 'low' as const },
  newsletter: { label: 'Newsletter / Marketing Material', category: 'general', sensitivity: 'low' as const },
  unknown: { label: 'Unknown Document', category: 'general', sensitivity: 'low' as const },
} as const

export type DocumentTypeId = keyof typeof DOCUMENT_TYPES

export interface DocumentClassification {
  documentType: DocumentTypeId
  confidence: number           // 0-1 how sure are we
  category: string             // insurance, finance, legal, etc.
  title: string                // suggested video title
  perspective: string          // who is the reader? "policyholder", "investor", "tenant", etc.
  sensitivity: 'low' | 'medium' | 'high'
  tone: string                 // how should the narration feel
  redFlags: string[]           // things the reader should watch for
  actionItems: string[]        // what should the reader do next
  keyQuestion: string          // the one question this video should answer
  industry: string             // mapped industry for script generation
  recommendedTemplate: string  // auto-selected template based on document type
}

const CLASSIFICATION_PROMPT = `You are a document classification expert. Analyze the first few pages of this document and classify it.

Return ONLY valid JSON (no markdown, no code fences):
{
  "documentType": "one of: ${Object.keys(DOCUMENT_TYPES).join(', ')}",
  "confidence": 0.0-1.0,
  "title": "a clear, human-friendly title for a video explaining this document",
  "perspective": "who is the typical reader? e.g. 'policyholder', 'account holder', 'tenant', 'employee', 'patient', 'investor', 'business owner'",
  "tone": "what emotional tone should the explanation have? e.g. 'reassuring and educational', 'empowering and solution-focused', 'confident and celebratory', 'calm and clear'",
  "redFlags": ["specific things in THIS document the reader should watch out for — be specific to what you see, not generic advice"],
  "actionItems": ["specific next steps the reader should consider based on THIS document's content"],
  "keyQuestion": "the single most important question this video should answer for the reader"
}

CLASSIFICATION RULES:
- An annuity contract has accumulation values, payout schedules, guaranteed rates, surrender charges — NOT death benefit projections
- A life insurance illustration has death benefit, premium schedules, cash value projections, riders
- A financial planning report that MENTIONS insurance products is NOT an insurance illustration — it's an investment_statement or report
- A mortgage statement shows payment history, escrow, principal/interest breakdown
- A bank statement shows transactions, deposits, withdrawals, balances
- A credit report shows credit scores, account history, inquiries
- An EOB (Explanation of Benefits) shows what insurance covered vs what the patient owes
- A 10-K or 10-Q has standardized SEC filing sections (Business, Risk Factors, Financial Statements)
- A pitch deck is visual, has slides, value propositions, market size, team, ask
- A P&L has revenue, COGS, operating expenses, net income
- If unsure between two types, pick the more specific one
- If nothing fits, use "unknown"

RED FLAG RULES:
- Be SPECIFIC to this document, not generic. "Your interest rate of 6.5% is above current averages" not "watch out for high interest rates"
- Look for: hidden fees, penalty clauses, expiring guarantees, unusual terms, below-average rates, above-average costs
- For medical: out-of-range values, denied services, coding errors
- For legal: auto-renewal, broad non-compete scope, one-sided arbitration clauses
- For insurance: exclusions, waiting periods, rate guarantee expiration, surrender charges
- Maximum 5 red flags, minimum 1

ACTION ITEMS RULES:
- Concrete, actionable, time-sensitive when possible
- "Call your insurer before June 1 to dispute this denial" not "consider contacting your insurer"
- Maximum 4 action items, minimum 1`

/**
 * Classify a document from text content (for URLs, pasted text, DOCX, etc.).
 * Uses the same prompt as classifyDocument but with text instead of inline data.
 */
export async function classifyFromText(
  content: string,
  purpose?: string,
): Promise<DocumentClassification> {
  const truncated = content.slice(0, 30000)
  const promptAddition = purpose ? `\n\nThe user's stated purpose: "${purpose}"` : ''

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${CLASSIFICATION_PROMPT}${promptAddition}\n\nHere is the document text to classify:\n\n${truncated}` },
          ],
        },
      ],
    })

    const text = response.text?.trim() ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    const parsed = JSON.parse(cleaned)
    const docType = (parsed.documentType as DocumentTypeId) || 'unknown'
    const typeInfo = DOCUMENT_TYPES[docType] || DOCUMENT_TYPES.unknown

    const categoryToIndustry: Record<string, string> = {
      insurance: 'insurance',
      finance: 'financial',
      business: 'consulting',
      legal: 'legal',
      healthcare: 'healthcare',
      government: 'general',
      education: 'education',
      general: 'general',
    }

    const templateMap: Record<string, string> = {
      life_insurance_illustration: 'executive', annuity_contract: 'executive',
      health_insurance_eob: 'commercial-pro', auto_home_policy: 'commercial-pro',
      insurance_claims_denial: 'commercial-pro', disability_policy: 'executive',
      long_term_care: 'executive', bank_statement: 'commercial-pro',
      credit_report: 'commercial-pro', mortgage_statement: 'executive',
      tax_return: 'commercial-pro', investment_statement: 'glassmorphism',
      loan_agreement: 'executive', retirement_plan: 'executive',
      earnings_report: 'executive', annual_report: 'executive',
      business_plan: 'glassmorphism', pitch_deck: 'glassmorphism',
      profit_loss: 'commercial-pro', balance_sheet: 'commercial-pro',
      marketing_report: 'neubrutalism', sales_proposal: 'commercial-pro',
      lease_agreement: 'legal-brief', employment_contract: 'legal-brief',
      nda_noncompete: 'legal-brief', terms_of_service: 'legal-brief',
      divorce_decree: 'legal-brief', court_document: 'legal-brief',
      lab_results: 'medical-journal', treatment_plan: 'medical-journal',
      medical_bill: 'medical-journal', prescription_info: 'medical-journal',
      social_security_statement: 'commercial-pro', property_tax_assessment: 'commercial-pro',
      immigration_document: 'legal-brief', benefits_statement: 'commercial-pro',
      transcript: 'commercial-pro', course_material: 'chalkboard',
      research_paper: 'medical-journal', presentation: 'executive',
      report: 'commercial-pro', newsletter: 'watercolor', unknown: 'executive',
    }

    return {
      documentType: docType,
      confidence: parsed.confidence ?? 0.5,
      category: typeInfo.category,
      title: parsed.title || 'Document Explained',
      perspective: parsed.perspective || 'reader',
      sensitivity: typeInfo.sensitivity,
      tone: parsed.tone || 'clear and professional',
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      keyQuestion: parsed.keyQuestion || 'What does this document mean for you?',
      industry: categoryToIndustry[typeInfo.category] || 'general',
      recommendedTemplate: templateMap[docType] || 'executive',
    }
  } catch (err) {
    console.error('[classifyFromText] Classification failed:', err instanceof Error ? err.message : 'unknown')
    return {
      documentType: 'unknown',
      confidence: 0,
      category: 'general',
      title: 'Document Explained',
      perspective: 'reader',
      sensitivity: 'low',
      tone: 'clear and professional',
      redFlags: [],
      actionItems: [],
      keyQuestion: 'What does this document mean for you?',
      industry: 'general',
      recommendedTemplate: 'executive',
    }
  }
}

/**
 * Classify a document using Gemini Flash (fast, cheap).
 * This is Pass 1 of the two-pass extraction system.
 */
export async function classifyDocument(pdfBase64: string, mimeType: string = 'application/pdf'): Promise<DocumentClassification> {
  // For non-PDF/image types (DOCX, PPTX, CSV), Gemini may not support inline data.
  // Fall back to text-based classification by attempting to decode as text.
  const supportedInlineMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
  if (!supportedInlineMimes.includes(mimeType)) {
    try {
      const textContent = Buffer.from(pdfBase64, 'base64').toString('utf-8')
      // If it decodes to reasonable text (not binary garbage), use text classification
      const printableRatio = textContent.slice(0, 1000).split('').filter(c => c.charCodeAt(0) >= 32 || c === '\n' || c === '\r' || c === '\t').length / Math.min(textContent.length, 1000)
      if (printableRatio > 0.7) {
        return classifyFromText(textContent)
      }
    } catch {
      // Fall through to inline data attempt
    }
    // If we can't decode as text, return safe default rather than failing
    return {
      documentType: 'unknown',
      confidence: 0,
      category: 'general',
      title: 'Document Explained',
      perspective: 'reader',
      sensitivity: 'low',
      tone: 'clear and professional',
      redFlags: [],
      actionItems: [],
      keyQuestion: 'What does this document mean for you?',
      industry: 'general',
      recommendedTemplate: 'executive',
    }
  }

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: CLASSIFICATION_PROMPT },
          { inlineData: { mimeType, data: pdfBase64 } },
        ],
      },
    ],
  })

  const text = response.text?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    const docType = (parsed.documentType as DocumentTypeId) || 'unknown'
    const typeInfo = DOCUMENT_TYPES[docType] || DOCUMENT_TYPES.unknown

    // Map category to industry for script generation
    const categoryToIndustry: Record<string, string> = {
      insurance: 'insurance',
      finance: 'financial',
      business: 'consulting',
      legal: 'legal',
      healthcare: 'healthcare',
      government: 'general',
      education: 'education',
      general: 'general',
    }

    // Auto-select template based on document type
    const templateMap: Record<string, string> = {
      // Insurance — professional executive look
      life_insurance_illustration: 'executive',
      annuity_contract: 'executive',
      health_insurance_eob: 'commercial-pro',
      auto_home_policy: 'commercial-pro',
      insurance_claims_denial: 'commercial-pro',
      disability_policy: 'executive',
      long_term_care: 'executive',
      // Finance — clean data-focused
      bank_statement: 'commercial-pro',
      credit_report: 'commercial-pro',
      mortgage_statement: 'executive',
      tax_return: 'commercial-pro',
      investment_statement: 'glassmorphism',
      loan_agreement: 'executive',
      retirement_plan: 'executive',
      // Business — varies by tone
      earnings_report: 'executive',
      annual_report: 'executive',
      business_plan: 'glassmorphism',
      pitch_deck: 'glassmorphism',
      profit_loss: 'commercial-pro',
      balance_sheet: 'commercial-pro',
      marketing_report: 'neubrutalism',
      sales_proposal: 'commercial-pro',
      // Legal — formal
      lease_agreement: 'legal-brief',
      employment_contract: 'legal-brief',
      nda_noncompete: 'legal-brief',
      terms_of_service: 'legal-brief',
      divorce_decree: 'legal-brief',
      court_document: 'legal-brief',
      // Medical — clinical
      lab_results: 'medical-journal',
      treatment_plan: 'medical-journal',
      medical_bill: 'medical-journal',
      prescription_info: 'medical-journal',
      // Government
      social_security_statement: 'commercial-pro',
      property_tax_assessment: 'commercial-pro',
      immigration_document: 'legal-brief',
      benefits_statement: 'commercial-pro',
      // Education
      transcript: 'commercial-pro',
      course_material: 'chalkboard',
      research_paper: 'medical-journal',
      // General
      presentation: 'executive',
      report: 'commercial-pro',
      newsletter: 'watercolor',
      unknown: 'executive',
    }

    return {
      documentType: docType,
      confidence: parsed.confidence ?? 0.5,
      category: typeInfo.category,
      title: parsed.title || 'Document Explained',
      perspective: parsed.perspective || 'reader',
      sensitivity: typeInfo.sensitivity,
      tone: parsed.tone || 'clear and professional',
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      keyQuestion: parsed.keyQuestion || 'What does this document mean for you?',
      industry: categoryToIndustry[typeInfo.category] || 'general',
      recommendedTemplate: templateMap[docType] || 'executive',
    }
  } catch {
    // If classification fails, return a safe default
    return {
      documentType: 'unknown',
      confidence: 0,
      category: 'general',
      title: 'Document Explained',
      perspective: 'reader',
      sensitivity: 'low',
      tone: 'clear and professional',
      redFlags: [],
      actionItems: [],
      keyQuestion: 'What does this document mean for you?',
      industry: 'general',
      recommendedTemplate: 'executive',
    }
  }
}
