// =============================================================================
// THE DOWNLOADS MENU — which files this result can really give you.
//
// The old page showed MP4 / PDF / PPTX / Script on every video, even when the
// look saved no slide pictures — the PDF then came back as ONE page (the
// cover picture) and looked broken. Now a download is only listed when the
// thing behind it exists:
//   * MP4         — the row has a video file
//   * PDF / PowerPoint for a video — the row has slide pictures (that is what
//                   /api/download-pdf and /api/download-pptx are built from)
//   * PDF / PowerPoint for a presentation or deck — its slides are saved
//                   (/api/presentation-export rebuilds them from draft_data)
//   * Script      — at least one scene has words
//   * Export video — interactive presentations only (the export route refuses
//                   anything else), with its price from credits.ts
// Pure: the guard test calls it with made-up rows.
// =============================================================================

import { CREDIT_COSTS } from '../../../../_lib/credits'
import { outputKind, slidePictures, hasScriptWords, type OutputRow } from './output'

export type DownloadKey = 'mp4' | 'pdf' | 'pptx' | 'script' | 'video-file' | 'export-video'

export interface DownloadItem {
  key: DownloadKey
  label: string
  /** Extra words under the label. */
  hint?: string
  /** Credits it costs, when it costs any. */
  credits?: number
}

function presentationSlidesSaved(row: OutputRow): boolean {
  const d = row.draft_data as { scenes?: unknown[] } | null | undefined
  return Array.isArray(d?.scenes) && d!.scenes!.length > 0
}

export function downloadsFor(row: OutputRow): DownloadItem[] {
  const kind = outputKind(row)
  const out: DownloadItem[] = []

  if (kind === 'presentation' || kind === 'deck') {
    if (presentationSlidesSaved(row)) {
      out.push({ key: 'pdf', label: 'PDF', hint: 'Every slide, one per page' })
      out.push({ key: 'pptx', label: 'PowerPoint', hint: 'Slides you can open and change' })
    }
    if (hasScriptWords(row)) out.push({ key: 'script', label: 'Script', hint: 'What the voice says, as text' })
    if (kind === 'presentation') {
      if (row.export_video_url) {
        out.push({ key: 'video-file', label: 'Video (MP4)', hint: 'The video you exported' })
      } else {
        out.push({ key: 'export-video', label: 'Export video', hint: 'Turns it into an MP4 — takes a few minutes', credits: CREDIT_COSTS.videoExport })
      }
    }
    return out
  }

  if (row.video_url) out.push({ key: 'mp4', label: 'MP4', hint: 'The video file' })
  if (slidePictures(row).length > 0) {
    out.push({ key: 'pdf', label: 'PDF', hint: 'One slide picture per page' })
    out.push({ key: 'pptx', label: 'PowerPoint', hint: 'Slide pictures with the words as notes' })
  }
  if (hasScriptWords(row)) out.push({ key: 'script', label: 'Script', hint: 'What the voice says, as text' })
  return out
}

/** The script as plain text, scene by scene (what the old Script button saved). */
export function scriptText(script: unknown): string {
  if (!Array.isArray(script)) return ''
  return (script as { title?: string; narration?: string }[])
    .map((s, i) => `Scene ${i + 1}: ${s?.title || ''}\n${s?.narration || ''}\n`)
    .join('\n---\n\n')
}
