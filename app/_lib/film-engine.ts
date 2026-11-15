import { isAdminDB } from './admin'

/*
 * THE FILM ENGINE (docs/FILM-ENGINE-PLAN.md): a second way of drawing a scene-kit plan — a 3D camera, depth and
 * light, the twelve film looks. Same planner, voice, music, pricing and render service as the kit; the plan just
 * carries `engine: 'film'` and KitVideo draws it with remotion/src/film.
 *
 * WHO GETS IT (FILM_ENGINE):
 *   off (or unset)  nobody
 *   admins          admins only, while it is proved on real documents
 *   on              everyone
 * When it is on for a user, their kit videos are drawn by the film engine and the explainer engine is not used
 * for them (generate-video).
 */
export type FilmMode = 'off' | 'admins' | 'on'
export const filmMode = (): FilmMode => {
  const v = String(process.env.FILM_ENGINE || '').toLowerCase()
  return v === 'on' || v === 'admins' ? v : 'off'
}
export async function filmEngineFor(userId: string | null | undefined): Promise<boolean> {
  const mode = filmMode()
  if (mode === 'on') return true
  if (mode === 'admins' && userId) return isAdminDB(userId).catch(() => false)
  return false
}
