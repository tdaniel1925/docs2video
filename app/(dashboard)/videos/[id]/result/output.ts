// =============================================================================
// WHAT KIND OF THING THIS RESULT PAGE IS SHOWING.
//
// The result page used to work this out in a dozen places, each a little
// differently ("is it a deck?" was asked five ways in one file). The download
// menu, the "Ask for a change" bar and the send panel all need the same
// answer, so it is worked out once, here, from the saved row alone.
// Pure: no database, no browser — the guard tests call it directly.
// =============================================================================

/** The fields of a videos row this file reads. Everything is optional because
 *  older rows are missing most of them. */
export interface OutputRow {
  output_type?: string | null
  video_url?: string | null
  slide_urls?: string[] | null
  slide_plan_url?: string | null
  export_video_url?: string | null
  script?: unknown
  draft_data?: unknown
}

export type OutputKind =
  /** Interactive presentation (narrated, clickable, made of HTML). */
  | 'presentation'
  /** Slide deck made by the deck builder (HTML slides, no narration needed). */
  | 'deck'
  /** Old PowerPoint / PDF exports. They are slide pictures plus a video. */
  | 'slides-file'
  /** A video in the Slide Deck look — the render service keeps a plan for it,
   *  so one scene can be fixed without remaking the rest (Fix-a-Scene). */
  | 'slide-deck-video'
  /** Every other video look (Cinematic, Editorial, Explainer, Aurora, …). */
  | 'video'

export function outputKind(row: OutputRow): OutputKind {
  const ot = String(row.output_type ?? '')
  if (ot === 'interactive') return 'presentation'
  if (ot === 'deck') return 'deck'
  if (ot === 'pptx' || ot === 'pdf') return 'slides-file'
  if (row.slide_plan_url) return 'slide-deck-video'
  return 'video'
}

/** Presentations and decks are HTML pages, not video files. */
export function isHtmlDeck(row: OutputRow): boolean {
  const k = outputKind(row)
  return k === 'presentation' || k === 'deck'
}

/** The word the page uses for it: "video" or "presentation". */
export function thingWord(row: OutputRow): 'video' | 'presentation' {
  return isHtmlDeck(row) ? 'presentation' : 'video'
}

/** Slide pictures saved with the row (some looks don't save any). */
export function slidePictures(row: OutputRow): string[] {
  return Array.isArray(row.slide_urls) ? row.slide_urls.filter((u) => typeof u === 'string' && u.length > 0) : []
}

/** The scenes in the saved script, or [] for rows without one. */
export function scriptScenes(row: OutputRow): { title?: string; narration?: string }[] {
  return Array.isArray(row.script) ? (row.script as { title?: string; narration?: string }[]) : []
}

/** True when at least one scene has words the voice says (or a slide shows). */
export function hasScriptWords(row: OutputRow): boolean {
  return scriptScenes(row).some((s) => typeof s?.narration === 'string' && s.narration.trim().length > 0)
}
