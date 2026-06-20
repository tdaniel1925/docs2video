import { loadFont as loadDMSerif } from '@remotion/google-fonts/DMSerifDisplay'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadSourceSerif } from '@remotion/google-fonts/SourceSerif4'
import { loadFont as loadPlexMono } from '@remotion/google-fonts/IBMPlexMono'

// Load the EPOCH editorial font stack.
export const FONT_DISPLAY = loadDMSerif().fontFamily   // headlines / masthead
export const FONT_KICKER = loadOswald().fontFamily      // condensed caps labels
export const FONT_BODY = loadSourceSerif().fontFamily   // article body
export const FONT_MONO = loadPlexMono().fontFamily      // folio / captions

/** Editorial palette + a VARIANT that picks the look:
 *  - 'editorial' = clean, warm, refined magazine (soft brand accent, thin/no
 *    frame, airy, smaller numerals). The calm choice.
 *  - 'time'      = bold red newsmagazine (thick red frame, red kickers, drop
 *    caps, numbered tiles, oversized red numerals, prominent folio). The punchy
 *    choice. Defaults mirror the EPOCH / Time mockup.
 *  Components read `variant` to switch device intensity from one theme object. */
export type EditorialVariant = 'editorial' | 'time'

export type EditorialTheme = {
  variant: EditorialVariant
  accent: string     // brand primary (editorial) or signature red (time)
  ink: string        // near-black headline/body
  paper: string      // warm page background
  muted: string      // secondary text
  hairline: string   // thin rules / borders
  paperEdge: string  // subtle panel tint
  /** Width of the colored page frame in px (time = bold, editorial = subtle). */
  frameWidth: number
}

/** TIME — bold red newsmagazine. */
export const EPOCH_TIME: EditorialTheme = {
  variant: 'time',
  accent: '#E1251B',   // signature Time red
  ink: '#16110F',
  paper: '#FBF8F3',
  muted: '#6E6862',
  hairline: '#D8CFC1',
  paperEdge: '#F1E9DC',
  frameWidth: 16,
}

/** EDITORIAL — clean, warm, refined. Cooler ink, softer hairline, thin frame. */
export const EPOCH_EDITORIAL: EditorialTheme = {
  variant: 'editorial',
  accent: '#1B365D',   // calm brand-blue default (overridden by brand primary)
  ink: '#1A1714',
  paper: '#FCFAF6',
  muted: '#7A736B',
  hairline: '#E6DFD4',
  paperEdge: '#F4EEE4',
  frameWidth: 5,
}

/** Back-compat alias (older imports referenced EPOCH = the Time look). */
export const EPOCH = EPOCH_TIME

/** Build a themed editorial palette. `variant` chooses the base look; for the
 *  'editorial' (clean) variant the brand primary becomes the accent. For 'time'
 *  the signature red is kept (brand color drives kickers/rules only if provided). */
export function editorialFromBrand(brandPrimary?: string, variant: EditorialVariant = 'time'): EditorialTheme {
  const base = variant === 'editorial' ? EPOCH_EDITORIAL : EPOCH_TIME
  if (!brandPrimary) return base
  // Editorial leans on the brand color; Time keeps its red identity.
  return variant === 'editorial' ? { ...base, accent: brandPrimary } : base
}

/** Convenience for the Time look. */
export function timeFromBrand(brandPrimary?: string): EditorialTheme {
  return editorialFromBrand(brandPrimary, 'time')
}
