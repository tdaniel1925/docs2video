import { z } from 'zod'
import { themeSchema } from '../schema'

/** A v3 scene — mirrors what the existing script-generator produces per scene:
 *  a title (headline), body (narration-derived support line), plus the rendered
 *  full-bleed image + narration audio + duration the pipeline supplies. */
export const v3SceneSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  accentWordIndex: z.number().int().optional(),
  image: z.string().optional(),      // public/ path (Gemini full-bleed); optional if gen failed
  placement: z.enum(['bottom', 'left', 'right', 'center', 'top']).optional(),
  kenBurns: z.enum(['in', 'left', 'right']).optional(),
  audio: z.string().optional(),      // public/ path (TTS)
  durationInFrames: z.number(),
  /** Optional key metric(s) shown as cinematic lower-third callouts over the
   *  image. `metric` (single) kept for back-compat; `metrics` shows up to 3. */
  metric: z.object({ label: z.string(), value: z.string() }).optional(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  /** When set, render ONE enormous hero figure (the reference "$0.019 / 594 /
   *  2-3×" look): a giant value filling the left, with a small label + optional
   *  caption. Use for a single dominant stat scene. */
  heroMetric: z.object({
    value: z.string(),
    label: z.string().optional(),
    caption: z.string().optional(),
    /** 'hero' = warm/primary (default, "the good number"); 'neutral' = cool. */
    tone: z.enum(['hero', 'neutral', 'warn']).optional(),
  }).optional(),
  /** Bullet points for the glass-panel slide layout. Each may carry a number. */
  bullets: z.array(z.object({ text: z.string(), value: z.string().optional() })).optional(),
  /** When present, this scene renders the branded ClosingCard (contact + logo). */
  closing: z.object({
    headline: z.string().optional(),
    cta: z.string().optional(),
    value: z.object({ label: z.string(), value: z.string() }).optional(),
    contact: z.object({ phone: z.string().optional(), email: z.string().optional(), website: z.string().optional() }).optional(),
  }).optional(),
  /** When true, render the presenter photo (framed inset) on this scene's cover. */
  showPresenterOnCover: z.boolean().optional(),
})

/** Presenter identity (Person profile): a headshot + name/role placed per style. */
export const v3PresenterSchema = z.object({
  name: z.string().optional(),
  role: z.string().optional(),
  /** public/ path to the downloaded headshot. */
  photo: z.string().optional(),
})

export const v3Schema = z.object({
  theme: themeSchema,
  brandName: z.string().optional(),
  music: z.string().optional(),
  /** Visual look:
   *  - 'aurora'          → continuous code-rendered ThemedBackground ($0, no images)
   *  - 'editorial-cinema'→ ONE shared backdrop image behind every scene
   *  - 'image-per-scene' → legacy: each scene has its own sc.image (default)
   *  Both fluid looks share ONE continuous background across all scenes. */
  look: z.enum(['aurora', 'editorial-cinema', 'image-per-scene']).optional(),
  /** The single shared backdrop image for 'editorial-cinema' (public/ path). */
  backdrop: z.string().optional(),
  // string (single file) OR {light,dark} variants (picked by theme mode).
  logo: z.union([z.string(), z.object({ light: z.string().optional(), dark: z.string().optional() })]).optional(),
  logoChip: z.boolean().optional(),
  presenter: v3PresenterSchema.optional(),
  /** Render the presenter photo on the cold-open cover. */
  presenterOnCover: z.boolean().optional(),
  /** Render the presenter photo on the closing card. */
  presenterOnClosing: z.boolean().optional(),
  /** Persistent on-screen chrome shown over EVERY scene (the cohesive "frame"
   *  that makes a video read as one product): a top-left eyebrow, an optional
   *  top-right tag (date/source), and up to 3 footer proof chips. */
  frame: z.object({
    eyebrow: z.string().optional(),
    tag: z.string().optional(),
    footer: z.array(z.string()).optional(),
  }).optional(),
  scenes: z.array(v3SceneSchema).min(1),
})

export type V3Props = z.infer<typeof v3Schema>
export type V3Scene = z.infer<typeof v3SceneSchema>
