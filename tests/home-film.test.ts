import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { HOME_FILM } from '../app/_components/marketing/HomeFilm'

/* The homepage film (owner, 2026-10-18): on the site, opened from the hero and from How it works, light enough to serve. */
const ROOT = join(__dirname, '..')
describe('the homepage film', () => {
  it('is on the site, with its poster, under 15 MB', () => {
    for (const f of [HOME_FILM.src, HOME_FILM.poster]) expect(existsSync(join(ROOT, 'public', f)), f).toBe(true)
    expect(statSync(join(ROOT, 'public', HOME_FILM.src)).size).toBeLessThan(15 * 1024 * 1024)
  })

  it('opens from the hero and from How it works, in a dialog that loads only when opened', () => {
    const home = readFileSync(join(ROOT, 'app/_components/marketing/Docs2VideoHome.tsx'), 'utf8')
    expect((home.match(/<HomeFilm /g) ?? []).length).toBe(2)
    const film = readFileSync(join(ROOT, 'app/_components/marketing/HomeFilm.tsx'), 'utf8')
    expect(film).toMatch(/\{open \? \(/)
    expect(film).toMatch(/role="dialog" aria-modal="true"/)
    expect(film).toMatch(/e\.key === 'Escape'/)
  })
})
