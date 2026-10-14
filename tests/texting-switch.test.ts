import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Owner decision 2026-10-14: texting is switched OFF until Twilio is active
// and registered. Every way in must check the switch.
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')

describe('texting is switched off unless NEXT_PUBLIC_TEXTING=on', () => {
  it('the switch defaults to off', async () => {
    const prev = process.env.NEXT_PUBLIC_TEXTING
    delete process.env.NEXT_PUBLIC_TEXTING
    const mod = await import('../app/_lib/texting-switch?off' as string).catch(() => import('../app/_lib/texting-switch'))
    expect(mod.TEXTING_ON).toBe(false)
    if (prev !== undefined) process.env.NEXT_PUBLIC_TEXTING = prev
  })
  it.each([
    'app/api/texting/send/route.ts', 'app/api/texting/settings/route.ts', 'app/api/texting/status/route.ts',
    'app/api/texting/verify/route.ts', 'app/api/cron/hot-alerts/route.ts', 'app/api/webhooks/twilio/route.ts',
  ])('%s refuses while off', (f) => {
    expect(read(f)).toMatch(/if \(!TEXTING_ON\) return NextResponse\.json/)
  })
  it('screens hide texting while off', () => {
    expect(read('app/(dashboard)/settings/page.tsx')).toMatch(/\{TEXTING_ON && <HotClientAlerts \/>\}/)
    expect(read('app/api/track-view/route.ts')).toMatch(/if \(TEXTING_ON && \[/)
    expect(read('app/_lib/admin/needs-you.ts')).toMatch(/if \(TEXTING_ON\) sections\.push\(await textingSection/)
    expect(read('app/(dashboard)/help/page.tsx')).not.toMatch(/href: '\/help\/texting'/)
  })
})
