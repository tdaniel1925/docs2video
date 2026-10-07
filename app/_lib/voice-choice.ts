/**
 * WHICH VOICE SPEAKS — one rule for every narrated look.
 *
 * The wizard offers six voices, all OpenAI ids: nova = Sarah (the female
 * default, CLAUDE.md rule 5) plus shimmer / onyx / echo / alloy / fable.
 * ElevenLabs only has ONE voice set up here (Rachel, also female), so:
 *  - Sarah, or nothing chosen: ElevenLabs first (the better voice), OpenAI
 *    Sarah if ElevenLabs refuses.
 *  - any OTHER voice: that OpenAI voice speaks, so a customer who picked
 *    "James" hears James. ElevenLabs only steps in if OpenAI fails, because
 *    some voice beats a silent video.
 *
 * This is the same rule the Slide Deck look has used since audit H2
 * (render-service/slides.js wantsChosenVoice). The render service can't import
 * from app/, so server.js uses the slides.js copy — keep the two in step.
 * No imports, so the browser-side preview code can use it too.
 */
export const OPENAI_VOICES = ['nova', 'shimmer', 'onyx', 'echo', 'alloy', 'fable'] as const
export type OpenAIVoice = (typeof OPENAI_VOICES)[number]

/** A known voice id, or Sarah (nova) when it's missing or unknown. */
export function normalizeVoice(voiceId: unknown): OpenAIVoice {
  return typeof voiceId === 'string' && (OPENAI_VOICES as readonly string[]).includes(voiceId) ? (voiceId as OpenAIVoice) : 'nova'
}

/** True when the customer picked a voice other than the default Sarah. */
export function wantsChosenVoice(voiceId: unknown): boolean {
  return normalizeVoice(voiceId) !== 'nova'
}

/** Which voice service to try first, then second. */
export function ttsOrder(voiceId: unknown): ['openai', 'elevenlabs'] | ['elevenlabs', 'openai'] {
  return wantsChosenVoice(voiceId) ? ['openai', 'elevenlabs'] : ['elevenlabs', 'openai']
}
