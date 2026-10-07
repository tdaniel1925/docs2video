import { calculateVideoCost, CREDIT_COSTS, MULTI_FILE_SURCHARGE } from './credits'
import { normalizeDetailLevel, type DetailLevel } from './wizard-draft'

// =============================================================================
// THE PRICE OF ONE PROJECT — ONE PLACE.
//
// generate-video and generate-presentation charge with the functions below,
// and /api/price-quote shows the price with the SAME functions, reading the
// SAME saved draft. So the number on the "Make it" button is the number that
// is charged. The browser never works a price out for itself (a hardcoded or
// client-side price drifts — see the audit: "price computed from what the
// browser sends").
// =============================================================================

/** Everything a project can be made as. One per project (one row = one output). */
export type MakeOutput = 'video' | 'pptx' | 'pdf' | 'interactive' | 'deck'

export function normalizeOutput(v: unknown): MakeOutput | null {
  return v === 'video' || v === 'pptx' || v === 'pdf' || v === 'interactive' || v === 'deck' ? v : null
}

/** The row fields the price depends on. */
export interface PricedRow {
  output_type?: string | null
  detail_level?: string | null
  draft_data?: unknown
}

export interface VideoPriceInputs {
  detailLevel: DetailLevel
  /** What the row says it is (video / pptx / pdf / interactive / deck). */
  draftOutputType: string
  /** How generate-video prices it: pptx and pdf have their own price, everything else is a video. */
  priceOutputType: 'video' | 'pptx' | 'pdf'
  fileCount: number
}

/**
 * The price inputs generate-video uses — read from the SAVED draft and row,
 * never from the request body. `internal` is only for trusted server-to-server
 * API calls, which have no wizard draft and may say the length themselves.
 */
export function videoPriceInputs(
  row: PricedRow,
  internal?: { detailLevel?: unknown; detailed?: boolean },
): VideoPriceInputs {
  const draft = ((row.draft_data as Record<string, unknown> | null) || {}) as Record<string, unknown>
  const detailLevel: DetailLevel =
    normalizeDetailLevel(draft.detailLevel) ??
    normalizeDetailLevel(row.detail_level) ??
    (internal ? normalizeDetailLevel(internal.detailLevel) ?? (internal.detailed ? 'detailed' : null) : null) ??
    'standard'
  const draftOutputType = String(row.output_type || draft.outputType || 'video')
  const priceOutputType: 'video' | 'pptx' | 'pdf' =
    draftOutputType === 'pptx' || draftOutputType === 'pdf' ? draftOutputType : 'video'
  // Multi-upload surcharge: +150 per extra uploaded file.
  const docs = draft.extractedDocs
  const fileCount = Array.isArray(docs) && docs.length > 1 ? docs.length : 1
  return { detailLevel, draftOutputType, priceOutputType, fileCount }
}

/** Credits generate-video charges for these inputs (grandfathered users pay old rates). */
export function videoCreditCost(inputs: VideoPriceInputs, userId: string | null | undefined): number {
  return calculateVideoCost({
    outputType: inputs.priceOutputType,
    detailLevel: inputs.detailLevel,
    narrationStyle: 'solo', // two-voice mode was retired; every video is solo
    userId: userId || undefined,
    fileCount: inputs.fileCount,
  })
}

/** Credits generate-presentation charges. */
export function presentationCreditCost(outputType: 'interactive' | 'deck'): number {
  return CREDIT_COSTS[outputType === 'deck' ? 'deck' : 'interactive']
}

/** Video renders are free for admins and beta accounts (same rule generate-video uses). */
export function videoIsFree(opts: { emailIsAdmin: boolean; isAdmin?: boolean | null; isBeta?: boolean | null }): boolean {
  return opts.emailIsAdmin || opts.isAdmin === true || opts.isBeta === true
}
/** Presentation builds are free only for flagged admin / beta accounts (deductCredits' bypass). */
export function presentationIsFree(opts: { isAdmin?: boolean | null; isBeta?: boolean | null }): boolean {
  return opts.isAdmin === true || opts.isBeta === true
}

// ── The quote the Make screen shows ─────────────────────────────────────────

export interface QuoteLine { label: string; credits: number }
export interface OutputQuote {
  output: MakeOutput
  /** Credits this output would cost. Always the sum of `lines`. */
  total: number
  lines: QuoteLine[]
  /** Admin / beta: nothing is charged. */
  free: boolean
}

// The names the length choice uses on steps 2 and 3 (Short / Standard / Detailed).
const LENGTH_NAMES: Record<DetailLevel, string> = { quick: 'short', standard: 'standard length', detailed: 'detailed' }
const OUTPUT_NAMES: Record<MakeOutput, string> = {
  video: 'Narrated video',
  interactive: 'Interactive presentation',
  deck: 'Slide deck',
  pptx: 'PowerPoint file',
  pdf: 'PDF file',
}

/**
 * What `output` would cost for this row if the user made it now — computed
 * with the exact functions the make routes charge with. The row's own output
 * type is swapped for `output`, which is what the Make screen saves to the
 * draft before it starts the job.
 */
export function quoteOutput(
  row: PricedRow,
  output: MakeOutput,
  userId: string | null | undefined,
  free: { video: boolean; presentation: boolean },
): OutputQuote {
  if (output === 'interactive' || output === 'deck') {
    const isFree = free.presentation
    const total = isFree ? 0 : presentationCreditCost(output)
    return { output, total, lines: [{ label: OUTPUT_NAMES[output], credits: total }], free: isFree }
  }
  const draft = ((row.draft_data as Record<string, unknown> | null) || {}) as Record<string, unknown>
  const inputs = videoPriceInputs({ ...row, output_type: output, draft_data: { ...draft, outputType: output } })
  if (free.video) {
    return { output, total: 0, lines: [{ label: OUTPUT_NAMES[output], credits: 0 }], free: true }
  }
  const total = videoCreditCost(inputs, userId)
  // Split the same total into lines. Only a video carries the extra-file charge.
  const surcharge = output === 'video' ? Math.max(0, inputs.fileCount - 1) * MULTI_FILE_SURCHARGE : 0
  const main = output === 'video' ? `${OUTPUT_NAMES.video} · ${LENGTH_NAMES[inputs.detailLevel]}` : OUTPUT_NAMES[output]
  const lines: QuoteLine[] = [{ label: main, credits: total - surcharge }]
  if (surcharge > 0) {
    const extra = inputs.fileCount - 1
    lines.push({ label: `${extra} more document${extra === 1 ? '' : 's'}`, credits: surcharge })
  }
  return { output, total, lines, free: false }
}

/** What the Make screen offers: the three products, plus the file type the
 *  project already is when it came from the PowerPoint/PDF builder. */
export function outputsOffered(current: string): MakeOutput[] {
  const base: MakeOutput[] = ['video', 'interactive', 'deck']
  const cur = normalizeOutput(current)
  return cur && !base.includes(cur) ? [...base, cur] : base
}

/** What GET /api/price-quote returns. */
export interface PriceQuoteResponse {
  /** What the project is saved as right now. */
  current: string
  detailLevel: 'quick' | 'standard' | 'detailed'
  fileCount: number
  /** One quote per output the Make screen offers — each the exact charge. */
  options: Partial<Record<MakeOutput, OutputQuote>>
  offered: MakeOutput[]
  /** The user's real credit balance (monthly + top-up). */
  balance: number
  /** Why this account can't spend right now (e.g. 'card_required'), or null. */
  blockedReason: string | null
  /** False once the job has started or finished — nothing more to make here. */
  startable: boolean
  status: string
}

/** Row statuses a job can still be started from (generate-video's claim list). */
export const STARTABLE_STATUSES = ['draft', 'failed', 'pending'] as const
