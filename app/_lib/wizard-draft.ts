// =============================================================================
// Small, pure rules about the create-wizard draft (videos.draft_data), shared by
// the draft API, the script/brief pages and generate-video. Pure on purpose:
// no database, no network — so each rule has a test that can actually fail.
// =============================================================================

type AnyRecord = Record<string, unknown>

// ---------------------------------------------------------------------------
// THE BRIEF — use it only when the user did not skip it.
//
// "Skip" on the Review step used to do nothing: the brief built on page load
// stayed on the draft and still steered the script, so skipping didn't skip.
// The page now writes `briefSkipped: true`; every reader goes through here.
// ---------------------------------------------------------------------------
export function usableBrief<T = AnyRecord>(draft: AnyRecord | null | undefined): T | null {
  if (!draft) return null
  const brief = draft.brief as AnyRecord | undefined
  if (!brief || typeof brief !== 'object') return null
  if (draft.briefSkipped === true || brief.skipped === true) return null
  return brief as T
}

// ---------------------------------------------------------------------------
// SOURCE CHANGES MAKE THE BRIEF AND SCRIPT STALE.
//
// Going Back and swapping the document used to keep the old brief and the old
// script — the new video quietly described the old file. When any of these
// fields really changes, the brief, its chat and the scenes are cleared so the
// next steps rebuild them from the new source.
// ---------------------------------------------------------------------------
export const SOURCE_FIELDS = ['extractedData', 'extractedDocs', 'contentMethod', 'purpose', 'combineInstruction'] as const
export const DERIVED_FROM_SOURCE = ['brief', 'briefChat', 'briefSkipped', 'scenes', 'script', 'scriptStatus', 'scriptError', 'scriptStartedAt'] as const

function stable(v: unknown): string {
  // Key-order-independent JSON, so re-saving the same object never looks like a change.
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm)
    if (x && typeof x === 'object') {
      const o = x as AnyRecord
      return Object.keys(o).sort().reduce<AnyRecord>((acc, k) => { if (o[k] !== undefined) acc[k] = norm(o[k]); return acc }, {})
    }
    return x
  }
  return JSON.stringify(norm(v) ?? null)
}

/** True when `updates` changes the source the brief/script were built from. */
export function sourceChanged(existing: AnyRecord, updates: AnyRecord): boolean {
  return SOURCE_FIELDS.some((k) => {
    if (!(k in updates)) return false
    const before = existing[k]
    const after = updates[k]
    // An empty list and "no list" are the same source.
    const empty = (v: unknown) => v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === ''
    if (empty(before) && empty(after)) return false
    return stable(before) !== stable(after)
  })
}

/** Merge `updates` into the draft; if the source changed, drop everything that
 *  was derived from the old source. (A `null` in updates is kept as null — it
 *  is how "no brand" / "no source PDF" is said on purpose.) */
export function mergeDraft(existing: AnyRecord, updates: AnyRecord): AnyRecord {
  const stale = sourceChanged(existing, updates)
  const merged: AnyRecord = { ...existing, ...updates }
  if (stale) for (const k of DERIVED_FROM_SOURCE) { if (!(k in updates)) delete merged[k] }
  return merged
}

// ---------------------------------------------------------------------------
// MULTI-FILE PROJECTS — use every file, not just the first.
//
// Several uploads were each extracted, stored as `extractedDocs`, charged +150
// per extra file — and then only `extractedData` (a copy of file #1) ever
// reached the script writer and the renderer. This folds every file into one
// extractedData so all downstream steps see all of them, each piece labelled
// with the file it came from.
// ---------------------------------------------------------------------------
export function mergeExtractedDocs(docs: { fileName?: string; data: AnyRecord }[] | null | undefined): AnyRecord | null {
  if (!Array.isArray(docs) || docs.length === 0) return null
  if (docs.length === 1) return docs[0]?.data || null
  const first = (docs[0]?.data || {}) as AnyRecord
  const label = (d: { fileName?: string; data: AnyRecord }, i: number) => {
    const t = typeof d.data?.title === 'string' && d.data.title.trim() ? d.data.title.trim() : ''
    return d.fileName || t || `Document ${i + 1}`
  }
  const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])

  const sections: { title: string; content: string }[] = []
  const bulletPoints: string[] = []
  const keyMetrics: AnyRecord[] = []
  const additionalNotes: string[] = []
  const disclaimers: string[] = []
  docs.forEach((d, i) => {
    const data = (d.data || {}) as AnyRecord
    const tag = label(d, i)
    for (const s of arr(data.sections) as AnyRecord[]) {
      if (!s) continue
      sections.push({ title: `${tag}: ${String(s.title ?? '')}`.trim(), content: String(s.content ?? '') })
    }
    for (const b of arr(data.bulletPoints)) if (typeof b === 'string' && b.trim()) bulletPoints.push(`${tag}: ${b}`)
    for (const m of arr(data.keyMetrics) as AnyRecord[]) {
      if (m && m.label != null && m.value != null) keyMetrics.push({ ...m, label: `${String(m.label)} (${tag})` })
    }
    for (const n of arr(data.additionalNotes)) if (typeof n === 'string' && n.trim()) additionalNotes.push(`${tag}: ${n}`)
    for (const n of arr(data.disclaimers)) if (typeof n === 'string' && n.trim() && !disclaimers.includes(n)) disclaimers.push(n)
  })

  return {
    ...first,
    title: typeof first.title === 'string' && first.title ? first.title : 'Combined documents',
    sections,
    bulletPoints,
    keyMetrics,
    additionalNotes,
    ...(disclaimers.length ? { disclaimers } : {}),
    // Which files went in, so the brief/script can say "across your 3 documents".
    sourceDocuments: docs.map((d, i) => ({ fileName: label(d, i), title: (d.data as AnyRecord)?.title ?? null })),
    combinedFromDocs: docs.length,
  }
}

// ---------------------------------------------------------------------------
// COVER / CLOSING — only a REAL edit overrides the personal touches.
//
// The script page adds an editable cover and closing to every script. Their
// default wording was then treated as the user's own words, so it silently
// replaced the presenter's intro, the "Hi {client}" greeting and the
// show-contact-on-closing choice. The page now marks those defaults `_auto`
// and remembers the text it wrote; a bookend counts as edited only when the
// narration no longer matches that default.
// ---------------------------------------------------------------------------
const LEGACY_AUTO_COVER = /^(hello [^,]{1,80}, )?thank you for your time today\./i
const LEGACY_AUTO_CLOSING = /^thank you for watching\.( to learn more, reach out: .*?\.)? (.{1,120} looks forward to serving you\.|we appreciate your time\.)$/i

export function isEditedBookend(scene: AnyRecord | null | undefined): boolean {
  if (!scene) return false
  const narration = typeof scene.narration === 'string' ? scene.narration.trim() : ''
  if (!narration) return false
  if (scene._auto === true) {
    const auto = typeof scene._autoNarration === 'string' ? scene._autoNarration.trim() : ''
    return narration !== auto
  }
  // Drafts saved before the flag existed: recognize the old default wording.
  if (scene._role === 'cover' && LEGACY_AUTO_COVER.test(narration)) return false
  if (scene._role === 'closing' && LEGACY_AUTO_CLOSING.test(narration)) return false
  return true
}

/** A source-PDF path is only trusted when it sits in the owner's own folder. */
export function isOwnedStoragePath(path: unknown, userId: string): path is string {
  return typeof path === 'string' && !!userId && path.startsWith(`${userId}/`) && !path.includes('..')
}

/**
 * The share-page columns a finished video/presentation carries (welcome banner,
 * the agent's note, the optional "download the original PDF" button). One
 * builder for both generators so a presentation's share page works like a
 * video's. The draft wins; `body` is only a fallback for API callers without a
 * wizard draft. The PDF path is dropped unless it is in the owner's folder.
 */
export function buildShareColumns(opts: {
  userId: string
  draft: AnyRecord
  recipient?: string | null
  body?: { allowSourceDownload?: unknown; agentNote?: unknown; sourcePdfPath?: unknown; sourcePdfName?: unknown }
}): { recipient_name: string | null; agent_note: string | null; source_pdf_path: string | null; source_pdf_name: string | null; allow_source_download: boolean } {
  const d = opts.draft || {}
  const b = opts.body || {}
  const pick = (k: 'allowSourceDownload' | 'agentNote' | 'sourcePdfPath' | 'sourcePdfName') => (k in d ? d[k] : b[k])
  const rawPath = pick('sourcePdfPath')
  const path = isOwnedStoragePath(rawPath, opts.userId) ? rawPath : null
  const name = path && typeof pick('sourcePdfName') === 'string' ? String(pick('sourcePdfName')).slice(0, 200) : null
  const note = typeof pick('agentNote') === 'string' ? String(pick('agentNote')).trim().slice(0, 400) : ''
  const recipient = (opts.recipient ?? (typeof d.recipientName === 'string' ? d.recipientName : '') ?? '').trim()
  return {
    recipient_name: recipient || null,
    agent_note: note || null,
    source_pdf_path: path,
    source_pdf_name: name,
    allow_source_download: !!(pick('allowSourceDownload') && path),
  }
}

export type DetailLevel = 'quick' | 'standard' | 'detailed'
export function normalizeDetailLevel(v: unknown): DetailLevel | null {
  return v === 'quick' || v === 'standard' || v === 'detailed' ? v : null
}
