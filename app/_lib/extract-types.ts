// Generalized extracted data that works for PDFs, text input, and ideas
export interface ExtractedData {
  title: string
  subtitle: string | null
  source: string | null
  keyMetrics: { label: string; value: string; highlight?: boolean }[]
  sections: { title: string; content: string }[]
  bulletPoints: string[]
  additionalNotes: string[]
  disclaimers?: string[]
  industry?: string
}

/**
 * Strict insurance detection — prevents non-insurance documents from being
 * treated as insurance just because a 'deathBenefit' key exists with value 0/null.
 */
export function isInsuranceData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    typeof d.deathBenefit === 'number' &&
    d.deathBenefit > 0 &&
    typeof d.policyType === 'string' &&
    d.policyType.length > 0
  )
}
