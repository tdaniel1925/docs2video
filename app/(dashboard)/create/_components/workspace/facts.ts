// What "Your video so far" says, worked out from the saved draft plus any
// choice the current screen has made but not saved yet. Pure (no React, no
// network) so the guard test can check it.

import { VOICE_OPTIONS } from '../../../../_lib/types'
import { PRES_LOOKS, VIDEO_LOOKS } from '../make/looks'
import { lengthName } from '../story/lengths'
import type { SoFar } from './SoFarPanel'

type Draft = Record<string, any> | null | undefined

const METHOD_NAMES: Record<string, string> = {
  url: 'A website',
  upload: 'Your file',
  text: 'Pasted text',
  idea: 'AI writes it',
}

/** "family-plan.pdf", "2 files", "example.com", "Pasted text"… */
export function sourceLabel(method: string | null | undefined, detail?: { fileNames?: string[]; url?: string; title?: string | null }): string | null {
  if (!method) return null
  const files = detail?.fileNames?.filter(Boolean) ?? []
  if (method === 'upload' && files.length > 1) return `${files.length} files`
  if (method === 'upload' && files.length === 1) return files[0]
  if (method === 'url' && detail?.url) return detail.url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  if (detail?.title && method !== 'idea') return `${METHOD_NAMES[method] ?? 'Your content'} — ${detail.title}`
  return METHOD_NAMES[method] ?? null
}

export function lookName(output: string | null | undefined, look: string | null | undefined): string | null {
  if (!look) return null
  if (output === 'interactive' || output === 'deck') return PRES_LOOKS.find((l) => l.id === look)?.name ?? null
  return VIDEO_LOOKS.find((l) => l.id === look)?.name ?? null
}

export function voiceName(id: string | null | undefined): string | null {
  return VOICE_OPTIONS.find((v) => v.id === id)?.name ?? null
}

/** Who it's for, as the draft saved it. */
export function clientLabel(d: Draft): string | null {
  if (!d) return null
  if (typeof d.recipientName === 'string' && d.recipientName.trim()) return d.recipientName.trim()
  if (d.clientId === null || d.contentMethod) return 'No client — general'
  return null
}

export function factsFromDraft(d: Draft, over: Partial<SoFar> = {}): SoFar {
  const ex = (d?.extractedData ?? {}) as Record<string, any>
  const docs = Array.isArray(d?.extractedDocs) ? (d!.extractedDocs as { fileName?: string }[]) : []
  const output = typeof d?.outputType === 'string' ? d.outputType : null
  const isPres = output === 'interactive' || output === 'deck'
  const narrated = output === 'video' || output === 'interactive' || output === null
  const brief = d?.brief && !d?.briefSkipped ? d.brief : null
  return {
    client: clientLabel(d),
    source: sourceLabel(d?.contentMethod, {
      fileNames: docs.length > 1 ? docs.map((x) => x.fileName || '') : d?.sourcePdfName ? [d.sourcePdfName] : [],
      title: typeof ex.title === 'string' ? ex.title : null,
    }),
    point: brief?.angle || brief?.summary || null,
    output,
    look: lookName(output, isPres ? d?.presentationTemplate : d?.videoStyle),
    voice: narrated ? voiceName(d?.voiceId) : output === 'deck' ? 'None — silent slides' : null,
    length: Array.isArray(d?.scenes) && d!.scenes.length > 0 || d?.detailLevel ? lengthName(d?.detailLevel) : null,
    price: { kind: 'later' },
    ...over,
  }
}
