import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedPolicyData } from './types'

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _claude
}

const INSURANCE_EXTRACTION_PROMPT = `You are an expert insurance document analyst extracting structured data from a life insurance illustration.

===== CRITICAL RULES =====

1. COLUMN IDENTIFICATION (most important step):
   Insurance illustrations contain projection tables with multiple value columns. Common headers include:
   - "Guaranteed", "Non-Guaranteed Current", "Non-Guaranteed Midpoint", "Illustrated", "Current Assumptions", "Alternate"
   You MUST:
   a) Report the EXACT column header text you found for each value set, VERBATIM from the document.
   b) Map them explicitly: which header you treated as "guaranteed" and which as "current" in the output.
   c) Provide a one-line rationale explaining WHY you chose that mapping.
   d) If there are MORE than two value columns, capture ALL of them in the "rawColumns" array and state which two you mapped.

2. YEAR SELECTION:
   - Extract projections for years 1, 5, 10, 15, 20, 25, 30 IF they actually appear in the illustration.
   - If a requested year is NOT present in the document, OMIT it entirely. NEVER interpolate or invent a row.
   - Report the policy's actual maximum illustrated year as "maxIllustratedYear".
   - For each row, note which page or table section it came from in "sourcePage".

3. NUMBERS:
   - All monetary values must be plain numbers (no dollar signs, no commas).
   - Copy values EXACTLY as they appear — do not round, estimate, or average.
   - If a value is unclear or illegible, OMIT the row and add the field to "lowConfidenceFields".

4. DISCLAIMERS:
   - Extract EVERY disclaimer, disclosure, and legal notice VERBATIM. Do not summarize or paraphrase.

5. CONFIDENCE:
   - Set "extractionConfidence" (0-1) based on how readable and unambiguous the document was.
   - List any fields you were unsure about in "lowConfidenceFields".

===== OUTPUT SCHEMA =====

Return ONLY valid JSON (no markdown, no code fences):
{
  "policyType": "string (e.g. Whole Life, IUL, Universal Life, Term, VUL)",
  "carrier": "string (insurance company name, exactly as printed)",
  "insuredName": "string (exactly as printed)",
  "insuredAge": number or null,
  "deathBenefit": number (initial face amount),
  "annualPremium": number,
  "paymentMode": "string (Annual, Monthly, Quarterly, Semi-Annual, etc.)",
  "guaranteed_column_label": "string — the EXACT header text from the PDF that you mapped to 'guaranteed'",
  "current_column_label": "string — the EXACT header text from the PDF that you mapped to 'current'",
  "column_mapping_rationale": "string — one line explaining why you chose these column mappings",
  "rawColumns": [
    { "label": "exact header text", "mappedTo": "guaranteed" | "current" | "unmapped" }
  ],
  "cashValueProjections": [
    { "year": number, "guaranteed": number, "current": number, "sourcePage": "string (e.g. 'Page 3, Table 1')" }
  ],
  "surrenderValueProjections": [
    { "year": number, "guaranteed": number, "current": number, "sourcePage": "string" }
  ],
  "maxIllustratedYear": number,
  "riders": ["string — rider name and brief description"],
  "loanRate": number or null,
  "additionalNotes": ["string"],
  "disclaimers": ["string — full verbatim text of each disclaimer"],
  "extractionConfidence": number (0-1),
  "lowConfidenceFields": ["string — field names where you were unsure"]
}`

/**
 * Extract insurance illustration data using Claude Opus.
 * This replaces the Gemini insurance extraction for higher accuracy on column disambiguation.
 */
export async function extractInsuranceWithOpus(
  pdfBase64: string,
  mimeType: string = 'application/pdf'
): Promise<ExtractedPolicyData | null> {
  const claude = getClaude()

  try {
    const response = await claude.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: mimeType as 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: INSURANCE_EXTRACTION_PROMPT },
        ],
      }],
    })

    const text = (response.content[0]?.type === 'text' ? response.content[0].text : '').trim()
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    const parsed = JSON.parse(cleaned)

    // Validate we got meaningful insurance data
    if (!parsed.deathBenefit || parsed.deathBenefit <= 0) {
      console.log('[insurance-extractor] No valid deathBenefit found, returning null')
      return null
    }

    console.log(`[insurance-extractor] Opus extraction: confidence=${parsed.extractionConfidence}, columns: guaranteed="${parsed.guaranteed_column_label}", current="${parsed.current_column_label}"`)
    if (parsed.lowConfidenceFields?.length > 0) {
      console.warn(`[insurance-extractor] Low confidence fields: ${parsed.lowConfidenceFields.join(', ')}`)
    }

    return parsed as ExtractedPolicyData
  } catch (err) {
    console.error('[insurance-extractor] Claude Opus extraction failed:', err instanceof Error ? err.message : 'unknown')
    return null
  }
}

// Export the prompt for documentation/testing
export { INSURANCE_EXTRACTION_PROMPT }
