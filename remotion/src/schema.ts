import { z } from 'zod'

/** Theme (palette) supplied per video — from a brand guide / scraped site / template. */
export const themeSchema = z.object({
  name: z.string(),
  ink: z.string(),
  inkSoft: z.string(),
  glass: z.string(),
  glassEdge: z.string(),
  textPrimary: z.string(),
  textMuted: z.string(),
  accents: z.tuple([z.string(), z.string(), z.string()]),
  mode: z.enum(['dark', 'light']),
})

export const pillarSchema = z.object({
  accentIndex: z.number().int().min(0).max(2),
  label: z.string(),
  title: z.string(),
  subhead: z.string(),
  icon: z.enum(['spark', 'shield', 'chart']),
})

export const coverSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
})

export const statSchema = z.object({
  value: z.string(),
  label: z.string(),
  accentIndex: z.number().int().min(0).max(2),
})

export const bulletsSchema = z.object({
  title: z.string(),
  items: z.array(z.string()).min(2).max(5),
})

export const closingSchema = z.object({
  title: z.string(),
  cta: z.string(),
  contact: z.string().optional(),
})

/** Per-scene narration: an audio file (in public/) + its measured duration. */
export const narrationSchema = z.object({
  cover: z.string().optional(),
  pillars: z.string().optional(),
  stat: z.string().optional(),
  bullets: z.string().optional(),
  closing: z.string().optional(),
})
/** Per-scene Gemini background image paths (in public/). */
export const backgroundsSchema = narrationSchema
export const durationsSchema = z.object({
  cover: z.number(),
  pillars: z.number(),
  stat: z.number(),
  bullets: z.number(),
  closing: z.number(),
})

export const explainerSchema = z.object({
  brandName: z.string(),
  theme: themeSchema,
  /** Optional logo (public/ path) shown small in a corner + on cover/closing. */
  logo: z.string().optional(),
  /** Optional background music (public/ path), played low under the narration. */
  music: z.string().optional(),
  cover: coverSchema,
  pillarsTitle: z.string(),
  pillars: z.array(pillarSchema).length(3),
  stat: statSchema,
  bullets: bulletsSchema,
  closing: closingSchema,
  /** Optional narration audio paths (public/) + per-scene durations in seconds. */
  narration: narrationSchema.optional(),
  sceneDurations: durationsSchema.optional(),
  /** Optional per-scene Gemini background images (public/). */
  backgrounds: backgroundsSchema.optional(),
})

export type ExplainerProps = z.infer<typeof explainerSchema>
export type Pillar = z.infer<typeof pillarSchema>
export type ThemeProps = z.infer<typeof themeSchema>
