/**
 * LIGHT / DARK (UI round C, 2026-10) — the rules, with no React in them.
 *
 * Copied from VidWiz's theme.tsx: three choices — System (follow the
 * computer), Light, Dark — kept per viewer in this browser only
 * (localStorage, every read and write in try/catch; a blocked store just
 * means "System"). The page wears the result as <html data-theme="light|dark">.
 *
 * THEME_BOOT_SCRIPT runs in <head> (app/layout.tsx) before anything paints,
 * so a dark-mode viewer never sees a white flash. It must say exactly what
 * resolveTheme() says — a test runs both.
 *
 * Who turns dark is CSS's job (globals.css, "DARK MODE"): only Docs2Video's
 * signed-in screens. The share page and the marketing site stay light.
 */
export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'd2v.theme'

export const THEME_CHOICES: ReadonlyArray<{ id: ThemePref; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

/** What was saved, or "system" when nothing (or nonsense) was. */
export function parsePref(saved: string | null | undefined): ThemePref {
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** The theme a choice comes to, given whether the computer is set to dark. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === 'light' || pref === 'dark') return pref
  return systemDark ? 'dark' : 'light'
}

/** Inline, before paint. Same rule as parsePref + resolveTheme. */
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,p=null,s=false;try{p=localStorage.getItem('${THEME_KEY}')}catch(e){}try{s=window.matchMedia('(prefers-color-scheme: dark)').matches}catch(e){}d.setAttribute('data-theme',p==='dark'||(p!=='light'&&s)?'dark':'light')})()`
