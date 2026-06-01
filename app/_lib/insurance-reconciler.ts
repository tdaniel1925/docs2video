import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData } from './types'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export interface ReconciliationResult {
  matches: { field: string; extractedValue: unknown; foundInSource: boolean }[]
  mismatches: { field: string; extractedValue: unknown; sourceValue: unknown; issue: string }[]
  columnMappingCheck: { agreesWithExtractor: boolean; note: string }
  unverifiable: string[]
  overallVerdict: 'pass' | 'review' | 'fail'
}

const RECONCILIATION_PROMPT = `You are a VERIFICATION agent. Your ONLY job is to check extracted data against the source document. You are NOT re-extracting — you are AUDITING.

You will receive:
1. A PDF document (the source of truth)
2. A JSON object containing data that was extracted from this PDF by a different AI model

For EVERY field in the JSON, verify it appears in the PDF with the same value. Specifically:

===== CHECKS =====

1. SCALAR FIELDS: For each of these, confirm the extracted value matches the PDF:
   - policyType, carrier, insuredName, insuredAge
   - deathBenefit, annualPremium, paymentMode, loanRate

2. COLUMN MAPPING: The extractor claims it mapped these column headers:
   - guaranteed_column_label → "guaranteed" values
   - current_column_label → "current" values
   Look at the actual tables in the PDF. Do these column headers exist? Did the extractor pick the right ones? If the PDF has additional columns the extractor ignored, note them.

3. PROJECTION ROWS: For each row in cashValueProjections and surrenderValueProjections:
   - Does year X exist in the PDF table?
   - Does the "guaranteed" value match what's under the guaranteed column?
   - Does the "current" value match what's under the current column?
   - Is the sourcePage reference correct?

4. RIDERS: Are the listed riders actually in the PDF? Are any missing?

5. DISCLAIMERS: Are the extracted disclaimers verbatim matches? Any key disclaimers missing?

===== OUTPUT =====

Return ONLY valid JSON (no markdown, no code fences):
{
  "matches": [
    { "field": "deathBenefit", "extractedValue": 500000, "foundInSource": true }
  ],
  "mismatches": [
    { "field": "cashValueProjections[year=10].guaranteed", "extractedValue": 45000, "sourceValue": 44500, "issue": "Value off by $500 — possible OCR/rounding error" }
  ],
  "columnMappingCheck": {
    "agreesWithExtractor": true,
    "note": "The PDF has columns 'Guaranteed' and 'Non-Guaranteed Current' — extractor correctly mapped these."
  },
  "unverifiable": ["loanRate — could not locate loan rate table in PDF"],
  "overallVerdict": "pass"
}

VERDICT RULES:
- "pass": Every number matches, column mapping is correct, no critical mismatches.
- "review": Minor discrepancies (rounding differences, 1-2 unverifiable fields) but no clearly wrong values.
- "fail": Any number is clearly wrong, column mapping is incorrect, or critical fields (deathBenefit, annualPremium) don't match.

Be STRICT. A single wrong number in a compliance-sensitive insurance document is a "fail".
Do NOT re-extract or improve the data — just verify what's there.`

/**
 * Run Gemini 2.5 Pro reconciliation against the source PDF.
 * Uses a DIFFERENT model family from the Opus extractor so errors don't correlate.
 */
export async function reconcileInsuranceExtraction(
  pdfBase64: string,
  mimeType: string,
  extractedData: ExtractedPolicyData
): Promise<ReconciliationResult> {
  const extractedJson = JSON.stringify(extractedData, null, 2)

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: pdfBase64 } },
            { text: `${RECONCILIATION_PROMPT}\n\n===== EXTRACTED DATA TO VERIFY =====\n\n${extractedJson}` },
          ],
        },
      ],
    })

    const text = response.text?.trim() ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const result = JSON.parse(cleaned) as ReconciliationResult

    // Validate verdict is one of the expected values
    if (!['pass', 'review', 'fail'].includes(result.overallVerdict)) {
      result.overallVerdict = 'review'
    }

    console.log(`[reconciler] Verdict: ${result.overallVerdict} | Matches: ${result.matches?.length || 0} | Mismatches: ${result.mismatches?.length || 0} | Unverifiable: ${result.unverifiable?.length || 0}`)
    if (result.mismatches?.length > 0) {
      for (const m of result.mismatches) {
        console.warn(`[reconciler] MISMATCH: ${m.field} — extracted=${JSON.stringify(m.extractedValue)}, source=${JSON.stringify(m.sourceValue)}: ${m.issue}`)
      }
    }

    return result
  } catch (err) {
    console.error('[reconciler] Gemini reconciliation failed:', err instanceof Error ? err.message : 'unknown')
    // If reconciliation itself fails, that's a REVIEW — we can't verify the data
    return {
      matches: [],
      mismatches: [],
      columnMappingCheck: { agreesWithExtractor: false, note: 'Reconciliation failed — could not verify' },
      unverifiable: ['ALL — reconciliation process failed'],
      overallVerdict: 'review',
    }
  }
}

// Export prompt for documentation/testing
export { RECONCILIATION_PROMPT }
