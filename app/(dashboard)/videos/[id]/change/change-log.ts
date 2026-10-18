// =============================================================================
// "YOUR CHANGES" — the list under the Ask-for-a-change bar, with Undo.
//
// What each change keeps so it can be undone:
//   * a presentation rebuild keeps the slides as they were before it;
//     Undo opens the slide editor with those slides back, and the rebuild
//     button there shows what putting them back costs (the server prices it);
//   * a Fix-a-Scene WORDING change keeps the old words; Undo opens Fix-a-Scene
//     on that scene with the old words filled in (same price as any wording
//     change — shown on its button);
//   * an older-editor rebuild keeps the scenes and slide pictures as they were;
//     Undo opens that editor with them back (free, like any save there).
// A re-recorded voice or a fixed pronunciation changes no words, so there is
// nothing to put back — those rows say so instead of showing Undo.
//
// Kept in this browser only (localStorage): it is a convenience for the person
// making changes, not a record anyone else needs. Every read and write is
// wrapped, so a private window or blocked storage just means an empty list.
// =============================================================================

import type { FixAction } from './change-route'

export type ChangeEntry =
  | { id: string; at: string; kind: 'presentation'; summary: string; before: unknown[] }
  | { id: string; at: string; kind: 'fix-scene'; summary: string; action: FixAction; sceneIndex: number; sceneLabel: string; oldText?: string }
  | { id: string; at: string; kind: 'older-editor'; summary: string; before: { scenes: unknown[]; slides: (string | null)[] } }

const KEY = (videoId: string) => `d2v-changes:${videoId}`
const MAX = 12

export function readChanges(videoId: string): ChangeEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY(videoId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as ChangeEntry[]) : []
  } catch {
    return []
  }
}

/** Distributes Omit over the union so each kind keeps its own fields. */
type NewChange = ChangeEntry extends infer E ? (E extends ChangeEntry ? Omit<E, 'id' | 'at'> : never) : never

export function addChange(videoId: string, entry: NewChange): ChangeEntry | null {
  const full = { ...entry, id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString() } as ChangeEntry
  try {
    const next = [full, ...readChanges(videoId)].slice(0, MAX)
    window.localStorage.setItem(KEY(videoId), JSON.stringify(next))
    return full
  } catch {
    return null
  }
}

export function findChange(videoId: string, id: string): ChangeEntry | null {
  return readChanges(videoId).find((c) => c.id === id) ?? null
}

export function removeChange(videoId: string, id: string): void {
  try {
    window.localStorage.setItem(KEY(videoId), JSON.stringify(readChanges(videoId).filter((c) => c.id !== id)))
  } catch { /* nothing to do — the list is a convenience */ }
}

/** Can this change be undone, and what does the Undo do? */
export function undoOf(c: ChangeEntry): { can: true; label: string } | { can: false; why: string } {
  if (c.kind === 'presentation') return { can: true, label: 'Undo' }
  if (c.kind === 'older-editor') return { can: true, label: 'Undo' }
  if (c.action === 'edit-text' && c.oldText) return { can: true, label: 'Undo' }
  return { can: false, why: 'No words changed, so there is nothing to put back.' }
}
