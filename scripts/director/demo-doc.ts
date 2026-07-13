/**
 * Generates a FAKE demo financial document (a retirement annuity proposal) as a
 * PDF, so we can prove the smart pipeline adapts to a DIFFERENT source — different
 * numbers, different structure than the IUL illustration. All numbers invented
 * for demo only. Writes demo-annuity.pdf to the repo root.
 * Run: npx tsx scripts/director/demo-doc.ts
 */
import { writeFileSync } from 'fs'
import { join } from 'path'

// Minimal hand-rolled single-page PDF with text (no deps). Good enough for Gemini
// to read as a document.
function pdf(lines: string[]): Buffer {
  const content = lines.map((l, i) => `BT /F1 ${l.startsWith('#') ? 20 : 12} Tf 60 ${760 - i * 26} Td (${l.replace('#', '').replace(/[()\\]/g, ' ')}) Tj ET`).join('\n')
  const objs: string[] = []
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>')
  objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let body = '%PDF-1.4\n'; const offsets: number[] = []
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xrefPos = body.length
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((o) => { body += String(o).padStart(10, '0') + ' 00000 n \n' })
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
  return Buffer.from(body, 'latin1')
}

const lines = [
  '# Meridian Financial Group - Retirement Income Proposal',
  '',
  'Prepared for: Mrs. Danielle Reyes, Age 58',
  'Product: Fixed Indexed Annuity (FIA) - Rollover from 401(k)',
  'Carrier: Meridian Life & Annuity',
  '',
  'INITIAL ROLLOVER PREMIUM: $485,000',
  'GUARANTEED INCOME BASE ROLL-UP: 7.0% simple, 10 years',
  'INCOME START AGE: 68 (10-year deferral)',
  'PROJECTED INCOME BASE AT AGE 68: $824,500',
  'GUARANTEED ANNUAL LIFETIME INCOME AT 68: $49,470',
  'PAYOUT RATE AT AGE 68: 6.0%',
  '',
  'ACCUMULATION VALUE ILLUSTRATION (non-guaranteed):',
  'Year 5 Accumulation Value: $612,300',
  'Year 10 Accumulation Value: $781,900',
  '',
  'CAP RATE: 9.5% annual  |  PARTICIPATION RATE: 100%  |  FLOOR: 0%',
  'SURRENDER CHARGE PERIOD: 7 years',
  '',
  'KEY FEATURES:',
  '- Principal protection with 0% floor in down markets',
  '- Guaranteed lifetime income you cannot outlive',
  '- Optional Enhanced Death Benefit rider',
  '- Nursing home / terminal illness waiver',
  '',
  'This is a hypothetical illustration for demonstration purposes only.',
  'Not a guarantee of future results. Consult your advisor.',
]
writeFileSync(join(__dirname, '..', '..', 'demo-annuity.pdf'), pdf(lines))
console.log('Wrote demo-annuity.pdf (fake retirement annuity proposal — demo numbers)')
