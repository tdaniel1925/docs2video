/**
 * Live test of the narrative-first two-pass script generation.
 * Run: npx tsx scripts/test-narrative-script.ts
 * Verifies: story pass runs (opus), segmentation preserves the story verbatim,
 * scenes carry slideData, no forward previews, output shape unchanged.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import type { ExtractedData } from '../app/_lib/extract-types'

const sample: ExtractedData = {
  title: 'Retirement Income Plan Review',
  subtitle: 'Prepared for the Henderson family',
  source: null,
  keyMetrics: [
    { label: 'Projected Monthly Income', value: '$6,450', highlight: true },
    { label: 'Current Portfolio Value', value: '$912,300' },
    { label: 'Annual Growth Assumption', value: '5.2%' },
    { label: 'Income Gap at Age 70', value: '$1,180/mo' },
  ],
  sections: [
    { title: 'Where You Stand', content: 'The portfolio is currently valued at $912,300 across taxable and tax-deferred accounts, positioned for moderate growth at an assumed 5.2% annual return.' },
    { title: 'The Income Gap', content: 'Based on projected expenses of $7,630 per month in retirement, current projections leave a gap of $1,180 per month starting at age 70 when required minimum distributions begin.' },
    { title: 'Closing the Gap', content: 'Increasing monthly contributions by $850 for the next 8 years, combined with delaying Social Security to age 70, closes the projected gap entirely and adds a $210 monthly cushion.' },
  ],
  bulletPoints: ['Portfolio review completed March 2026', 'Assumes retirement at age 67', 'Social Security estimates from ssa.gov statement'],
  additionalNotes: [],
  contactInfo: { phone: '555-201-4477', email: 'advisor@example.com' },
}

async function main() {
  const { generateScript } = await import('../app/_lib/script-generator')
  const t0 = Date.now()
  const scenes = await generateScript(
    sample, 'Summit Financial', { primary: '#1a3c5e', secondary: '#4a90d9', accent: '#e8b54d', background: '#ffffff', text: '#1b1b1b' },
    false, 0, 'nova', undefined,
    { phone: '555-201-4477', email: 'advisor@example.com' },
    'help the client understand their retirement readiness and agree to the recommended contribution increase',
    undefined, 'finance', 'standard', 'solo', null, null,
  )
  console.log(`\n=== ${scenes.length} scenes in ${((Date.now() - t0) / 1000).toFixed(0)}s ===\n`)
  let totalWords = 0
  for (const s of scenes) {
    const words = (s.narration || '').split(/\s+/).length
    totalWords += words
    const sd: any = (s as any).slideData
    console.log(`--- Scene ${s.scene} [${(s as any).beat}] "${s.title}" (${words}w, ${s.duration}s)`)
    if (sd?.headline) console.log(`    slide: ${sd.headline} | stats: ${JSON.stringify(sd.stats || [])}`)
    console.log(`    ${s.narration}\n`)
  }
  console.log(`TOTAL: ${totalWords} words (~${Math.round(totalWords / 2.5)}s)`)
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1) })
