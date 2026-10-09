import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import {
  closestFreeFont, contrast, formatFigure, guardLook, KIT_LOOKS, kitTimeline, parseFigure, sanitizeLook,
  spelledNumbersIn, cueFrame, FEEL, VO_LEAD, VO_TAIL, END_HOLD, MIN_FRAMES, PREVIEW_FRAMES,
  type KitScene, type SceneType,
} from '../remotion/src/kit/spec'
import {
  costOf, fallbackPlan, KIT_PLAN_CAP_USD, KIT_PLANNER_MODEL, planKitScenes, validateKitScenes,
  type CallResult, type PlannerCall, type PlannerInput,
} from '../app/_lib/kit-planner'
import { planKitVideoCached, resolveKitLook, assembleKitPlan, kitLogoAssets } from '../app/_lib/kit-engine'
import { cardForDraft, previewLookFor, styleForCard } from '../app/_lib/kit-looks'
import { stillEngineFor } from '../app/_lib/first-scene-preview'
import { CARRIER_BLOCKLIST } from '../app/_lib/compliance'
import { KIT_STORIES } from '../scripts/look-samples/kit-stories'
import type { Brand } from '../app/_lib/types'

const ROOT = path.join(__dirname, '..')
const req = createRequire(path.join(ROOT, 'package.json'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kitJs: any = req(path.join(ROOT, 'render-service/kit.js'))

// ── a small story to plan ────────────────────────────────────────────────────
const input = (over: Partial<PlannerInput> = {}): PlannerInput => ({
  beats: [
    { role: 'cover', title: 'Your plan', narration: 'Here is your plan.', slideData: { headline: 'Your plan' } },
    { role: 'content', title: 'What you get', narration: 'Your family receives five hundred thousand dollars.', slideData: { headline: 'What you get', stats: [{ label: 'Paid to your family', value: '$500,000' }] } },
    { role: 'content', title: 'Where it goes', narration: 'Three hundred ten thousand for the mortgage and one hundred twenty thousand for college.', slideData: { headline: 'Where it goes', stats: [{ label: 'Mortgage', value: '$310,000' }, { label: 'College', value: '$120,000' }] } },
    { role: 'content', title: 'Why it fits', narration: 'The price never goes up. You can switch later.', slideData: { headline: 'Why it fits', bullets: ['The price never goes up', 'Switch to permanent later'] } },
    { role: 'closing', title: 'Let’s talk', narration: 'Book a quick call any time.', slideData: { headline: 'Let’s talk', cta: 'Book a call' } },
  ],
  keyMetrics: [{ label: 'Coverage', value: '$500,000' }],
  regulated: true,
  contact: { phone: '555-0142', email: 'hello@example.com' },
  ...over,
})

const GOOD: KitScene[] = [
  { id: 1, narration: '', type: 'title', headline: 'Your plan' },
  { id: 2, narration: '', type: 'bignumber', label: 'Paid to your family', figure: { value: 500000, prefix: '$' }, landOn: 'five hundred thousand' },
  { id: 3, narration: '', type: 'chart', kind: 'bar', heading: 'Where it goes', prefix: '$', points: [{ label: 'Mortgage', value: 310000 }, { label: 'College', value: 120000 }] },
  { id: 4, narration: '', type: 'checklist', heading: 'Why it fits', items: ['The price never goes up', 'Switch to permanent later'] },
  { id: 5, narration: '', type: 'cta', headline: 'Let’s talk', action: 'Book a quick call' },
]
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const answer = (scenes: unknown, usage = { input_tokens: 1500, output_tokens: 700, cache_creation_input_tokens: 0, cache_read_input_tokens: 1900 }, stopReason = 'end_turn'): CallResult =>
  ({ text: JSON.stringify({ types: [], scenes }), usage, stopReason })
/** A fake API: hands out the given answers in order and records each request. */
function fakeCall(...answers: (CallResult | Error)[]) {
  const seen: { system: string; user: string; maxTokens: number }[] = []
  const call: PlannerCall = async (r) => {
    seen.push(r)
    const a = answers[Math.min(seen.length - 1, answers.length - 1)]
    if (a instanceof Error) throw a
    return a
  }
  return { call, seen }
}
const quiet = () => {}

// ── numbers ──────────────────────────────────────────────────────────────────
describe('numbers are always written the house way', () => {
  it('reads figures and writes $ with commas', () => {
    expect(formatFigure(parseFigure('$500,000')!)).toBe('$500,000')
    expect(formatFigure(parseFigure('$1.2M')!)).toBe('$1,200,000')
    expect(formatFigure(parseFigure('$46,666.50')!)).toBe('$46,666.50')
    expect(formatFigure(parseFigure('$142/mo')!)).toBe('$142/mo')
    expect(formatFigure(parseFigure('6.35%')!)).toBe('6.35%')
    expect(formatFigure(parseFigure('Age 65')!)).toBe('Age 65')
    expect(formatFigure({ value: 355829, prefix: '$' })).toBe('$355,829')
    expect(formatFigure({ value: 12.5, prefix: '$' })).toBe('$12.50')
    expect(parseFigure('3-5 years')).toBeNull()
    expect(parseFigure('N/A')).toBeNull()
  })
  it('hears spelled-out numbers (for grounding checks)', () => {
    expect(spelledNumbersIn('five hundred thousand dollars and sixty-five')).toEqual([500000, 65])
    expect(spelledNumbersIn('one hundred forty-two dollars')).toEqual([142])
  })
  it('finds the spoken word a number lands on', () => {
    const words = [{ w: 'receives', start: 0.2, end: 0.6 }, { w: 'five', start: 1.0, end: 1.2 }, { w: 'hundred', start: 1.2, end: 1.5 }, { w: 'thousand', start: 1.5, end: 1.9 }]
    expect(cueFrame(words, 'five hundred thousand')).toBe(30)
    expect(cueFrame(words, 'a million')).toBeNull()
  })
})

// ── looks ────────────────────────────────────────────────────────────────────
describe('looks: one settings object, contrast guarded', () => {
  it('every ready look reads at 4.5:1 (words) and 3:1 (big numbers)', () => {
    for (const look of Object.values(KIT_LOOKS)) {
      const { tokens: t, fixes } = guardLook(look)
      expect(contrast(t.text, t.bg), look.id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.muted, t.bg), look.id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.accentInk, t.bg), look.id).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.accentBig, t.bg), look.id).toBeGreaterThanOrEqual(3)
      expect(contrast(t.onAccent, t.accentBig), look.id).toBeGreaterThanOrEqual(3)
      expect(t.radius).toBeLessThanOrEqual(10)
      expect(fixes.filter((f) => f.includes('text')), `${look.id} needs no text fix`).toEqual([])
    }
  })
  it('fixes unreadable text and SAYS so', () => {
    const { tokens, fixes } = guardLook({ ...KIT_LOOKS.editorial, colors: { ...KIT_LOOKS.editorial.colors, text: '#d8d2c8' } })
    expect(contrast(tokens.text, tokens.bg)).toBeGreaterThanOrEqual(4.5)
    expect(fixes.join(' ')).toMatch(/readable/)
  })
  it('keeps fonts to the free list and colours to real hex', () => {
    const l = sanitizeLook({ id: 'custom', headFont: 'Comic Sans', bodyFont: 'inter', colors: { bg: 'red', accent: '#abc' }, feel: 'wild', corners: 'round' })
    expect(l.headFont).toBe('montserrat')
    expect(l.bodyFont).toBe('inter')
    expect(l.colors.bg).toBe(KIT_LOOKS['animated-slides'].colors.bg)
    expect(l.colors.accent).toBe('#aabbcc')
    expect(l.feel).toBe('premium')
    expect(closestFreeFont('Helvetica Neue')).toEqual({ id: 'inter', exact: false })
    expect(closestFreeFont('Playfair Display')).toEqual({ id: 'playfair', exact: true })
  })
  it('resolves the look a video is made in (preset, brand, saved, logo card)', () => {
    const brand = { primary_color: '#1d4e89', accent_color: '#e9a23b', logo_chip: true } as unknown as Brand
    expect(resolveKitLook({ kitLook: 'bright' }).id).toBe('bright')
    expect(resolveKitLook({ kitLook: 'nonsense' }).id).toBe('animated-slides')
    const b = resolveKitLook({ kitLook: 'brand', brand })
    expect(b.id).toBe('brand')
    expect(b.colors.accent).toBe('#e9a23b')
    expect(b.logoMode).toBe('plate')   // a logo the brand says needs a card gets one
    expect(resolveKitLook({ kitLookCustom: { id: 'editorial', colors: { accent: '#ff0000' } } }).colors.accent).toBe('#ff0000')
  })
  it('only real uploaded logos, never for a person profile', () => {
    expect(kitLogoAssets({ profile_type: 'company', logo_light_url: 'https://x/l.png', logo_dark_url: 'https://x/d.png' } as unknown as Brand)).toEqual({ logo_light: 'https://x/l.png', logo_dark: 'https://x/d.png' })
    expect(kitLogoAssets({ profile_type: 'company', logo_url: 'https://x/a.png' } as unknown as Brand)).toEqual({ logo_any: 'https://x/a.png' })
    expect(kitLogoAssets({ profile_type: 'person', logo_url: 'https://x/a.png' } as unknown as Brand)).toEqual({})
    expect(assembleKitPlan({ title: 't', scenes: [], look: KIT_LOOKS.bright, brandName: 'Docs2Video', regulated: false }).brand.name).toBeUndefined()
  })
})

// ── timing: the app's copy and the render service's copy agree ──────────────
describe('timeline mirror (spec.ts ↔ render-service/kit.js)', () => {
  it('has the same constants', () => {
    expect(kitJs.KIT.VO_LEAD).toBe(VO_LEAD)
    expect(kitJs.KIT.VO_TAIL).toBe(VO_TAIL)
    expect(kitJs.KIT.END_HOLD).toBe(END_HOLD)
    expect(kitJs.KIT.PREVIEW_FRAMES).toBe(PREVIEW_FRAMES)
    expect(kitJs.KIT.MIN_FRAMES).toEqual(MIN_FRAMES)
    for (const f of ['calm', 'premium', 'energetic'] as const) {
      expect(kitJs.KIT.CUT[f]).toBe(FEEL[f].cut)
      expect(kitJs.KIT.MUSIC[f]).toBe(FEEL[f].music)
    }
  })
  it('gives the same timeline for the same scenes', () => {
    const types: SceneType[] = ['title', 'bignumber', 'comparison', 'timeline', 'chart', 'checklist', 'quote', 'cta']
    for (let seed = 1; seed < 30; seed++) {
      const scenes = types.slice(0, 2 + (seed % 7)).map((type, i) => ({ type, voSec: ((seed * 7 + i * 13) % 90) / 10 }))
      for (const feel of ['calm', 'premium', 'energetic'] as const) {
        expect(kitJs.kitTimeline(scenes, feel)).toEqual(kitTimeline(scenes, feel))
        expect(kitJs.kitTimeline(scenes, feel, { preview: true })).toEqual(kitTimeline(scenes, feel, { preview: true }))
      }
    }
  })
  it('never lets a voice run into the next cut', () => {
    const scenes = [{ type: 'title' as const, voSec: 6.2 }, { type: 'bignumber' as const, voSec: 0.5 }, { type: 'cta' as const, voSec: 4 }]
    const tl = kitTimeline(scenes, 'premium')
    tl.starts.forEach((s, i) => {
      if (i === tl.starts.length - 1) return
      const voiceEnd = s + VO_LEAD + tl.voFrames[i]
      expect(voiceEnd).toBeLessThanOrEqual(tl.starts[i + 1])   // the next scene's cut starts after the voice
    })
    expect(tl.durations[0]).toBeGreaterThanOrEqual(MIN_FRAMES.title)   // the cover is readable
  })
})

// ── planner checks ───────────────────────────────────────────────────────────
describe('planner: code checks every scene', () => {
  it('passes a good plan', () => {
    expect(validateKitScenes(GOOD, input())).toEqual([])
  })
  const broken = (mutate: (s: KitScene[]) => void) => { const s = clone(GOOD); mutate(s); return validateKitScenes(s, input()).join(' | ') }
  it('refuses invented numbers', () => {
    expect(broken((s) => { (s[1] as any).figure.value = 750000 })).toMatch(/750000 is not in the source/)
  })
  it('refuses money without its $', () => {
    expect(broken((s) => { (s[1] as any).figure = { value: 500000 } })).toMatch(/dollar amount in the source/)
  })
  it('refuses big numbers written without commas in words', () => {
    expect(broken((s) => { (s[3] as any).items[0] = 'Pays $500000 to your family' })).toMatch(/without commas/)
  })
  it('refuses two of the same scene in a row', () => {
    expect(broken((s) => { s[3] = { id: 4, narration: '', type: 'chart', kind: 'bar', heading: 'x', prefix: '$', points: [{ label: 'Mortgage', value: 310000 }, { label: 'College', value: 120000 }] } })).toMatch(/same scene type/)
  })
  it('refuses a comparison without two real sides', () => {
    const cmp = (left: any, right: any) => broken((s) => { s[2] = { id: 3, narration: '', type: 'comparison', heading: 'Compare', left, right } })
    expect(cmp({ label: 'With it', figure: { value: 310000, prefix: '$' } }, { label: 'N/A', figure: { value: 120000, prefix: '$' } })).toMatch(/real label/)
    expect(cmp({ label: 'With it', points: ['Paid off'] }, { label: 'Without it' })).toMatch(/figure or at least one point/)
    expect(cmp({ label: 'Premium', figure: { value: 310000, prefix: '$', suffix: '/mo' } }, { label: 'Term', figure: { value: 120000, suffix: ' years' } })).toMatch(/measure different things/)
  })
  it('flags sales pressure', () => {
    expect(broken((s) => { (s[4] as any).action = 'Act now' })).toMatch(/sales-pressure/)
    expect(broken((s) => { (s[3] as any).heading = 'Limited time offer' })).toMatch(/sales-pressure/)
  })
  it('refuses carrier / product names on a regulated video, and our own name everywhere', () => {
    const carrier = CARRIER_BLOCKLIST[0]
    expect(broken((s) => { (s[0] as any).headline = `Your ${carrier} plan` })).toMatch(/insurance company\/product/)
    expect(broken((s) => { (s[0] as any).sub = 'Made with Docs2Video' })).toMatch(/Docs2Video/)
  })
  it('keeps word limits and the cover/closing roles', () => {
    expect(broken((s) => { (s[1] as any).label = 'one two three four five six seven eight' })).toMatch(/limit 6/)
    expect(broken((s) => { s[0] = clone(GOOD[3]) })).toMatch(/cover beat must be "title"/)
  })
  it('refuses a bar chart of amounts that are not comparable', () => {
    const inp = input({ keyMetrics: [{ label: 'a', value: '$500,000' }, { label: 'b', value: '$142' }] })
    const s = clone(GOOD); s[2] = { id: 3, narration: '', type: 'chart', kind: 'bar', heading: 'x', prefix: '$', points: [{ label: 'Cover', value: 500000 }, { label: 'Monthly', value: 142 }] }
    expect(validateKitScenes(s, inp).join(' ')).toMatch(/not comparable/)
  })
})

// ── planner flow: one call, one repair, fallback, money cap ─────────────────
describe('planner: call → repair → fallback, capped at $0.25', () => {
  it('uses the model and its prices', () => {
    expect(KIT_PLANNER_MODEL).toBe('claude-sonnet-5')
    expect(KIT_PLAN_CAP_USD).toBe(0.25)
    expect(costOf({ input_tokens: 1_000_000 })).toBeCloseTo(2)
    expect(costOf({ output_tokens: 1_000_000 })).toBeCloseTo(10)
    expect(costOf({ cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2)
    expect(costOf({ cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(2.5)
  })
  it('a good first answer is used as is (one call), contact from the profile', async () => {
    const f = fakeCall(answer({ ...GOOD }))
    const withFakeContact = clone(GOOD); (withFakeContact[4] as any).contact = { phone: '999-9999' }
    const f2 = fakeCall(answer(withFakeContact))
    const r = await planKitScenes(input(), { call: f2.call, log: quiet })
    expect(r.source).toBe('claude')
    expect(r.calls).toBe(1)
    expect((r.scenes[4] as any).contact).toEqual({ phone: '555-0142', email: 'hello@example.com' })   // never the model's
    expect(r.scenes.map((s) => s.narration)).toEqual(input().beats.map((b) => b.narration))           // narration untouched
    expect(r.costUsd).toBeCloseTo(costOf({ input_tokens: 1500, output_tokens: 700, cache_read_input_tokens: 1900 }), 6)
    void f
  })
  it('drops a landing word the voice never says', async () => {
    const s = clone(GOOD); (s[1] as any).landOn = 'half a million'
    const r = await planKitScenes(input(), { call: fakeCall(answer(s)).call, log: quiet })
    expect((r.scenes[1] as any).landOn).toBeUndefined()
  })
  it('one repair call fixes a bad answer, and is told exactly what failed', async () => {
    const bad = clone(GOOD); (bad[1] as any).figure.value = 999999
    const f = fakeCall(answer(bad), answer(GOOD))
    const r = await planKitScenes(input(), { call: f.call, log: quiet })
    expect(r.source).toBe('repaired')
    expect(r.calls).toBe(2)
    expect(f.seen[1].user).toMatch(/999999 is not in the source/)
  })
  it('a still-bad repair swaps ONLY the bad scenes for the fallback', async () => {
    const bad = clone(GOOD); (bad[1] as any).figure.value = 999999
    const f = fakeCall(answer(bad), answer(bad))
    const r = await planKitScenes(input(), { call: f.call, log: quiet })
    expect(r.source).toBe('mixed')
    expect(r.calls).toBe(2)
    expect(validateKitScenes(r.scenes, input())).toEqual([])
    expect(r.scenes[2]).toMatchObject({ type: 'chart' })   // the good Claude scene kept
  })
  it('garbage, a cut-off answer, or an error ends in a clean fallback plan', async () => {
    const junk: CallResult = { text: 'Sure! Here you go', usage: { input_tokens: 10, output_tokens: 10 } }
    const r1 = await planKitScenes(input(), { call: fakeCall(junk, junk).call, log: quiet })
    expect(r1.source).toBe('fallback')
    expect(validateKitScenes(r1.scenes, input())).toEqual([])
    const cut = answer(GOOD, undefined, 'max_tokens')
    const r2 = await planKitScenes(input(), { call: fakeCall(cut, answer(GOOD)).call, log: quiet })
    expect(r2.source).toBe('repaired')
    const r3 = await planKitScenes(input(), { call: fakeCall(new Error('overloaded')).call, log: quiet })
    expect(r3.source).toBe('fallback')
    expect(r3.note).toMatch(/overloaded/)
    const r4 = await planKitScenes(input(), { call: null, log: quiet })
    expect(r4.source).toBe('fallback')
    expect(r4.calls).toBe(0)
  })
  it('never makes a call that could pass the cap', async () => {
    const f = fakeCall(answer(GOOD))
    const r = await planKitScenes(input(), { call: f.call, capUsd: 0.002, log: quiet })
    expect(f.seen.length).toBe(0)
    expect(r.source).toBe('fallback')
    expect(r.note).toMatch(/cost cap/)
  })
  it('skips the repair when the first call used up the budget', async () => {
    const bad = clone(GOOD); (bad[1] as any).figure.value = 999999
    const pricey = answer(bad, { input_tokens: 45_000, output_tokens: 15_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 })   // $0.24
    const f = fakeCall(pricey, answer(GOOD))
    const r = await planKitScenes(input(), { call: f.call, log: quiet })
    expect(f.seen.length).toBe(1)
    expect(r.costUsd).toBeLessThanOrEqual(KIT_PLAN_CAP_USD)
    expect(validateKitScenes(r.scenes, input())).toEqual([])
  })
  it('asks for no more output than the cap allows', async () => {
    const f = fakeCall(answer(GOOD))
    await planKitScenes(input(), { call: f.call, log: quiet })
    const worstIn = Math.ceil((f.seen[0].system.length + f.seen[0].user.length) / 2.5) * 2.5e-6
    expect(worstIn + f.seen[0].maxTokens * 10e-6).toBeLessThanOrEqual(KIT_PLAN_CAP_USD)
  })
  it('a retry of the same story reuses the saved plan for $0', async () => {
    const f = fakeCall(answer(GOOD))
    const first = await planKitVideoCached(input(), null, { call: f.call })
    const again = await planKitVideoCached(input({ videoId: 'other-id' }), first.cache, { call: f.call })
    expect(again.reused).toBe(true)
    expect(again.result.costUsd).toBe(0)
    expect(f.seen.length).toBe(1)
    const changed = await planKitVideoCached(input({ recipient: 'Someone else' }), first.cache, { call: f.call })
    expect(changed.reused).toBe(false)
  })
})

describe('the deterministic fallback', () => {
  it('plans every sample story cleanly, with no repeats in a row', () => {
    for (const story of KIT_STORIES) {
      const inp: PlannerInput = { beats: story.beats, keyMetrics: story.keyMetrics, regulated: story.regulated, contact: story.contact }
      const scenes = fallbackPlan(inp)
      expect(scenes.length).toBe(story.beats.length)
      expect(validateKitScenes(scenes, inp), story.id).toEqual([])
      expect(scenes[0].type).toBe('title')
      expect(scenes[scenes.length - 1].type).toBe('cta')
    }
  })
  it('never charts amounts that are not comparable', () => {
    const scenes = fallbackPlan(input({ beats: [input().beats[0], { role: 'content', narration: 'It pays five hundred thousand dollars for one hundred forty-two dollars a month.', slideData: { stats: [{ label: 'Coverage', value: '$500,000' }, { label: 'Monthly', value: '$142' }] } }, input().beats[4]] }))
    expect(scenes[1].type).toBe('bignumber')
  })
})

// ── wiring ───────────────────────────────────────────────────────────────────
describe('wiring: step 3, preview, render service', () => {
  it('step-3 cards save the kit only when the engine is on', () => {
    expect(styleForCard('slides', false)).toEqual({ videoStyle: 'slides' })
    expect(styleForCard('slides', true)).toEqual({ videoStyle: 'kit', kitLook: 'animated-slides' })
    expect(styleForCard('explainer', true)).toEqual({ videoStyle: 'kit', kitLook: 'bright' })
    expect(styleForCard('drawn', true)).toEqual({ videoStyle: 'drawn' })
    expect(cardForDraft('kit', 'bright')).toBe('explainer')
    expect(cardForDraft('aurora', undefined)).toBe('aurora')
    expect(previewLookFor('editorial', true)).toBe('kit:editorial')
    expect(stillEngineFor('video', 'kit:bright')).toBe('kit')
    expect(stillEngineFor('video', 'slides')).toBe('directed')
  })
  it('the free preview still is the first content scene, settled', () => {
    const plan = { look: KIT_LOOKS.bright, scenes: GOOD }
    const j = kitJs.previewKitJob({ plan })
    expect(j.comp).toBe('KitVideo')
    expect(j.props.still).toBe(true)
    expect(j.frame).toBe(j.props.timeline.starts[1] + 150)
  })
  it('the render service scrubs carrier names on regulated videos only', () => {
    const carrier = CARRIER_BLOCKLIST[0]
    const plan = { regulated: true, scenes: [{ type: 'title', headline: `Your ${carrier} plan`, narration: `Thanks for choosing ${carrier} today.` }] }
    const removed = kitJs.scrubKitPlan(plan, CARRIER_BLOCKLIST)
    expect(removed.length).toBeGreaterThan(0)
    expect(JSON.stringify(plan).toLowerCase()).not.toContain(carrier)
    const plain = { regulated: false, scenes: [{ type: 'title', headline: `Your ${carrier} plan`, narration: 'x' }] }
    expect(kitJs.scrubKitPlan(plain, CARRIER_BLOCKLIST)).toEqual([])
  })
  it('the render service image ships kit.js (a missing file would crash every kit render)', () => {
    expect(fs.readFileSync(path.join(ROOT, 'render-service/Dockerfile'), 'utf8')).toMatch(/^COPY kit\.js \.\/$/m)
    expect(fs.readFileSync(path.join(ROOT, 'render-service/build-context.sh'), 'utf8')).toMatch(/job-guards\.js kit\.js /)
  })
  it('KitVideo keeps its file address through setup (Lambda)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'remotion/src/kit/KitVideo.tsx'), 'utf8')
    const meta = src.slice(src.indexOf('export const kitMetadata'), src.indexOf('// ── the reveal cut'))
    expect(meta.indexOf('setAssetBase(props?.assetBase)')).toBeGreaterThan(-1)
    expect(meta.indexOf('setAssetBase(props?.assetBase)')).toBeLessThan(meta.indexOf('getAudioDurationInSeconds'))
    // every return hands the address on
    const returns = meta.split('return { ...base').slice(1)
    expect(returns.length).toBeGreaterThanOrEqual(3)
    for (const r of returns) expect(r.slice(0, 220)).toMatch(/assetBase/)
  })
  it('generate-video only uses the kit when KIT_ENGINE is on, and falls back to Animated slides', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/api/generate-video/route.ts'), 'utf8')
    expect(src).toMatch(/videoStyle === 'kit' && kitEngineOn\(\)/)
    expect(src).toMatch(/\/generate-kit/)
    expect(src).toMatch(/const isSlides = videoStyle === 'slides' \|\| videoStyle === 'kit' \|\| kitFellBack/)
  })
})

describe('the sample stories are made up', () => {
  it('name no real carrier', () => {
    const hay = JSON.stringify(KIT_STORIES).toLowerCase()
    for (const term of CARRIER_BLOCKLIST) expect(hay.includes(term), term).toBe(false)
  })
})
