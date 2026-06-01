// Generalized extracted data that works for PDFs, text input, and ideas
export interface ExtractedData {
  title: string
  subtitle: string | null
  source: string | null
  keyMetrics: { label: string; value: string; qualifier?: string | null; highlight?: boolean }[]
  sections: { title: string; content: string }[]
  bulletPoints: string[]
  additionalNotes: string[]
  disclaimers?: string[]
  industry?: string
  companyName?: string | null
  contactInfo?: {
    phone?: string | null
    email?: string | null
    website?: string | null
    address?: string | null
  }
  truncated?: boolean
}

/**
 * Strict insurance detection — prevents non-insurance documents from being
 * treated as insurance just because a 'deathBenefit' key exists with value 0/null.
 * Also runs deterministic sanity checks and attaches flags to the data.
 */
export function isInsuranceData(data: unknown): data is { policyType: string; carrier: string; insuredName: string; deathBenefit: number; annualPremium: number; sanityFlags?: string[]; [key: string]: unknown } {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const isInsurance = (
    typeof d.deathBenefit === 'number' &&
    d.deathBenefit > 0 &&
    typeof d.policyType === 'string' &&
    (d.policyType as string).length > 0
  )
  if (isInsurance) {
    // Run deterministic sanity checks and attach flags
    // Lazy import to avoid circular dependency
    const { runInsuranceSanityChecks } = require('./insurance-sanity-checks')
    const newFlags = runInsuranceSanityChecks(d as any) as string[]
    const existing = (d.sanityFlags as string[] | undefined) || []
    d.sanityFlags = [...existing, ...newFlags]
    if (newFlags.length > 0) {
      console.warn(`[isInsuranceData] Sanity checks flagged ${newFlags.length} issues: ${newFlags.join('; ')}`)
    }
  }
  return isInsurance
}
