import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

vi.mock('../app/_lib/admin', () => ({ isAdminDB: async (id: string) => id === 'admin-user' }))
import { filmMode, filmEngineFor } from '../app/_lib/film-engine'
import { FILM_LOOKS, FILM_LOOK_IDS, filmCardId, filmLookForCard, filmLookForDraft, filmStyleForCard, isFilmLookId } from '../app/_lib/film-looks'
import { lookCards } from '../app/(dashboard)/create/_components/make/looks'
import { stillEngineFor, VIDEO_PREVIEW_LOOKS } from '../app/_lib/first-scene-preview'

/* THE FILM ENGINE (docs/FILM-ENGINE-PLAN.md): the scene kit's plan, drawn with a 3D camera and twelve looks. */
const ROOT = join(__dirname, '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n')

afterEach(() => { vi.unstubAllEnvs() })

describe('who gets it', () => {
  it('nobody until it is switched on, admins while it is proved, everyone when on', async () => {
    vi.stubEnv('FILM_ENGINE', '')
    expect(filmMode()).toBe('off')
    expect(await filmEngineFor('admin-user')).toBe(false)
    vi.stubEnv('FILM_ENGINE', 'admins')
    expect(await filmEngineFor('admin-user')).toBe(true)
    expect(await filmEngineFor('customer')).toBe(false)
    expect(await filmEngineFor(null)).toBe(false)
    vi.stubEnv('FILM_ENGINE', 'on')
    expect(await filmEngineFor('customer')).toBe(true)
    vi.stubEnv('FILM_ENGINE', 'sometimes')
    expect(filmMode()).toBe('off')
  })
})

describe('the twelve looks', () => {
  it('are exactly the film themes the video draws (remotion/src/film/theme.ts)', () => {
    const theme = read('remotion/src/film/theme.ts')
    const ids = [...theme.matchAll(/^\s*\{ id: '([a-z]+)', name: /gm)].map((m) => m[1])
    expect(ids).toEqual([...FILM_LOOK_IDS])
    expect(FILM_LOOKS.map((l) => l.id)).toEqual([...FILM_LOOK_IDS])
  })
  it('each sit beside a real kit look, so music, fallback and old drafts keep working', () => {
    for (const l of FILM_LOOKS) expect(['animated-slides', 'editorial', 'bright']).toContain(l.kitLook)
    expect(filmStyleForCard(filmCardId('night'))).toEqual({ videoStyle: 'kit', kitLook: 'animated-slides', filmLook: 'night' })
    expect(filmStyleForCard('slides')).toBeNull()
    expect(filmLookForCard('film-nope')).toBeNull()
    expect(isFilmLookId('heritage')).toBe(true)
    expect(isFilmLookId('<script>')).toBe(false)
  })
  it('a saved draft keeps its film look; an old kit draft draws as its film twin; Your look derives its own', () => {
    expect(filmLookForDraft({ filmLook: 'luxury', kitLook: 'animated-slides' })).toBe('luxury')
    expect(filmLookForDraft({ kitLook: 'editorial' })).toBe('editorial')
    expect(filmLookForDraft({ kitLook: 'bright' })).toBe('bright')
    expect(filmLookForDraft({ kitLook: 'custom' })).toBeNull()
    expect(filmLookForDraft({ filmLook: 'bogus', kitLook: 'brand' })).toBeNull()
  })
})

describe('step 3', () => {
  it('shows the twelve film looks (plus Your look, Drawn slides, Walk-through) instead of the kit three', () => {
    const cards = lookCards('video', { kit: true, film: true, yourLook: { colors: { bg: '#000000', glow: '#111111', accent: '#ffcc00', text: '#ffffff' } } })
    const ids = cards.map((c) => c.id)
    for (const id of FILM_LOOK_IDS) expect(ids).toContain(filmCardId(id))
    expect(ids).toContain('custom')
    expect(ids).toContain('drawn')
    expect(ids).toContain('walkthrough')
    expect(ids).not.toContain('slides')
    expect(ids).not.toContain('explainer')
    expect(cards.find((c) => c.id === 'film-night')!.samples).toEqual(['/style-samples/film-night-cover.png', '/style-samples/film-night-data.png', '/style-samples/film-night-closing.png'])
  })
  it('with the film engine off, the cards are exactly as before', () => {
    expect(lookCards('video', { kit: true }).map((c) => c.id)).toEqual(lookCards('video', { kit: true, film: false }).map((c) => c.id))
    expect(lookCards('video', { kit: true }).some((c) => c.id.startsWith('film-'))).toBe(false)
  })
  it('saves the film look with the kit look, and sends it to make the video', () => {
    const src = read('app/(dashboard)/create/_components/steps/LookVoiceReview.tsx')
    expect(src).toContain('...(filmOn ? { filmLook: filmLook ?? null } : {})')
    expect(src).toContain('...(filmLook ? { filmLook } : {})')
  })
  it('the draft keeps only a real film look', () => {
    expect(read('app/api/videos/draft/route.ts')).toContain("if ('filmLook' in u && !isFilmLookId(u.filmLook)) u.filmLook = null")
    expect(read('app/api/videos/draft/duplicate/copy-draft.ts')).toContain("'filmLook'")
  })
})

describe('the free preview', () => {
  it('draws a film look with the real composition', () => {
    expect(VIDEO_PREVIEW_LOOKS).toContain('film:night')
    expect(stillEngineFor('video', 'film:heritage')).toBe('kit')
    const server = read('app/_lib/first-scene-preview-server.ts')
    expect(server).toContain("if (filmId) { plan.engine = 'film'; plan.filmTheme = filmId }")
  })
})

describe('the route', () => {
  const route = read('app/api/generate-video/route.ts')
  it('decides the film engine before the explainer, and skips the explainer for it', () => {
    const film = route.indexOf("const filmOn = videoStyle === 'kit' && await filmEngineFor(user.id)")
    expect(film).toBeGreaterThan(route.indexOf('const deducted = await deductCredits('))
    expect(film).toBeLessThan(route.indexOf('if (!isDrawn && !filmOn && await explainerEngineFor(user.id)) {'))
  })
  it('marks the kit plan for the film engine, with the picked look', () => {
    const at = route.indexOf('if (filmOn) {\n            kitPlan.engine = \'film\'')
    expect(at).toBeGreaterThan(route.indexOf('const kitPlan = assembleKitPlan('))
    expect(at).toBeLessThan(route.indexOf('const kitPayload = {'))
    expect(route).toContain('if (filmLook) kitPlan.filmTheme = filmLook')
  })
})

describe('the video', () => {
  it('KitVideo draws a film plan with the film engine, keeping the voice and music, almost no sound effects', () => {
    const kv = read('remotion/src/kit/KitVideo.tsx')
    const at = kv.indexOf("if (plan.engine === 'film') {")
    expect(at).toBeGreaterThan(0)
    const block = kv.slice(at, kv.indexOf('return (\n    <KitThemeProvider', at))
    expect(block).toContain('<FilmView plan={{ ...plan, look }} tl={tl} />')
    expect(block).toContain('<Audio src={staticFile(s.vo)} />')
    expect(block).toContain('<MusicBed')
    expect(block).not.toContain('whoosh')
  })
  it('film images go through the asset base (Lambda), and no gradient-clipped text', () => {
    for (const f of ['remotion/src/film/kitscenes.tsx', 'remotion/src/film/core.tsx']) {
      const src = read(f)
      expect(src).not.toMatch(/staticFile[^\n]*from 'remotion'/)
      expect(src).not.toMatch(/backgroundClip: 'text'|WebkitBackgroundClip/)
    }
  })
})
