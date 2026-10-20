/**
 * WHICH VOICE SPEAKS — one rule for every narrated look.
 *
 * The wizard offers six voices. Their ids are OpenAI's names, kept for history
 * (saved drafts and API callers send them): nova = Sarah (the female default,
 * CLAUDE.md rule 5) plus shimmer / onyx / echo / alloy / fable.
 *
 * Since 2026-10-19 OpenAI speaks none of them. Every voice is an ElevenLabs
 * voice (fal-tts.ts FAL_VOICE_MAP), spoken by fal.ai first and ElevenLabs
 * direct if fal fails — so the customer always hears the voice they picked.
 * No imports, so the browser-side preview code can use it too.
 */
export const OPENAI_VOICES = ['nova', 'shimmer', 'onyx', 'echo', 'alloy', 'fable'] as const
export type OpenAIVoice = (typeof OPENAI_VOICES)[number]

/** A known voice id, or Sarah (nova) when it's missing or unknown. */
export function normalizeVoice(voiceId: unknown): OpenAIVoice {
  return typeof voiceId === 'string' && (OPENAI_VOICES as readonly string[]).includes(voiceId) ? (voiceId as OpenAIVoice) : 'nova'
}
