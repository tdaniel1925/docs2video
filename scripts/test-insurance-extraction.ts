/**
 * Test script: Run Claude Opus insurance extraction against a real PDF.
 * Usage: npx tsx scripts/test-insurance-extraction.ts path/to/illustration.pdf
 *
 * Requires ANTHROPIC_API_KEY in .env.local
 */
import { readFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    console.error('Usage: npx tsx scripts/test-insurance-extraction.ts <path-to-pdf>')
    process.exit(1)
  }

  const pdfBuffer = readFileSync(pdfPath)
  const pdfBase64 = pdfBuffer.toString('base64')
  console.log(`Loaded PDF: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`)

  const { extractInsuranceWithOpus } = await import('../app/_lib/insurance-extractor')

  console.log('\nCalling Claude Opus...\n')
  const start = Date.now()
  const result = await extractInsuranceWithOpus(pdfBase64, 'application/pdf')
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  if (!result) {
    console.error(`\nExtraction returned null after ${elapsed}s`)
    process.exit(1)
  }

  console.log(`\n✓ Extraction completed in ${elapsed}s\n`)
  console.log('=== COLUMN MAPPING ===')
  console.log(`Guaranteed column: "${result.guaranteed_column_label}"`)
  console.log(`Current column:    "${result.current_column_label}"`)
  console.log(`Rationale:         ${result.column_mapping_rationale}`)
  console.log(`Raw columns:       ${JSON.stringify(result.rawColumns, null, 2)}`)

  console.log('\n=== KEY FIELDS ===')
  console.log(`Policy Type:       ${result.policyType}`)
  console.log(`Carrier:           ${result.carrier}`)
  console.log(`Insured:           ${result.insuredName}, age ${result.insuredAge}`)
  console.log(`Death Benefit:     $${result.deathBenefit?.toLocaleString()}`)
  console.log(`Annual Premium:    $${result.annualPremium?.toLocaleString()}`)
  console.log(`Payment Mode:      ${result.paymentMode}`)
  console.log(`Loan Rate:         ${result.loanRate ?? 'N/A'}%`)
  console.log(`Max Illustrated:   Year ${result.maxIllustratedYear}`)

  console.log('\n=== CASH VALUE PROJECTIONS ===')
  for (const row of result.cashValueProjections || []) {
    console.log(`  Year ${String(row.year).padStart(2)}: Guaranteed=$${row.guaranteed?.toLocaleString().padStart(10)}, Current=$${row.current?.toLocaleString().padStart(10)}  [${row.sourcePage || 'no page'}]`)
  }

  console.log('\n=== SURRENDER VALUE PROJECTIONS ===')
  for (const row of result.surrenderValueProjections || []) {
    console.log(`  Year ${String(row.year).padStart(2)}: Guaranteed=$${row.guaranteed?.toLocaleString().padStart(10)}, Current=$${row.current?.toLocaleString().padStart(10)}  [${row.sourcePage || 'no page'}]`)
  }

  console.log(`\n=== CONFIDENCE ===`)
  console.log(`Extraction confidence: ${result.extractionConfidence}`)
  console.log(`Low confidence fields: ${result.lowConfidenceFields?.length ? result.lowConfidenceFields.join(', ') : 'none'}`)

  console.log(`\n=== RIDERS (${result.riders?.length || 0}) ===`)
  for (const r of result.riders || []) console.log(`  - ${r}`)

  console.log(`\n=== DISCLAIMERS (${result.disclaimers?.length || 0}) ===`)
  for (const d of result.disclaimers || []) console.log(`  "${d.slice(0, 120)}${d.length > 120 ? '...' : ''}"`)

  console.log('\n=== FULL JSON ===')
  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
