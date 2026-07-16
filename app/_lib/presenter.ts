// Presenter / Profile helpers — the personalization layer.
//
// A "profile" is a brands row that is either a COMPANY (the classic brand) or a
// PERSON (a presenter with name, role, photo, and a spoken intro line). This file
// derives the runtime `Presenter` passed into the render payloads and decides
// WHERE a presenter photo appears, which depends on the chosen video style.

import type { Brand } from './types'

export type VideoStyle = 'slides' | 'cinematic' | 'editorial' | 'classic' | 'infographic'
export type PhotoPlacementPref = 'auto' | 'cover' | 'closing' | 'both' | 'none'

/** The runtime presenter handed to payload builders + renderers. */
export type Presenter = {
  name?: string
  role?: string
  /** Photo URL (resolved to a local filename on the VPS before rendering). */
  photo?: string
  /** Spoken intro line for the opening, written by the user. */
  intro?: string
}

/** Resolved decision: should the photo render on the cover and/or the closing. */
export type PhotoPlacement = { cover: boolean; closing: boolean }

/**
 * Decide where the presenter photo appears.
 *
 * `auto` defers to the style — each style has a sensible default so identity
 * feels designed-in rather than bolted-on:
 *   - cinematic : framed inset on the cover + circular headshot on the closing card
 *   - editorial : bordered Figure beside the masthead + portrait on the closing page
 *   - classic / : keep data-led covers clean — photo only on the closing contact card
 *     infographic
 * An explicit preference (cover/closing/both/none) always overrides `auto`.
 */
export function resolvePhotoPlacement(
  style: VideoStyle | string | undefined,
  pref: PhotoPlacementPref | undefined,
): PhotoPlacement {
  const p = pref || 'auto'
  if (p === 'none') return { cover: false, closing: false }
  if (p === 'cover') return { cover: true, closing: false }
  if (p === 'closing') return { cover: false, closing: true }
  if (p === 'both') return { cover: true, closing: true }
  // auto → by style. A personalized explainer (slides) is often sent to a NAMED
  // client, so the agent's face belongs on the cover next to the client's name —
  // cover + closing, same as cinematic/editorial. Only the data-led classic /
  // infographic covers stay photo-free.
  switch (style) {
    case 'cinematic':
    case 'editorial':
    case 'slides':
      return { cover: true, closing: true }
    case 'classic':
    case 'infographic':
    default:
      return { cover: false, closing: true }
  }
}

/** True when the profile represents a person (a presenter), not a company. */
export function isPersonProfile(brand: Brand | null | undefined): boolean {
  return brand?.profile_type === 'person'
}

/**
 * Build the runtime Presenter from a profile + per-video options. Returns null
 * when there's nothing personal to show (company profile, or person opted out).
 */
export function buildPresenter(
  brand: Brand | null | undefined,
  opts?: { intro?: string; introduceInOpening?: boolean },
): Presenter | null {
  if (!isPersonProfile(brand) || !brand) return null
  const intro = opts?.introduceInOpening === false
    ? undefined
    : (opts?.intro?.trim() || brand.intro_line || undefined)
  const presenter: Presenter = {
    name: brand.name || undefined,
    role: brand.person_role || undefined,
    photo: brand.photo_url || undefined,
    intro,
  }
  // Nothing useful → no presenter.
  if (!presenter.name && !presenter.photo && !presenter.intro) return null
  return presenter
}

/**
 * The on-screen brand/masthead name. For a PERSON, only use their name when
 * `show_name_on_slides` is on; otherwise return null so the document title leads
 * the cover. For a COMPANY, always use the brand name.
 */
export function resolveDisplayName(brand: Brand | null | undefined): string | null {
  if (!brand) return null
  if (brand.profile_type === 'person') {
    return brand.show_name_on_slides === false ? null : (brand.name || null)
  }
  return brand.name || null
}

/** Should the company logo render? Person profiles never use a logo (they use a photo). */
export function shouldShowLogo(brand: Brand | null | undefined): boolean {
  if (!brand) return false
  if (brand.profile_type === 'person') return false
  return brand.show_logo !== false
}
