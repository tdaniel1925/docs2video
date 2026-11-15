import { createHash } from 'crypto'
import { checkCtx, sourceNumbers, validateScene, type PlannerInput } from './kit-planner'
import { formatForTTS } from './tts-format'
import { formatFigure, parseFigure, type KitScene } from '../../remotion/src/kit/spec'

/*
 * THE STORYBOARD (step 5, film engine on): every content scene of the story as the film engine will show it — a
 * still frame, the words the voice says, the words on screen — with the words on screen editable.
 * Owner rules: NO previews, NO motion or timing controls, NO changing how a scene is shown ("show as").
 *
 * The cover and the closing are made at "Make it" (the greeting, who is speaking, the photo, the contact), so the
 * storyboard holds the CONTENT scenes. Each is keyed by its spoken words: when the video is made, a content scene
 * whose words are unchanged is drawn exactly as the storyboard showed it (re-checked against the source); a
 * changed one is planned again.
 */

export type SceneEdits = Record<string, string>
export type StoryFrame = { url: string; sig: string }
export type StoryboardEntry = { key: string; scene: KitScene; edits?: SceneEdits; frame?: StoryFrame }
export type Storyboard = { entries: StoryboardEntry[]; at: string; cache?: unknown; frames?: { day: string; n: number } }

/** The scene's identity: its spoken words, formatted as the voice reads them. */
export function storyKey(narration: unknown): string {
  const spoken = formatForTTS(String(narration ?? '')).toLowerCase().replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(spoken).digest('hex').slice(0, 20)
}

/* ── what can be edited on screen, per scene type (paths into the scene) ───── */
const FIELDS: Record<KitScene['type'], (s: KitScene) => string[]> = {
  title: () => ['headline', 'sub'],
  bignumber: () => ['label', 'figure', 'context'],
  comparison: () => ['heading', 'left.label', 'left.figure', 'right.label', 'right.figure', 'verdict'],
  timeline: (s) => ['heading', ...(s.type === 'timeline' ? s.steps.flatMap((_, i) => [`steps.${i}.when`, `steps.${i}.label`]) : [])],
  chart: (s) => ['heading', 'takeaway', ...(s.type === 'chart' ? s.points.flatMap((_, i) => [`points.${i}.label`, `points.${i}.value`]) : [])],
  checklist: (s) => ['heading', ...(s.type === 'checklist' ? s.items.map((_, i) => `items.${i}`) : [])],
  quote: () => ['quote', 'attribution'],
  cta: () => ['headline', 'action'],
}
/** The words on screen as editable fields: [path, label, current text]. */
export function screenFields(scene: KitScene): { path: string; label: string; value: string }[] {
  const nice = (p: string) => p.replace(/^steps\.(\d+)\.when$/, (_, i) => `Step ${+i + 1} when`).replace(/^steps\.(\d+)\.label$/, (_, i) => `Step ${+i + 1}`)
    .replace(/^points\.(\d+)\.label$/, (_, i) => `Bar ${+i + 1} label`).replace(/^points\.(\d+)\.value$/, (_, i) => `Bar ${+i + 1} number`)
    .replace(/^items\.(\d+)$/, (_, i) => `Point ${+i + 1}`).replace(/^left\./, 'Left ').replace(/^right\./, 'Right ')
    .replace(/figure$/, 'number').replace(/^(\w)/, (c) => c.toUpperCase())
  return FIELDS[scene.type](scene).map((path) => ({ path, label: nice(path), value: readPath(scene, path) })).filter((f) => f.value !== '' || ['sub', 'context', 'verdict', 'takeaway', 'attribution'].includes(f.path))
}
function readPath(scene: KitScene, path: string): string {
  let v: unknown = scene
  for (const k of path.split('.')) v = v == null ? undefined : (v as Record<string, unknown>)[k]
  if (path.endsWith('figure')) return v && typeof v === 'object' ? formatFigure(v as Parameters<typeof formatFigure>[0]) : ''
  if (path.endsWith('.value') && path.startsWith('points.')) {
    const s = scene as Extract<KitScene, { type: 'chart' }>
    return typeof v === 'number' ? formatFigure({ value: v, prefix: s.prefix, suffix: s.suffix, decimals: s.decimals }) : ''
  }
  return v == null ? '' : String(v)
}

/** The scene with the user's on-screen edits applied. Only known fields; numbers are parsed ("$500,000" → 500000). */
export function applyEdits(scene: KitScene, edits: SceneEdits | undefined): KitScene {
  if (!edits) return scene
  const out = JSON.parse(JSON.stringify(scene)) as KitScene
  const allowed = new Set(FIELDS[scene.type](scene))
  for (const [path, raw] of Object.entries(edits)) {
    if (!allowed.has(path)) continue
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
    const keys = path.split('.')
    let o = out as unknown as Record<string, unknown>
    for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>
    const last = keys[keys.length - 1]
    if (last === 'figure') { const f = parseFigure(text); if (f) o[last] = f; else if (!text) delete o[last]; continue }
    if (path.startsWith('points.') && last === 'value') { const f = parseFigure(text); if (f) o[last] = f.value; continue }
    if (!text && ['sub', 'context', 'verdict', 'takeaway', 'attribution'].includes(last)) { delete o[last]; continue }
    o[last] = text
  }
  return out
}

/** Every number on screen, and whether the source has it (the green check). */
export function numberChecks(scene: KitScene, input: PlannerInput): { text: string; found: boolean }[] {
  const pool = sourceNumbers(input)
  const near = (v: number) => pool.some((p) => p === v || (Math.abs(p) > 0 && Math.abs(p - v) / Math.abs(p) < 0.005))
  const out: { text: string; found: boolean }[] = []
  const figs: { text: string; value: number }[] = []
  if (scene.type === 'bignumber') figs.push({ text: formatFigure(scene.figure), value: scene.figure.value })
  if (scene.type === 'comparison') for (const s of [scene.left, scene.right]) if (s.figure) figs.push({ text: formatFigure(s.figure), value: s.figure.value })
  if (scene.type === 'chart') for (const p of scene.points) figs.push({ text: formatFigure({ value: p.value, prefix: scene.prefix, suffix: scene.suffix, decimals: scene.decimals }), value: p.value })
  for (const f of figs) out.push({ text: f.text, found: near(f.value) })
  return out
}

/** Check a scene the user edited, the way the planner's own scenes are checked (numbers from the source, word limits, compliance). */
export function checkEdited(scene: KitScene, index: number, input: PlannerInput): string[] {
  return validateScene(scene, index, input, checkCtx(input))
}

/**
 * At "Make it": each planned content scene whose spoken words match a storyboard scene is drawn as the storyboard
 * showed it (with the user's on-screen edits), if it still passes the planner's checks. The cover and closing stay
 * as planned. Returns the scenes, and how many were taken from the storyboard.
 */
export function pinStoryboard(planned: KitScene[], board: Storyboard | null | undefined, input: PlannerInput): { scenes: KitScene[]; pinned: number } {
  const entries = Array.isArray(board?.entries) ? board!.entries : []
  if (!entries.length) return { scenes: planned, pinned: 0 }
  const ctx = checkCtx(input)
  let pinned = 0
  const out: KitScene[] = []
  planned.forEach((s, i) => {
    if (s.type === 'title' || s.type === 'cta') { out.push(s); return }
    const e = entries.find((x) => x.key === storyKey(s.narration))
    if (!e) { out.push(s); return }
    const candidate = { ...applyEdits(e.scene, e.edits), id: s.id, narration: s.narration, ...(s.mood ? { mood: s.mood } : {}) } as KitScene
    const issues = validateScene(candidate, i, input, ctx, out[i - 1])
    if (issues.length) { out.push(s); return }
    out.push(candidate)
    pinned++
  })
  return { scenes: out, pinned }
}
