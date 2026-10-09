// =============================================================================
// "DUPLICATE" — a new draft copied from one of the user's projects.
//
// The result page's Duplicate button opened /create?duplicate=<id>, and
// nothing read it: the user got a blank step 1. The copy is now made on the
// server (owner only) from the source project's saved draft.
//
// WHAT COMES ALONG is a short allow-list — who it's for, the goal, the
// sources, the story, the look, the voice, the output and the brand. Anything
// not on the list stays behind: the finished video, the share-page settings
// (note to the client, "download the original PDF"), quotes, sends and
// analytics (those live in other columns and tables and are never read here).
//
// Pure on purpose (no database, no network) so each rule has a test.
// =============================================================================

type AnyRecord = Record<string, unknown>

export type CopyOutput = 'video' | 'pptx' | 'pdf' | 'interactive' | 'deck'
export type CopyLength = 'quick' | 'standard' | 'detailed'

/** Draft fields a copy carries over. Everything else is left behind. */
export const COPIED_FIELDS = [
  // who it's for and what it should do
  'recipientName', 'purpose',
  // the sources
  'contentMethod', 'extractedData', 'extractedDocs', 'combineInstruction', 'classification',
  // the story
  'title', 'brief', 'briefSkipped', 'scenes', 'detailLevel', 'narrationStyle',
  // the look
  'videoStyle', 'drawStyle', 'presentationTemplate', 'slidePhotos', 'styleId', 'customStylePrompt', 'styleReferenceUrl',
  // the voice and music
  'voiceId', 'aiMusic', 'musicPrompt',
  // the brand and how the person is introduced
  'inlineBrand', 'contactPhone', 'contactEmail', 'contactWebsite',
  'presenterIntro', 'introduceInOpening', 'showContactClosing', 'photoPlacement',
] as const

/** Share-page settings and job leftovers — never copied, named so a test can
 *  prove none of them sneak onto the list above. */
export const NEVER_COPIED = [
  'allowSourceDownload', 'agentNote',
  'briefChat', 'scriptStatus', 'scriptError', 'scriptStartedAt', 'resolvedAccent',
] as const

function asRecord(v: unknown): AnyRecord {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRecord) : {}
}

export function normalizeCopyOutput(v: unknown): CopyOutput | null {
  return v === 'video' || v === 'pptx' || v === 'pdf' || v === 'interactive' || v === 'deck' ? v : null
}

function normalizeLength(v: unknown): CopyLength | null {
  return v === 'quick' || v === 'standard' || v === 'detailed' ? v : null
}

/** A project made outside the create flow (a commercial, an API job) has no
 *  source or story to copy — say so instead of opening an empty draft. */
export function hasContentToCopy(draft: unknown): boolean {
  const d = asRecord(draft)
  const data = asRecord(d.extractedData)
  return Object.keys(data).length > 0 ||
    (Array.isArray(d.scenes) && d.scenes.length > 0) ||
    (Array.isArray(d.extractedDocs) && d.extractedDocs.length > 0)
}

/**
 * Remove the "this came from that uploaded PDF" marks inside the copied
 * content. The nightly draft clean-up deletes the PDF a dead draft points at;
 * if the copy still pointed at the ORIGINAL's file, an abandoned copy would
 * delete it and break the original's share page.
 */
function withoutPdfMarks(data: unknown): AnyRecord | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const rest: AnyRecord = { ...(data as AnyRecord) }
  delete rest._sourcePdfPath
  delete rest._sourcePdfName
  return rest
}

export interface CopyInput {
  /** The source project's draft_data. */
  draft: unknown
  /** The source row's output_type (wins over the draft's own). */
  outputType: unknown
  /** The source row's detail_level (used when the draft has none). */
  rowDetailLevel?: unknown
  /** The brand to use, already checked to be the user's own. null = "no
   *  brand" on purpose; undefined = none chosen (step 3 offers the default). */
  brandId: string | null | undefined
  /** The client, already checked to be the user's own. */
  clientId: string | undefined
  /** The copy's OWN copy of the source PDF (never the original's file). */
  pdf: { path: string; name: string | null } | null
}

export interface CopyResult {
  draftData: AnyRecord
  outputType: CopyOutput
  detailLevel: CopyLength | null
}

export function copyDraft(input: CopyInput): CopyResult {
  const src = asRecord(input.draft)
  const out: AnyRecord = {}
  for (const k of COPIED_FIELDS) {
    if (k in src && src[k] !== undefined) out[k] = src[k]
  }

  const outputType = normalizeCopyOutput(input.outputType) ?? normalizeCopyOutput(src.outputType) ?? 'video'
  out.outputType = outputType

  const detailLevel = normalizeLength(src.detailLevel) ?? normalizeLength(input.rowDetailLevel)
  if (detailLevel) out.detailLevel = detailLevel
  else delete out.detailLevel

  // Sources: the same content, minus the marks that point at the original's file.
  if ('extractedData' in out) {
    const clean = withoutPdfMarks(out.extractedData)
    if (clean) out.extractedData = clean
    else delete out.extractedData
  }
  if (Array.isArray(out.extractedDocs)) {
    out.extractedDocs = (out.extractedDocs as unknown[]).map((doc) => {
      const d = asRecord(doc)
      return { ...d, data: withoutPdfMarks(d.data) ?? {} }
    })
  }

  // Brand and client: only what the caller checked is still the user's own.
  if (input.brandId !== undefined) out.brandId = input.brandId
  if (input.clientId) out.clientId = input.clientId

  // The copy's own source PDF, so "download the original" can still be
  // offered — but switched off, like any new project.
  if (input.pdf) {
    out.sourcePdfPath = input.pdf.path
    if (input.pdf.name) out.sourcePdfName = input.pdf.name.slice(0, 200)
  }

  // Where the copy picks up: with a story, it's written — show it (and Home's
  // "continue" lands on the story too); without one, step 2 writes it.
  const hasStory = Array.isArray(out.scenes) && out.scenes.length > 0
  if (hasStory) {
    out.scriptStatus = 'ready'
    out.step = outputType === 'video' || outputType === 'interactive' ? 5 : 4
  } else {
    delete out.scenes
    out.step = 2
  }

  return { draftData: out, outputType, detailLevel }
}

/** The screen a new copy opens on: the story step, with a note saying it's a copy. */
export function copyLandingUrl(newId: string): string {
  return `/create/script?id=${encodeURIComponent(newId)}&copied=1`
}
