import type { Page, Request, Route } from '@playwright/test'

/*
 * A pretend draft for the story and "make it yours" screens. The draft API is
 * mocked around it, so these tests never touch a real project. The id is a
 * valid-looking UUID that belongs to no row.
 */
export const FAKE_ID = '00000000-e2e0-4000-8000-000000000001'

export const BRIEF = {
  docType: 'Life insurance summary',
  summary: 'A 20-year term plan that protects the family.',
  angle: 'Your family keeps its home if the worst happens.',
  keyPoints: ['$500,000 of cover', '20-year term', 'Fixed monthly premium'],
  figures: [{ label: 'monthly premium', value: '$84.50' }, { label: 'cover', value: '$500,000' }],
  avoid: ['jargon'],
}

export function scenes() {
  return [
    { _role: 'cover', _auto: true, _autoNarration: 'Hello Jordan, thank you for your time today.', title: 'Your Family Plan', narration: 'Hello Jordan, thank you for your time today.', slideData: { headline: 'Your Family Plan' } },
    { scene: 2, title: 'What it costs', narration: 'Your plan costs eighty four dollars and fifty cents a month, and that price never goes up.', slideData: { headline: 'What it costs', stats: [{ value: '$84.50', label: 'a month' }], bullets: ['Fixed price', 'No surprises'] } },
    { scene: 3, title: 'What it pays', narration: 'If the worst happens, your family receives five hundred thousand dollars.', slideData: { headline: 'What it pays', bullets: ['Tax free'] } },
    { scene: 4, title: 'How long it lasts', narration: 'The cover lasts twenty years, until the children are grown.', slideData: { headline: 'How long it lasts' } },
    { _role: 'closing', _auto: true, _autoNarration: 'Thank you for watching. We appreciate your time.', title: 'Thank You', narration: 'Thank you for watching. We appreciate your time.', slideData: { headline: 'Thank You', cta: 'Reach out to take the next step.' } },
  ]
}

export function draftRow(draftData: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    id: FAKE_ID,
    title: 'E2E family plan',
    status: 'draft',
    output_type: (draftData.outputType as string) || 'video',
    draft_data: draftData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...extra,
  }
}

export function storyDraft(over: Record<string, unknown> = {}) {
  return {
    outputType: 'video',
    purpose: 'Explain the family plan',
    recipientName: 'Jordan',
    extractedData: { title: 'Family Protection Plan', industry: 'insurance' },
    brief: BRIEF,
    scenes: scenes(),
    detailLevel: 'standard',
    step: 5,
    ...over,
  }
}

export type DraftMock = {
  /** Every PATCH body sent to /api/videos/draft, oldest first. */
  patches: any[]
  /** Replace what the next GETs return. */
  set: (row: Record<string, unknown>) => void
  /** Status for PATCH answers (default 200). */
  patchStatus: number
}

/** Mock GET/PATCH /api/videos/draft for FAKE_ID. */
export async function mockDraft(page: Page, row: Record<string, unknown>): Promise<DraftMock> {
  let current = row
  const mock: DraftMock = { patches: [], set: (r) => { current = r }, patchStatus: 200 }
  await page.route('**/api/videos/draft**', async (route: Route, req: Request) => {
    if (req.method() === 'GET') {
      return route.fulfill({ json: current })
    }
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}')
      mock.patches.push(body)
      if (mock.patchStatus !== 200) return route.fulfill({ status: mock.patchStatus, json: { error: 'Draft save failed' } })
      // Keep the pretend draft in step with what was saved.
      const dd = { ...(current.draft_data as Record<string, unknown>), ...(body.updates || {}) }
      current = { ...current, draft_data: dd }
      return route.fulfill({ json: { success: true } })
    }
    // The "save as the tab closes" beacon for the pretend draft.
    if (req.method() === 'POST' && req.url().includes('/beacon')) return route.fulfill({ json: { success: true } })
    return route.fallback()
  })
  return mock
}

/** A price quote the way /api/price-quote answers. */
export function quote(over: Record<string, unknown> = {}) {
  return {
    current: 'video',
    detailLevel: 'standard',
    fileCount: 1,
    options: {
      video: { output: 'video', total: 240, free: false, lines: [{ label: 'Narrated video, standard length', credits: 200 }, { label: 'Extra document', credits: 40 }] },
      interactive: { output: 'interactive', total: 150, free: false, lines: [{ label: 'Interactive presentation', credits: 150 }] },
      deck: { output: 'deck', total: 90, free: false, lines: [{ label: 'Slide deck', credits: 90 }] },
    },
    offered: ['video', 'interactive', 'deck'],
    balance: 1000,
    blockedReason: null,
    startable: true,
    status: 'draft',
    ...over,
  }
}
