import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { NAMES, KIND_NAMES, kindOfOutput, planLabel, planName } from '../app/_lib/names'
import { PLANS } from '../app/_lib/pricing'
import { DOCS2VIDEO } from '../app/_lib/brand'

const read = (p: string) => readFileSync(path.join(__dirname, '..', p), 'utf8')
// Strip comments so an explanation that names an old label doesn't trip a guard.
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('plan label in the avatar menu', () => {
  it('names every paid plan by its pricing.ts label (it said "Free Account" for Business and Enterprise)', () => {
    const label = (tier: string) => PLANS.find(p => p.tier === tier)!.label
    expect(planLabel('business')).toBe(`${label('business')} plan`)
    expect(planLabel('enterprise')).toBe(`${label('enterprise')} plan`)
    expect(planLabel('agency')).toBe(`${label('enterprise')} plan`)
    expect(planLabel('pro')).toBe(`${label('pro')} plan`)
    expect(planLabel('professional')).toBe(`${label('pro')} plan`)
    expect(planLabel('starter')).toBe(`${label('starter')} plan`)
    expect(planLabel('active')).toBe(`${label('starter')} plan`)
  })

  it('says what a trial, a failed payment and a free account really are', () => {
    expect(planLabel('trial')).toBe('Free trial')
    expect(planLabel('past_due')).toBe('Payment due')
    expect(planLabel(null)).toBe(PLANS.find(p => p.tier === 'free')!.label)
    expect(planLabel('cancelled')).toBe(PLANS.find(p => p.tier === 'free')!.label)
    expect(planName('BUSINESS')).toBe('Business')
  })

  it('the header reads planLabel, not a hand-typed list', () => {
    const header = code('app/_components/Header.tsx')
    expect(header).toMatch(/planLabel\(profile\.subscription_status\)/)
    expect(header).not.toMatch(/Pro Member|Free Account/)
  })
})

describe('one name per thing', () => {
  it('the Docs2Video nav reads the shared words', () => {
    expect(DOCS2VIDEO.create?.label).toBe(NAMES.newButton)
    expect(DOCS2VIDEO.nav.find(n => n.href === '/videos')?.label).toBe(NAMES.library)
  })

  it('the old names are gone from the screens that used them', () => {
    expect(code('app/_components/Header.tsx')).not.toMatch(/Brand profiles/)
    expect(code('app/(dashboard)/dashboard/page.tsx')).not.toMatch(/\+ New project/)
    expect(code('app/(dashboard)/videos/page.tsx')).not.toMatch(/\+ New Creation/)
    expect(code('app/(dashboard)/brands/page.tsx')).not.toMatch(/Your profiles|\+ New profile/)
    expect(code('app/_lib/brand.ts')).not.toMatch(/'\+ Create'/)
  })
})

describe('library tabs', () => {
  it('files each videos row under the right tab (commercials have no marker, so they are videos)', () => {
    expect(kindOfOutput('interactive')).toBe('presentation')
    expect(kindOfOutput('deck')).toBe('deck')
    expect(kindOfOutput('pptx')).toBe('deck')
    expect(kindOfOutput('pdf')).toBe('deck')
    expect(kindOfOutput('video')).toBe('video')
    expect(kindOfOutput(null)).toBe('video')
  })

  it('has Videos and Presentations tabs (plus Older items when there are any), kept in the address', () => {
    const page = code('app/(dashboard)/videos/page.tsx')
    const tabs = code('app/(dashboard)/videos/library-tabs.ts')
    for (const kind of ['video', 'presentation'] as const) {
      expect(tabs).toContain(`label: KIND_NAMES.${kind}.many, shows: (k) => k === '${kind}'`)
    }
    expect(page).toMatch(/href=\{tab\.key \? `\/videos\?type=\$\{tab\.key\}`/)
    expect(KIND_NAMES.presentation.many).toBe('Presentations')
  })
})
