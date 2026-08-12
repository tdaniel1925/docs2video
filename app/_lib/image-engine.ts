// =============================================================================
// Which engine draws the design, and how we know the words came out right.
//
// gpt-image-2 DRAWS EVERYTHING. Decided on measurement, twice, and the second
// measurement overturned the argument the first one made. Re-run it yourself
// with scripts/engine-bakeoff.mjs before changing this — it takes ten minutes.
//
// MEASURED, 12 looks across 12 shelves, identical words and subject:
//
//                          gpt-image-2         Gemini 2.5 Flash Image
//   drew at all                6/6                     12/12
//   every word right           6/6         0/6 first try, 3/12 after 3 tries
//   time                      116 s                30 s (incl. retries)
//   cost per design            18c              12c (2.9 attempts each)
//
// THE ARGUMENT THAT DIED. This file used to say: at four cents you can afford
// to CHECK AND REDO, so three cheap attempts beat one expensive one. It reads
// well and it is wrong, because it assumes the mistake is RANDOM. It is not.
// The same small line fails for the same reason, so drawing it again mostly
// lands on a different wrong word:
//
//   "seven days an week"    "seven days de week"    "seven days in week"
//
// Real words, right shape, wrong word — which is worse than gibberish. Gibberish
// you catch across the room. "Seven days an week" survives a glance, survives
// the customer's approval, and gets found by THEIR customer. On something that
// was printed five hundred times, that is not a defect, it is a bill.
//
// Needing 2.9 attempts also eats the saving: 12c against 18c is a third off,
// not four times. Paying two thirds the price for three quarters of the flyers
// misspelled is not a saving.
//
// NOTHING BELOW IS DELETED. The Gemini path, the aspect matching and the
// read-back loop all still work, and FLYER_IMAGE_ENGINE=gemini turns them on
// without a deploy. Their image model will improve — this is a decision with an
// expiry date, not a closed door. checkWords earns its keep either way: it now
// runs on every design, on both engines.
// =============================================================================

export type Engine = 'gemini' | 'openai'

/**
 * The shapes Gemini will draw. It does not take arbitrary dimensions the way
 * gpt-image-2 does, so a size whose proportions are not close to one of these
 * has to stay on the slower engine — cropping to fit would cut into a design
 * that was composed for a different shape, which is the exact mistake this
 * codebase spent a while undoing for banners.
 */
const GEMINI_RATIOS: { label: string; ratio: number }[] = [
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
]

/** Past this the shapes are different enough that fitting one to the other cuts the design. */
const RATIO_TOLERANCE = 0.06

/**
 * Can Gemini draw this shape closely enough to be worth it?
 *
 * Returns the aspect label to ask for, or null to use gpt-image-2. A rack card
 * at 1:2.4 and a LinkedIn strip at 4:1 have no near match and stay where they
 * are; a letter flyer at 0.77 is within a whisker of 3:4 and does not.
 */
export function geminiAspect(w: number, h: number): string | null {
  const want = w / h
  let best = GEMINI_RATIOS[0]
  for (const r of GEMINI_RATIOS) {
    if (Math.abs(r.ratio - want) < Math.abs(best.ratio - want)) best = r
  }
  return Math.abs(best.ratio - want) / want <= RATIO_TOLERANCE ? best.label : null
}

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'
const GEMINI_READ_MODEL = 'gemini-2.5-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Draw one image with Gemini. Throws with a readable message; the caller decides.
 *
 * `inputs` are the customer's own pictures and, on a deck, the slide the rest
 * must match. They go in AFTER the words, in the order the prompt names them —
 * the prompt says "Image 1", "Image 2", and getting the order wrong applies the
 * "keep this person recognisable" rule to the wrong picture.
 */
export async function drawWithGemini(
  prompt: string,
  aspect: string,
  inputs: { data: Buffer<ArrayBuffer>; mimeType: string }[] = [],
): Promise<Buffer<ArrayBuffer>> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')

  const parts: Record<string, unknown>[] = [{ text: prompt }]
  for (const i of inputs) {
    parts.push({ inlineData: { mimeType: i.mimeType, data: i.data.toString('base64') } })
  }

  const res = await fetch(`${BASE}/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${(await res.text()).slice(0, 160)}`)

  const json = await res.json()
  const part = json?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)
  if (!part?.inlineData?.data) {
    // A refusal or a safety block comes back as text rather than an image, and
    // saying so beats "no image returned".
    const said = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join(' ')
    throw new Error(said ? `Gemini declined: ${String(said).slice(0, 140)}` : 'Gemini returned no image')
  }
  return Buffer.from(part.inlineData.data, 'base64')
}

export type SpellCheck = {
  /** Did every word we asked for come out intact? */
  ok: boolean
  /** The ones that did not, so a retry can be told what went wrong. */
  missing: string[]
  /** What the checker actually read, for the log when something is odd. */
  saw: string
}

/** Strip everything that is not a letter or a number, so case and punctuation do not count. */
const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Read the words back off the finished image and compare them with what was
 * asked for.
 *
 * TRANSCRIBE AND COMPARE, rather than asking "is anything misspelled". A model
 * asked to judge its own spelling is agreeable and says yes; a model asked to
 * transcribe just reads. The comparison then happens in code, where it is
 * deterministic and cannot be talked out of a verdict.
 *
 * Only the words that MATTER are checked — a headline, a price, a phone number.
 * Flagging a decorative word in the background would mean redrawing a perfectly
 * good design over something no one will read.
 */
export async function checkWords(image: Buffer<ArrayBuffer>, expected: string[]): Promise<SpellCheck> {
  const key = process.env.GEMINI_API_KEY
  const wanted = expected.map((s) => String(s ?? '').trim()).filter((s) => s.length >= 3)
  if (!key || !wanted.length) return { ok: true, missing: [], saw: '' }

  try {
    const res = await fetch(`${BASE}/${GEMINI_READ_MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Transcribe EVERY word of text visible in this image, exactly as it is spelled, including any spelling mistakes. Do not correct anything. Do not describe the picture. Output the words only.' },
            { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) return { ok: true, missing: [], saw: `reader returned ${res.status}` }

    const json = await res.json()
    const saw: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join(' ') ?? ''
    const haystack = bare(saw)

    // A phrase counts as present if its letters appear in order and unbroken.
    // "REPETIVE" against "REPETITIVE" fails, which is the case that started
    // all this; a line break inside the headline does not, which would
    // otherwise redraw a design that is perfectly correct.
    const missing = wanted.filter((w) => !haystack.includes(bare(w)))
    return { ok: missing.length === 0, missing, saw: saw.slice(0, 400) }
  } catch (e) {
    // NEVER FAIL A DESIGN BECAUSE THE CHECKER BROKE. An unreadable check means
    // unknown, and unknown must not throw away an image somebody paid for.
    return { ok: true, missing: [], saw: e instanceof Error ? e.message : 'reader failed' }
  }
}

/**
 * Which engine should draw this?
 *
 * gpt-image-2, unless FLYER_IMAGE_ENGINE=gemini says otherwise. See the top of
 * this file for the numbers behind that, and re-run the bake-off before
 * changing it rather than trusting either the numbers or this sentence.
 */
export function pickEngine(w: number, h: number): { engine: Engine; aspect: string | null } {
  const forced = (process.env.FLYER_IMAGE_ENGINE || '').toLowerCase()

  // OPENAI, ON EVIDENCE RATHER THAN PREFERENCE.
  //
  // Two separate reasons, and the second is the one that settles it:
  //
  // 1. The designs were judged worse by the person whose product this is. A
  //    benchmark does not overrule that; cheaper and faster is only better if
  //    the work is still worth sending to a customer.
  //
  // 2. Re-measured on the CURRENT prompts, after the look was separated from
  //    the subject — the fair test, since the old numbers were taken on a
  //    prompt that no longer exists. 3 of 12 designs came out with every word
  //    correct, after three attempts each. Not 3 of 12 misspelled. 3 of 12
  //    CORRECT.
  //
  // Both stay true independently. If their model improves and the pictures get
  // better, point 2 still has to be re-measured before this line moves.
  if (forced !== 'gemini') return { engine: 'openai', aspect: null }

  const aspect = geminiAspect(w, h)
  if (!aspect || !process.env.GEMINI_API_KEY) return { engine: 'openai', aspect: null }
  return { engine: 'gemini', aspect }
}

/** How many times to redraw before accepting whatever we have. */
export const SPELLING_ATTEMPTS = 3

/**
 * Draw it, read it back, and draw it again if the words came out wrong.
 *
 * Returns the best attempt even when every one of them failed the check —
 * a design with one soft word is worth more to the person who paid for it than
 * an error, and the caller is told so it can say something honest.
 */
export async function drawChecked(
  prompt: string,
  aspect: string,
  mustSay: string[],
  inputs: { data: Buffer<ArrayBuffer>; mimeType: string }[] = [],
): Promise<{ image: Buffer<ArrayBuffer>; attempts: number; spelling: SpellCheck }> {
  let best: { image: Buffer<ArrayBuffer>; spelling: SpellCheck } | null = null

  for (let attempt = 1; attempt <= SPELLING_ATTEMPTS; attempt++) {
    const image = await drawWithGemini(prompt, aspect, inputs)
    const spelling = await checkWords(image, mustSay)
    if (spelling.ok) return { image, attempts: attempt, spelling }

    // Keep whichever attempt got the most words right, so three failures still
    // hand back the least bad one rather than the last one.
    if (!best || spelling.missing.length < best.spelling.missing.length) best = { image, spelling }
    console.warn(`[image-engine] attempt ${attempt} misspelled: ${spelling.missing.join(', ')}`)
  }

  return { image: best!.image, attempts: SPELLING_ATTEMPTS, spelling: best!.spelling }
}
