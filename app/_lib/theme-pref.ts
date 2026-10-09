/**
 * LIGHT / DARK (UI round C, 2026-10) — the rules, with no React in them.
 *
 * Copied from VidWiz's theme.tsx: three choices — System (follow the
 * computer), Light, Dark — kept per viewer in this browser only
 * (localStorage, every read and write in try/catch). The page wears the
 * result as <html data-theme="light|dark">.
 *
 * DARK BY DEFAULT (owner decision 2026-10-09): someone who never picked —
 * nothing saved, nonsense saved, or a blocked store — gets Dark. Picking
 * System now saves the word 'system' so it is remembered as a real choice.
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

/** What someone who never picked gets. */
export const DEFAULT_PREF: ThemePref = 'dark'

/** What was saved, or the default (Dark) when nothing (or nonsense) was. */
export function parsePref(saved: string | null | undefined): ThemePref {
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_PREF
}

/** The theme a choice comes to, given whether the computer is set to dark. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  if (pref === 'light' || pref === 'dark') return pref
  return systemDark ? 'dark' : 'light'
}

/** Inline, before paint. Same rule as parsePref + resolveTheme: Light only
 *  when Light was picked, or System was picked on a light computer. */
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,p=null,s=false;try{p=localStorage.getItem('${THEME_KEY}')}catch(e){}try{s=window.matchMedia('(prefers-color-scheme: dark)').matches}catch(e){}d.setAttribute('data-theme',p==='light'||(p==='system'&&!s)?'light':'dark')})()`
