import { loadFont as loadDMSerif } from '@remotion/google-fonts/DMSerifDisplay'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadSourceSerif } from '@remotion/google-fonts/SourceSerif4'
import { loadFont as loadPlexMono } from '@remotion/google-fonts/IBMPlexMono'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'

// EPOCH editorial font stack (serif — used by editorial + time).
export const FONT_DISPLAY = loadDMSerif().fontFamily   // headlines / masthead
export const FONT_KICKER = loadOswald().fontFamily      // condensed caps labels
export const FONT_BODY = loadSourceSerif().fontFamily   // article body
export const FONT_MONO = loadPlexMono().fontFamily      // folio / captions

// Explainer font stack (geometric/humanist sans — friendly, modern).
export const FONT_GROTESK = loadSpaceGrotesk().fontFamily  // headlines / labels
export const FONT_ARCHIVO = loadArchivo().fontFamily       // body / UI

/** Editorial palette + a VARIANT that picks the look:
 *  - 'editorial' = clean, warm, refined magazine (soft brand accent, thin/no
 *    frame, airy, smaller numerals). The calm choice.
 *  - 'time'      = bold red newsmagazine (thick red frame, red kickers, drop
 *    caps, numbered tiles, oversized red numerals, prominent folio). The punchy
 *    choice. Defaults mirror the EPOCH / Time mockup.
 *  Components read `variant` to switch device intensity from one theme object. */
export type EditorialVariant = 'editorial' | 'time' | 'explainer'

export type EditorialTheme = {
  variant: EditorialVariant
  accent: string     // brand primary (editorial) / signature red (time) / coral (explainer)
  ink: string        // near-black headline/body
  paper: string      // page background (warm cream, or navy-on-cover for explainer)
  muted: string      // secondary text
  hairline: string   // thin rules / borders
  paperEdge: string  // subtle panel tint
  /** Width of the colored page frame in px (time = bold, editorial = subtle, explainer = 0). */
  frameWidth: number
  /** Fonts — serif stack (editorial/time) vs sans stack (explainer). */
  fontDisplay: string
  fontKicker: string
  fontBody: string
  fontMono: string
  /** Card corner radius — explainer uses big rounded cards; magazine = square. */
  radius: number
  /** Rotating multi-color accent set (explainer's signature). */
  accents: string[]
}

const SERIF_FONTS = { fontDisplay: FONT_DISPLAY, fontKicker: FONT_KICKER, fontBody: FONT_BODY, fontMono: FONT_MONO }
const SANS_FONTS = { fontDisplay: FONT_GROTESK, fontKicker: FONT_GROTESK, fontBody: FONT_ARCHIVO, fontMono: FONT_ARCHIVO }

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
  ...SERIF_FONTS,
  radius: 0,
  accents: ['#E1251B', '#16110F', '#6E6862'],
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
  ...SERIF_FONTS,
  radius: 0,
  accents: ['#1B365D', '#1A1714', '#7A736B'],
}

/** EXPLAINER — friendly, modern educational deck. Sans fonts, navy + cream,
 *  rounded cards, a rotating four-color accent set, NO page frame. */
export const EXPLAINER: EditorialTheme = {
  variant: 'explainer',
  accent: '#FF5A3C',   // coral primary
  ink: '#15233B',      // deep navy text
  paper: '#F5F2EC',    // warm cream
  muted: '#5C5648',
  hairline: '#E7E1D5',
  paperEdge: '#F0EBE0',
  frameWidth: 0,       // no colored frame — clean edges
  ...SANS_FONTS,
  radius: 18,          // big rounded cards
  accents: ['#FF5A3C', '#1FA88E', '#F5B72E', '#6B5CE0'], // coral / teal / gold / purple
}

/** Back-compat alias (older imports referenced EPOCH = the Time look). */
export const EPOCH = EPOCH_TIME

/** Build a themed palette. `variant` chooses the base look; 'editorial' uses the
 *  brand primary as accent; 'time' keeps its red; 'explainer' keeps its coral +
 *  four-color set (brand color does not override its identity). */
export function editorialFromBrand(brandPrimary?: string, variant: EditorialVariant = 'time'): EditorialTheme {
  const base = variant === 'explainer' ? EXPLAINER : variant === 'editorial' ? EPOCH_EDITORIAL : EPOCH_TIME
  if (!brandPrimary) return base
  return variant === 'editorial' ? { ...base, accent: brandPrimary } : base
}

/** Convenience constructors. */
export function timeFromBrand(brandPrimary?: string): EditorialTheme { return editorialFromBrand(brandPrimary, 'time') }
export function explainerFromBrand(brandPrimary?: string): EditorialTheme { return editorialFromBrand(brandPrimary, 'explainer') }
