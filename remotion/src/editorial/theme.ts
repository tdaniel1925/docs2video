import { loadFont as loadDMSerif } from '@remotion/google-fonts/DMSerifDisplay'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadSourceSerif } from '@remotion/google-fonts/SourceSerif4'
import { loadFont as loadPlexMono } from '@remotion/google-fonts/IBMPlexMono'

// Load the EPOCH editorial font stack.
export const FONT_DISPLAY = loadDMSerif().fontFamily   // headlines / masthead
export const FONT_KICKER = loadOswald().fontFamily      // condensed caps labels
export const FONT_BODY = loadSourceSerif().fontFamily   // article body
export const FONT_MONO = loadPlexMono().fontFamily      // folio / captions

/** Editorial palette — brand color drives the accent + frame; paper stays warm
 *  and authoritative. Defaults mirror the EPOCH (Time-style) mockup. */
export type EditorialTheme = {
  accent: string     // the red → brand primary (frame, kickers, rules)
  ink: string        // near-black headline/body
  paper: string      // warm page background
  muted: string      // secondary text
  hairline: string   // thin rules / borders
  paperEdge: string  // subtle panel tint
}

export const EPOCH: EditorialTheme = {
  accent: '#E1251B',
  ink: '#16110F',
  paper: '#FBF8F3',
  muted: '#6E6862',
  hairline: '#D8CFC1',
  paperEdge: '#F1E9DC',
}

/** Build a brand-themed editorial palette: brand primary becomes the accent;
 *  everything else stays warm/authoritative for legibility + prestige. */
export function editorialFromBrand(brandPrimary?: string): EditorialTheme {
  if (!brandPrimary) return EPOCH
  return { ...EPOCH, accent: brandPrimary }
}
