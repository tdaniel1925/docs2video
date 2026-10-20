import { normalizeVoice } from './voice-choice'
import { falSpeak, elevenDirectSpeak } from './fal-tts'
import { silenceMp3 } from './silence'

const TTS_MAX_CHARS = 4096

// Voice engine order (2026-10-19, "move everything to fal"): fal.ai FIRST
// (fal-tts.ts — ElevenLabs voices, the customer's pick mapped by
// FAL_VOICE_MAP), then ElevenLabs direct in the SAME picked voice
// (elevenDirectSpeak). OpenAI TTS is gone: its account ran out of credits, and
// both remaining engines speak the voice the customer chose.


/**
 * Normalize text so TTS SPEAKS symbols instead of mangling them — ElevenLabs
 * reads a literal "$176,204" badly. Convert money/percent before synthesis.
 */
export function speakable(text: string): string {
  if (!text) return text
  let t = String(text)
  // Pipe separators (contact globs like "555 | a@b.com | site.com") → commas.
  t = t.replace(/\s*\|\s*/g, ', ')
  // Emails → "name at domain dot tld" (before URL handling — emails contain domains).
  t = t.replace(/\b([a-z0-9._%+-]+)@([a-z0-9.-]+)\.([a-z]{2,})\b/gi, (_m, u: string, d: string, tld: string) =>
    `${u.replace(/\./g, ' dot ')} at ${d.replace(/\./g, ' dot ')} dot ${tld}`)
  // Bare domains/URLs → "domain dot tld" (common TLDs only, so normal sentences
  // with periods are never touched).
  // A link's path and query are never read out ("wolfe dot com slash plans
  // question mark id equals 7") — only where to go.
  t = t.replace(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|ai|co|app|us|info|biz))\b(?:\/[^\s,;)]*[^\s,;).!?])?\/?/gi,
    (_m, dom: string) => dom.replace(/\./g, ' dot '))
  // Phone numbers → digit groups spoken one at a time ("9 3 6, 6 4 1, 7 1 3 0").
  t = t.replace(/(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g, (_m, a: string, b: string, c: string) =>
    `${a.split('').join(' ')}, ${b.split('').join(' ')}, ${c.split('').join(' ')}`)
  t = t.replace(/\$\s?([\d,]+(?:\.\d+)?)\s?(k|m|b|thousand|million|billion)?/gi, (_m, num: string, unit?: string) => {
    const n = num.replace(/,/g, '')
    const u = (unit || '').toLowerCase()
    const word = u === 'k' || u === 'thousand' ? ' thousand'
      : u === 'm' || u === 'million' ? ' million'
      : u === 'b' || u === 'billion' ? ' billion' : ''
    return `${n}${word} dollars`
  })
  t = t.replace(/(\d(?:[\d,.]*\d)?)\s?%/g, '$1 percent')
  t = t.replace(/\$/g, ' dollars ')
  // READ THE WAY A PERSON SAYS IT (edge-case review, 2026-10-18).
  // Retirement accounts by their spoken names: "401(k)" → "four oh one k".
  t = t.replace(/\b(401|403|457)\s?\(([kb])\)/gi, (_m, n: string, l: string) => `${{ '401': 'four oh one', '403': 'four oh three', '457': 'four fifty-seven' }[n]} ${l.toLowerCase()}`)
  // "per" for rates: "$12.50/mo" → "12.50 dollars per month".
  t = t.replace(/\s?\/\s?(mo|mos|month)\b/gi, ' per month').replace(/\s?\/\s?(yr|year|annum)\b/gi, ' per year').replace(/\s?\/\s?(wk|week)\b/gi, ' per week').replace(/\s?\/\s?(day|hr|hour)\b/gi, (_m, u: string) => ` per ${u.toLowerCase() === 'hr' ? 'hour' : u.toLowerCase()}`)
  // Bare magnitudes: "1.5M" → "1.5 million" (capitals only — "5m" may be meters).
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?(MM|M|B|K)\b(?![a-z])/g, (_m, n: string, u: string) => `${n} ${u === 'K' ? 'thousand' : u === 'B' ? 'billion' : 'million'}`)
  // About: "~20 percent" → "about 20 percent".
  t = t.replace(/~\s?(?=\d)/g, 'about ')
  // Ranges: "3-5 years" → "3 to 5 years", "100 dollars-200 dollars" → "… to …".
  // Never a date ("2026-01-05") or anything longer: no hyphen or digit either side.
  t = t.replace(/(?<![\d\-–])(\d{1,4}(?:\.\d+)?)\s?[-–—]\s?(\d{1,4}(?:\.\d+)?)(?![\d\-–])/g, '$1 to $2')
  t = t.replace(/\b(dollars|percent)\s?[-–—]\s?(?=\d)/gi, '$1 to ')
  // Units after a number.
  const UNIT: Record<string, [string, string]> = { lb: ['pound', 'pounds'], lbs: ['pound', 'pounds'], oz: ['ounce', 'ounces'], ft: ['foot', 'feet'], 'sq ft': ['square foot', 'square feet'], 'sq. ft': ['square foot', 'square feet'], hr: ['hour', 'hours'], hrs: ['hour', 'hours'], yr: ['year', 'years'], yrs: ['year', 'years'], mos: ['month', 'months'] }
  t = t.replace(/\b(\d+(?:\.\d+)?)\s?(sq\.? ft|lbs?|oz|ft|hrs?|yrs?|mos)\b(?=\s|$|[.,;:!?])/gi, (_m, n: string, u: string) => {
    const w = UNIT[u.toLowerCase()]
    return w ? `${n} ${n === '1' ? w[0] : w[1]}` : _m
  })
  // Ensure a space after an injected "dollars"/"percent" when the source ran the
  // next token right up against the number ("$X at" → "...dollars at", not
  // "dollarsat"; "$X&" → "dollars &"). Do this BEFORE the & → "and" rewrite.
  t = t.replace(/\b(dollars|percent)(?=[^\s.,!?])/gi, '$1 ')
  t = t.replace(/\s?&\s?/g, ' and ')
  t = t.replace(/\s+/g, ' ').trim()
  // Trailing punctuation so the engine doesn't clip the last word.
  if (t && !/[.!?]$/.test(t)) t += '.'
  return t
}

export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  options: { strict?: boolean } = {}
): Promise<Buffer> {
  // Guard against empty/whitespace narration
  if (!text?.trim()) {
    console.log('[tts] Empty narration text, generating brief silence')
    return generateBriefSilence()
  }

  const strict = options.strict ?? process.env.STRICT_MODE === 'true'

  if (text.length > TTS_MAX_CHARS) {
    if (strict) {
      throw new Error(
        `TTS text exceeds ${TTS_MAX_CHARS} char limit (${text.length} chars). Split into multiple scenes before calling synthesizeSpeech.`
      )
    }
    // Non-strict: split at sentence boundary, synthesize each chunk, concatenate
    return await synthesizeLongText(text, voiceId)
  }

  // Normalize money/percent/symbols + add a trailing pause so any engine speaks
  // it correctly and doesn't clip the last word.
  text = speakable(text)

  const voice = normalizeVoice(voiceId)
  let lastError: Error | null = null
  // PRIMARY (2026-10-09): fal.ai — the same ElevenLabs voices, in the voice the
  // customer picked (fal-tts.ts FAL_VOICE_MAP). Retries + a real-audio check
  // live in falSpeak; any failure drops to the old chain below.
  if (process.env.FAL_KEY) {
    try {
      return (await falSpeak(text, { voiceId: voice })).audio
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[tts] fal voice failed (${lastError.message}) — trying ElevenLabs direct`)
    }
  }
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      return await elevenDirectSpeak(text, { voiceId: voice })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`[tts] ElevenLabs voice "${voice}" failed (${lastError.message})`)
    }
  }

  // Both providers failed — throw instead of silently substituting silence.
  throw new Error(`TTS failed (fal + ElevenLabs). Last error: ${lastError?.message || 'Unknown error'}`)
}

async function synthesizeLongText(text: string, voiceId: string): Promise<Buffer> {
  const chunks = splitAtSentenceBoundary(text, TTS_MAX_CHARS - 100)
  console.log(`[tts] Long text (${text.length} chars) split into ${chunks.length} chunks`)
  const buffers: Buffer[] = []
  for (const chunk of chunks) {
    const buf = await synthesizeSpeech(chunk, voiceId, { strict: false })
    buffers.push(buf)
  }
  return Buffer.concat(buffers)
}

export function splitAtSentenceBoundary(text: string, maxLen: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen) {
      if (current) chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

/**
 * Brief silence for intentionally empty narration scenes — half a second of a
 * real silent mp3 (silence.ts). NOT used as an error fallback — TTS errors
 * should propagate.
 */
async function generateBriefSilence(): Promise<Buffer> {
  return silenceMp3()
}

export async function synthesizeAllScenes(
  scenes: Array<{ narration: string }>,
  voiceId: string
): Promise<Buffer[]> {
  const buffers: Buffer[] = []
  const failures: { sceneIndex: number; error: string }[] = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    try {
      if (!scene.narration?.trim()) {
        // Intentionally empty narration — brief silence
        buffers.push(silenceMp3())
        continue
      }
      const buf = await synthesizeSpeech(scene.narration, voiceId)
      buffers.push(buf)
    } catch (err: any) {
      failures.push({ sceneIndex: i + 1, error: err.message })
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `TTS synthesis failed for ${failures.length} scene(s): ${failures.map(f => `Scene ${f.sceneIndex}: ${f.error}`).join('; ')}`
    )
  }

  return buffers
}
