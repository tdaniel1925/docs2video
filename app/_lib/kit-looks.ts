// Pure data shared by the browser (step 3) and the server (generate-video,
// the free preview): which step-3 look card becomes which scene-kit look when
// KIT_ENGINE is on. No imports, safe anywhere.

export type KitLookId = 'animated-slides' | 'editorial' | 'bright' | 'brand' | 'custom'

/** Step-3 card → kit look. Cards not listed (Drawn slides) keep their own engine. */
export const KIT_LOOK_FOR_CARD: Record<string, KitLookId> = { slides: 'animated-slides', editorial: 'editorial', explainer: 'bright', custom: 'custom' }

/** Kit look → the card shown as picked when a kit draft is reopened. */
export const CARD_FOR_KIT_LOOK: Record<string, string> = { 'animated-slides': 'slides', editorial: 'editorial', bright: 'explainer', brand: 'slides', custom: 'custom' }

/** Looks retired from step 3 while the kit engine is on (old videos still render). */
export const RETIRED_WITH_KIT = ['aurora', 'cinematic', 'infographic'] as const

/** What step 3 saves for a card: { videoStyle, kitLook } (kitLook only for kit). */
export function styleForCard(card: string, kitOn: boolean): { videoStyle: string; kitLook?: KitLookId } {
  const k = kitOn ? KIT_LOOK_FOR_CARD[card] : undefined
  return k ? { videoStyle: 'kit', kitLook: k } : { videoStyle: card }
}

/** The card to show picked for a saved draft. */
export function cardForDraft(videoStyle: unknown, kitLook: unknown): string | null {
  if (videoStyle === 'kit') return CARD_FOR_KIT_LOOK[String(kitLook)] ?? 'slides'
  return typeof videoStyle === 'string' ? videoStyle : null
}

/** The look id the free preview is asked for ("kit:bright", or the card id). */
export function previewLookFor(card: string, kitOn: boolean): string {
  const k = kitOn ? KIT_LOOK_FOR_CARD[card] : undefined
  return k ? `kit:${k}` : card
}
