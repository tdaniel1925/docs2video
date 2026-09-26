import { describe, it, expect } from 'vitest'
import {
  usableBrief, sourceChanged, mergeDraft, mergeExtractedDocs,
  isEditedBookend, isOwnedStoragePath, buildShareColumns, normalizeDetailLevel,
} from '../app/_lib/wizard-draft'

describe('usableBrief — Skip really skips', () => {
  const brief = { angle: 'x', keyPoints: ['a'] }
  it('uses an approved or untouched brief', () => {
    expect(usableBrief({ brief })).toEqual(brief)
  })
  it('ignores a brief the user skipped', () => {
    expect(usableBrief({ brief, briefSkipped: true })).toBeNull()
    expect(usableBrief({ brief: { ...brief, skipped: true } })).toBeNull()
  })
  it('is null when there is no brief', () => {
    expect(usableBrief({})).toBeNull()
    expect(usableBrief(null)).toBeNull()
  })
})

describe('mergeDraft — a new source clears the stale brief and script', () => {
  const existing = {
    extractedData: { title: 'Old doc', bulletPoints: ['a'] },
    purpose: 'Explain it',
    brief: { angle: 'old' }, briefSkipped: true, scenes: [{ narration: 'old' }], scriptStatus: 'ready',
    voiceId: 'onyx',
  }

  it('keeps everything when the same source is saved again (key order ignored)', () => {
    const same = { extractedData: { bulletPoints: ['a'], title: 'Old doc' }, purpose: 'Explain it' }
    expect(sourceChanged(existing, same)).toBe(false)
    const m = mergeDraft(existing, same)
    expect(m.brief).toEqual({ angle: 'old' })
    expect(m.scenes).toHaveLength(1)
  })

  it('drops brief, skip flag and scenes when the document changes', () => {
    const m = mergeDraft(existing, { extractedData: { title: 'New doc' } })
    expect(m.brief).toBeUndefined()
    expect(m.briefSkipped).toBeUndefined()
    expect(m.scenes).toBeUndefined()
    expect(m.scriptStatus).toBeUndefined()
    expect(m.voiceId).toBe('onyx') // unrelated choices survive
  })

  it('drops them when the purpose changes', () => {
    expect(mergeDraft(existing, { purpose: 'Sell it' }).scenes).toBeUndefined()
  })

  it('treats "no list" and "empty list" as the same source', () => {
    expect(sourceChanged({ extractedDocs: undefined }, { extractedDocs: [] })).toBe(false)
  })

  it('keeps edits that are not about the source', () => {
    const m = mergeDraft(existing, { scenes: [{ narration: 'edited' }] })
    expect(m.scenes).toEqual([{ narration: 'edited' }])
    expect(m.brief).toEqual({ angle: 'old' })
  })
})

describe('mergeExtractedDocs — every file is used', () => {
  const docs = [
    { fileName: 'a.pdf', data: { title: 'Plan A', bulletPoints: ['cheap'], keyMetrics: [{ label: 'Premium', value: '$100' }], sections: [{ title: 'Intro', content: 'A text' }] } },
    { fileName: 'b.pdf', data: { title: 'Plan B', bulletPoints: ['fast'], keyMetrics: [{ label: 'Premium', value: '$150' }], sections: [{ title: 'Intro', content: 'B text' }] } },
  ]
  it('includes the second file’s content, labelled by file', () => {
    const m = mergeExtractedDocs(docs)!
    expect(m.bulletPoints).toEqual(['a.pdf: cheap', 'b.pdf: fast'])
    expect((m.keyMetrics as any[]).map((k) => k.label)).toEqual(['Premium (a.pdf)', 'Premium (b.pdf)'])
    expect((m.sections as any[])[1].content).toBe('B text')
    expect(m.combinedFromDocs).toBe(2)
  })
  it('returns a single file unchanged', () => {
    expect(mergeExtractedDocs([docs[0]])).toBe(docs[0].data)
  })
  it('is null for nothing', () => {
    expect(mergeExtractedDocs([])).toBeNull()
  })
})

describe('isEditedBookend — default cover/closing never override personal touches', () => {
  it('an untouched default is not an edit', () => {
    expect(isEditedBookend({ _role: 'cover', _auto: true, _autoNarration: 'Hi. Title.', narration: 'Hi. Title.' })).toBe(false)
  })
  it('a changed default is an edit', () => {
    expect(isEditedBookend({ _role: 'cover', _auto: true, _autoNarration: 'Hi. Title.', narration: 'My own words.' })).toBe(true)
  })
  it('recognizes old drafts’ default wording', () => {
    expect(isEditedBookend({ _role: 'cover', narration: 'Hello Sam, thank you for your time today. My Plan.' })).toBe(false)
    expect(isEditedBookend({ _role: 'closing', narration: 'Thank you for watching. To learn more, reach out: 555 | a@b.com. Acme looks forward to serving you.' })).toBe(false)
    expect(isEditedBookend({ _role: 'closing', narration: 'Thank you for watching. We appreciate your time.' })).toBe(false)
  })
  it('old drafts with real edits still count', () => {
    expect(isEditedBookend({ _role: 'closing', narration: 'Call me on Monday and we will set it up.' })).toBe(true)
  })
  it('empty or missing is not an edit', () => {
    expect(isEditedBookend(null)).toBe(false)
    expect(isEditedBookend({ _role: 'cover', narration: '  ' })).toBe(false)
  })
})

describe('source PDF path ownership', () => {
  it('accepts only the owner’s folder', () => {
    expect(isOwnedStoragePath('u1/doc-uploads/x.pdf', 'u1')).toBe(true)
    expect(isOwnedStoragePath('u2/doc-uploads/x.pdf', 'u1')).toBe(false)
    expect(isOwnedStoragePath('u1/../u2/x.pdf', 'u1')).toBe(false)
    expect(isOwnedStoragePath(undefined, 'u1')).toBe(false)
    expect(isOwnedStoragePath('u1/x.pdf', '')).toBe(false)
  })
  it('share columns drop a foreign path and the download switch with it', () => {
    const cols = buildShareColumns({ userId: 'u1', draft: { sourcePdfPath: 'u2/x.pdf', sourcePdfName: 'x.pdf', allowSourceDownload: true, agentNote: ' hi ' } })
    expect(cols.source_pdf_path).toBeNull()
    expect(cols.allow_source_download).toBe(false)
    expect(cols.agent_note).toBe('hi')
  })
  it('share columns keep the owner’s own PDF', () => {
    const cols = buildShareColumns({ userId: 'u1', draft: { sourcePdfPath: 'u1/x.pdf', sourcePdfName: 'x.pdf', allowSourceDownload: true, recipientName: 'Sam' } })
    expect(cols).toMatchObject({ source_pdf_path: 'u1/x.pdf', allow_source_download: true, recipient_name: 'Sam' })
  })
})

describe('normalizeDetailLevel', () => {
  it('accepts only the three lengths', () => {
    expect(normalizeDetailLevel('quick')).toBe('quick')
    expect(normalizeDetailLevel('huge')).toBeNull()
    expect(normalizeDetailLevel(undefined)).toBeNull()
  })
})
