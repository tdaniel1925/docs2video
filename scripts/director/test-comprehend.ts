import { config } from 'dotenv'
config({ path: '.env.local' })
import { gatherSource, comprehend } from './comprehend'

async function main() {
  const url = process.argv[2] || 'https://pubcozone.com'
  console.log(`\n▶ COMPREHEND: ${url}\n`)
  const g = await gatherSource({ url })
  console.log(`   pages read: ${(g.pages || []).length}`)
  ;(g.pages || []).forEach((p) => console.log(`     - ${p}`))
  console.log('\n   comprehending...\n')
  const u = await comprehend(g.text, g.kind)
  console.log('WHAT IT IS:', u.what_it_is)
  console.log('CATEGORY:', u.category)
  console.log('\nAUDIENCES:')
  ;(u.audiences || []).forEach((a: any) => {
    console.log(`  ▸ ${a.name}  [${a.pricing || 'no price'}]`)
    ;(a.what_they_get || []).forEach((x: string) => console.log(`      - ${x}`))
    console.log(`      value: ${a.value}`)
  })
  console.log('\nDIFFERENTIATORS:', (u.differentiators || []).join(' | '))
  console.log('CORE PROMISE:', u.core_promise)
  console.log('KEY NUMBERS:', JSON.stringify(u.key_numbers))
  console.log('TONE:', u.tone)
  if (u.coverage_notes) console.log('COVERAGE NOTES:', u.coverage_notes)
  require('fs').writeFileSync('comprehension.json', JSON.stringify({ source: g.kind, pages: g.pages, understanding: u }, null, 2))
  console.log('\n→ saved comprehension.json')
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
