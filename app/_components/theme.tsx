'use client'

/*
 * LIGHT / DARK switch (UI round C) — VidWiz's theme.tsx pattern.
 *   ThemeChoice  System / Light / Dark, in Settings → Profile
 *   ThemeToggle  one line in the top bar's account menu ("Dark mode")
 *   ThemeSync    keeps "System" in step when the computer changes
 * The rules (and the before-paint script) are in app/_lib/theme-pref.ts.
 */
import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { DEFAULT_PREF, THEME_CHOICES, THEME_KEY, parsePref, resolveTheme, type Theme, type ThemePref } from '../_lib/theme-pref'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readThemePref(): ThemePref {
  try { return parsePref(window.localStorage.getItem(THEME_KEY)) } catch { return DEFAULT_PREF }
}

function apply(pref: ThemePref) {
  let systemDark = false
  try { systemDark = darkQuery().matches } catch { /* old browser: light */ }
  document.documentElement.setAttribute('data-theme', resolveTheme(pref, systemDark))
}

// One shared choice; every switch on screen stays in step.
const listeners = new Set<(pref: ThemePref) => void>()
export function setThemePref(pref: ThemePref) {
  // Every choice is saved, System too: nothing saved means Dark (the default).
  try {
    window.localStorage.setItem(THEME_KEY, pref)
  } catch { /* this browser only; a blocked store just forgets */ }
  apply(pref)
  listeners.forEach((listener) => listener(pref))
}

export function useThemePref() {
  const [pref, setPref] = useState<ThemePref>(DEFAULT_PREF)
  useEffect(() => {
    setPref(readThemePref())
    listeners.add(setPref)
    return () => { listeners.delete(setPref) }
  }, [])
  return [pref, setThemePref] as const
}

const currentTheme = (): Theme => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')

/** Mounted once by the dashboard layout: re-applies the choice (a client-side
 *  visit from another page) and follows the computer while on "System". */
export function ThemeSync() {
  useEffect(() => {
    apply(readThemePref())
    let query: MediaQueryList
    try { query = darkQuery() } catch { return }
    const onChange = () => { if (readThemePref() === 'system') apply('system') }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return null
}

/** A menu line that flips between light and dark. */
export function ThemeToggle({ className = 'kit-menu-item', onDone }: { className?: string; onDone?: () => void }) {
  const [pref] = useThemePref()
  const [mode, setMode] = useState<Theme>('light')
  useEffect(() => setMode(currentTheme()), [pref])
  const next: Theme = mode === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={className}
      onClick={() => { setThemePref(next); setMode(next); onDone?.() }}
      aria-label={`Switch to ${next} mode`}
    >
      <span className="kit-btn-label">{next === 'dark' ? <Moon size={16} /> : <Sun size={16} />}{next === 'dark' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  )
}

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const

/** System / Light / Dark — for Settings → Profile. */
export function ThemeChoice() {
  const [pref, setPref] = useThemePref()
  return (
    <div className="kit-segmented" role="radiogroup" aria-label="Appearance">
      {THEME_CHOICES.map(({ id, label }) => {
        const Icon = ICONS[id]
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={pref === id}
            className="kit-segmented-item"
            onClick={() => setPref(id)}
          >
            <Icon size={16} />{label}
          </button>
        )
      })}
    </div>
  )
}

/** The sun/moon button in the top bar: one tap flips light and dark. */
export function ThemeIconButton() {
  const [pref] = useThemePref()
  const [mode, setMode] = useState<Theme>('dark')
  useEffect(() => setMode(currentTheme()), [pref])
  const next: Theme = mode === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="kit-icon-btn"
      onClick={() => { setThemePref(next); setMode(next) }}
      aria-label={`Switch to ${next} mode`}
      title={next === 'dark' ? 'Dark mode' : 'Light mode'}
    >
      {next === 'dark' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
    </button>
  )
}
