/** Builds a source brief PDF for PubCoZone from the scraped site copy. */
import { writeFileSync } from 'fs'
import { join } from 'path'
function pdf(lines: string[]): Buffer {
  const content = lines.map((l, i) => `BT /F1 ${l.startsWith('#') ? 20 : 12} Tf 55 ${770 - i * 24} Td (${l.replace('#', '').replace(/[()\\]/g, ' ')}) Tj ET`).join('\n')
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let body = '%PDF-1.4\n'; const off: number[] = []
  objs.forEach((o, i) => { off.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const x = body.length; body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  off.forEach((o) => { body += String(o).padStart(10, '0') + ' 00000 n \n' })
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`
  return Buffer.from(body, 'latin1')
}
const lines = [
  '# PubcoZone - Product Overview',
  'Tagline: Where public companies and investors meet on the record. Facts over noise.',
  '',
  'FOR INVESTORS:',
  'Research any ticker. Facts over hype. A board where claims get checked against',
  'filings, pumps get flagged, and you see real SEC data - price, cash, insiders,',
  'short interest - before you decide. You are not the exit liquidity.',
  'Free to research any ticker. No signup to look.',
  '',
  'FOR PUBLIC COMPANIES:',
  'Turn filings into compliant posts you approve. AI drafts your investor updates',
  'from the public record, a Reg FD check and counsel sign-off keep you compliant,',
  'and you post to every channel - all approved by you with one tap.',
  'Your whole IR program in one place.',
  'Free company report. Plans from $399 per month.',
  '',
  'KEY POINTS:',
  '- Two-sided: one side investors, one side public companies',
  '- Claims checked against SEC filings',
  '- Reg FD compliance check + counsel sign-off',
  '- Post to every channel with one tap',
  '- Compensated service provider, not an investment adviser',
  '- Not investment advice; data from public sources',
  '',
  'Brand: navy (#0f172a) and emerald (#059669). Font: Inter. 2026 PubcoZone.',
]
writeFileSync(join(__dirname, '..', '..', 'pubco-brief.pdf'), pdf(lines))
console.log('Wrote pubco-brief.pdf')
