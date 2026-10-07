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

/** Same words + same voice = same file, so re-previewing costs us nothing. */
export function audioCacheKey(text: string, engine: string, voice: string): string {
  return hash(`voice|v1|${engine}|${voice}|${String(text).trim()}`)
}

/** Same look + same content + same brand = same picture. */
export function stillCacheKey(engine: StillEngine, request: unknown): string {
  return hash(`still|v1|${engine}|${stable(request)}`)
}
