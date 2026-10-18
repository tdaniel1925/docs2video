// Cache keys for the free first-scene preview. Separate from
// first-scene-preview.ts only because hashing needs node's crypto, and that
// file is also used in the browser.

import { createHash } from 'node:crypto'
import type { StillEngine } from './first-scene-preview'

// ── Cache keys ──────────────────────────────────────────────────────────────

/** Key-order-independent JSON, so the same content always hashes the same. */
function stable(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm)
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>
      return Object.keys(o).sort().reduce<Record<string, unknown>>((acc, k) => { if (o[k] !== undefined) acc[k] = norm(o[k]); return acc }, {})
    }
    return x
  }
  return JSON.stringify(norm(v) ?? null)
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 40)

/** Same words + same voice = same file, so re-previewing costs us nothing.
 *  v2-fal (2026-10-09): voices now come from fal, so older cached samples
 *  (OpenAI / ElevenLabs-direct) are not replayed as if they were the new voice. */
export function audioCacheKey(text: string, engine: string, voice: string): string {
  return hash(`voice|v2-fal|${engine}|${voice}|${String(text).trim()}`)
}

/** Same look + same content + same brand = same picture. */
export function stillCacheKey(engine: StillEngine, request: unknown): string {
  return hash(`still|v1|${engine}|${stable(request)}`)
}
