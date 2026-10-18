import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { videoSender, senderName, bookingFor, foreignIdentity, preflightIdentity, foreignIn, type SenderBrand, type SenderProfile } from '../app/_lib/video-sender'
import { sceneFor } from '../app/_lib/explainer-engine'

/*
 * WHO A VIDEO IS FROM (owner, 2026-10-18): the Darrell Wolfe brand was chosen,
 * and the video's pages showed the account owner (Trent Daniel) instead — and
 * no photo of Darrell on the opening or the closing.
 */
const TRENT: SenderProfile = { full_name: 'Trent Daniel', company_name: 'Daniel Financial', photo_url: 'https://x.test/trent.jpg', email: 'trent@daniel.test', phone: '(936) 641-7130', calendly_url: 'https://calendly.com/trent' }
const DARRELL: SenderBrand = {
  id: 'b-darrell', name: 'Darrell Wolfe', profile_type: 'person', person_role: 'Retirement advisor',
  photo_url: 'https://x.test/darrell.jpg', logo_url: 'https://x.test/logo.png',
  brand_guide_data: { phone: '555-201-7788', email: 'darrell@wolfe.test', website: 'wolfeplanning.test' },
}
const ACME: SenderBrand = { id: 'b-acme', name: 'Acme Insurance', profile_type: 'company', logo_url: 'https://x.test/acme.png', brand_guide_data: { phone: '555-000-1111' } }
const read = (f: string) => readFileSync(f, 'utf8')

describe('the selected brand is the one source of who it is from', () => {
  it('Darrell’s brand: Darrell’s name, role, photo and contact — none of Trent’s', () => {
    const s = videoSender(DARRELL, TRENT)
    expect(s).toMatchObject({ source: 'brand', kind: 'person', person: 'Darrell Wolfe', role: 'Retirement advisor', photo: 'https://x.test/darrell.jpg', phone: '555-201-7788', email: 'darrell@wolfe.test', website: 'wolfeplanning.test' })
    expect(JSON.stringify(s)).not.toMatch(/Trent|trent@|641-7130|Daniel Financial/)
  })
  it('a brand with no phone shows no phone — it never borrows the account’s', () => {
    const s = videoSender({ ...DARRELL, brand_guide_data: {} }, TRENT)
    expect(s.phone).toBeNull()
    expect(s.email).toBeNull()
  })
  it('a company brand: its name and logo, no person', () => {
    const s = videoSender(ACME, TRENT)
    expect(s).toMatchObject({ kind: 'company', person: null, company: 'Acme Insurance', photo: 'https://x.test/acme.png', phone: '555-000-1111', email: null })
    expect(senderName(s)).toBe('Acme Insurance')
  })
  it('no brand: the account, as before', () => {
    expect(videoSender(null, TRENT)).toMatchObject({ source: 'profile', person: 'Trent Daniel', company: 'Daniel Financial', phone: '(936) 641-7130' })
    expect(videoSender(null, null).source).toBe('none')
  })
  it('the account’s booking link never goes on another person’s video', () => {
    expect(bookingFor(videoSender(DARRELL, TRENT), TRENT)).toBeNull()
    expect(bookingFor(videoSender({ ...DARRELL, brand_guide_data: { calendly: 'https://cal.com/darrell' } }, TRENT), TRENT)).toBe('https://cal.com/darrell')
    expect(bookingFor(videoSender(ACME, TRENT), TRENT)).toBe('https://calendly.com/trent')
    expect(bookingFor(videoSender(null, TRENT), TRENT)).toBe('https://calendly.com/trent')
  })
  it('the account’s own details are foreign only on another person’s video', () => {
    expect(foreignIdentity(videoSender(DARRELL, TRENT), TRENT).sort()).toEqual(['(936) 641-7130', 'Trent Daniel', 'trent@daniel.test'])
    expect(foreignIdentity(videoSender(ACME, TRENT), TRENT)).toEqual([])
    expect(foreignIdentity(videoSender(null, TRENT), TRENT)).toEqual([])
    expect(foreignIdentity(videoSender({ ...DARRELL, name: 'Trent Daniel' }, TRENT), TRENT)).toEqual([])
  })
})

describe('the pre-flight before an explainer is sent', () => {
  const s = videoSender(DARRELL, TRENT)
  const foreign = foreignIdentity(s, TRENT)
  const both = { cover: true, closing: true }
  const job = (o: Partial<Parameters<typeof preflightIdentity>[0]> = {}) => ({
    cover: { bullets: ['Prepared for Jane Smith', 'Darrell Wolfe'], narration: 'Jane, thank you for letting Darrell Wolfe share this summary with you.' },
    closing: { bullets: ['555-201-7788', 'darrell@wolfe.test', 'wolfeplanning.test'], narration: 'Thank you for watching. Prepared for you by Darrell Wolfe, Retirement advisor.' },
    narrations: ['Here is your plan.'],
    presenter: { name: 'Darrell Wolfe', role: 'Retirement advisor', cover: true, closing: true },
    photoUrl: 'https://x.test/darrell.jpg',
    ...o,
  })
  const opts = { placement: both, foreign, showContactClosing: true }

  it('passes the job the route builds for Darrell', () => {
    expect(preflightIdentity(job(), s, opts)).toEqual([])
  })
  it('refuses Trent’s name on the cover, or his phone or email anywhere', () => {
    expect(preflightIdentity(job({ cover: { bullets: ['Prepared for Jane Smith', 'Trent Daniel'], narration: 'Jane, thank you for letting Trent Daniel share this summary with you.' } }), s, opts).map((p) => p.code)).toEqual(['foreign-identity'])
    expect(preflightIdentity(job({ narrations: ['Call 936-641-7130 with questions.'] }), s, opts).map((p) => p.code)).toEqual(['foreign-identity'])
    expect(preflightIdentity(job({ closing: { bullets: ['trent@daniel.test', 'darrell@wolfe.test', 'wolfeplanning.test'], narration: 'Thanks.' } }), s, opts).map((p) => p.code)).toEqual(['foreign-identity'])
  })
  it('refuses a missing or wrong photo when the settings show it', () => {
    expect(preflightIdentity(job({ photoUrl: null }), s, opts).map((p) => p.code)).toEqual(['photo-missing'])
    expect(preflightIdentity(job({ photoUrl: TRENT.photo_url }), s, opts).map((p) => p.code)).toEqual(['photo-wrong'])
    expect(preflightIdentity(job({ presenter: { name: 'Darrell Wolfe', cover: false, closing: true } }), s, opts).map((p) => p.code)).toEqual(['photo-placement'])
    // "Don't show my photo": no photo is right.
    expect(preflightIdentity(job({ photoUrl: null, presenter: { name: 'Darrell Wolfe', cover: false, closing: false } }), s, { ...opts, placement: { cover: false, closing: false } })).toEqual([])
  })
  it('refuses a presenter who is not the brand, and the brand’s contact missing from the closing', () => {
    expect(preflightIdentity(job({ presenter: { name: 'Trent Daniel', cover: true, closing: true } }), s, opts).map((p) => p.code)).toContain('presenter-name')
    expect(preflightIdentity(job({ presenter: null }), s, opts).map((p) => p.code)).toContain('presenter-missing')
    expect(preflightIdentity(job({ closing: { bullets: ['555-201-7788'], narration: 'Thanks.' } }), s, opts).map((p) => p.code)).toEqual(['contact-missing', 'contact-missing'])
  })
  it('a company brand sends no presenter or photo', () => {
    const c = videoSender(ACME, TRENT)
    expect(preflightIdentity(job({ closing: { bullets: ['555-000-1111'], narration: 'Thanks.' } }), c, { ...opts, foreign: [] }).map((p) => p.code)).toEqual(['presenter-unexpected'])
    expect(preflightIdentity(job({ presenter: null, photoUrl: null, closing: { bullets: ['555-000-1111'], narration: 'Thanks.' } }), c, { ...opts, foreign: [] })).toEqual([])
  })
  it('a name in a content scene is the document’s, not refused', () => {
    expect(foreignIn(['Darrell Wolfe'], ['Trent Daniel founded the agency in 2004.'], foreign, s)).toEqual([])
  })
  it('the explainer scenes carry what the pre-flight reads', () => {
    expect(sceneFor('closing', { narration: 'Thanks.' }, ['555-201-7788', 'darrell@wolfe.test']).bullets).toEqual(['555-201-7788', 'darrell@wolfe.test'])
  })
})

describe('the wiring', () => {
  const route = read('app/api/generate-video/route.ts')
  const watch = read('app/api/public/watch/[id]/route.ts')
  it('the explainer job gets the presenter and the photo, after the pre-flight', () => {
    expect(route).toMatch(/const problems = \[\s*\.\.\.preflightIdentity\(/)
    expect(route).toContain('presenter: exPresenter, photoUrl: exPhoto,')
    expect(route.indexOf('throw new PreflightError')).toBeLessThan(route.indexOf('const started = await startExplainer('))
    const engine = read('app/_lib/explainer-engine.ts')
    expect(engine).toContain("put('assets/presenter.png', photo, 'image/png')")
    expect(engine).toContain('photo: Boolean(photo), cover: o.presenter.cover, closing: o.presenter.closing')
  })
  it('a chosen brand that cannot be loaded stops the video instead of becoming the account', () => {
    expect(route).toContain("if (!brand) return failAndRefund(409,")
    expect(route).toMatch(/brandId === undefined && typeof draft\.brandId === 'string'/)
  })
  it('the share page, its title, the email and the presentation all ask video-sender', () => {
    // The brand comes back too, for its colours only (the page wears them).
    expect(watch).toContain('const { sender, brand } = await loadSender(admin, { userId: ownerId, brandId, profile })')
    expect(watch).toContain('full_name: sender.person,')
    expect(read('app/(public)/watch/[id]/layout.tsx')).toContain('senderName(sender)')
    expect(read('app/_lib/share-send.ts')).toContain('const senderName = nameOf(sender)')
    expect(read('app/api/send-email/route.ts')).toContain('const agentName = senderName(sender)')
    expect(read('app/api/generate-presentation/route.ts')).toContain('const presenterName = senderName(sender)')
  })
})
