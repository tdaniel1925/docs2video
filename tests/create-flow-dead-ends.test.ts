import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { CREDIT_COSTS } from '../app/_lib/credits'
import { quoteOutput, videoPriceInputs } from '../app/_lib/price-quote'
import {
  DEFAULT_LENGTH, LENGTHS, LENGTH_ANCHOR, lengthChange, lengthName, lengthOf,
} from '../app/(dashboard)/create/_components/story/lengths'
import {
  COPIED_FIELDS, NEVER_COPIED, copyDraft, copyLandingUrl, hasContentToCopy,
} from '../app/api/videos/draft/duplicate/copy-draft'
import { ALL_TIPS, madeNoun, tipsFor } from '../app/(dashboard)/create/_components/generatingTips'

/*
 * THE CREATE FLOW HAS NO DEAD ENDS.
 *
 * Four things a customer could press and land nowhere:
 *   1. Step 3's "Change the length" sent people to step 2, which had no
 *      length choice — every video was Standard.
 *   2. "Duplicate" opened /create?duplicate=<id>, which nothing read — a
 *      blank step 1.
 *   3. The waiting screen promised things that weren't true for what was
 *      being made ("custom-designed with your brand colors and logo" with no
 *      brand; "download as MP4, PDF or PPTX" for a slide deck).
 *   4. Step 1 carried ~330 lines of a "style preview" no one could reach.
 *
 * Pure rules are tested directly; the wiring between screens is checked in
 * the source (a page that stops reading ?duplicate= would still pass a unit
 * test of the copy helper).
 */

type Rec = Record<string, unknown>
const root = path.resolve(__dirname, '..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')
/** Source minus comments — the notes describe the very bugs they forbid. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const STEP1 = 'app/(dashboard)/create/_components/Step1Content.tsx'
const STEP2 = 'app/(dashboard)/create/script/page.tsx'
const STEP3 = 'app/(dashboard)/create/theme/page.tsx'
const WAITING = 'app/(dashboard)/create/generating/page.tsx'
const BRAND = 'app/(dashboard)/create/brand/page.tsx'
const DUP_ROUTE = 'app/api/videos/draft/duplicate/route.ts'

// ── 1. LENGTH ────────────────────────────────────────────────────────────────

describe('length: Short / Standard / Detailed, chosen on the story step', () => {
  it('three plain names, saved as the detail levels the price already knows', () => {
    expect(LENGTHS.map((l) => l.name)).toEqual(['Short', 'Standard', 'Detailed'])
    expect(LENGTHS.map((l) => l.id)).toEqual(['quick', 'standard', 'detailed'])
    expect(DEFAULT_LENGTH).toBe('standard')
  })

  it('reads a saved length, and anything odd as Standard', () => {
    expect(lengthOf('quick')).toBe('quick')
    expect(lengthOf('detailed')).toBe('detailed')
    expect(lengthOf(undefined)).toBe('standard')
    expect(lengthOf('highlights')).toBe('standard')
    expect(lengthName('quick')).toBe('Short')
  })

  it('no story yet: a new pick is saved; with a story: a rewrite is offered, never a silent change', () => {
    expect(lengthChange({ current: 'standard', picked: 'quick', hasStory: false, writing: false })).toBe('save')
    expect(lengthChange({ current: 'standard', picked: 'standard', hasStory: false, writing: false })).toBe('none')
    expect(lengthChange({ current: 'standard', picked: 'detailed', hasStory: true, writing: false })).toBe('offer')
    expect(lengthChange({ current: 'standard', picked: 'standard', hasStory: true, writing: false })).toBe('none')
    // While the story is being written nothing can change under it.
    expect(lengthChange({ current: 'standard', picked: 'quick', hasStory: false, writing: true })).toBe('none')
  })

  it('the saved length is the price: Short / Standard / Detailed = 500 / 1,000 / 1,500 credits', () => {
    const NOT_FREE = { video: false, presentation: false }
    const price = (detailLevel: string) => quoteOutput({ output_type: 'video', draft_data: { detailLevel } }, 'video', 'u1', NOT_FREE)
    expect(price('quick').total).toBe(CREDIT_COSTS.videoQuick)
    expect(price('standard').total).toBe(CREDIT_COSTS.videoStandard)
    expect(price('detailed').total).toBe(CREDIT_COSTS.videoDetailed)
    expect([CREDIT_COSTS.videoQuick, CREDIT_COSTS.videoStandard, CREDIT_COSTS.videoDetailed]).toEqual([500, 1000, 1500])
    // The price line uses the same word as the chips.
    expect(price('quick').lines[0].label).toMatch(/short$/)
    expect(videoPriceInputs({ output_type: 'video', draft_data: { detailLevel: 'quick' } }).detailLevel).toBe('quick')
  })

  const step2 = code(read(STEP2))

  it('step 2 shows the length choice and writes the story at the picked length', () => {
    expect(step2).toMatch(/<LengthPicker/)
    expect(step2).toMatch(/async function writeStory\(len: StoryLength = pickedRef\.current\)/)
    expect(step2).toMatch(/detailLevel: dl,/)
    expect(step2).toMatch(/detailed: dl === 'detailed'/)
  })

  it('step 2 only saves a length on its own when there is no story yet', () => {
    const pick = step2.slice(step2.indexOf('function pickLength'), step2.indexOf('function keepLength'))
    expect(pick, 'pickLength vanished').not.toBe('')
    const guard = pick.indexOf("if (change !== 'save') return")
    expect(guard, 'the "only when there is no story" guard is gone').toBeGreaterThan(-1)
    expect(guard).toBeLessThan(pick.indexOf("method: 'PATCH'"))
  })

  it('step 2 will not go on to the price while a different length is picked but not written', () => {
    expect(step2).toMatch(/const lengthPending = scenes\.length > 0 && pickedLength !== detailLevel/)
    expect(step2).toMatch(/if \(!videoId \|\| scenes\.length === 0 \|\| lengthPending\) return/)
    // held back — with the reason shown under the button — while the length is pending
    expect(step2).toMatch(/lengthPending \? \{ reason: /)
    expect(step2).toMatch(/missing=\{missing\}/)
    // and "Looks right" saves the length the story was written at
    expect(step2).toMatch(/const updates: Record<string, unknown> = \{ scenes, detailLevel, narrationStyle, step \}/)
  })

  it('a failed rewrite puts the old story back', () => {
    const rw = step2.slice(step2.indexOf('async function rewriteAtLength'), step2.indexOf('async function rewriteAtLength') + 1200)
    expect(rw).toMatch(/const before = scenes/)
    expect(rw).toMatch(/if \(!ok\) \{[\s\S]*setScenes\(before\)/)
  })

  it('step 3 links to the length choice itself and uses the same names', () => {
    const step3 = code(read(STEP3))
    expect(step3).toContain('router.push(`/create/script?id=${videoId}#${LENGTH_ANCHOR}`)')
    expect(step3).toMatch(/import \{ LENGTHS, LENGTH_ANCHOR \} from '..\/_components\/story\/lengths'/)
    expect(step3).not.toMatch(/Highlights/)
    expect(LENGTH_ANCHOR).toBe('length')
    const picker = read('app/(dashboard)/create/_components/story/LengthPicker.tsx')
    expect(picker).toMatch(/id=\{LENGTH_ANCHOR\}/)
    expect(picker).toMatch(/role="radiogroup" aria-label="Length"/)
  })

  it('generation checks the script against the real saved length (Short is not treated as Standard)', () => {
    const gv = code(read('app/api/generate-video/route.ts'))
    expect(gv).not.toMatch(/detailLevel: isDetailed \? 'detailed' : 'standard'/)
    expect(gv).toMatch(/const detailLevel: DetailLevel = priceInputs\.detailLevel/)
  })

  it('the length screens never work a price out themselves', () => {
    for (const f of ['app/(dashboard)/create/_components/story/LengthPicker.tsx', 'app/(dashboard)/create/_components/story/lengths.ts']) {
      expect(read(f)).not.toMatch(/\b(calculateVideoCost|CREDIT_COSTS|videoCreditCost|quoteOutput)\b|_lib\/credits/)
    }
  })
})

// ── 2. DUPLICATE ─────────────────────────────────────────────────────────────

const SOURCE_DRAFT = {
  step: 5,
  outputType: 'video',
  purpose: 'Explain the family plan',
  recipientName: 'Jordan',
  clientId: 'client-old',
  contentMethod: 'file',
  extractedData: { title: 'Family Plan', industry: 'insurance', _sourcePdfPath: 'u1/doc-uploads/a.pdf', _sourcePdfName: 'plan.pdf', _autoBrandId: 'b1' },
  extractedDocs: [
    { fileName: 'a.pdf', data: { title: 'A', _sourcePdfPath: 'u1/doc-uploads/a.pdf', _sourcePdfName: 'a.pdf' } },
    { fileName: 'b.pdf', data: { title: 'B', _sourcePdfPath: 'u1/doc-uploads/b.pdf' } },
  ],
  combineInstruction: 'compare these',
  brief: { angle: 'Your family keeps its home.', approved: true },
  briefSkipped: false,
  briefChat: [{ role: 'user', text: 'focus on price' }],
  scenes: [{ _role: 'cover', title: 'Hi' }, { title: 'What it costs', narration: 'x' }, { _role: 'closing', title: 'Bye' }],
  scriptStatus: 'ready',
  scriptError: null,
  scriptStartedAt: '2026-10-01T00:00:00Z',
  detailLevel: 'quick',
  narrationStyle: 'solo',
  videoStyle: 'aurora',
  presentationTemplate: 'heritage',
  slidePhotos: true,
  voiceId: 'onyx',
  aiMusic: true,
  brandId: 'brand-old',
  inlineBrand: { name: 'Acme' },
  contactPhone: '555',
  presenterIntro: 'Hi, I am Sam.',
  photoPlacement: 'cover',
  // share-page settings — must stay behind
  allowSourceDownload: true,
  agentNote: 'See you Tuesday',
  sourcePdfPath: 'u1/doc-uploads/a.pdf',
  sourcePdfName: 'plan.pdf',
  resolvedAccent: '#123456',
}

describe('duplicate: a new draft from one of your projects', () => {
  const base = { draft: SOURCE_DRAFT, outputType: 'video', brandId: 'brand-old', clientId: 'client-old', pdf: { path: 'u1/doc-uploads/NEW.pdf', name: 'plan.pdf' } }

  it('copies who it’s for, the goal, the sources, the story, the look, the voice and the brand', () => {
    const { draftData: d } = copyDraft(base)
    expect(d.recipientName).toBe('Jordan')
    expect(d.clientId).toBe('client-old')
    expect(d.purpose).toBe('Explain the family plan')
    expect(d.contentMethod).toBe('file')
    expect(d.combineInstruction).toBe('compare these')
    expect(d.scenes).toEqual(SOURCE_DRAFT.scenes)
    expect(d.brief).toEqual(SOURCE_DRAFT.brief)
    expect(d.detailLevel).toBe('quick')
    expect(d.videoStyle).toBe('aurora')
    expect(d.presentationTemplate).toBe('heritage')
    expect(d.slidePhotos).toBe(true)
    expect(d.voiceId).toBe('onyx')
    expect(d.aiMusic).toBe(true)
    expect(d.brandId).toBe('brand-old')
    expect(d.presenterIntro).toBe('Hi, I am Sam.')
    expect(d.outputType).toBe('video')
    expect((d.extractedData as Rec).title).toBe('Family Plan')
    expect((d.extractedData as Rec)._autoBrandId).toBe('b1')
  })

  it('leaves the share-page settings and the old job behind', () => {
    const { draftData: d } = copyDraft(base)
    for (const k of ['allowSourceDownload', 'agentNote', 'briefChat', 'scriptError', 'scriptStartedAt', 'resolvedAccent']) {
      expect(d, k).not.toHaveProperty(k)
    }
    // the never-copied list really is disjoint from the copied one
    for (const k of NEVER_COPIED) expect(COPIED_FIELDS as readonly string[]).not.toContain(k)
  })

  it('never points at the original’s uploaded PDF (a dead copy’s clean-up would delete it)', () => {
    const { draftData: d } = copyDraft(base)
    expect(d.sourcePdfPath).toBe('u1/doc-uploads/NEW.pdf')
    expect(JSON.stringify(d)).not.toContain('u1/doc-uploads/a.pdf')
    expect(JSON.stringify(d)).not.toContain('u1/doc-uploads/b.pdf')
    expect((d.extractedDocs as { data: Rec }[]).map((x) => x.data.title)).toEqual(['A', 'B'])
    // no copy of the file → no PDF at all, not the original's
    const none = copyDraft({ ...base, pdf: null }).draftData
    expect(none).not.toHaveProperty('sourcePdfPath')
    expect(JSON.stringify(none)).not.toContain('doc-uploads/')
  })

  it('brand and client only as the server checked them; an explicit "no brand" stays no brand', () => {
    const gone = copyDraft({ ...base, brandId: undefined, clientId: undefined }).draftData
    expect(gone).not.toHaveProperty('brandId')
    expect(gone).not.toHaveProperty('clientId')
    expect(copyDraft({ ...base, brandId: null }).draftData.brandId).toBeNull()
  })

  it('with a story it opens ready on the story step; without one, step 2 writes it', () => {
    const withStory = copyDraft(base)
    expect(withStory.draftData.scriptStatus).toBe('ready')
    expect(withStory.draftData.step).toBe(5)
    const noStory = copyDraft({ ...base, draft: { ...SOURCE_DRAFT, scenes: [] } }).draftData
    expect(noStory).not.toHaveProperty('scenes')
    expect(noStory).not.toHaveProperty('scriptStatus')
    expect(noStory.step).toBe(2)
    expect(copyLandingUrl('abc')).toBe('/create/script?id=abc&copied=1')
  })

  it('the row’s output type wins; length falls back to the row', () => {
    const r = copyDraft({ ...base, outputType: 'deck', draft: { ...SOURCE_DRAFT, detailLevel: undefined }, rowDetailLevel: 'detailed' })
    expect(r.outputType).toBe('deck')
    expect(r.draftData.outputType).toBe('deck')
    expect(r.detailLevel).toBe('detailed')
    expect(r.draftData.step).toBe(4)
    expect(copyDraft({ ...base, outputType: 'nonsense', draft: { ...SOURCE_DRAFT, outputType: 'interactive' } }).outputType).toBe('interactive')
  })

  it('a project with nothing to copy (a commercial, an API job) is refused, not copied empty', () => {
    expect(hasContentToCopy({})).toBe(false)
    expect(hasContentToCopy(null)).toBe(false)
    expect(hasContentToCopy({ apiKeyId: 'k', kind: 'deck' })).toBe(false)
    expect(hasContentToCopy({ extractedData: { title: 'x' } })).toBe(true)
    expect(hasContentToCopy({ scenes: [{ title: 'x' }] })).toBe(true)
  })

  const route = code(read(DUP_ROUTE))

  it('the server copies only a project the signed-in user owns', () => {
    expect(route).toMatch(/auth\.getUser\(\)/)
    expect(route).toMatch(/\.eq\('id', videoId\)\s*\.eq\('user_id', user\.id\)/)
    expect(route).toMatch(/if \(!source\) return NextResponse\.json\(\{ error: [^}]+\}, \{ status: 404 \}\)/)
    // brand and client re-checked against the user before they come along
    expect(route).toMatch(/ownsBrand\(admin, user\.id, rawBrand\)/)
    expect(route).toMatch(/ownsClient\(admin, user\.id, rawClient\)/)
    // a NEW draft row — the source row is never written to
    expect(route).toMatch(/\.insert\(\{\s*user_id: user\.id,\s*status: 'draft'/)
    expect(route).not.toMatch(/\.update\(/)
  })

  it('the copy gets its own copy of the source PDF', () => {
    expect(route).toMatch(/\.storage\.from\(SOURCE_BUCKET\)\.copy\(path, to\)/)
    expect(route).toMatch(/pdf: pdfPath \?/)
  })

  it('step 1 reads ?duplicate=, asks the server, and opens the copy (no blank step 1)', () => {
    const step1 = code(read(STEP1))
    expect(step1).toMatch(/searchParams\.get\('duplicate'\)/)
    expect(step1).toMatch(/fetch\('\/api\/videos\/draft\/duplicate'/)
    expect(step1).toMatch(/router\.replace\(data\.next\)/)
    // only once, even when the effect runs twice
    expect(step1).toMatch(/if \(!duplicateOf \|\| copyStarted\.current\) return/)
  })

  it('the result page’s Duplicate (More menu) still points at that link', () => {
    const result = read('app/(dashboard)/videos/[id]/result/ResultHeader.tsx')
    expect(result).toMatch(/\/create\?duplicate=\$\{video\.id\}/)
  })
})

// ── 3. WAITING-PAGE WORDS ───────────────────────────────────────────────────

describe('the waiting screen only says what is true for what is being made', () => {
  const all = Object.values(ALL_TIPS).flat()

  it('the false promises are gone', () => {
    for (const t of all) {
      expect(t).not.toMatch(/brand colors and logo/i)
      expect(t).not.toMatch(/MP4, PDF slides, or PPTX/i)
      expect(t).not.toMatch(/My Videos/)
    }
  })

  it('silent outputs never mention a voice or an MP4; a video never promises PowerPoint', () => {
    for (const o of ['deck', 'pptx', 'pdf']) {
      for (const t of tipsFor(o)) expect(t, `${o}: ${t}`).not.toMatch(/voice|MP4|narrat/i)
    }
    for (const t of tipsFor('video')) expect(t).not.toMatch(/PowerPoint|PPTX/i)
    expect(tipsFor('something-new')).toHaveLength(1)
    expect(madeNoun('deck')).toBe('slide deck')
    expect(madeNoun('interactive')).toBe('presentation')
    expect(madeNoun('video')).toBe('video')
  })

  it('the page uses those tips and says Library', () => {
    const page = code(read(WAITING))
    expect(page).toMatch(/tipsFor\(outputType\)/)
    expect(page).not.toMatch(/const TIPS = \[/)
    expect(page).not.toMatch(/My Videos/)
  })
})

// ── 4. DEAD CODE ─────────────────────────────────────────────────────────────

describe('step 1 has no unreachable style preview', () => {
  const step1 = read(STEP1)
  it('the stage that was never set, and everything only it used, are gone', () => {
    for (const gone of ['style-suggest', 'generating-preview', 'previewImages', 'handleUseThisStyle', 'handleReferenceImageUpload', 'handleSelectPresetStyle', 'handleQuickMode', 'showStylesGrid', 'SLIDE_STYLES', 'skipToStep']) {
      expect(step1, gone).not.toContain(gone)
    }
  })
})

// ── 5. NAMES ────────────────────────────────────────────────────────────────

describe('the create flow says Brand, Library and New', () => {
  it('no "My Videos", "New creation" or "who’s presenting" left on these screens', () => {
    for (const f of [STEP1, STEP2, STEP3, WAITING, BRAND]) {
      const src = code(read(f))
      expect(src, f).not.toMatch(/My Videos/)
      expect(src, f).not.toMatch(/New creation/i)
      expect(src, f).not.toMatch(/Who&rsquo;s presenting|Who’s presenting|who's presenting/i)
      expect(src, f).not.toMatch(/saved profile|default profile|new profile|from your profile/i)
    }
  })

  it('the brand step is headed "Your brand" and says it can be a person or a company', () => {
    const brand = read(BRAND)
    expect(brand).toMatch(/>\s*Your brand\s*</)
    expect(brand).toMatch(/A brand can be you/)
    expect(brand).toMatch(/or a company/)
  })
})

// ── Help ─────────────────────────────────────────────────────────────────────

describe('the help article describes the screens as they are', () => {
  const help = read('app/(dashboard)/help/creating-videos/page.tsx')
  it('three steps, the length on step 2, Duplicate, and no screens that are gone', () => {
    for (const t of ['Your content', 'The story (free)', 'The look', 'After you press Make it', 'Rewrite at this length', 'Change the length', 'Duplicate', 'Skip — no brand on this one']) {
      expect(help, t).toContain(t)
    }
    for (const gone of ['What it’s about', 'Make it yours', 'Your video so far', 'Voice &amp; Length', 'Choose the presenter', 'Approve the brief', 'Generate with', '<strong style={INK}>Nova</strong>']) {
      expect(help, gone).not.toContain(gone)
    }
  })
})
