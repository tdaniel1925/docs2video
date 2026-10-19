import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildTemplatePreview, previewState, templatePreviewPaths, TEMPLATE_PREVIEW_TIMEOUT_MS } from '../app/_lib/template-preview'
import type { Brand } from '../app/_lib/types'

/*
 * A TEMPLATE'S FREE PREVIEW (owner, 2026-10-19): the customer's OWN cover and
 * first scene in the template they picked — their brand, their words, the
 * template's or the brand's colors — drawn by the real template engine on the
 * render worker. Free, capped like every free preview, never charged.
 */
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const draft = {
  recipientName: 'Jane Morales',
  scenes: [
    { _role: 'cover', title: 'Your 2026 coverage review', narration: 'Jane, thank you for letting Darrell Wolfe share this summary with you.' },
    { title: 'Your premium went down', narration: 'Your premium went down to $84.50 a month.', slideData: { headline: 'Your premium went down', stats: [{ label: 'a month', value: '$84.50' }] } },
    { title: 'What you are covered for', narration: 'Five hundred thousand dollars of cover.' },
    { title: 'Next steps', narration: 'Let us talk.' },
    { _role: 'closing', title: 'Thank you', narration: 'Thank you for watching.' },
  ],
}
const darrell = {
  id: 'b1', user_id: 'u1', name: 'Darrell Wolfe', profile_type: 'person', person_role: 'Senior Advisor',
  photo_url: 'https://x.example/darrell.jpg', photo_placement: 'both',
  primary_color: '#0B2545', secondary_color: '#13315C', accent_color: '#EEF4ED',
  brand_guide_data: { phone: '5550142290', email: 'darrell@wolfe.example' },
} as unknown as Brand
const trent = { full_name: 'Trent Daniel', company_name: 'BotMakers', photo_url: null, email: 'trent@botmakers.example', phone: '2815058290', calendly_url: null }

describe('the preview is the customer’s own cover and first scene, as the video sends them', () => {
  const plan = buildTemplatePreview({ draft, brand: darrell, profile: trent, templateId: 'night', colors: 'template' })!

  it('the cover, then the first content scene — never the closing or a sample', () => {
    expect(plan.scenes.map((s) => s.role)).toEqual(['cover', 'content'])
    expect(plan.scenes[0].title).toBe('Your 2026 coverage review')
    expect(plan.scenes[1].title).toBe('Your premium went down')
    expect(plan.scenes[1].bullets.join(' ')).toMatch(/\$84\.50 a month/i)
    expect(plan.pageCount).toBe(5)
    expect(plan.narration).toMatch(/\$84\.50/)
  })

  it('from Darrell’s brand only, on Trent’s account: Trent’s details are refused on every page', () => {
    expect(plan.identity.kind).toBe('person')
    expect(plan.identity.person).toBe('Darrell Wolfe')
    expect(plan.identity.client).toBe('Jane Morales')
    expect(JSON.stringify(plan.identity)).not.toMatch(/Trent|botmakers/i)
    expect(plan.forbidden).toEqual(expect.arrayContaining(['Trent Daniel', 'trent@botmakers.example']))
  })

  it('Darrell’s photo goes on the cover when his brand says so', () => {
    expect(plan.photoUrl).toBe('https://x.example/darrell.jpg')
    expect(plan.identity.photoOn).toEqual({ cover: true, closing: true })
    const noPhoto = buildTemplatePreview({ draft, brand: { ...darrell, photo_placement: 'closing' } as Brand, profile: trent, templateId: 'night', colors: 'template' })!
    expect(noPhoto.photoUrl).toBeNull()
  })

  it('the brand’s colors only when asked and the brand has some', () => {
    expect(plan.colors).toBe('template')
    expect(plan.palette).toEqual([])
    const brandColored = buildTemplatePreview({ draft, brand: darrell, profile: trent, templateId: 'night', colors: 'brand' })!
    expect(brandColored.colors).toBe('brand')
    expect(brandColored.palette).toEqual(['#0B2545', '#13315C', '#EEF4ED'])
    const noColors = buildTemplatePreview({ draft, brand: { ...darrell, primary_color: null, secondary_color: null, accent_color: null } as unknown as Brand, profile: trent, templateId: 'night', colors: 'brand' })!
    expect(noColors.colors).toBe('template')
  })

  it('one key per thing it shows: the same choices find the same pictures, a change makes new ones', () => {
    expect(plan.key).toMatch(/^[a-f0-9]{32}$/)
    expect(buildTemplatePreview({ draft, brand: darrell, profile: trent, templateId: 'night', colors: 'template' })!.key).toBe(plan.key)
    expect(buildTemplatePreview({ draft, brand: darrell, profile: trent, templateId: 'swiss', colors: 'template' })!.key).not.toBe(plan.key)
    expect(buildTemplatePreview({ draft, brand: darrell, profile: trent, templateId: 'night', colors: 'brand' })!.key).not.toBe(plan.key)
  })

  it('no story yet, no preview', () => {
    expect(buildTemplatePreview({ draft: { scenes: [] }, brand: darrell, profile: trent, templateId: 'night', colors: 'template' })).toBeNull()
  })
})

describe('where its pictures are, and what they say about it', () => {
  it('in the customer’s own previews folder, named as the worker names them', () => {
    const p = templatePreviewPaths('u1', 'a'.repeat(32))
    expect(p.cover).toBe(`u1/previews/tpl-${'a'.repeat(32)}-cover.png`)
    expect(p.scene).toBe(`u1/previews/tpl-${'a'.repeat(32)}-scene.png`)
    expect(p.failed).toBe(`u1/previews/tpl-${'a'.repeat(32)}-failed.json`)
  })
  it('ready only with both pictures; a failure note or a long wait gives the preview back', () => {
    const now = Date.now()
    expect(previewState({ cover: true, scene: true, failed: false, pendingAt: now }, now)).toBe('ready')
    expect(previewState({ cover: false, scene: true, failed: false, pendingAt: now }, now)).toBe('pending')
    expect(previewState({ cover: false, scene: false, failed: true, pendingAt: now }, now)).toBe('failed')
    expect(previewState({ cover: false, scene: false, failed: false, pendingAt: now - TEMPLATE_PREVIEW_TIMEOUT_MS - 1 }, now)).toBe('stale')
    expect(previewState({ cover: false, scene: false, failed: false, pendingAt: null }, now)).toBe('none')
  })
})

describe('the free-preview route and the page', () => {
  const route = read('app/api/preview-first-scene/route.ts')
  it('a chosen template goes to the template preview, counted like every free preview', () => {
    expect(route).toMatch(/if \(output === 'video' && isVideoTemplate\(body\.templateId\)\)/)
    const fn = route.slice(route.indexOf('async function templatePreview('))
    expect(fn).toMatch(/rate_limit_hit/)
    expect(fn).toMatch(/status: 202/)
    expect(fn).toMatch(/if \(note\?\.counted && note\.capKey\) await giveBack/)
    expect(fn).toMatch(/startTemplatePreview\(/)
    expect(route).not.toMatch(/^import .*credit/im)
  })
  it('the job is a small machine and touches no video', () => {
    const e = read('app/_lib/explainer-engine.ts')
    const fn = e.slice(e.indexOf('export async function startTemplatePreview'))
    expect(fn).toMatch(/kind: 'template-preview'/)
    expect(fn).toMatch(/cpu: '4096', memory: '8192'/)
    expect(fn).not.toMatch(/report:/)
  })
  it('the page sends the template, asks again while it is made, and shows the cover and the first scene', () => {
    const p = read('app/(dashboard)/create/_components/make/FirstScenePreview.tsx')
    expect(p).toMatch(/templateId, templateColors: templateColors \?\? 'template'/)
    expect(p).toMatch(/res\.status === 202 && d\.pending/)
    expect(p).toMatch(/setTimeout\(\(\) => \{ void ask\(\) \}, POLL_MS\)/)
    expect(p).toMatch(/Your cover<\/figcaption>/)
    expect(p).toMatch(/Your first scene<\/figcaption>/)
    const step = read('app/(dashboard)/create/_components/steps/LookVoiceReview.tsx')
    expect(step).toMatch(/templateId: isVideo \? templateId : null/)
    expect(step).not.toMatch(/Templates show their scenes on the card/)
  })
})
