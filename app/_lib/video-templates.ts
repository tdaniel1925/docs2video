/* ============================================================================
 * THE TEMPLATES — eight fixed designs a video can be made in (owner,
 * 2026-10-18: "great templates users can choose from … pixel perfect every
 * time"). Each is built in code in the shared deck engine (One Dollar Decks
 * lib/code-deck/templates) and filmed on its render worker: Claude only picks
 * each scene's layout and writes its words; the cover and closing are built
 * from the chosen brand alone; every page is fitted and checked before it is
 * filmed, and a page that cannot pass stops the video (refunded).
 *
 * Pure data, safe in the browser. The scene pictures are the engine's own
 * renders of made-up sample words (Jordan Avery of Avery & Co.), in
 * public/templates/<id>/.
 * ==========================================================================*/

export const VIDEO_TEMPLATE_IDS = ['night', 'luxury', 'editorial', 'magazine', 'lifestyle', 'swiss', 'grunge', 'newsweekly'] as const
export type VideoTemplateId = typeof VIDEO_TEMPLATE_IDS[number]
export const isVideoTemplate = (v: unknown): v is VideoTemplateId => typeof v === 'string' && (VIDEO_TEMPLATE_IDS as readonly string[]).includes(v)

export type VideoTemplate = {
  id: VideoTemplateId
  name: string
  /** Three words under the name. */
  tagline: string
  /** Its four sample scenes: the cover, a big number, a cards scene, the closing. */
  scenes: { src: string; label: string }[]
}

const scenes = (id: string) => [
  { src: `/templates/${id}/cover.jpg`, label: 'Cover' },
  { src: `/templates/${id}/number.jpg`, label: 'A key figure' },
  { src: `/templates/${id}/cards.jpg`, label: 'Side by side' },
  { src: `/templates/${id}/closing.jpg`, label: 'Closing' },
]

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  { id: 'night', name: 'Cinematic Night', tagline: 'Night city, amber', scenes: scenes('night') },
  { id: 'luxury', name: 'Luxury Gold', tagline: 'Marble and gold', scenes: scenes('luxury') },
  { id: 'editorial', name: 'Warm Editorial', tagline: 'Linen and olive', scenes: scenes('editorial') },
  { id: 'magazine', name: 'Bold Magazine', tagline: 'Loud colour blocks', scenes: scenes('magazine') },
  { id: 'lifestyle', name: 'Lifestyle', tagline: 'Real-life photos', scenes: scenes('lifestyle') },
  { id: 'swiss', name: 'Swiss Corporate', tagline: 'Clean grid, cobalt', scenes: scenes('swiss') },
  { id: 'grunge', name: 'Grunge', tagline: 'Concrete and tape', scenes: scenes('grunge') },
  { id: 'newsweekly', name: 'Newsweekly Cover', tagline: 'Red-frame magazine', scenes: scenes('newsweekly') },
]

export const videoTemplate = (id: unknown): VideoTemplate | null => VIDEO_TEMPLATES.find((t) => t.id === id) ?? null

/** The template a new video starts on, when nothing was chosen before. */
export const DEFAULT_VIDEO_TEMPLATE: VideoTemplateId = 'night'

/**
 * A TEMPLATE'S COLORS (owner, 2026-10-18: "templates need to be able to change
 * to brand colors"): its own, or the chosen brand's — main, second and accent
 * color, made readable on every page by the engine's rules
 * (app/_lib/template-palette.ts, a copy of the engine's). The template's own
 * colors by default.
 */
export type TemplateColors = 'template' | 'brand'
export const isTemplateColors = (v: unknown): v is TemplateColors => v === 'template' || v === 'brand'

/** The colors a brand gives a template: its main, second and accent color, valid hex only. Never the account's. */
export function brandTemplatePalette(brand: { primary_color?: string | null; secondary_color?: string | null; accent_color?: string | null } | null | undefined): string[] {
  return [brand?.primary_color, brand?.secondary_color, brand?.accent_color].filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim())).map((c) => c.trim())
}
