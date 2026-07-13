/**
 * WORD-TIMED TTS — the backbone of "bullets that reveal in sync with the voice."
 *
 * ElevenLabs' /with-timestamps endpoint returns the exact audio PLUS a
 * character-level alignment (per-character start/end seconds) for THAT audio. We
 * collapse those characters into WORDS, then the Director can ask: "at what
 * second does the phrase 'SEC filings' begin?" — and the renderer reveals the
 * matching bullet / lights its highlight at exactly that frame. No guessing.
 *
 * Exports:
 *   ttsTimed(text, mp3File) -> { words:[{w,start,end}], durationSec }
 *   cueFrame(words, phrase) -> second the phrase first starts (or null)
 */
import { writeFileSync } from 'fs'
import { join } from 'path'

const PUB = join(__dirname, '..', '..', 'remotion', 'public')

export type TimedWord = { w: string; start: number; end: number }
export type TimedVO = { words: TimedWord[]; durationSec: number }

// Collapse ElevenLabs char alignment → word alignment. The API gives parallel
// arrays: characters[], character_start_times_seconds[], character_end_times_seconds[].
function charsToWords(chars: string[], starts: number[], ends: number[]): TimedWord[] {
  const words: TimedWord[] = []
  let cur = '', s = -1, e = 0
  const flush = () => { if (cur.trim()) words.push({ w: cur.trim(), start: s < 0 ? e : s, end: e }); cur = ''; s = -1 }
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (/\s/.test(c)) { flush(); e = ends[i] ?? e; continue }
    if (s < 0) s = starts[i] ?? e
    cur += c; e = ends[i] ?? e
  }
  flush()
  return words
}

// ---- PRONUNCIATION: rewrite tokens the TTS voice mangles into a phonetic form
// it reads correctly. Applied ONLY to the audio input; cue-matching stays fuzzy
// so the original phrasing still resolves. Domain dictionary + generic rules
// (all-caps initialisms → spaced letters). Fixes "Reg FD" → "rej d".
const PRON: Record<string, string> = {
  'Reg FD': 'Regulation F D', 'Reg-FD': 'Regulation F D', 'RegFD': 'Regulation F D',
  'Reg D': 'Regulation D', 'Reg A': 'Regulation A', 'Reg SHO': 'Regulation S H O',
  '13F': 'thirteen F', '10-K': 'ten K', '10-Q': 'ten Q', '8-K': 'eight K',
  'IUL': 'I U L', 'IR': 'I R', 'CRM': 'C R M', 'SEC': 'S E C', 'IPO': 'I P O',
  'CEO': 'C E O', 'CFO': 'C F O', 'ETF': 'E T F', 'API': 'A P I', 'ROI': 'R O I',
  'FAQ': 'F A Q', 'AI': 'A I', 'IR CRM': 'I R, C R M',
}
// spell a plain integer (no separators) into English words so the voice always
// says large amounts correctly (ElevenLabs mangles some comma-grouped numbers).
function spellInteger(n: number): string {
  if (n === 0) return 'zero'
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  const under1000 = (x: number): string => {
    let s = ''
    if (x >= 100) { s += ones[Math.floor(x / 100)] + ' hundred'; x %= 100; if (x) s += ' ' }
    if (x >= 20) { s += tens[Math.floor(x / 10)]; x %= 10; if (x) s += '-' + ones[x] }
    else if (x > 0) s += ones[x]
    return s
  }
  const scales = [['', 1], ['thousand', 1e3], ['million', 1e6], ['billion', 1e9]] as [string, number][]
  let words: string[] = []
  for (let i = scales.length - 1; i >= 0; i--) {
    const [name, val] = scales[i]
    if (n >= val) { const chunk = Math.floor(n / val); n %= val; words.push(under1000(chunk) + (name ? ' ' + name : '')) }
  }
  return words.join(' ').replace(/\s+/g, ' ').trim()
}

// ---- NUMBER normalization for natural speech. Fixes: "7.0%"→"seven percent"
// (not "seven point zero"), "$824,500"→spelled dollars (not mangled digits),
// "401(k)"→"four oh one k", and stray trailing .0 decimals. ----
export function speakableNumbers(text: string): string {
  let t = text
  // 401(k) / 403(b) etc → spoken form
  t = t.replace(/\b401\s*\(?k\)?/gi, 'four oh one k').replace(/\b403\s*\(?b\)?/gi, 'four oh three b')
  // DOLLAR amounts: $1,234,567(.89)? → spelled words + "dollars" (+ "and N cents")
  t = t.replace(/\$\s?(\d{1,3}(?:,\d{3})+|\d{4,})(\.\d{1,2})?/g, (_m, intPart: string, dec?: string) => {
    const n = parseInt(intPart.replace(/,/g, ''), 10)
    let out = spellInteger(n) + ' dollars'
    if (dec && parseInt(dec.slice(1), 10) > 0) out += ' and ' + spellInteger(parseInt(dec.slice(1).padEnd(2, '0'), 10)) + ' cents'
    return out
  })
  // small dollar amounts ($9, $49) → "N dollars"
  t = t.replace(/\$\s?(\d{1,3})\b/g, (_m, d: string) => `${spellInteger(parseInt(d, 10))} dollars`)
  // PERCENT with pointless trailing zeros: 7.0% → 7%, 6.00% → 6%; keep 9.5%.
  t = t.replace(/(\d+)\.0+(%|\s*percent)/gi, '$1$2')
  // any remaining "N.0" whole-number decimal (7.0 years) → "N"
  t = t.replace(/\b(\d+)\.0+\b/g, '$1')
  return t
}

export function speakable(text: string): string {
  let t = text
  // apply longest keys first so "Reg FD" wins over "Reg"
  for (const k of Object.keys(PRON).sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'g'), PRON[k])
  }
  // generic: any remaining ALL-CAPS initialism of 2-5 letters → spaced letters
  t = t.replace(/\b([A-Z]{2,5})\b/g, (m) => m.split('').join(' '))
  // numbers/figures spoken naturally
  t = speakableNumbers(t)
  return t
}

export async function ttsTimed(text: string, mp3File: string): Promise<TimedVO> {
  const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ text: speakable(text), model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j: any = await res.json()
  writeFileSync(join(PUB, mp3File), Buffer.from(j.audio_base64, 'base64'))
  const a = j.alignment || j.normalized_alignment || {}
  const chars: string[] = a.characters || []
  const starts: number[] = a.character_start_times_seconds || []
  const ends: number[] = a.character_end_times_seconds || []
  const words = charsToWords(chars, starts, ends)
  const durationSec = words.length ? words[words.length - 1].end : 0
  return { words, durationSec }
}

// Normalize a token for fuzzy matching (lowercase, strip punctuation).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9$%]/g, '')

/**
 * cueSec — the second at which `phrase` first begins in the spoken VO. Matches
 * the phrase's first meaningful word against the word timeline (fuzzy, so
 * "$399/mo" vs "399" still lines up). Returns null if not found.
 */
export function cueSec(words: TimedWord[], phrase: string): number | null {
  if (!phrase) return null
  // normalize the cue the SAME way the spoken text was, so a cue like "$824,500"
  // becomes "eight hundred twenty-four thousand..." and matches the actual words
  // the voice said (the timestamps come from the normalized/spoken text).
  const target = speakableNumbers(phrase).split(/\s+/).map(norm).filter(Boolean)
  if (!target.length) return null
  const wn = words.map((w) => norm(w.w))
  // try to match the full phrase as a contiguous run; fall back to first word
  for (let i = 0; i < words.length; i++) {
    let ok = true
    for (let k = 0; k < target.length && i + k < words.length; k++) {
      if (!wn[i + k].includes(target[k]) && !target[k].includes(wn[i + k])) { ok = false; break }
    }
    if (ok) return words[i].start
  }
  const first = target[0]
  const hit = words.findIndex((_, i) => wn[i].includes(first) || first.includes(wn[i]))
  return hit >= 0 ? words[hit].start : null
}
