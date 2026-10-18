/* ============================================================================
 * WHO IS SPEAKING — the narration's point of view, on every path.
 *
 * The bug (owner, 2026-10-18): a video for the presenter Darrell Wolfe opened
 * "…thank you for letting Darrell Wolfe share this summary with you. Hello,
 * I'm Darrell Wolfe…" — in a FEMALE AI voice. "The voice is not the person —
 * it is a presentation for the person."
 *
 * THE RULE
 *  - By default the AI narrator speaks ON BEHALF of the presenter, in the
 *    third person ("Darrell asked me to walk you through…"). It never says
 *    "I'm <presenter>", "my name is <presenter>" or "this is <presenter>".
 *  - First person ("Hi, I'm Darrell") only when the presenter chose
 *    "Speak as me" AND the chosen voice matches the voice they said fits them.
 *    Anything less falls back to the third person.
 *  - Every narration that leaves for a voice passes repairNarration(): a
 *    deterministic check that rewrites a self-introduction, a "my/I've"
 *    claim in the presenter's own intro line, and a second greeting.
 *
 * No imports: the browser (the opener step's warning) uses it too.
 * KEEP IN SYNC with render-service/slides.js ("WHO IS SPEAKING").
 * ==========================================================================*/

export type VoiceGender = 'female' | 'male' | 'neutral'
/** What the presenter said a voice speaking as them should sound like. */
export type PresenterVoice = 'female' | 'male'
export type SpeakAs = 'for' | 'as'
export type NarratorMode = 'for' | 'as'

/** The six voices (app/_lib/types.ts VOICE_OPTIONS) by how they sound. Unknown → nova (Sarah). */
export const VOICE_GENDER: Record<string, VoiceGender> = {
  nova: 'female', shimmer: 'female', onyx: 'male', echo: 'male', alloy: 'neutral', fable: 'male',
}
export const voiceGenderOf = (voiceId: unknown): VoiceGender =>
  (typeof voiceId === 'string' && VOICE_GENDER[voiceId]) || VOICE_GENDER.nova

/**
 * FIRST PERSON IS EARNED. "as" only when the presenter asked for it, said
 * which voice fits them, and that is the voice chosen; else "for".
 */
export function narratorMode(o: { speakAs?: SpeakAs | null; presenterVoice?: PresenterVoice | null; voiceId?: unknown; hasPresenter: boolean }): NarratorMode {
  if (!o.hasPresenter || o.speakAs !== 'as' || !o.presenterVoice) return 'for'
  return voiceGenderOf(o.voiceId) === o.presenterVoice ? 'as' : 'for'
}

/**
 * The opener step's warning, or null. Said when "Speak as me" cannot hold
 * (no voice said, or a voice that doesn't match), and when a first-person
 * intro will be said by a voice that is plainly not theirs.
 */
export function voiceNote(o: { presenterName?: string | null; speakAs?: SpeakAs | null; presenterVoice?: PresenterVoice | null; voiceId?: unknown; intro?: string | null }): string | null {
  const name = (o.presenterName || '').trim() || 'you'
  const voice = voiceGenderOf(o.voiceId)
  if (o.speakAs === 'as') {
    if (!o.presenterVoice) return `Say which voice fits ${name} — until then the narrator speaks on ${name === 'you' ? 'your' : `${name}’s`} behalf, not as ${name === 'you' ? 'you' : 'them'}.`
    if (voice !== o.presenterVoice) return `The voice you picked is ${voice === 'neutral' ? 'a neutral voice' : `a ${voice} voice`}, so it will speak on ${name === 'you' ? 'your' : `${name}’s`} behalf, not as ${name === 'you' ? 'you' : 'them'}. Pick a ${o.presenterVoice} voice on the look step to speak as ${name === 'you' ? 'you' : 'them'}.`
    return null
  }
  if (o.intro && hasFirstPerson(o.intro)) return `The narrator is an AI voice speaking for ${name}, so “I’m…” lines are said in the third person (“${name === 'you' ? 'They' : firstName(name)} asked me to walk you through…”).`
  return null
}

/* ── text helpers ───────────────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const A = `['’]` // straight or curly apostrophe
export const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || ''

/** Sentences, each with its own end punctuation and following space. */
export function sentences(text: string): string[] {
  return (String(text || '').match(/[^.!?]+(?:[.!?]+["”’)]?|$)\s*/g) || []).filter((s) => s.trim())
}

const FIRST_PERSON_RE = new RegExp(`(^|[^\\w${A.slice(1, -1)}])(I|I${A}m|I${A}ve|I${A}ll|I${A}d|[Mm]e|[Mm]y|[Mm]ine|[Mm]yself)(?=$|[^\\w${A.slice(1, -1)}])`)
/** Does this line speak as "I"? */
export function hasFirstPerson(text: string): boolean {
  return FIRST_PERSON_RE.test(String(text || ''))
}

/** The ways a voice claims to BE someone: "I'm X", "I am X", "my name is X", "this is X", "X here". */
function selfIdRe(names: string[]): RegExp | null {
  const alts = names.map((n) => n.trim()).filter((n) => n.length > 1).map(esc)
  if (!alts.length) return null
  const who = `(?:${alts.join('|')})`
  return new RegExp(`(?:\\b(?:I${A}m|I am|my name${A}?s|my name is|this is|it${A}s)\\s+${who}\\b|^\\s*(?:(?:hi|hello|hey)[\\s,!.]+)?${who}\\s+here\\b)`, 'i')
}

/**
 * The claim itself, to cut out of its sentence and keep the rest:
 * "Hello, I'm Darrell Wolfe, your financial advisor, and I'll call soon." →
 * role "your financial advisor", rest "I'll call soon."
 */
function claimRe(names: string[]): RegExp | null {
  const alts = names.map((n) => n.trim()).filter((n) => n.length > 1).map(esc)
  if (!alts.length) return null
  const who = `(?:${alts.join('|')})`
  return new RegExp(`(?:(?:hi|hello|hey)(?:\\s+there)?[\\s,!.—-]+)?(?:\\b(?:I${A}m|I am|my name${A}?s|my name is|this is|it${A}s)\\s+${who}\\b|^\\s*${who}\\s+here\\b)(?:\\s*,\\s*(?!(?:and|but|so)\\b)([^,.!?—]+?)(?=\\s*(?:[,.!?—-]|\\band\\b|$)))?[\\s,.!?—-]*(?:and\\s+)?`, 'i')
}

/* "I help" → "Darrell helps". Modals and the usual past tenses stay as they are. */
const KEEP_VERB = /^(can|could|will|would|shall|should|may|might|must|did|had|was|were|put|set|read|cut|let|just|also|really|always|never|often|still|already)$/i
function conj(v: string): string {
  if (KEEP_VERB.test(v) || /ed$/i.test(v)) return v
  const l = v.toLowerCase()
  if (l === 'have') return 'has'
  if (l === 'am' || l === 'be') return 'is'
  if (l === 'do' || l === 'go') return `${v}es`
  if (/(s|sh|ch|x|z|o)$/i.test(v)) return `${v}es`
  if (/[^aeiou]y$/i.test(v)) return `${v.slice(0, -1)}ies`
  return `${v}s`
}

/** A greeting that opens a sentence. */
const GREETING_RE = /^\s*(?:hi|hello|hey|welcome|good (?:morning|afternoon|evening)|greetings)\b/i

/**
 * THE PRESENTER'S OWN INTRO LINE, IN THE THIRD PERSON. "Hi, I'm Sarah Talls,
 * a registered nurse. I've prepared this video to walk you through your
 * prescription plan." → "Sarah Talls, a registered nurse, prepared this video
 * to walk you through your prescription plan." `greeted`: the opening already
 * named them (the client greeting), so a bare self-introduction is dropped.
 */
export function thirdPersonIntro(intro: string, p: { name: string; role?: string | null }, opts: { greeted?: boolean } = {}): string {
  const name = (p.name || '').trim()
  const text = String(intro || '').trim()
  if (!text || !name) return text
  const first = firstName(name)
  const idRe = selfIdRe([name, first])
  const cut = claimRe([name, first])
  let role = ''
  let claimed = false
  let subject = opts.greeted ? first : name
  const out: string[] = []
  for (const raw of sentences(text)) {
    let s = raw.trim()
    if (GREETING_RE.test(s) && !idRe?.test(s) && s.replace(GREETING_RE, '').replace(/[\s,!.]+/g, '').length === 0) continue // a bare "Hi!"
    if (idRe?.test(s) && cut) {
      // "Hi, I'm Sarah Talls, a registered nurse." — keep the role and the rest, drop the claim.
      const m = s.match(cut)
      if (m?.[1] && !hasFirstPerson(m[1])) role = m[1].trim()
      s = s.replace(cut, '').trim()
      claimed = true
      if (!/[a-z0-9]/i.test(s)) continue
      s = s.charAt(0).toUpperCase() + s.slice(1)
    }
    if (!hasFirstPerson(s)) { out.push(s); continue }
    const subj = role ? `${subject}, ${role},` : subject
    let used = false
    const take = () => { used = true; return subj }
    s = s
      .replace(new RegExp(`^(?:(?:and|so|today)[,\\s]+)?I${A}ve\\b`, 'i'), () => `${take()} has`)
      .replace(new RegExp(`^(?:(?:and|so|today)[,\\s]+)?I have\\b`, 'i'), () => `${take()} has`)
      .replace(new RegExp(`^(?:(?:and|so|today)[,\\s]+)?(?:I${A}m|I am)\\b`, 'i'), () => `${take()} is`)
      .replace(new RegExp(`^(?:(?:and|so|today)[,\\s]+)?(?:I${A}ll|I will)\\b`, 'i'), () => `${take()} will`)
      .replace(new RegExp(`^(?:(?:and|so|today)[,\\s]+)?I${A}d\\b`, 'i'), () => `${take()} would`)
      .replace(/^(?:(?:and|so|today)[,\s]+)?I\s+([a-z]+)\b/, (_w, v: string) => `${take()} ${conj(v)}`)
      .replace(/^(?:(?:and|so|today)[,\s]+)?I\b/, () => take())
    s = s
      .replace(/\bI\s+([a-z]+)\b/g, (_w, v: string) => `${first} ${conj(v)}`)
      .replace(new RegExp(`\\bI${A}ve\\b`, 'g'), `${first} has`)
      .replace(new RegExp(`\\b(?:I${A}m|I am)\\b`, 'g'), `${first} is`)
      .replace(new RegExp(`\\b(?:I${A}ll|I will)\\b`, 'g'), `${first} will`)
      .replace(new RegExp(`\\bI${A}d\\b`, 'g'), `${first} would`)
      .replace(/\bI\b/g, first)
      .replace(/\bmyself\b/gi, first)
      .replace(/\bmine\b/gi, `${first}’s`)
      .replace(/\bmy\b/gi, 'their')
      .replace(/\bme\b/g, first)
    if (used) { role = ''; subject = first }
    out.push(s.charAt(0).toUpperCase() + s.slice(1))
  }
  // Only a self-introduction was written: say who they are, once.
  if (!out.length) {
    if (opts.greeted) return role ? `${first} is ${/^(a|an|the|your)\s/i.test(role) ? role : `a ${role}`}.`.replace(/\.\.$/, '.') : ''
    return `This comes to you from ${name}${role ? `, ${role}` : ''}.`
  }
  if (role) out.unshift(`${opts.greeted ? first : name} is ${/^(a|an|the|your)\s/i.test(role) ? role : `a ${role}`}.`)
  // A claim was cut and nothing left says who this is from: say it once.
  else if (claimed && !opts.greeted && !new RegExp(`\\b${esc(first)}\\b`, 'i').test(out.join(' '))) out.unshift(`This comes to you from ${name}.`)
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

/* ── the deterministic check ────────────────────────────────────────────── */

export type PovIssue = { code: 'self-intro' | 'double-greeting' | 'foreign-name'; scene: number; text: string }

export type PovContext = {
  /** The presenter (a person's brand), when there is one. */
  presenterName?: string | null
  presenterRole?: string | null
  /** The company brand's name, when the video is a company's. */
  brandName?: string | null
  mode: NarratorMode
  /** Names that must NOT be said in this video — the account owner's, when a different brand was chosen. */
  foreignNames?: string[]
}

/** Every POV problem in a script — what repairNarration fixes, and what the pre-flight refuses. */
export function checkNarration(narrations: string[], ctx: PovContext): PovIssue[] {
  const issues: PovIssue[] = []
  const names = [ctx.presenterName, ctx.presenterName ? firstName(ctx.presenterName) : '', ctx.brandName].filter((x): x is string => !!x && x.trim().length > 1)
  const idRe = ctx.mode === 'for' ? selfIdRe(names) : null
  const foreign = (ctx.foreignNames || []).map((n) => n.trim()).filter((n) => n.length > 2)
  narrations.forEach((n, i) => {
    const text = String(n || '')
    for (const s of sentences(text)) if (idRe?.test(s)) issues.push({ code: 'self-intro', scene: i, text: s.trim() })
    if (i === 0) {
      const greets = sentences(text).filter((s) => GREETING_RE.test(s) || /thank you for letting\b/i.test(s))
      if (greets.length > 1) issues.push({ code: 'double-greeting', scene: i, text: greets[1].trim() })
    }
    for (const f of foreign) if (new RegExp(`\\b${esc(f)}\\b`, 'i').test(text)) issues.push({ code: 'foreign-name', scene: i, text: f })
  })
  return issues
}

/**
 * REPAIR ONE NARRATION (scene `index`; 0 is the opening). In "for" mode a
 * sentence that claims to be the presenter is rewritten in the third person
 * (or dropped when it only said who they are and the opening already named
 * them); on the opening a second greeting loses its "Hello,". `greetedBefore`:
 * the scene before it (the cover) already greeted the viewer, so this one
 * (the first content scene) opens without a greeting of its own. Returns the
 * text unchanged when nothing is wrong.
 */
export function repairNarration(text: string, ctx: PovContext, index = 1, opts: { greetedBefore?: boolean } = {}): string {
  let out = String(text ?? '')
  if (!out.trim()) return out
  const presenter = (ctx.presenterName || '').trim()
  const names = [presenter, presenter ? firstName(presenter) : '', ctx.brandName || ''].filter((x) => x.trim().length > 1)
  const idRe = ctx.mode === 'for' ? selfIdRe(names) : null
  if (idRe) {
    const parts = sentences(out)
    const before = (k: number) => parts.slice(0, k).join(' ')
    const fixed = parts.map((s, k) => {
      if (!idRe.test(s)) return s
      const who = presenter || ctx.brandName || ''
      const named = !!who && new RegExp(`\\b${esc(firstName(who))}\\b`, 'i').test(before(k))
      const trail = /\s$/.test(s) ? ' ' : ''
      if (presenter) {
        const said = thirdPersonIntro(s, { name: presenter, role: ctx.presenterRole }, { greeted: named })
        return said ? `${said}${trail}` : ''
      }
      // A company: "Hi, this is Acme Insurance." → "This comes to you from Acme Insurance."
      const cut = claimRe([who])
      let rest = cut ? s.replace(cut, '').trim() : ''
      rest = /[a-z0-9]/i.test(rest) ? `${rest.charAt(0).toUpperCase()}${rest.slice(1)}${trail}` : ''
      return named ? rest : `This comes to you from ${who}.${rest ? ' ' : trail}${rest}`
    })
    out = fixed.join('').replace(/\s+/g, ' ').trim()
  }
  if (index === 0) {
    const parts = sentences(out)
    let greeted = !!opts.greetedBefore
    out = parts.map((s) => {
      const g = GREETING_RE.test(s) || /thank you for letting\b/i.test(s)
      if (!g) return s
      if (!greeted) { greeted = true; return s }
      // A second "Hello, …" — keep what it says, not the greeting.
      const rest = s.replace(/^\s*(?:(?:hi|hello|hey|greetings)(?:\s+there)?[\s,!.—-]+|welcome(?:\s+back)?\s*[,!.—-]+\s*)/i, '')
      if (!rest.trim() || /^\s*(?:welcome|good (?:morning|afternoon|evening))\b[\s,!.—-]*$/i.test(rest)) return ''
      return rest.charAt(0).toUpperCase() + rest.slice(1)
    }).join('').replace(/\s+/g, ' ').trim()
  }
  return out
}
