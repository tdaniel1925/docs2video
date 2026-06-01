import type { ExtractedPolicyData } from './types'

/**
 * Pure deterministic validation on extracted insurance data.
 * These FLAG for review — they do NOT hard-reject (some products legitimately violate these).
 * Returns an array of flag strings. Empty array = all checks passed.
 */
export function runInsuranceSanityChecks(data: ExtractedPolicyData): string[] {
  const flags: string[] = []

  // 1. Cash value generally non-decreasing year over year
  if (data.cashValueProjections?.length > 1) {
    for (let i = 1; i < data.cashValueProjections.length; i++) {
      const prev = data.cashValueProjections[i - 1]
      const curr = data.cashValueProjections[i]
      if (curr.guaranteed < prev.guaranteed && prev.guaranteed > 0) {
        flags.push(`CV_GUARANTEED_DIP: Cash value guaranteed dropped from $${prev.guaranteed} (year ${prev.year}) to $${curr.guaranteed} (year ${curr.year})`)
      }
      if (curr.current < prev.current && prev.current > 0) {
        flags.push(`CV_CURRENT_DIP: Cash value current dropped from $${prev.current} (year ${prev.year}) to $${curr.current} (year ${curr.year})`)
      }
    }
  }

  // 2. Surrender value generally non-decreasing year over year
  if (data.surrenderValueProjections?.length > 1) {
    for (let i = 1; i < data.surrenderValueProjections.length; i++) {
      const prev = data.surrenderValueProjections[i - 1]
      const curr = data.surrenderValueProjections[i]
      if (curr.guaranteed < prev.guaranteed && prev.guaranteed > 0) {
        flags.push(`SV_GUARANTEED_DIP: Surrender value guaranteed dropped from $${prev.guaranteed} (year ${prev.year}) to $${curr.guaranteed} (year ${curr.year})`)
      }
      if (curr.current < prev.current && prev.current > 0) {
        flags.push(`SV_CURRENT_DIP: Surrender value current dropped from $${prev.current} (year ${prev.year}) to $${curr.current} (year ${curr.year})`)
      }
    }
  }

  // 3. Surrender value <= cash value in early years (first 15 years)
  if (data.cashValueProjections?.length > 0 && data.surrenderValueProjections?.length > 0) {
    for (const sv of data.surrenderValueProjections) {
      if (sv.year > 15) continue
      const cv = data.cashValueProjections.find(c => c.year === sv.year)
      if (cv) {
        if (sv.guaranteed > cv.guaranteed && cv.guaranteed > 0) {
          flags.push(`SV_EXCEEDS_CV: Surrender value guaranteed ($${sv.guaranteed}) > cash value guaranteed ($${cv.guaranteed}) at year ${sv.year}`)
        }
        if (sv.current > cv.current && cv.current > 0) {
          flags.push(`SV_EXCEEDS_CV_CURRENT: Surrender value current ($${sv.current}) > cash value current ($${cv.current}) at year ${sv.year}`)
        }
      }
    }
  }

  // 4. Death benefit within plausible multiple of annual premium
  if (data.deathBenefit > 0 && data.annualPremium > 0) {
    const ratio = data.deathBenefit / data.annualPremium
    if (ratio < 2) {
      flags.push(`DB_PREMIUM_RATIO_LOW: Death benefit ($${data.deathBenefit}) is only ${ratio.toFixed(1)}x the annual premium ($${data.annualPremium}) — unusually low`)
    }
    if (ratio > 500) {
      flags.push(`DB_PREMIUM_RATIO_HIGH: Death benefit ($${data.deathBenefit}) is ${ratio.toFixed(0)}x the annual premium ($${data.annualPremium}) — unusually high`)
    }
  }

  // 5. Every projection year <= maxIllustratedYear (if provided)
  if (data.maxIllustratedYear) {
    for (const row of data.cashValueProjections || []) {
      if (row.year > data.maxIllustratedYear) {
        flags.push(`CV_YEAR_EXCEEDS_MAX: Cash value year ${row.year} exceeds maxIllustratedYear ${data.maxIllustratedYear} — possibly invented row`)
      }
    }
    for (const row of data.surrenderValueProjections || []) {
      if (row.year > data.maxIllustratedYear) {
        flags.push(`SV_YEAR_EXCEEDS_MAX: Surrender value year ${row.year} exceeds maxIllustratedYear ${data.maxIllustratedYear} — possibly invented row`)
      }
    }
  }

  // 6. Numeric range sanity
  if (data.loanRate !== null && data.loanRate !== undefined) {
    if (data.loanRate < 0 || data.loanRate > 25) {
      flags.push(`LOAN_RATE_ABSURD: Loan rate ${data.loanRate}% is outside plausible range (0-25%)`)
    }
  }

  if (data.insuredAge !== null && data.insuredAge !== undefined) {
    if (data.insuredAge < 0 || data.insuredAge > 120) {
      flags.push(`AGE_ABSURD: Insured age ${data.insuredAge} is outside plausible range (0-120)`)
    }
  }

  if (data.annualPremium < 0) {
    flags.push(`PREMIUM_NEGATIVE: Annual premium is negative ($${data.annualPremium})`)
  }
  if (data.annualPremium > 10_000_000) {
    flags.push(`PREMIUM_EXTREME: Annual premium ($${data.annualPremium}) exceeds $10M — verify`)
  }

  if (data.deathBenefit < 0) {
    flags.push(`DB_NEGATIVE: Death benefit is negative ($${data.deathBenefit})`)
  }
  if (data.deathBenefit > 100_000_000) {
    flags.push(`DB_EXTREME: Death benefit ($${data.deathBenefit}) exceeds $100M — verify`)
  }

  // 7. Required fields present
  if (!data.policyType || data.policyType.trim().length === 0) {
    flags.push(`MISSING_POLICY_TYPE: No policy type extracted`)
  }
  if (!data.carrier || data.carrier.trim().length === 0) {
    flags.push(`MISSING_CARRIER: No carrier name extracted`)
  }
  if (!data.insuredName || data.insuredName.trim().length === 0) {
    flags.push(`MISSING_INSURED_NAME: No insured name extracted`)
  }
  if (!data.cashValueProjections || data.cashValueProjections.length === 0) {
    flags.push(`NO_CV_PROJECTIONS: No cash value projections extracted`)
  }

  return flags
}
