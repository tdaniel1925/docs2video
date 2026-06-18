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
  image: z.string(),                 // public/ path (Gemini full-bleed)
  placement: z.enum(['bottom', 'left', 'right', 'center', 'top']).optional(),
  kenBurns: z.enum(['in', 'left', 'right']).optional(),
  audio: z.string().optional(),      // public/ path (TTS)
  durationInFrames: z.number(),
})

export const v3Schema = z.object({
  theme: themeSchema,
  brandName: z.string().optional(),
  music: z.string().optional(),
  // string (single file) OR {light,dark} variants (picked by theme mode).
  logo: z.union([z.string(), z.object({ light: z.string().optional(), dark: z.string().optional() })]).optional(),
  logoChip: z.boolean().optional(),
  scenes: z.array(v3SceneSchema).min(1),
})

export type V3Props = z.infer<typeof v3Schema>
export type V3Scene = z.infer<typeof v3SceneSchema>
