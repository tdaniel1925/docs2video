/**
 * Design tokens. Type / motion / timing are FIXED house constants.
 * The PALETTE is a Theme — supplied per video (from a brand guide, a scraped
 * site, or a named internal template) so the same components re-skin entirely.
 */

export type Theme = {
  name: string
  ink: string          // dark (or light) ground
  inkSoft: string
  glass: string        // card fill
  glassEdge: string    // card border
  textPrimary: string  // main text on the ground
  textMuted: string
  accents: [string, string, string]  // tri-accent (used for cards, glows, dots)
  /** 'dark' = neon glows on dark ground; 'light' = soft tints on light ground. */
  mode: 'dark' | 'light'
}

/** Aurora — the original dark neon house look. */
export const AURORA: Theme = {
  name: 'Aurora',
  ink: '#070A11',
  inkSoft: '#0C111C',
  glass: 'rgba(255,255,255,0.035)',
  glassEdge: 'rgba(255,255,255,0.10)',
  textPrimary: '#FFFFFF',
  textMuted: '#93A1B0',
  accents: ['#7FFF00', '#A65CF0', '#2E9BF0'],
  mode: 'dark',
}

/** iHostPoker — deep casino red + gold/cream on a rich dark-red ground. */
export const IHOSTPOKER: Theme = {
  name: 'iHostPoker',
  ink: '#1A0608', inkSoft: '#2A0A0E',
  glass: 'rgba(255,255,255,0.04)', glassEdge: 'rgba(212,175,55,0.28)',
  textPrimary: '#FFF8EC', textMuted: '#C9A98C',
  accents: ['#C8102E', '#D4AF37', '#F3E3C3'],
  mode: 'dark',
}

/** Executive Light — clean white/light, navy + accent, crisp corporate. */
export const EXECUTIVE_LIGHT: Theme = {
  name: 'Executive Light',
  ink: '#F4F6FA', inkSoft: '#FFFFFF',
  glass: 'rgba(20,40,80,0.04)', glassEdge: 'rgba(20,40,80,0.12)',
  textPrimary: '#0E1A2B', textMuted: '#5A6B82',
  accents: ['#1B365D', '#2E9BF0', '#16A34A'],  // navy, azure, green
  mode: 'light',
}

/** Warm Trust — soft cream/earth, gentle and human. Life insurance, healthcare. */
export const WARM_TRUST: Theme = {
  name: 'Warm Trust',
  ink: '#FBF6EE', inkSoft: '#FFFFFF',
  glass: 'rgba(120,80,40,0.05)', glassEdge: 'rgba(160,120,70,0.20)',
  textPrimary: '#2C2218', textMuted: '#7A6A55',
  accents: ['#C8821E', '#3E7C59', '#B5562E'],  // amber, sage green, terracotta
  mode: 'light',
}

/** Bold Editorial — high-contrast, big type, financial-times feel. */
export const BOLD_EDITORIAL: Theme = {
  name: 'Bold Editorial',
  ink: '#0B0B0C', inkSoft: '#161618',
  glass: 'rgba(255,255,255,0.05)', glassEdge: 'rgba(255,255,255,0.16)',
  textPrimary: '#FFFFFF', textMuted: '#A0A0A8',
  accents: ['#FF3B30', '#FFD60A', '#FFFFFF'],  // red, yellow, white
  mode: 'dark',
}

/** Modern Fintech — cool blues, glassmorphism, sleek gradients. */
export const MODERN_FINTECH: Theme = {
  name: 'Modern Fintech',
  ink: '#070D1A', inkSoft: '#0C1730',
  glass: 'rgba(120,170,255,0.06)', glassEdge: 'rgba(120,170,255,0.22)',
  textPrimary: '#EAF2FF', textMuted: '#8FA6C8',
  accents: ['#3B82F6', '#22D3EE', '#8B5CF6'],  // blue, cyan, violet
  mode: 'dark',
}

/** Minimal Mono — near-monochrome + one accent, ultra-clean. */
export const MINIMAL_MONO: Theme = {
  name: 'Minimal Mono',
  ink: '#101113', inkSoft: '#1A1B1E',
  glass: 'rgba(255,255,255,0.04)', glassEdge: 'rgba(255,255,255,0.14)',
  textPrimary: '#F5F5F5', textMuted: '#9A9A9E',
  accents: ['#E8B84B', '#F5F5F5', '#9A9A9E'],  // single warm accent + greys
  mode: 'dark',
}

/** Docs2Video PREMIUM — dark navy ground, neon-green accent, glass + glow.
 *  The default Docs2Video house look (matches the "87 Pages" storyboard). */
export const PREMIUM: Theme = {
  name: 'Docs2Video Premium',
  ink: '#060B14', inkSoft: '#0B1424',
  glass: 'rgba(255,255,255,0.06)', glassEdge: 'rgba(127,255,80,0.28)',
  textPrimary: '#FFFFFF', textMuted: '#9DB0C7',
  accents: ['#7CFF4F', '#3DDC97', '#2E9BF0'], // neon green, emerald, azure
  mode: 'dark',
}

/** All curated themes, in preview order. */
export const ALL_THEMES: Theme[] = [
  IHOSTPOKER, EXECUTIVE_LIGHT, WARM_TRUST, BOLD_EDITORIAL, MODERN_FINTECH, MINIMAL_MONO, AURORA,
]

/**
 * ROLE-BASED color semantics derived from a Theme. This is what makes the
 * reference "benchmark" look read as designed: warm = the hero / the thing
 * being sold / "good"; cool = neutral / comparison. Color MEANS something.
 * Falls back gracefully to the theme's own accents so every existing theme
 * gains the roles for free.
 */
export function roles(theme: Theme): { hero: string; neutral: string; warn: string } {
  // accents[0] is the brand's primary — treat it as the hero (warm) by default.
  // accents[2] is usually the cooler/secondary — use it for the neutral role.
  return {
    hero: theme.accents[0],
    neutral: theme.accents[2] ?? theme.accents[1] ?? theme.accents[0],
    warn: theme.accents[1] ?? theme.accents[0],
  }
}

export const FONTS = {
  display: 'Archivo',
  body: 'Inter',
} as const

/** Type scale — sized for VIDEO viewing (phones/feeds), deliberately LARGE.
 *  On a desktop monitor these look almost too big — that's correct for mobile. */
export const TYPE = {
  hero: 184,
  title: 92,
  cardTitle: 52,
  label: 28,
  body: 46,
  subhead: 40,
} as const

/** Minimum readable size on a 1080p video (auto-fit never goes below this). */
export const MIN_VIDEO_FONT = 42

/** Headline drop-shadow/glow so text pops off any background (legibility + depth). */
export const TEXT_SHADOW = '0 4px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)'

// 24fps (was 30): ~20% fewer frames per render with no visible quality loss for
// slide/data-explainer motion — cuts render time proportionally on the VPS. All
// durations are computed as seconds×FPS, so video length is unchanged.
export const FPS = 24
export const MOTION = {
  settle: [0.16, 1, 0.3, 1] as const,
  entranceFrames: Math.round(0.7 * FPS),
  staggerFrames: Math.round(0.09 * FPS),
} as const

/** Fallback per-scene durations (seconds) — used when no narration audio. With
 *  narration, each scene's duration is driven by its audio length instead. */
export const SCENE_SECONDS = {
  cover: 4,
  pillars: 6,
  stat: 4,
  bullets: 6,
  closing: 4,
} as const
