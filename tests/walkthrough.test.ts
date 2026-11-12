import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { walkthroughBody, walkthroughTheme, WALKTHROUGH_STYLE } from '../app/_lib/walkthrough'
import { brandLook, KIT_LOOKS } from '../remotion/src/kit/spec'
import { walkTimeline } from '../remotion/src/walkthrough/WalkthroughVideo'
import { lookCards, VIDEO_LOOKS, WALKTHROUGH_LOOK_ID } from '../app/(dashboard)/create/_components/make/looks'

const require = createRequire(import.meta.url)
const walk = require('../render-service/walkthrough.js')

const page = (lines: { text: string; x: number; y: number; w?: number; h?: number }[], n = 1) => ({
  n, w: 2400, h: 3100, file: '', imgs: [], imgBoxesKnown: true,
  lines: lines.map((l, i) => ({ id: `p${n}l${i}`, text: l.text, x: l.x, y: l.y, w: l.w ?? 400, h: l.h ?? 30 })),
})

describe('reading the PDF (poppler output)', () => {
  it('turns -bbox-layout lines into text with boxes, entities decoded', () => {
    const xhtml = `<page width="612.000000" height="792.000000"><flow><block>
      <line xMin="40" yMin="24" xMax="193" yMax="31"><word xMin="40" yMin="24" xMax="73" yMax="31">Death</word><word xMin="76" yMin="24" xMax="104" yMax="31">Benefit:</word></line>
      <line xMin="40" yMin="40" xMax="90" yMax="47"><word xMin="40" yMin="40" xMax="90" yMax="47">A&amp;B</word></line>
    </block></flow></page>`
    const pages = walk.parseBboxLayout(xhtml)
    expect(pages).toHaveLength(1)
    expect(pages[0].w).toBe(612)
    expect(pages[0].lines.map((l: { text: string }) => l.text)).toEqual(['Death Benefit:', 'A&B'])
  })
  it('finds pictures (logos) per page from pdftohtml -xml', () => {
    const xml = `<page number="6" position="absolute" top="0" left="0" height="1188" width="918"><image top="20" left="720" width="113" height="35" src="y-6_1.png"/></page>`
    expect(walk.parseImagesXml(xml)[6].imgs).toEqual([{ top: 20, left: 720, w: 113, h: 35 }])
  })
})

describe('what is hidden', () => {
  const pages = [page([
    { text: 'American General Life Insurance Company', x: 100, y: 100 },
    { text: 'AGL does not solicit business in New York.', x: 100, y: 200 },
    { text: 'Quality of Life… Insurance®', x: 100, y: 300 },
    { text: 'Client Name: IMTIAZ ALI', x: 100, y: 400 },
    { text: 'Death Benefit: $1,000,000.00', x: 100, y: 500 },
  ])]
  it('insurer names, their short forms (AGL), trademark lines and the client are hidden; figures are not', () => {
    const named = walk.hideMatcher(['american general'])
    const initials = walk.initialsFor(pages, named)
    expect(initials).toContain('AGL')
    const hidden = walk.hideMatcher(['american general', ...initials, ...walk.nameTerms('Imtiaz Ali')])
    const isHidden = (t: string) => hidden(t) || walk.PERSONAL_RE.test(t) || walk.MARK_RE.test(t)
    expect(pages[0].lines.map((l) => isHidden(l.text))).toEqual([true, true, true, true, false])
  })
  it('card words lose insurer, product and client names', () => {
    const scrub = walk.makeScrub(['american general', 'corebridge'], 'Imtiaz Ali')
    expect(scrub('American General Life pays Imtiaz Ali $1,000,000®')).toBe('Life pays $1,000,000')
  })
})

describe('the plan the model returns is checked in code', () => {
  const p3 = page([
    { text: 'Death Benefit:', x: 157, y: 443, w: 220 },
    { text: '$1,000,000.00', x: 700, y: 443, w: 220 },
    { text: 'Client Name: X', x: 157, y: 300 },
  ], 3)
  p3.lines[2] = { ...p3.lines[2], hidden: true } as typeof p3.lines[number]
  const pages = [p3]
  const docNums = walk.docNumberSet(pages)
  const scene = { title: 'Coverage', narration: 'One million dollars of coverage for twenty years.' }

  it('accepts a good answer and boxes the figure with its label', () => {
    const shot = walk.checkShot({ i: 0, page: 3, lines: ['p3l0'], ringWord: 'million', card: { type: 'figure', eyebrow: 'Your coverage', value: '$1,000,000' }, cardWord: 'million' }, scene, pages, docNums, null)
    expect(shot.page).toBe(3)
    expect(shot.lines).toEqual(['p3l0', 'p3l1']) // the amount on the same row joins its label
    expect(shot.card.value).toBe('$1,000,000')
    expect(shot.ringWord).toBe('million')
  })
  it('a number not printed in the document never reaches a card', () => {
    const shot = walk.checkShot({ i: 0, page: 3, lines: ['p3l1'], card: { type: 'figure', value: '$2,500,000' } }, scene, pages, docNums, null)
    expect(JSON.stringify(shot.card)).not.toContain('2,500,000')
  })
  it('refuses a hidden line, a missing page or a missing line', () => {
    expect(walk.checkShot({ page: 3, lines: ['p3l2'] }, scene, pages, docNums, null)).toBeNull()
    expect(walk.checkShot({ page: 9, lines: ['p9l0'] }, scene, pages, docNums, null)).toBeNull()
    expect(walk.checkShot({ page: 3, lines: ['p3l99'] }, scene, pages, docNums, null)).toBeNull()
  })
  it('a cue word the voice never says is dropped', () => {
    const shot = walk.checkShot({ page: 3, lines: ['p3l1'], ringWord: 'banana', card: { type: 'statement', text: 'Coverage' } }, scene, pages, docNums, null)
    expect(shot.ringWord).toBeNull()
  })
  it('no model answer: plain matching still finds the figure from the scene numbers', async () => {
    const shots = await walk.planWalkthrough({ scenes: [{ ...scene, slideData: { stats: [{ label: 'Death Benefit', value: '$1,000,000.00' }] } }], pages, claude: null })
    expect(shots[0].source).toBe('fallback')
    expect(shots[0].lines).toContain('p3l1')
    expect(shots[0].card.type).toBe('figure')
  })
  it('a planner that throws never fails the video', async () => {
    const shots = await walk.planWalkthrough({ scenes: [scene], pages, claude: async () => { throw new Error('down') } })
    expect(shots).toHaveLength(1)
  })
})

describe('timing', () => {
  it('the render service and the composition agree on scene lengths', () => {
    const vos = [5.7, 13.9, 20.5, 6.5]
    const tl = walkTimeline(vos.map((voSec) => ({ kind: 'page' as const, voSec })))
    const sec = walk.walkTimelineSec(vos)
    sec.forEach((s: { startSec: number; endSec: number }, i: number) => {
      expect(Math.round(s.startSec * 30)).toBe(tl.starts[i])
      expect(Math.round((s.endSec - s.startSec) * 30)).toBe(tl.lens[i])
    })
  })
})

describe('what the app sends', () => {
  const base = {
    videoId: 'v', userId: 'u', sourcePdfPath: 'u/doc-uploads/a.pdf',
    scenes: [{ title: 'A', narration: ' Hello ' }, { title: 'B', narration: '' }],
    coverNarration: 'Hi', closingNarration: 'Bye', title: 'Your quote', recipient: 'Sam', from: 'Ann',
    regulated: true, sourceDownload: false, contact: ['555', null, ''], hideTerms: ['QoL', 'ab'],
  }
  it('drops empty scenes, short hide words and empty contacts; only promises the PDF when the share page offers it', () => {
    const b = walkthroughBody(base)
    expect(b.scenes).toEqual([{ title: 'A', narration: 'Hello' }])
    expect(b.hideTerms).toEqual(['QoL'])
    expect(b.closing.contact).toEqual(['555'])
    expect(b.closing.line).toBeUndefined()
    expect(walkthroughBody({ ...base, sourceDownload: true }).closing.line).toMatch(/below this video/)
    expect(b.cover.prepared).toBe('Sam')
  })
  it('wears the brand, not a fixed gold (owner, 2026-11-11)', () => {
    const green = walkthroughTheme(brandLook({ primary_color: '#14532d', secondary_color: '#84cc16' }))
    expect(green.bg).not.toBe('#121110')
    expect(green.accentBig.toLowerCase()).not.toBe('#ddb166')
    const light = walkthroughTheme({ ...KIT_LOOKS['animated-slides'], id: 'custom', colors: { bg: '#f6efe4', glow: '#ead9c2', accent: '#e4572e', text: '#2b2118' } })
    expect(light.bg).toBe('#f6efe4')
  })
})

describe('the app wiring', () => {
  const route = readFileSync('app/api/generate-video/route.ts', 'utf8')
  it('Walk-through without an uploaded PDF is refused before any credits are taken', () => {
    const refuse = route.indexOf('isWalk && !isOwnedStoragePath(walkPdfPath, user.id)')
    expect(refuse).toBeGreaterThan(0)
    expect(refuse).toBeLessThan(route.indexOf('deductCredits('))
  })
  it('goes to /generate-walkthrough before the explainer engine can take it', () => {
    const branch = route.indexOf('if (isWalk) {')
    expect(branch).toBeGreaterThan(0)
    expect(branch).toBeLessThan(route.indexOf('await explainerEngineFor(user.id)'))
    expect(route).toContain('/generate-walkthrough')
    expect(route).toContain("resolveKitLook({ kitLook: 'custom', kitLookCustom: draft.kitLookCustom, brand })")
  })
  it('is a look card with sample pictures, shown with the scene kit on and off', () => {
    expect(WALKTHROUGH_STYLE).toBe(WALKTHROUGH_LOOK_ID)
    expect(VIDEO_LOOKS.some((l) => l.id === 'walkthrough')).toBe(true)
    expect(lookCards('video', { kit: true }).some((c) => c.id === 'walkthrough')).toBe(true)
    expect(lookCards('video').some((c) => c.id === 'walkthrough')).toBe(true)
  })
  it('the render service image ships the new files', () => {
    expect(readFileSync('render-service/Dockerfile', 'utf8')).toContain('COPY walkthrough.js ./')
    const ctx = readFileSync('render-service/build-context.sh', 'utf8')
    expect(ctx).toMatch(/page-still\.js walkthrough\.js/)
    expect(ctx).toContain('need_file remotion/src/walkthrough/WalkthroughVideo.tsx')
    expect(readFileSync('remotion/src/Root.tsx', 'utf8')).toContain('id="WalkthroughVideo"')
  })
})
