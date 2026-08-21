'use client'

// =============================================================================
// Flyer, ad & business card maker.
//
// The page IS the conversation. One column, oldest at the top, newest at the
// bottom, and the typing bar pinned underneath — you describe the job, it
// confirms what it caught, you press Make, and the designs appear right there
// in the thread as a permanent block.
//
// WHY A TIMELINE. The previous layout stacked four panels and kept the results
// in a sticky column beside them, which had two real faults rather than merely
// ugly ones:
//   - Pressing Make wiped the last batch. Change a price, re-make, and the
//     originals were gone. A refresh lost everything ever made.
//   - Designs were shown about 370px wide, in which you cannot read a phone
//     number — while the page told you to check the phone number before
//     printing.
// Rounds are now saved (see /api/flyer-history) and any design opens full
// screen.
//
// WHY THE BUTTONS STAYED. Picking a look from a wall of pictures is three clicks
// and describing it is a sentence that gets it wrong, so style, photos and
// sizes are controls in the typing bar rather than things you must type. Chat
// is the spine; clicking is kept for whatever is faster to click.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { useDictation } from '../../_components/useDictation'
import { StepRow, DropHint } from '../../_components/StepRow'
import { useBrand } from '../../_components/BrandProvider'
import {
  FLYER_TEMPLATES, VISIBLE_STYLES, STYLE_FAMILIES, FLYER_SIZES, PHOTO_ROLES, thumbUrl, proofUrl,
  type FlyerFields, type PhotoRole,
  canBleed,
} from '../../_lib/flyer-engine'

/** A finished design. designId is what makes a masked edit possible. */
type Design = {
  sizeId: string; label: string; w: number; h: number; src: string; designId?: string
  /**
   * Did the words on the finished design match the words that were asked for?
   *
   * The AI DRAWS the lettering, so a phone number can come out with the digits
   * shuffled and it still LOOKS right. Every design is read back and compared,
   * because the customer who finds that out at the printer does not come back.
   *
   * undefined means the design predates the check, NOT that it passed.
   */
  checked?: boolean
  /** The words that did not match, so the warning can name them. */
  misspelled?: string[]
}
type Status = 'wait' | 'busy' | 'done' | 'fail'

/** A deck's running order, as returned by the planner before anything is drawn. */
type PlannedSlide = { role: string; fields: FlyerFields }
type DeckPlan = { title: string; slides: PlannedSlide[] }

/**
 * A picker, arriving as a message.
 *
 * THIS IS THE WHOLE FIX. Before, the assistant could return words and design
 * fields and nothing else — so asked "can you give me a way to select the
 * formats", the only thing it could do was TYPE OUT twenty-three sizes with
 * their pixel dimensions. The picker existed. It was thirty pixels away. The
 * assistant could not reach it, so it described it instead.
 *
 * Now it names one and the real thing opens, in the conversation. Two
 * consequences beyond the obvious: it can no longer recite options, because
 * choosing has stopped being something it does with words — and a card is a
 * MESSAGE, so it scrolls away like any other. The previous version pinned a
 * question panel above the typing box and only dismissed it when design fields
 * came back, so a conversation about formats left "What should it say?" on
 * screen permanently while everything moved on around it.
 */
type CardKind = 'reference' | 'slides' | 'brand'

/** Everything in the thread, in the order it happened. */
type Item =
  | { kind: 'msg'; role: 'user' | 'assistant'; text: string }
  | {
      kind: 'card'; id: string; card: CardKind
    }
  | {
      /**
       * A deck being built, or built.
       *
       * Kept separate from a round rather than squeezed in beside it: a round is
       * keyed by SIZE — one design per ticked size — and a deck is many designs
       * at the SAME size, so sharing the shape would mean every status lookup
       * collided on 'slide-16x9'.
       */
      kind: 'deck'; id: string; title: string; slides: PlannedSlide[]
      designs: (Design & { designId?: string })[]
      status: Record<number, Status>
      startedAt: number; live: boolean
      /** Slide one is drawn and waiting to be approved before the rest. */
      awaiting?: boolean
    }
  | {
      kind: 'round'; id: string; templateId: string; note: string
      sizeIds: string[]; designs: Design[]; status: Record<string, Status>
      startedAt: number; live: boolean; failed?: string[]
    }

// Three at a time: quick enough, and few enough not to trip the image API's
// rate limit and turn a queue into a wall of errors.
const CONCURRENCY = 3
// Below 3 it is not a deck; above 20 the cost surprises people. Mirrors the
// same clamp on the server, which is the one that actually binds.
const MIN_DECK = 3
const MAX_DECK = 20
// MEASURED against production, not guessed — the first estimate here was 75s
// and it was wrong. Better to quote the real number and finish early.
const SECS_PER_SIZE = 115

// Ordered by how many people need it, NOT by how many looks we happen to have.
// Nightlife used to be first and was seven of the fifteen styles, so the app
// opened looking like a nightclub-flyer tool — a restaurant or a salon landed on
// a wall of dark neon and had nothing to pick.
const CATEGORIES = [
  { id: 'business', label: 'Business' },
  { id: 'sale', label: 'Sales & offers' },
  { id: 'food', label: 'Food & drink' },
  { id: 'services', label: 'Local services' },
  { id: 'realestate', label: 'Real estate' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'community', label: 'Community' },
  { id: 'music', label: 'Live music' },
  { id: 'nightlife', label: 'Nightlife' },
] as const

const GROUPS = [
  { id: 'print', label: 'Print' },
  { id: 'slide', label: 'Presentation slides' },
  { id: 'social', label: 'Social posts' },
  { id: 'banner', label: 'Banners & headers' },
  { id: 'card', label: 'Business cards' },
] as const

/**
 * THE CONVERSATION, one question at a time.
 *
 * The old design put every control in a bar under the chat: style, photos,
 * sizes, and a deck planner hidden inside the sizes panel. Everything was
 * available at once and nothing said what to do first, so people either pressed
 * Make with the defaults or hunted. It also asked for the LOOK before it knew
 * what was being made, which is how a business deck inherited a flyer's style.
 *
 * Now the assistant asks, and the answer widget appears in the question itself.
 * No permanent bar, no hunting: the thread is both the interface and the record
 * of what was decided.
 *
 * `null` means there is nothing to ask — press Make.
 */
type Step = 'kind' | 'piece' | 'slides' | 'content' | 'look' | 'photos' | 'notes' | null

/** What someone said they wanted at the very start. */
type Kind = 'deck' | 'print' | 'social' | 'set'

/**
 * The first thing said, and it does NOT ask what you are making.
 *
 * It used to — and so did a card underneath it, and so did row 1 of the steps,
 * all three on screen at once, two of them with the same four buttons. The
 * question is the rail's job; the chat's job is to say what the rail is and
 * where the typing box is, once, and then get out of the way.
 */
const HELLO = "I'm your graphic designer. Answer the steps above as you go — or just tell me what you need in the box below."

const STARTERS: { kind: Kind; label: string; hint: string }[] = [
  { kind: 'deck', label: 'Make a slide deck', hint: 'A whole presentation, all the slides matching' },
  { kind: 'social', label: 'Make a graphic', hint: 'For Instagram, Facebook, LinkedIn or a website' },
  { kind: 'print', label: 'Make something to print', hint: 'Flyer, poster, postcard, business card, sign' },
  { kind: 'set', label: 'Make a set', hint: 'The same design in several sizes at once' },
]

/**
 * WHAT "What's it about?" MEANS — ONE source, two voices.
 *
 * A deck and a flyer want different things here. A deck wants a subject and an
 * audience; a flyer wants the words that go ON it — the date, the price, the
 * phone number. The bug was that these were written twice: the chat reply after
 * picking a kind switched on the kind, but step 2's help text was hard-wired to
 * the flyer version, so choosing "slide deck" left an HVAC flyer example
 * ("$89 tune-up, 555-0142") sitting under a chat bubble asking what the deck is
 * about. Two instructions, disagreeing, side by side.
 *
 * Now both come from here. `chat` is the sentence the designer says back in the
 * thread; `body` is the same guidance as the step's help text. Change the
 * wording once and both move together — they cannot drift again.
 */
function contentGuidance(kind: Kind | null): { chat: string; body: string } {
  if (kind === 'deck') {
    return {
      chat: 'What is the deck about, and who is it for? Type it below — or upload a document and I’ll build it from that.',
      body: 'Tell me what the deck is about and who it’s for — say it in the box at the bottom the way you would out loud. Or drop a PDF, Word file or PowerPoint in and I’ll build the slides from it.',
    }
  }
  // Flyers, graphics and sets all want the WORDS that go on the artwork.
  return {
    chat: 'What should it say? The date, the time, the place, the price — whatever needs to be on it. Type it below, or upload a document and I’ll pull it out.',
    body: 'Say the words that go on it, in the box at the bottom, the way you would out loud — “Grand opening Saturday, 20% off, 555-0142”. Or drop a PDF, Word file or PowerPoint in and I’ll read it. You can paste your website address too and I’ll go and look.',
  }
}

/** The pieces inside "something to print", asked as one question with pictures. */
const PRINT_PIECES: { id: string; label: string }[] = [
  { id: 'letter', label: 'Flyer / sell sheet' },
  { id: 'poster', label: 'Poster' },
  { id: 'postcard-6x4', label: 'Postcard' },
  { id: 'biz-card-front', label: 'Business card' },
  { id: 'rack-card', label: 'Rack card' },
  { id: 'door-hanger', label: 'Door hanger' },
  { id: 'table-tent', label: 'Table tent' },
  { id: 'yard-sign', label: 'Yard sign' },
]

const SOCIAL_PIECES: { id: string; label: string }[] = [
  { id: 'ig-post', label: 'Instagram post' },
  { id: 'ig-story', label: 'Instagram story / Reel' },
  { id: 'fb-post', label: 'Facebook post' },
  { id: 'fb-ad', label: 'Facebook / Instagram ad' },
  { id: 'yt-thumb', label: 'YouTube thumbnail' },
  { id: 'li-banner', label: 'LinkedIn banner' },
]


/** The groups the formats picker shows, in the order most people need them. */
/**
 * Put the group they asked for first.
 *
 * Someone who clicked "Make something to print" should not have to scroll past
 * Instagram to find a flyer. Everything is still there — only the order moves,
 * because hiding the rest would mean a second question to get at them.
 */
function orderedGroups(kind: Kind | null) {
  const lead = kind === 'deck' ? 'slide' : kind === 'social' ? 'social' : kind === 'print' ? 'print' : null
  if (!lead) return FORMAT_GROUPS
  return [...FORMAT_GROUPS].sort((a, b) => (a.id === lead ? -1 : b.id === lead ? 1 : 0))
}

/**
 * Which "what are you making?" a size belongs to.
 *
 * Reopening a finished job needs to put the right group of formats first and
 * light up the right rail step, but only the SIZES were saved — not the kind.
 * So we read the kind back off the size's own group: a slide means a deck, a
 * social or banner size means a graphic, print and cards mean a print piece.
 * Defaults to 'print' for an unknown id rather than leaving it blank.
 */
function kindForSize(sizeId: string): Kind {
  const g = FLYER_SIZES.find((s) => s.id === sizeId)?.group
  if (g === 'slide') return 'deck'
  if (g === 'social' || g === 'banner') return 'social'
  return 'print' // print + card
}

const FORMAT_GROUPS: { id: string; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'social', label: 'Social' },
  { id: 'banner', label: 'Banners' },
  { id: 'card', label: 'Business cards' },
  { id: 'slide', label: 'Slides' },
]

/**
 * Every choice, drawn rather than described.
 *
 * One component for all of them because they share the same contract: show the
 * options, take the answer, hand back a one-line summary for the collapsed
 * state. Splitting them into five components would mean five places to forget
 * the summary.
 */
function Picker(p: {
  card: CardKind
  /** What they said they were making, so the right group of formats leads. */
  kind: Kind | null
  brands: { id: string; name: string; primary_color?: string | null }[]
  onPickBrand: (id: string | null) => void
  ticked: string[]; onTickSize: (id: string) => void
  /** The look chosen so far. Used twice: to mark the picked tile in the style
   *  grid, and to show each SHAPE with that look cropped into it. */
  styles: typeof FLYER_TEMPLATES; templateId: string
  onPickStyle: (id: string) => void; onSeeAll: () => void
  photos: { name: string }[]; onOpenPhotos: () => void
  onReference: (f: File) => void
  deckCount: number; onPickSlides: (n: number) => void
  unit: number | null; bleed: boolean; onBleed: (b: boolean) => void
  onDone: (summary: string) => void
}) {
  const btn = { ...PLAIN_BTN, padding: '7px 12px' } as const
  const soft = 'var(--ink-soft,#6b6459)'

  if (p.card === 'brand') {
    return (
      <>
        <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 2px' }}>Whose brand is this for?</p>
        <p style={{ fontSize: 12.5, color: soft, margin: '0 0 12px', lineHeight: 1.5 }}>
          Pick one and every design uses their colours and drops their logo in — no re-uploading it each time.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {p.brands.map((b) => (
            <button key={b.id} onClick={() => { p.onPickBrand(b.id); p.onDone(b.name) }}
              style={{ ...btn, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                background: b.primary_color || 'var(--border,#ddd6cc)',
              }} />
              {b.name}
            </button>
          ))}
          <button onClick={() => { p.onPickBrand(null); p.onDone('no brand') }} style={btn}>
            No brand — a one-off
          </button>
        </div>
        {!p.brands.length && (
          <p style={{ fontSize: 12.5, color: soft, margin: '10px 0 0', lineHeight: 1.5 }}>
            You have not saved a brand yet. <a href="/brands/new" style={{ color: 'var(--ink,#23201c)' }}>Add one from your website</a> —
            paste the address and it reads the colours, the logo and the tone off the page.
          </p>
        )}
      </>
    )
  }

  // NO formats / styles / photos CARD ANY MORE.
  //
  // Each of these drew, inside the conversation, the exact panel that row 3,
  // 4 or 5 of the steps rail already shows a few inches away — one of them
  // even under the identical heading, "How should it look?", with a second
  // wall of the same thumbnails. The rail asks the questions now; the chat
  // routes to the row instead of growing a copy of it. See openQuestion.

  if (p.card === 'reference') {
    return (
      <>
        <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 2px' }}>Work from a design of your own</p>
        <p style={{ fontSize: 12.5, color: soft, margin: '0 0 12px', lineHeight: 1.5 }}>
          Upload one, or paste an image anywhere on this page. We read its style — the colours, the lettering, the mood — never its words, logos or photographs.
        </p>
        <label style={{ ...btn, cursor: 'pointer', display: 'inline-block' }}>
          Choose a file
          <input type="file" accept="image/*" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onReference(f) }} />
        </label>
      </>
    )
  }

  // slides
  return (
    <>
      <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 2px' }}>How many slides?</p>
      <p style={{ fontSize: 12.5, color: soft, margin: '0 0 12px' }}>
        I write the running order first, free, for you to check before anything is drawn.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[5, 8, 10, 12, 16].map((n) => (
          <button key={n} onClick={() => { p.onPickSlides(n); p.onDone(`${n} slides`) }}
            style={{ ...btn, ...(p.deckCount === n ? { background: 'var(--cream,#F4F1EC)', borderColor: 'var(--ink,#23201c)' } : null) }}>
            {n} slides{p.unit !== null ? ` · ${(p.unit * n).toLocaleString()} cr` : ''}
          </button>
        ))}
      </div>
    </>
  )
}

/**
 * A format tile, drawn to its real proportions.
 *
 * "12. Table tent 4x6 in" tells a non-designer nothing. A little rectangle the
 * shape of the actual piece tells them everything, instantly, without reading a
 * number. This is what "go back to the selection picker" meant, and the shape
 * does the explaining the dimensions were failing to do.
 */
function ShapeTile({ w, h, on, styleId }: { w: number; h: number; on: boolean; styleId?: string }) {
  const box = 42
  const scale = Math.min(box / w, box / h)
  const tw = Math.max(7, Math.round(w * scale))
  const th = Math.max(7, Math.round(h * scale))
  return (
    <span style={{
      width: box, height: box, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        width: tw, height: th, borderRadius: 2, overflow: 'hidden',
        display: 'block', position: 'relative',
        // The plain block stays underneath. If the picture has not loaded, or
        // no look has been chosen yet, the shape is still readable rather than
        // being a hole — which is what an <img> with nothing behind it becomes.
        background: on ? 'var(--ink,#23201c)' : 'var(--border,#ddd6cc)',
        outline: on ? '2px solid var(--ink,#23201c)' : 'none',
        outlineOffset: 1,
      }}>
        {styleId && (
          <img src={thumbUrl(styleId)} alt=""
            // COVER, so the crop is the real crop. A design squashed to fit
            // would misrepresent the one thing this tile is for: what the shape
            // does to the artwork.
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        )}
      </span>
    </span>
  )
}

/**
 * The "do this next" marker.
 *
 * Deliberately quiet. A step that has not been done yet still WORKS — the dot
 * suggests an order, it does not enforce one, and anything that looked like a
 * lock would make this worse than the panels it replaced.
 */
const Dot = () => (
  <span aria-hidden style={{
    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
    background: 'var(--ink,#23201c)', marginRight: 6, verticalAlign: 'middle',
  }} />
)

/** The plain button, at module level so the blocks below can use it too. */
const PLAIN_BTN = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border,#ddd6cc)',
  background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', color: 'var(--ink,#23201c)',
} as const

/**
 * Extra art direction per slide type.
 *
 * Mirrors roleDirection in app/_lib/deck-plan.ts. It is repeated here rather
 * than imported because the engine and the planner must not depend on each
 * other — and because a cover and a numbers slide want completely different
 * weight even in the same look, which the model will not infer from the words.
 */
const DECK_DIRECTION: Record<string, string> = {
  cover: 'This is the OPENING slide of a deck. The title dominates — the largest type in the whole deck. Nothing competes with it. Generous empty space.',
  point: 'This is a body slide. One idea. The headline leads; supporting lines sit quietly beneath at a much smaller size.',
  numbers: 'This slide exists for ONE FIGURE. Set the headline enormous — it should fill a third of the frame on its own. The supporting line is small, directly underneath.',
  quote: 'This is a QUOTATION. Set it as a quote — larger, lighter, more space around it than a normal headline, attribution small and quiet beneath.',
  closing: 'This is the FINAL slide. Calm and uncluttered. The ask reads first; contact details are small at the bottom.',
}

const INK = 'var(--ink,#23201c)'
const SOFT = 'var(--ink-soft,#6b6459)'
const LINE = 'var(--border,#ddd6cc)'
const CREAM = 'var(--cream,#F4F1EC)'

type Chat = { id: string; title: string; updated_at: string; pinned?: boolean }

/** Pinned first, then most recent — the same order the server returns, so a
 *  local change never reshuffles into something different. */
const sortChats = (list: Chat[]): Chat[] =>
  [...list].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
    (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Where you left off, remembered across a refresh.
 *
 * A chat row is only written once a design succeeds — so pressing New chat and
 * then having the generation fail left NOTHING on the server, and a refresh
 * fell back to "most recent", which was some job from months ago. You had to
 * start over every time.
 *
 * The browser remembers the open chat regardless of whether anything has been
 * made in it yet, so wherever you left off is where you come back to.
 */
const OPEN_CHAT_KEY = 'designs:openChat'
const rememberChat = (id: string | null) => {
  try { id ? localStorage.setItem(OPEN_CHAT_KEY, id) : localStorage.removeItem(OPEN_CHAT_KEY) } catch { /* private mode */ }
}
const recallChat = (): string | null => {
  try {
    // An explicit ?chat= in the address wins — that is someone deliberately
    // opening a particular job, and it must beat whatever was last open.
    const fromUrl = new URLSearchParams(window.location.search).get('chat')
    if (fromUrl) return fromUrl
    return localStorage.getItem(OPEN_CHAT_KEY)
  } catch { return null }
}

/**
 * Shrink a photo IN THE BROWSER before it is ever sent.
 *
 * THIS IS WHY DESIGNS WERE FAILING. The whole file was read as a data URL and
 * posted as JSON — and base64 is a third bigger than the original, so a 12 MB
 * phone photo became a ~16 MB request. The host rejects anything over 4.5 MB
 * with a 413, so the request never arrived and the careful downscaling on the
 * server never got the chance to run. The size limit has to be enforced on the
 * side that does the sending.
 *
 * 1600px on the longest edge is more than the image model can use anyway, and
 * lands around 200–500 KB — so three photos and a reference still leave the
 * request comfortably inside the limit.
 */
async function shrinkForUpload(file: File, maxEdge = 1600, quality = 0.82): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(new Error('could not read the file'))
    r.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('that file is not an image the browser can open'))
    i.src = dataUrl
  })

  // Already small enough and not enormous? Send it untouched — re-encoding a
  // small PNG can make it bigger, and a logo needs its crisp edges.
  const longest = Math.max(img.width, img.height)
  if (longest <= maxEdge && dataUrl.length < 700_000) return dataUrl

  const scale = Math.min(1, maxEdge / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  // White behind it: a transparent PNG flattened to JPEG goes black otherwise.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Shrink an image the page already holds, for sending back up as a REFERENCE.
 *
 * THIS IS WHY DECK SLIDES 2 ONWARDS FAILED WITH "Network error". Slide one is
 * attached to every later slide so the deck matches — but it was attached at
 * full size. A 1920x1080 PNG is around 2.6 MB, base64 adds a third, so each
 * request carried ~3.5 MB and three ran at once. The host rejects anything over
 * 4.5 MB, so those requests never arrived, had no JSON body, and surfaced as a
 * network failure rather than as the size problem they were.
 *
 * A style reference does not need resolution. What is being read off it is
 * palette, lettering weight and mood, none of which survive past about a
 * thousand pixels anyway.
 */
async function shrinkForReference(dataUrl: string, maxEdge = 1024, quality = 0.85): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('unreadable'))
      i.src = dataUrl
    })
    const longest = Math.max(img.width, img.height)
    if (longest <= maxEdge && dataUrl.length < 700_000) return dataUrl

    const scale = maxEdge / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    // Worst case the deck loses its anchor and the slides match less well —
    // still better than failing the whole build over a resize.
    return dataUrl
  }
}

/**
 * Save every design in a round.
 *
 * Browsers throttle a burst of downloads and will silently drop some, so they
 * are fired one at a time with a small gap — "download all" that quietly saves
 * four of six is worse than no button.
 */
async function downloadAll(round: Extract<Item, { kind: 'round' }>) {
  for (let i = 0; i < round.designs.length; i++) {
    const d = round.designs[i]
    const a = document.createElement('a')
    a.href = d.src
    a.download = `design-${i + 1}-${d.sizeId}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    await new Promise((r) => setTimeout(r, 350))
  }
}

export default function FlyerMakerPage() {
  const [items, setItems] = useState<Item[]>([
    {
      kind: 'msg', role: 'assistant',
      text: HELLO,
    },
  ])

  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [err, setErr] = useState('')

  /**
   * WHAT IT IS DOING WHILE YOU WAIT, in plain words.
   *
   * The reply takes ~18 seconds and the only sign of life was the word
   * "Thinking…". That is long enough that people press Send again, decide it
   * has broken, or leave. These lines change every few seconds so the wait
   * feels like the designer working rather than a hang.
   *
   * The server sends no progress events, so this is a timer, not a truth — and
   * that puts two hard limits on what it may say. It must not name a step that
   * does not happen (this call reads your message and history, then asks the
   * model what should go on the design and which look suits it — nothing is
   * generated or charged here). And it must NEVER say anything is finished or
   * ready: a timer cannot know that, and claiming done before done is the exact
   * bug app/_lib/no-false-claims.ts exists to stop. So the last line is still a
   * "…", never "Done" — the real reply replaces it when it actually lands.
   *
   * It holds on the last line rather than looping, so it never resets to
   * "Reading…" after ten seconds and implies it started over.
   */
  const THINKING_STAGES = [
    'Reading what you wrote…',
    'Working out what should go on it…',
    'Picking a look that fits…',
    'Almost there…',
  ]
  const [thinkStage, setThinkStage] = useState(0)
  useEffect(() => {
    if (!thinking) { setThinkStage(0); return }
    const id = setInterval(
      () => setThinkStage((s) => Math.min(s + 1, THINKING_STAGES.length - 1)),
      3500,
    )
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking])

  const [fields, setFields] = useState<FlyerFields>({})
  const [templateId, setTemplateId] = useState(VISIBLE_STYLES[0].id)
  const [category, setCategory] = useState<string>(CATEGORIES[0].id)
  const [family, setFamily] = useState<string>(STYLE_FAMILIES[0].id)
  /**
   * Show every look carrying the SAME ordinary job instead of its own sample.
   *
   * One switch for the whole grid rather than a hover on each tile: hover does
   * not exist on a phone, and flipping all of them at once is the point. The
   * van never changes while the look changes underneath it, which is the
   * difference between a pile of themed posters and a style catalogue.
   */
  const [onRealWork, setOnRealWork] = useState(false)
  /** Looks whose proof tile has not been generated yet, so the switch does not
   *  silently show a broken image where a design should be. */
  const [noProof, setNoProof] = useState<string[]>([])
  const [note, setNote] = useState('')
  // EMPTY. Two formats used to be ticked before anyone was asked, which is
  // how a customer ended up paying for two designs they never chose.
  const [ticked, setTicked] = useState<string[]>([])
  // Off by default — see the note by the checkbox. Most people print at home.
  const [bleed, setBleed] = useState(false)
  const [photos, setPhotos] = useState<{ dataUrl: string; role: PhotoRole; name: string }[]>([])
  // A design to copy the LOOK of. Mutually exclusive with a template style —
  // see the note in the style sheet for why.
  const [reference, setReference] = useState<{ dataUrl: string; name: string } | null>(null)
  // What is typed into the style search. Empty means "show the chosen group".
  const [styleQuery, setStyleQuery] = useState('')

  // Deck mode. The running order is planned as TEXT first and shown for
  // approval, because drawing twelve slides costs real money and several
  // minutes — and the commonest way to waste both is generating an order
  // nobody read.
  const [deckPlan, setDeckPlan] = useState<DeckPlan | null>(null)
  const [deckCount, setDeckCount] = useState(8)
  const [planning, setPlanning] = useState(false)
  /**
   * What should be IN the picture, as opposed to what it should SAY.
   *
   * The assistant has always worked this out and returned it. The page threw it
   * away — so "change the burger to a radio" was understood, answered politely,
   * and then had nowhere to go: the fields carry words, and the artwork came
   * only from the style's built-in scene. The design was redrawn with the same
   * burger every time.
   */
  const [artNote, setArtNote] = useState('')
  const [readingDoc, setReadingDoc] = useState(false)
  // Photos are optional, so the offer is made ONCE. Re-opening it after every
  // message would nag about something that was already declined.
  const [photosAsked, setPhotosAsked] = useState(false)
  const [brandAsked, setBrandAsked] = useState(false)
  // Which chat row is asking to be confirmed, and whether Clear chat is.
  // Inline, in place, rather than a browser dialog over the whole app.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  // On a phone the past-jobs list is behind a menu button rather than eating a
  // third of a narrow screen. Off by default so the phone opens on the work.
  const [drawerOpen, setDrawerOpen] = useState(false)
  // What they said they were making. Used to put the right group of formats
  // first, so someone who asked for a print piece is not led with Instagram.
  const [kind, setKind] = useState<Kind | null>(null)
  // Whose brand this job is for. Null means no brand — a one-off.
  const [brands, setBrands] = useState<{ id: string; name: string; primary_color?: string | null; logo_url?: string | null }[]>([])
  const [brandId, setBrandId] = useState<string | null>(null)

  // The running order is long. Once the deck is being drawn it has done its
  // job, and left open it buries the slides underneath it — which is exactly
  // what it did, with no way to fold it away.
  const [planOpen, setPlanOpen] = useState(true)

  // Mac says Cmd, everyone else says Ctrl. Worked out after the first paint so
  // the server and the browser render the same thing.
  const [pasteKey, setPasteKey] = useState('Ctrl+V')
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setPasteKey('Cmd+V')
  }, [])

  // Has the customer made these choices THEMSELVES yet? The conversation is
  // allowed to set the look and the sizes while they are still on the
  // defaults, but the moment someone picks for themselves, their choice wins
  // and stays won. Nothing is more annoying than a tool that quietly undoes
  // what you just clicked.
  const [stylePicked, setStylePicked] = useState(false)
  const [sizesPicked, setSizesPicked] = useState(false)

  // SHOW THAT SOMETHING HAPPENED. A thin border on one of six thumbnails is
  // easy to miss, and once you have chosen there is nothing saying the panel
  // is finished with. `strobeId` flashes a ring round whatever was just
  // picked; `unacked` keeps Done pulsing until it is pressed.
  const [strobeId, setStrobeId] = useState<string | null>(null)
  const [unacked, setUnacked] = useState(false)
  const strobeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markPicked = (id: string) => {
    setUnacked(true)
    if (strobeTimer.current) clearTimeout(strobeTimer.current)
    // Clear first so picking the SAME thing twice replays the animation
    // instead of doing nothing.
    setStrobeId(null)
    requestAnimationFrame(() => setStrobeId(id))
    strobeTimer.current = setTimeout(() => setStrobeId(null), 2400)
  }

  const closeSheet = () => { setSheet(null); setUnacked(false); setStrobeId(null) }
  useEffect(() => () => { if (strobeTimer.current) clearTimeout(strobeTimer.current) }, [])

  const [making, setMaking] = useState(false)
  const [sheet, setSheet] = useState<null | 'photos'>(null)

  // Browsing all the looks happens in the WIDE middle column, not a cramped
  // panel in the 420px rail beside it. This flips the middle from the
  // designs/examples over to the full style browser; picking one flips it back.
  const [browseLooks, setBrowseLooks] = useState(false)

  /**
   * WHICH SECTION IS OPEN. One at a time, and never more.
   *
   * The thread version put every question in the scroll as it arrived, so the
   * job had no shape you could see: what was decided scrolled away, what was
   * left was invisible, and the way out of a panel moved. Five rows you can
   * take in at a glance replaces all of that.
   *
   * null means "work it out from what is answered" — so coming back to a saved
   * job, or being handed a format by the conversation, both land on the right
   * row without anything having to remember a position.
   */
  const [openStep, setOpenStep] = useState<Step | null>(null)


  /** Which storefront this is. Both serve this page under different names. */
  const storefront = useBrand()
  const [viewing, setViewing] = useState<Design | null>(null)
  const [unit, setUnit] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Project chats. One chat is one job — the summer party flyer, a client's
  // cards — instead of every design anyone ever made sharing one endless
  // scrollback.
  const [chats, setChats] = useState<Chat[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [openChatKey, setOpenChatKey] = useState(0)

  // A clock, but only while something is being made — an idle page should not
  // re-render once a second for nothing.
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!making) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [making])

  // ── the saved thread ───────────────────────────────────────────────────
  useEffect(() => {
    let dead = false
    setLoadingHistory(true)
    ;(async () => {
      // On the very first load, reopen whatever was last open in this browser
      // rather than letting the server pick "most recent" — those differ the
      // moment a new chat has not produced a design yet.
      const wanted = chatId ?? recallChat()

      // IS THIS A COLD LANDING? True only when nobody has deliberately chosen a
      // chat this session — no chatId in state, and no ?chat= in the address.
      // A cold landing is the one case where "reopen the last job" can be the
      // WRONG thing: if that job is already FINISHED, the person is far more
      // likely starting something new than coming back to a done design. So a
      // finished last job lands on a fresh chat instead (it stays one click
      // away in the list). A job still in progress opens as before — that
      // person is coming back to finish it.
      let urlChat: string | null = null
      try { urlChat = new URLSearchParams(window.location.search).get('chat') } catch { /* ssr */ }
      const coldLanding = chatId == null && !urlChat
      const r = await fetch(`/api/flyer-history${wanted ? `?chat=${wanted}` : ''}`)
        .then((x) => x.json()).catch(() => null)
      if (dead || !r) { setLoadingHistory(false); return }
      setUnit(typeof r.unit === 'number' ? r.unit : null)
      setBalance(typeof r.balance === 'number' ? r.balance : null)
      setChats(r.chats ?? [])
      // Adopt the server's pick ONLY when neither we nor the browser had one —
      // a genuinely first visit, where "most recent" is the sensible default.
      // If a chat was asked for, ours wins; anything else is the page silently
      // moving you somewhere you didn't ask to go.
      const opened = wanted ?? r.openChat ?? null
      if (opened !== chatId) setChatId(opened)
      rememberChat(opened)
      const past: Item[] = []
      for (const round of r.rounds ?? []) {
        for (const m of round.messages ?? []) {
          if (m?.text) past.push({ kind: 'msg', role: m.role === 'user' ? 'user' : 'assistant', text: m.text })
        }
        if (round.designs?.length) {
          const designs = round.designs as { id?: string; sizeId: string; label: string; w: number; h: number; url: string }[]

          // IS THIS A DECK? A normal batch is one design per ticked size, so
          // every size id is different. A deck is many designs at the SAME
          // size — so a repeated size id means a deck and nothing else does.
          //
          // This matters because a round is INDEXED BY SIZE. Rebuilt as a
          // round, a deck's five slides all shared the id 'slide-16x9', every
          // tile looked up the first match, and the customer saw five copies of
          // one slide — all badged "1" — for five slides they had paid for.
          // The designs were fine. Only the display was wrong.
          const sizes = designs.map((d) => d.sizeId)
          const isDeck = sizes.length > 1 && new Set(sizes).size < sizes.length

          if (isDeck) {
            past.push({
              kind: 'deck', id: round.id,
              title: (round.fields?.headline as string) || 'Deck',
              // The running order is not stored, so captions fall back to the
              // slide number. The pictures are the point; the plan was the
              // scaffolding used to make them.
              slides: [],
              designs: designs.map((d, i) => ({
                sizeId: `slide-${i + 1}`, label: `Slide ${i + 1}`,
                w: d.w, h: d.h, src: d.url, designId: d.id,
              })),
              status: Object.fromEntries(designs.map((_, i) => [i, 'done' as Status])),
              startedAt: 0, live: false,
            })
          } else {
            past.push({
              kind: 'round', id: round.id, templateId: round.templateId, note: round.note ?? '',
              sizeIds: designs.map((d) => d.sizeId),
              designs: designs.map((d) => ({
                  sizeId: d.sizeId, label: d.label, w: d.w, h: d.h, src: d.url, designId: d.id,
              })),
              status: Object.fromEntries(designs.map((d) => [d.sizeId, 'done' as Status])),
              startedAt: 0, live: false,
            })
          }
        }
      }
      // FINISHED LAST JOB + COLD LANDING → START FRESH. The old job is already
      // in the list on the left (r.chats), one click away, and nothing about it
      // is touched. We just don't drop the returning customer INTO it, because
      // a done design is not a thing you come back to edit — it is a thing you
      // made, and you are here to make another.
      const finished = past.some((it) => it.kind === 'round' || it.kind === 'deck')
      if (coldLanding && finished) {
        const fresh = crypto.randomUUID()
        setChatId(fresh)
        rememberChat(fresh)
        setItems([{ kind: 'msg', role: 'assistant', text: HELLO }])
        setFields({}); setNote(''); setTemplateId(VISIBLE_STYLES[0].id)
        setLoadingHistory(false)
        return
      }

      if (past.length) {
        // The stored conversation replaces the opening prompt — a returning
        // customer should not be greeted as if they had never been here.
        setItems([...past, {
          kind: 'msg', role: 'assistant',
          text: 'Picking up where you left off. Change anything and press Make again, or start something new.',
        }])
        const last = r.rounds[r.rounds.length - 1]
        if (last) {
          setTemplateId(last.templateId || VISIBLE_STYLES[0].id)
          setFields(last.fields ?? {})
          setNote(last.note ?? '')

          // BRING BACK THE WHOLE BUILD, NOT JUST THE WORDS.
          //
          // Reopening a job used to restore the words and the style but leave
          // the SIZES and the KIND blank. So "make more sizes" opened the
          // formats picker with nothing ticked and no idea what you were
          // making — an empty screen with none of your work on it. We restore
          // the sizes you last made and infer the kind from them, so the
          // picker opens already showing what you had, ready to add to.
          const lastSizes: string[] = Array.isArray(last.designs)
            ? last.designs.map((d: { sizeId: string }) => d.sizeId).filter(Boolean)
            : []
          // A deck repeats one size; a normal job has distinct sizes. Either
          // way, tick what actually exists so the picker reflects reality.
          const uniqueSizes = [...new Set(lastSizes)]
          if (uniqueSizes.length) {
            const isDeck = lastSizes.length > 1 && uniqueSizes.length < lastSizes.length
            setKind(isDeck ? 'deck' : kindForSize(uniqueSizes[0]))
            setTicked(isDeck ? ['slide-16x9'] : uniqueSizes)
            setSizesPicked(true)
          }
        }
      } else {
        // Switched to an empty chat. Reset rather than leaving the last chat's
        // thread on screen under a different name.
        setItems([
          { kind: 'msg', role: 'assistant', text: HELLO, },
              ])
        setFields({})
      }
      setLoadingHistory(false)

      // "MORE SIZES" ARRIVES READY TO USE.
      //
      // The library's "More sizes" link comes in as ?pick=formats. Now that the
      // job's words, style and sizes are back on screen, open the formats
      // picker straight away so the customer can tick a new size and press Make
      // — instead of landing on the design and having to hunt for where sizes
      // live. One-shot: we strip the param so a refresh doesn't reopen it.
      try {
        const sp = new URLSearchParams(window.location.search)
        if (sp.get('pick') === 'formats' && past.length) {
          openQuestion('formats')
          sp.delete('pick')
          const qs = sp.toString()
          window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
        }
      } catch { /* ssr / private mode */ }
    })()
    return () => { dead = true }
    // openChatKey changes when a chat is chosen or started, which is what
    // reloads the thread. chatId alone is not enough: the server may hand back
    // the same id it was given, and that would not re-run anything.
  }, [openChatKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the thread down as it grows, the way a chat does.
  const endRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  /**
   * Pin the workspace to the WINDOW, not to the page.
   *
   * Three goes at making this sit still all failed the same way: the panel
   * stayed inside the document and then tried to out-argue the page it lived
   * in. The dashboard layout gives every page a min-height of the full viewport
   * plus 40px of padding top and bottom — so whatever height this asked for,
   * something was always left over, the document grew taller than the window,
   * and anything "stuck to the bottom" scrolled away with it.
   *
   * position:fixed takes it out of the document. `marker` is a zero-height
   * element left behind in normal flow purely so the app header's height can be
   * read off it — the one number that genuinely cannot be known in advance.
   */
  const marker = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)

  /**
   * PHONE OR DESKTOP — the one switch the whole layout hangs off.
   *
   * Below this width the three side-by-side columns (216 + flex + 420) cannot
   * fit; they were clipped off the right edge with no way to reach them, so a
   * phone opened to a dead end. Everything the phone does differently keys off
   * this single boolean rather than scattering breakpoints through the markup.
   *
   * 900 is the point where 216 + 20 + a usable middle + 20 + 420 stops fitting.
   * Measured with matchMedia, not window.innerWidth, so a rotate or a desktop
   * window drag flips it live without a resize-math dance.
   */
  const [isPhone, setIsPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const sync = () => setIsPhone(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const measure = () => setTop(marker.current?.getBoundingClientRect().top ?? 0)
    measure()
    window.addEventListener('resize', measure)

    // DESKTOP ONLY: pin the whole app to the window and lock the page behind it.
    // On a phone the layout is one tall column that MUST scroll the page — so
    // locking html/body overflow there would trap the customer above the fold
    // with the typing box unreachable below it. The very bug we are fixing.
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    if (!isPhone) {
      html.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
    }

    return () => {
      window.removeEventListener('resize', measure)
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [isPhone])
  /**
   * Follow the conversation — but only if the customer is watching the end of
   * it.
   *
   * This used to be scrollIntoView({behavior:'smooth'}) on every message, which
   * animated the WHOLE PAGE for half a second each time and yanked you back
   * down the instant you scrolled up to read something. Now it moves the
   * thread's own scrollbar, instantly, and leaves you alone whenever you are
   * anywhere but the bottom.
   */
  /**
   * PINNED TO THE NEWEST MESSAGE unless the customer deliberately scrolled up.
   *
   * The first version stuck only when you were within 160px of the bottom.
   * Wrong mechanic, measured wrong: a reply lands as several pieces at once
   * (your message + the answer + the brief card, 300-400px together), so one
   * arrival overshoots the threshold and the sticking silently stops for the
   * rest of the conversation — which is exactly the "scroll down to find the
   * reply" treadmill. The truth we actually want is INTENT: are they reading
   * back, or watching the end? So a scroll listener records which, and while
   * they are at the end we pin hard — on every new message AND whenever the
   * thread RESIZES (opening a tall step above shrinks the chat, which also
   * used to lose the bottom). Scrolling up detaches; scrolling back to the
   * bottom re-attaches. Nothing yanks you while you are reading history.
   */
  const stickToEnd = useRef(true)
  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const onScroll = () => {
      stickToEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => {
      if (stickToEnd.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [isPhone])

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    if (stickToEnd.current) el.scrollTop = el.scrollHeight
  }, [items, thinking])

  /**
   * A conversation OPENS at its newest message, not its oldest. One hard jump
   * per load/switch (re-attaching the pin), then the intent logic above owns it.
   */
  useEffect(() => {
    if (loadingHistory) return
    stickToEnd.current = true
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [loadingHistory, openChatKey])

  // Escape closes whatever is open, innermost first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewing) setViewing(null)
      else if (sheet) closeSheet()
      else if (browseLooks) exitBrowse()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing, sheet, browseLooks])

  const say = (role: 'user' | 'assistant', text: string) =>
    setItems((p) => [...p, { kind: 'msg', role, text }])


  /**
   * Which style tiles to show.
   *
   * Nothing typed: the chosen group. Something typed: every group, because a
   * search that only looks inside the group you happen to be standing in finds
   * nothing and looks broken.
   *
   * The words in the style's own description are searched too, not just its
   * name — "taco" and "gold" and "wedding" are how people actually describe
   * what they want, and none of those are the name of a style.
   */
  const shownStyles = (() => {
    const q = styleQuery.trim().toLowerCase()
    if (!q) return VISIBLE_STYLES.filter((t) => t.family === family)
    const words = q.split(/\s+/)
    return VISIBLE_STYLES.filter((t) => {
      // The old subject is searched too. Somebody who remembers the pumpkin
      // sample should still find that look by typing "pumpkin", even though the
      // pumpkins are no longer what they would get.
      const hay = `${t.name} ${t.family} ${t.look} ${t.subject ?? ""} ${t.lettering}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  })()

  /**
   * Attach a design to work from, however it arrived.
   *
   * Three routes in — the file button, a paste, a drag-and-drop — and all of
   * them land here. The realistic path is browsing a stock site, right-clicking
   * an image and pressing paste; making that work only through a file picker
   * would mean saving it to disk first, which is enough friction that most
   * people give up and use a style they did not really want.
   */
  const attachReference = async (file: File, label: string) => {
    if (!file.type.startsWith('image/')) {
      setErr('That is not an image. Copy the picture itself rather than a link to it.')
      return
    }
    let dataUrl: string
    try {
      dataUrl = await shrinkForUpload(file)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read that image.')
      return
    }
    setReference({ dataUrl, name: label })
    setStylePicked(true)
    markPicked('reference')
    say('assistant',
      'Got it. I\'ll take the style from that — the colours, the lettering, the mood — and build you a ' +
      'new design from your own words. I won\'t copy the design itself, or its text, logos or photos. ' +
      'Our own looks are switched off while it\'s attached; remove it to go back to them.')
  }

  /**
   * Add one of the customer's own pictures.
   *
   * Lives here rather than inside the photo panel so that pasting, dropping and
   * the file button are the SAME code. When it lived in the panel's onChange
   * only the file button could reach it, which is how you end up with an app
   * where one of three obvious gestures works.
   */
  const addPhoto = async (f: File) => {
    if (photos.length >= 3) { setErr('Three photos is the most a design can use.'); return }
    try {
      // Shrunk rather than rejected for being big. A phone photo straight from
      // the camera is 4000px and 12 MB; posted as JSON that is a ~16 MB request
      // and the host refuses anything over 4.5 MB — which was making designs
      // fail with no explanation.
      const dataUrl = await shrinkForUpload(f)
      setPhotos((p) => [...p, { dataUrl, name: f.name || 'pasted photo', role: 'person' as PhotoRole }].slice(0, 3))
      setErr('')
    } catch (err) {
      setErr(err instanceof Error ? err.message : `Could not read ${f.name || 'that image'}.`)
    }
  }

  /**
   * Anything dropped or pasted with no panel open, waiting to be sorted.
   *
   * ONE BUCKET, NOT THREE. The obvious build is three labelled trays — logo
   * here, photos there, reference in the third — but that makes somebody sort
   * their own files before the app will look at them, which is the work we are
   * meant to be doing. Drop the lot in; the app works out what each one is and
   * shows you what it decided.
   */
  type Dropped = {
    id: string
    dataUrl: string
    name: string
    /** What it was taken to be. Editable — the guess is a starting point. */
    kind: PhotoRole | 'reference'
    /** The app's own description, so you can tell which one it means. */
    what: string
    /** Was it confident? An unsure one is highlighted rather than assumed. */
    sure: boolean
  }
  const [dropped, setDropped] = useState<Dropped[]>([])
  const [sorting, setSorting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  /**
   * Take whatever arrived, shrink it, and ask what each one is.
   *
   * The sorting is a CONVENIENCE, never a gate. If it fails, or there is no key
   * for it, the files still land — they just arrive unlabelled and ask. Losing
   * somebody's upload because a nicety broke is not a trade worth making.
   */
  const takeDropped = async (files: File[]) => {
    const room = 6 - dropped.length
    if (room <= 0) { setErr('Six at a time is plenty — sort these first.'); return }

    const taken: Dropped[] = []
    for (const f of files.slice(0, room)) {
      if (!f.type.startsWith('image/')) continue
      try {
        taken.push({
          id: crypto.randomUUID(),
          dataUrl: await shrinkForUpload(f),
          name: f.name || 'pasted image',
          kind: 'person', what: '', sure: false,
        })
      } catch (err) {
        setErr(err instanceof Error ? err.message : `Could not read ${f.name || 'that image'}.`)
      }
    }
    if (!taken.length) return

    setErr('')
    setDropped((d) => [...d, ...taken])
    setSorting(true)
    try {
      const res = await fetch('/api/classify-images', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images: taken.map((t) => t.dataUrl) }),
      }).then((r) => r.json()).catch(() => null)

      if (res?.results?.length === taken.length) {
        setDropped((d) => d.map((item) => {
          const i = taken.findIndex((t) => t.id === item.id)
          if (i < 0) return item
          const g = res.results[i]
          return { ...item, kind: g.kind, what: g.what, sure: g.sure }
        }))
      }
    } finally {
      setSorting(false)
    }
  }

  /**
   * Go and look at a web page, and put what is on it into the tray.
   *
   * "Here is what we look like" is a link, not a folder. Their site already has
   * the logo, the photographs and the colours on it; making them save each one
   * to disk first is asking them to redo a job they already did.
   *
   * Everything found is a CANDIDATE. It lands in the same tray, gets sorted the
   * same way, and is thrown out with one click — a page also carries navigation
   * icons and stock banners, so choosing for them would be wrong often enough
   * to be worse than not offering it.
   */
  const [readingSite, setReadingSite] = useState(false)
  const takeFromUrl = async (url: string) => {
    if (readingSite) return
    setReadingSite(true); setErr('')
    say('user', url)
    say('assistant', 'Having a look at that page…')
    try {
      const r = await fetch('/api/reference-url', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      }).then((x) => x.json()).catch(() => null)

      if (!r || r.error || !r.images?.length) {
        say('assistant', r?.error
          ? `${r.error}`
          : 'I could not find any usable pictures on that page. Save the ones you want and drop them in — I will sort them.')
        return
      }

      // Fetched through our own server: a browser cannot read pixels from
      // another site's image, and we need the bytes to sort and to use them.
      const got: Dropped[] = []
      for (const src of r.images.slice(0, 6)) {
        try {
          const blob = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`).then((x) => x.ok ? x.blob() : null)
          if (!blob || !blob.type.startsWith('image/')) continue
          const file = new File([blob], src.split('/').pop()?.split('?')[0] || 'from the site', { type: blob.type })
          got.push({
            id: crypto.randomUUID(), dataUrl: await shrinkForUpload(file),
            name: file.name, kind: 'person', what: '', sure: false,
          })
        } catch { /* one bad image must not lose the rest */ }
      }

      if (!got.length) {
        say('assistant', 'That page had pictures but none of them would load for me. Drop them in and I will sort them.')
        return
      }

      setDropped((d) => [...d, ...got].slice(0, 6))
      say('assistant', `Pulled ${got.length} picture${got.length === 1 ? '' : 's'} off ${r.title || 'that page'}. Sorting them now — keep what you want, bin the rest.`)

      setSorting(true)
      try {
        const res = await fetch('/api/classify-images', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ images: got.map((g) => g.dataUrl) }),
        }).then((x) => x.json()).catch(() => null)
        if (res?.results?.length === got.length) {
          setDropped((d) => d.map((item) => {
            const i = got.findIndex((g) => g.id === item.id)
            return i < 0 ? item : { ...item, kind: res.results[i].kind, what: res.results[i].what, sure: res.results[i].sure }
          }))
        }
      } finally { setSorting(false) }
    } finally {
      setReadingSite(false)
    }
  }

  /** File it where it belongs and take it out of the tray. */
  const fileDropped = (d: Dropped) => {
    // Read out before the check. Narrowing a property does not survive into the
    // closure below, so `d.kind` in there is still "might be a reference".
    const role = d.kind
    setDropped((rest) => rest.filter((x) => x.id !== d.id))
    if (role === 'reference') {
      // The reference wants the original file, not our shrunk copy — it is the
      // one image whose fine detail is the whole point.
      fetch(d.dataUrl).then((r) => r.blob()).then((b) => {
        void attachReference(new File([b], d.name, { type: b.type }), d.name)
      })
      return
    }
    setPhotos((p) => [...p, { dataUrl: d.dataUrl, name: d.name, role }].slice(0, 3))
    markPicked('photo')
  }

  /**
   * PASTE WORKS EVERYWHERE, AND LANDS WHERE YOU ARE.
   *
   * Bound to the window rather than to a box you have to click first: "click
   * here, then paste" is a step people skip and then report the paste as
   * broken. It used to be bound only while the style panel was open, so
   * pasting a photo or a logo silently did nothing — which reads as the
   * feature not existing.
   *
   * What is open decides where it goes. When nothing is open it goes into the
   * tray, which works out what it is and SHOWS you — a pasted image is as
   * likely to be a design to copy the look of as a photo to put in one, and
   * there is no signal in the gesture that tells them apart.
   */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return

      // TEXT WINS ONLY WHEN THERE IS TEXT. The old rule was "ignore any paste
      // while the cursor is in a box you type into" — which killed the gesture
      // in the chat box, the single most obvious place to paste a picture.
      //
      // The real question is not where the cursor is, it is what is ON the
      // clipboard. Copying a headline out of a document puts text there and
      // that must stay text. Copying an image puts an image there, and no
      // amount of cursor position changes what was meant.
      const alsoText = (e.clipboardData?.getData('text/plain') ?? '').trim()
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if (typing && alsoText) return

      e.preventDefault()
      if (sheet === 'photos') void addPhoto(file)
      else if (browseLooks && !reference) void attachReference(file, 'pasted design')
      else void takeDropped([file])
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  /**
   * DROP ANYWHERE ON THE PAGE.
   *
   * Same reasoning as paste being bound to the window: a drop zone you have to
   * find and hit is a zone people miss, and a file dropped outside it gets
   * OPENED BY THE BROWSER — the whole app replaced by a JPEG, and their work
   * apparently gone. Which is why the leave/over handlers below cancel the
   * default even when we are not going to accept the file.
   */
  useEffect(() => {
    let depth = 0
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
    }
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault(); depth++; setDragOver(true)
    }
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragOver(false) }
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault(); depth = 0; setDragOver(false)
      const files = [...(e.dataTransfer.files ?? [])]
      const images = files.filter((f) => f.type.startsWith('image/'))
      // A dropped PDF or Word file is a BRIEF, not artwork — the app already
      // reads those. Sending it to the image sorter would just reject it.
      const doc = files.find((f) => !f.type.startsWith('image/'))
      if (images.length) {
        if (sheet === 'photos') { for (const f of images) void addPhoto(f) }
        else if (browseLooks && !reference) void attachReference(images[0], images[0].name)
        else void takeDropped(images)
      } else if (doc) void readDocument(doc)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  })

  // ── talking to it ──────────────────────────────────────────────────────
  // Native speech where the browser has it, recording + server transcription
  // everywhere else. See useDictation for why it is built that way — the first
  // version of this had no fallback and was reported as simply not working.
  const { listening, transcribing, toggle: toggleMic } = useDictation(
    // Append rather than replace: dictation arrives in chunks and each one
    // should add to the sentence, not wipe what came before.
    (heard) => setInput((prev) => (prev ? `${prev.trim()} ${heard}` : heard)),
    { onError: setErr },
  )

  /**
   * Pin or unpin. Updated on screen first and reverted if the server refuses —
   * a pin that takes a round trip to appear feels broken.
   */
  const togglePin = async (c: { id: string; pinned?: boolean }) => {
    const next = !c.pinned
    setChats((prev) => sortChats(prev.map((x) => (x.id === c.id ? { ...x, pinned: next } : x))))
    const ok = await fetch(`/api/flyer-chats/${c.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pinned: next }),
    }).then((r) => r.ok).catch(() => false)
    if (!ok) {
      setChats((prev) => sortChats(prev.map((x) => (x.id === c.id ? { ...x, pinned: c.pinned } : x))))
      setErr('Could not save that pin. Try again.')
    }
  }

  /** Delete a chat and everything in it. */
  const removeChat = async (c: { id: string; title: string }) => {
    // NO BROWSER DIALOG. window.confirm greys out the whole app behind a box
    // that says "text2art.app says" in a font we do not control and cannot
    // style — it looks like the site has been taken over by something. The
    // asking now happens inline, in the row itself, where the thing being
    // deleted is still visible next to the question.

    const res = await fetch(`/api/flyer-chats/${c.id}`, { method: 'DELETE' })
      .then((r) => r.json()).catch(() => ({ error: 'Network error' }))
    if (res?.error) { setErr(res.error); return }

    const left = chats.filter((x) => x.id !== c.id)
    setChats(left)
    // Deleting the chat you are looking at has to move you somewhere real,
    // not leave the thread of a job that no longer exists on screen.
    if (c.id === chatId) {
      const next = left[0]?.id ?? null
      setChatId(next)
      rememberChat(next)
      setOpenChatKey((k) => k + 1)
    }
  }

  /** Open a saved project chat. */
  const openChat = (id: string) => {
    setDrawerOpen(false) // on a phone, choosing a job returns you to the work
    if (id === chatId) return
    setChatId(id)
    rememberChat(id)
    setOpenChatKey((k) => k + 1)
    setSheet(null)
  }

  /**
   * Start a fresh job.
   *
   * The chat row is NOT created here — an empty chat in the sidebar that was
   * opened and abandoned is clutter. The id is minted now and the row appears
   * the first time something is actually made.
   */
  const newChat = () => {
    setDrawerOpen(false) // on a phone, starting fresh returns you to the work
    // Deliberately does NOT reload from the server. There is nothing saved
    // under a chat that has never been used, so a fetch could only come back
    // empty — and the round trip cost a flicker and, until the server was
    // fixed, dumped the customer back into the previous conversation.
    const fresh = crypto.randomUUID()
    setChatId(fresh)
    rememberChat(fresh)
    setItems([
      { kind: 'msg', role: 'assistant', text: HELLO, },
      ])
    // A NEW JOB STARTS EMPTY. Formats, the look and the photos-already-offered
    // flag used to survive into the next chat, so the new job silently
    // inherited the last one's choices — and then never asked, because from the
    // app's point of view they were already answered.
    setFields({}); setNote(''); setPhotos([]); setReference(null)
    setTicked([]); setKind(null); setPhotosAsked(false); setDeckPlan(null); setArtNote('')
    setBrandAsked(false)
    setStylePicked(false); setSizesPicked(false)
    setInput(''); setErr(''); setSheet(null)
    setDeckPlan(null)
  }

  /** Wipe the conversation and start over — settings and saved history stay. */
  const clearChat = () => {
    setConfirmClear(false)
    setItems([
      { kind: 'msg', role: 'assistant', text: HELLO, },
      ])
    setFields({})
    setInput('')
    setErr('')
  }

  /**
   * Read a document and use its words as the content.
   *
   * The fourth way in, beside typing, pasting and asking me to write it — and
   * the strongest one, because most people already HAVE the words. A one-pager,
   * a price list, a menu, a report. Retyping those into a chat box just to get
   * them back as a design is work nobody should have to do.
   *
   * Reuses /api/extract-doc, which has read PDFs and Word files for Docs2Video
   * for months and takes a file directly — so there is no upload step to build
   * and no second place for this to break.
   */
  const readDocument = async (file: File) => {
    if (thinking || readingDoc) return
    if (file.size > 20 * 1024 * 1024) {
      setErr('That file is over 20 MB. Try a smaller one, or paste the important part in.')
      return
    }
    setErr(''); setReadingDoc(true)
    say('user', `📄 ${file.name}`)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/extract-doc', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(data?.error || 'Could not read that document. Try pasting the text in instead.')
        return
      }

      // Flatten what came back. The extractor returns a title and sections; the
      // assistant is better at choosing a headline out of that than any rule
      // here would be, so it gets the words rather than a guess.
      const sections: { heading?: string; content?: string }[] = data.sections ?? []
      const full = [
        data.title,
        sections.map((s) => [s.heading, s.content].filter(Boolean).join('\n')).join('\n\n'),
      ].filter(Boolean).join('\n\n').trim().slice(0, 12_000)

      if (!full) {
        setErr('That document came back empty — it may be a scan with no real text in it. Try pasting the words in.')
        return
      }

      say('assistant', `Read ${file.name} — about ${full.split(/\s+/).length} words. Working out what goes on the design…`)
      await ask(`Here is the source material for this job. Use it as the content:\n\n${full}`)
    } catch {
      setErr('Could not read that document. Try pasting the text in instead.')
    } finally {
      setReadingDoc(false)
    }
  }




  /**
   * Put a picker in the thread.
   *
   * Only one of each kind stays open. Asking twice for formats should re-open
   * the one you already have rather than stack a second copy under it, which
   * would leave two live pickers disagreeing about the same choice.
   */
  const openCard = (card: CardKind) => {
    setItems((p) => {
      const live = p.some((i) => i.kind === 'card' && i.card === card)
      if (live) return p
      return [...p, { kind: 'card', id: crypto.randomUUID(), card }]
    })
  }

  /**
   * ASK A QUESTION — in the ONE place that question is asked.
   *
   * This is the fix for the whole class of mess, not one instance of it.
   * Anything that wanted an answer used to push a card into the chat, and
   * three of those questions — the look, the sizes, the photos — were already
   * rows in the steps rail a few inches away. So the screen grew the same
   * picker twice, once even under the identical heading "How should it look?"
   * with a second wall of the same thumbnails. The two copies did not behave
   * alike either, because they were two pieces of code.
   *
   * Everything routes through here now. If the rail owns the question, the
   * rail's row opens. Only the two questions the rail has no row for — how
   * many slides, whose brand — are still cards in the conversation.
   */
  const ROW_FOR: Record<string, Step> = {
    start: 'kind', content: 'content', styles: 'look', photos: 'photos', formats: 'notes',
  }

  const openQuestion = (name: string) => {
    const row = ROW_FOR[name]
    if (row) { setOpenStep(row); return }
    if (name === 'reference' || name === 'slides' || name === 'brand') openCard(name)
  }

  /**
   * Answered: the card GOES. It does not collapse into a grey summary row.
   *
   * The collapsed rows were the pile-up. A normal job answers four cards, so
   * the thread filled with four boxes each restating a choice that was already
   * sitting next to it as a message. Two things saying the same thing, and one
   * of them a panel.
   *
   * The choice is spoken instead, like any other turn in the conversation, and
   * changing it is what the typing box is for — "actually make it a postcard"
   * already works.
   */
  /**
   * Answer "what are you making?" — from the rail, which is now the only place
   * that asks it.
   *
   * The reply still lands in the chat. Clicking a row used to be silent while
   * clicking the identical card in the thread said "Good. What should it say?"
   * — same choice, two behaviours, because they were two pieces of code. This
   * is the one piece.
   */
  const chooseKind = (k: Kind, label: string) => {
    setKind(k)
    if (k === 'deck') { setTicked(['slide-16x9']); setSizesPicked(true) }
    say('user', label)
    say('assistant', 'Good. ' + contentGuidance(k).chat)
    setOpenStep('content')
  }

  const answerCard = (id: string, summary: string) => {
    const card = items.find((i) => i.kind === 'card' && i.id === id) as Extract<Item, { kind: 'card' }> | undefined
    setItems((p) => p.filter((i) => !(i.kind === 'card' && i.id === id)))
    say('user', summary)

    // ANSWERING ONE QUESTION ASKS THE NEXT. Without this a card vanishes and
    // nothing happens — the customer clicks "Make a graphic" and the screen
    // just goes blank on them, which is exactly what it did: only the slide
    // deck had a follow-on, so the other three starters led nowhere.
    // WHAT IT SAYS COMES BEFORE HOW IT LOOKS. Choosing a style for a job you
    // have not described yet is choosing blind — and the six suggestions are
    // picked FROM the description, so asking first makes them better too.
    if (card?.card === 'brand') return openQuestion('formats')
    
    if (card?.card === 'slides') return openQuestion('formats')
    if (card?.card === 'reference') {
      if (!photosAsked) { setPhotosAsked(true); return openQuestion('photos') }
    }
  }

  /**
   * Close the look question once a look has been chosen ANYWHERE.
   *
   * The look row closes itself, because it watches whether a look exists. The
   * bring-your-own-design card cannot: a style chosen from the middle of the
   * screen or the full-screen picker never told it anything, so it sat there
   * with no way to close it and nothing to move on to.
   *
   * Watching the ANSWER rather than the button means every route in closes the
   * question, including any added later.
   */
  useEffect(() => {
    const open = items.find((i): i is Extract<Item, { kind: 'card' }> => i.kind === 'card')
    if (open?.card !== 'reference') return
    if (!stylePicked && !reference) return
    const t = FLYER_TEMPLATES.find((x) => x.id === templateId)
    answerCard(open.id, reference ? 'your own design' : t?.name ?? 'that look')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stylePicked, reference, templateId, items])

  /** Formats are multi-select, so this toggles rather than replaces. */
  const toggleSize = (id: string) => {
    setSizesPicked(true)
    setTicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]).slice(0, 8))
  }

  const pickStyle = (id: string) => {
    const t = FLYER_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setTemplateId(t.id); setCategory(t.category); setStylePicked(true)
  }

  const pickSlides = (n: number) => {
    setDeckCount(n); setTicked(['slide-16x9']); setSizesPicked(true)
  }

  /** Just an address, nothing else — so it was meant as "go and look at this". */
  const JUST_A_URL = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i

  const send = async () => {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    // A BARE ADDRESS MEANS GO AND LOOK. Typing a website into a design tool and
    // getting "tell me more about your event" back is the app ignoring the most
    // useful thing it was given. An address inside a sentence is left alone —
    // "put northsideheating.com at the bottom" is a contact line, not an
    // instruction to go browsing.
    if (JUST_A_URL.test(text) && !text.includes(' ')) { await takeFromUrl(text); return }
    say('user', text)
    await ask(text)
  }

  /**
   * One pipeline for everything the customer says, however it arrived —
   * typed, dictated, or lifted out of a document. The caller does the echoing
   * into the thread, because a document's entire text in a chat bubble is
   * unreadable and its filename has already been shown.
   */
  const ask = async (text: string) => {
    if (!text.trim() || thinking) return
    setErr('')
    setThinking(true)
    const history = items.filter((i): i is Extract<Item, { kind: 'msg' }> => i.kind === 'msg')
      .slice(-6).map((m) => ({ role: m.role, text: m.text }))
    // The most recent round's designs, numbered as they appear on screen, so
    // "design 2, make the price $25" means something.
    const lastRound = [...items].reverse().find((i): i is Extract<Item, { kind: 'round' }> => i.kind === 'round' && i.designs.length > 0)
    const designs = (lastRound?.designs ?? []).map((d, i) => ({ n: i + 1, sizeId: d.sizeId, label: d.label }))

    const r = await fetch('/api/flyer-chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, fields, layoutId: templateId, sizeId: ticked[0] ?? 'letter', history, designs }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setThinking(false)
    if (r?.error) { setErr(r.error); return }
    setFields(r.fields ?? {})

    // LET THE CONVERSATION CHOOSE THE LOOK. It always returned a suggestion and
    // the page used to throw it away, which is how a request for an estate
    // agent's business card came back designed as a nightclub flyer — the
    // default style is a club night, and nothing ever moved it.
    const notes: string[] = []
    if (!stylePicked && r.layoutId && r.layoutId !== templateId) {
      const t = FLYER_TEMPLATES.find((x) => x.id === r.layoutId)
      // Move the SUGGESTIONS, not the choice. This used to set the style
      // outright and announce "I set the look to Confetti Pop" — a decision
      // made on the customer's behalf, with their credits, for something they
      // were never shown. Now it only decides which six the styles card offers.
      if (t) { setTemplateId(t.id); setCategory(t.category) }
    }

    // ASKED FOR ONE DESIGN BACK. "design 2, make the price $25" queues up just
    // that size, so pressing Make redoes the one they meant instead of the
    // whole batch again — which would charge for sizes they were happy with.
    // This overrides a manual size choice, because naming a number IS a choice.
    if (r.redoSizeId) {
      const s = FLYER_SIZES.find((x) => x.id === r.redoSizeId)
      if (s) {
        setTicked([s.id]); setSizesPicked(true)
        const n = designs.find((d) => d.sizeId === s.id)?.n
        notes.push(`queued up design ${n ?? ''} (${s.label}) to be redone on its own`.replace('  ', ' '))
      }
    }
    // The assistant's suggested SIZE is deliberately not applied. This is the
    // same fault as the style one line above: it silently ticked a format, so
    // the formats question never needed asking and the customer never saw it.
    // The suggestion still steers which group of formats leads; it does not
    // make the choice.

    // Say what was changed on your behalf. A tool that silently rearranges your
    // settings is unnerving even when it guesses right.
    say('assistant', (r.reply || 'Got it.') + (notes.length ? ` (I ${notes.join(' and ')} — I've noted that.)` : ''))

    // THE ASSISTANT ASKED FOR A PICKER. This one line is what stops it typing
    // out twenty-three formats: choosing is no longer something it can do with
    // words, so when a choice is needed it names one of these and the real
    // thing opens here, in the conversation, where the answer belongs.
    // Keep what they said about the PICTURE. Appended rather than replaced,
    // so "make it a radio" and then "at night" both survive.
    if (r.subject) setArtNote((p) => (p ? `${p} ${r.subject}` : String(r.subject)).slice(0, 600))

    if (r.show) openQuestion(String(r.show))
    else askNext(r.fields ?? {})
  }

  /**
   * Open the next question the customer has not answered yet.
   *
   * THE APP GUARANTEES THIS rather than hoping the assistant remembers. A
   * customer described a birthday flyer and went straight to two finished
   * designs for 400 credits, having never been shown a format, a style, or the
   * photo upload — because the assistant was busy collecting the wording and
   * never got round to offering a choice.
   *
   * The assistant can still open a picker whenever it wants, and that stays
   * useful for "show me the styles" out of nowhere. But the sequence does not
   * DEPEND on its judgement. Judgement decides the extras; code decides the
   * things that must happen before any money is spent.
   */
  const askNext = (f: FlyerFields) => {
    const hasContent = Object.values(f).some((v) => (Array.isArray(v) ? v.length : v))
    if (!hasContent) return
    if (kind === 'deck' && deckCount === 0) return openQuestion('slides')
    // Ask whose brand it is BEFORE the look, because the brand largely IS the
    // look — colours, logo and tone all come from it.
    if (brands.length && brandId === null && !brandAsked) { setBrandAsked(true); return openQuestion('brand') }
    // THE SAME ORDERED LIST the rail draws and the hint reads. This used to be
    // its own third copy of the order, and it disagreed with both: it asked for
    // sizes before the look, so the rail jumped from row 2 to row 5 and left 3
    // behind. The list is numbered, and people read numbered lists downwards.
    const next = TODO.find((s) => !s.done && s.row !== 'kind' && s.row !== 'content')
    if (next) return setOpenStep(next.row)
    // Photos are optional, so they are not in that list — offered once, after
    // everything that is actually required has been answered.
    if (!photosAsked) { setPhotosAsked(true); return openQuestion('photos') }
  }

  // ONE REQUEST PER SIZE, not one for all of them. Asking for everything at
  // once means nothing appears until the last one lands; split apart, each
  // design shows the moment it is ready, the bar counts real completions
  // rather than a made-up percentage, and one failure costs one size.
  /**
   * Work out the running order. Costs nothing — no picture is drawn yet.
   */
  const planTheDeck = async () => {
    if (planning) return
    const brief = [
      note.trim(),
      ...items.filter((i): i is Extract<Item, { kind: 'msg' }> => i.kind === 'msg' && i.role === 'user')
        .slice(-6).map((m) => m.text),
    ].filter(Boolean).join('\n')

    if (brief.trim().length < 10) {
      setErr('Tell me what the deck is about first — a sentence or two in the box below.')
      return
    }
    setErr(''); setPlanning(true)
    try {
      const res = await fetch('/api/flyer-deck', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief, slides: deckCount }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.slides?.length) {
        setErr(data?.error || 'Could not plan that deck.')
        return
      }
      setDeckPlan(data); setPlanOpen(true)
      say('assistant',
        `Here's the running order for "${data.title}" — ${data.slides.length} slides. ` +
        `Read it and tell me anything you want changed. Nothing is drawn yet, so changes are free. ` +
        `When it looks right, press Make deck.`)
    } catch {
      setErr('Network error while planning the deck.')
    } finally {
      setPlanning(false)
    }
  }

  /**
   * Draw the deck.
   *
   * THE FIRST SLIDE ANCHORS THE REST. Twelve slides generated independently in
   * "the same style" drift apart — the same words for a look do not produce the
   * same palette twice, and a deck whose slides don't match is worse than one
   * plain template. So slide one is drawn on its own, and every slide after it
   * is drawn with slide one attached as the reference. That is the same
   * machinery a customer uses to copy their own design, pointed inward.
   *
   * The cost of that: the first slide is a bottleneck, about two minutes before
   * the rest can start. Worth it — the alternative is a deck you cannot present.
   */
  const makeDeck = async (retry?: {
    /** The deck already on screen, being topped up rather than replaced. */
    deckId: string
    /** Which slide positions failed and are being drawn again. */
    indices: number[]
    slides: PlannedSlide[]
    /** Slide one, already drawn, so the retries still match the deck. */
    anchorSrc?: string
  }) => {
    if (making || !unit) return
    if (!retry && !deckPlan) return
    setErr(''); setSheet(null); setPlanOpen(false)

    const chat = chatId ?? crypto.randomUUID()
    if (!chatId) { setChatId(chat); rememberChat(chat) }

    const roundId = retry?.deckId ?? crypto.randomUUID()
    const plan = retry ? { title: '', slides: retry.slides } : deckPlan!
    const messages = items.filter((i): i is Extract<Item, { kind: 'msg' }> => i.kind === 'msg')
      .slice(-12).map((m) => ({ role: m.role, text: m.text }))

    if (retry) {
      // Approving or retrying both clear the pause.
      // Put the failed ones back to waiting. The slides that worked stay
      // exactly as they are — they are drawn, saved and paid for, and redrawing
      // them would charge twice for work already done.
      setItems((p) => p.map((i) => (i.kind === 'deck' && i.id === roundId
        ? { ...i, live: true, awaiting: false, startedAt: Date.now(), status: { ...i.status, ...Object.fromEntries(retry.indices.map((n) => [n, 'wait' as Status])) } }
        : i)))
    } else {
      setItems((p) => [...p, {
        kind: 'deck', id: roundId, title: plan.title, slides: plan.slides,
        designs: [], status: Object.fromEntries(plan.slides.map((_, i) => [i, 'wait' as Status])),
        startedAt: Date.now(), live: true,
      }])
    }
    setMaking(true)

    const patch = (fn: (r: Extract<Item, { kind: 'deck' }>) => Extract<Item, { kind: 'deck' }>) =>
      setItems((p) => p.map((i) => (i.kind === 'deck' && i.id === roundId ? fn(i) : i)))

    const failures: string[] = []
    let stop = ''

    const drawSlide = async (index: number, anchor?: string) => {
      const slide = plan.slides[index]
      patch((r) => ({ ...r, status: { ...r.status, [index]: 'busy' } }))
      const res = await fetch('/api/flyer-art', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          templateId,
          sizeIds: ['slide-16x9'],
          fields: slide.fields,
          note: [DECK_DIRECTION[slide.role] ?? DECK_DIRECTION.point, note.trim(), artNote].filter(Boolean).join(' '),
          // Slide one carries the customer's own reference if they gave one;
          // every later slide is anchored to slide one instead.
          referenceDataUrl: anchor ?? reference?.dataUrl,
          brandId,
          roundId, chatId: chat, messages,
        }),
      }).then(async (x) => {
        // SAY WHICH FAILURE THIS WAS. Every one of these used to land in a
        // single catch reporting "Network error", which is the least useful
        // thing it could have said — it sent me hunting a payload-size problem
        // that measurement then showed was not happening at all.
        //
        // Slide one is GENERATED. Every later slide is EDITED, because it
        // carries the anchor image. Editing is the slower call, so a timeout
        // lands on slides two onward and looks like the anchor is at fault
        // when the real answer is that the slide took too long.
        if (x.status === 413) return { error: 'That slide was too large to send.' }
        if (x.status === 502 || x.status === 504) {
          return { error: 'That slide took too long and the connection was cut before it finished.' }
        }
        const body = await x.text()
        try { return JSON.parse(body) } catch {
          return { error: `The server replied with something unreadable (status ${x.status}).` }
        }
      }).catch((e) => ({ error: `Could not reach the server — ${e instanceof Error ? e.message : 'unknown'}` }))

      if (res?.images?.length) {
        const img = res.images[0]
        patch((r) => ({
          ...r,
          // REPLACE, don't append. On a retry the slot may already hold a
          // failed attempt, and appending would leave two slide 4s in the deck.
          designs: [
            ...r.designs.filter((d) => d.sizeId !== `slide-${index + 1}`),
            { sizeId: `slide-${index + 1}`, label: `Slide ${index + 1}`, w: img.w, h: img.h, src: img.png, designId: img.designId, checked: img.checked, misspelled: img.misspelled },
          ],
          status: { ...r.status, [index]: 'done' },
        }))
        setBalance((b) => (b === null ? b : Math.max(0, b - unit)))
        return img.png as string
      }
      if (res?.needed) stop = res.error || 'Not enough credits'
      failures.push(`Slide ${index + 1}: ${res?.failed?.[0]?.error || res?.error || 'no reason given'}`)
      patch((r) => ({ ...r, status: { ...r.status, [index]: 'fail' } }))
      return null
    }

    // On a retry slide one already exists, so it is reused as the anchor rather
    // than drawn again — the whole point is not to pay twice.
    const full = retry
      ? retry.anchorSrc ?? null
      : await drawSlide(0)
    // Send it on as a SMALL reference, not the multi-megabyte original — see
    // shrinkForReference.
    const anchor = full ? await shrinkForReference(full) : null

    /**
     * STOP AND SHOW SLIDE ONE.
     *
     * A twelve-slide deck is about eighteen minutes and 2,400 credits, and the
     * look was only visible at the END of it — so a style that turned out wrong
     * cost the whole thing. Slide one is drawn, shown, and nothing else happens
     * until it is approved: 200 credits to find out, instead of 2,400.
     *
     * Carrying on is the RETRY path with every slide but the first — the same
     * code, the same anchor, so approving cannot drift from redrawing.
     */
    if (!retry && anchor && !stop) {
      patch((r) => ({ ...r, live: false, awaiting: true }))
      setMaking(false)
      say('assistant',
        `Here's slide one. Everything else will be drawn to match it, so it is worth a look now — ` +
        `the other ${plan.slides.length - 1} cost ${unit ? (unit * (plan.slides.length - 1)).toLocaleString() + ' credits' : 'the rest of the credits'} ` +
        `and about ${mmss(Math.ceil((plan.slides.length - 1) / CONCURRENCY) * SECS_PER_SIZE)}. ` +
        `Happy with the look, or shall we try a different one?`)
      return
    }

    if (anchor && !stop) {
      const queue = retry
        ? retry.indices.filter((i) => i !== 0)
        : plan.slides.map((_, i) => i).slice(1)
      const worker = async () => {
        for (;;) {
          const i = queue.shift()
          if (i === undefined || stop) return
          await drawSlide(i, anchor)
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
    } else if (!stop) {
      // Without slide one there is nothing to match, and drawing the rest
      // unanchored would produce eleven slides that do not belong together.
      stop = 'The first slide failed, so the rest were not drawn — they would not have matched. You were only charged for the one attempt.'
    }

    patch((r) => ({
      ...r, live: false,
      status: Object.fromEntries(Object.entries(r.status).map(([k, v]) => [k, v === 'wait' || v === 'busy' ? 'fail' : v])),
    }))
    setMaking(false)
    if (stop) setErr(stop)
    else if (failures.length) setErr(`${failures.length} slide${failures.length === 1 ? '' : 's'} failed — you were not charged for those. ${failures.slice(0, 3).join(' · ')}`)
  }

  const make = async () => {
    if (making || !ticked.length || !unit) return
    setErr(''); setSheet(null)

    // Every job lives in a chat. If this is the first thing made in a brand
    // new session there is no id yet, so mint one now.
    const chat = chatId ?? crypto.randomUUID()
    if (!chatId) { setChatId(chat); rememberChat(chat) }

    const roundId = crypto.randomUUID()
    const sizeIds = [...ticked]
    const messages = items.filter((i): i is Extract<Item, { kind: 'msg' }> => i.kind === 'msg')
      .slice(-12).map((m) => ({ role: m.role, text: m.text }))

    setItems((p) => [...p, {
      kind: 'round', id: roundId, templateId, note, sizeIds,
      designs: [], status: Object.fromEntries(sizeIds.map((s) => [s, 'wait' as Status])),
      startedAt: Date.now(), live: true,
    }])
    setMaking(true)

    const patch = (fn: (r: Extract<Item, { kind: 'round' }>) => Extract<Item, { kind: 'round' }>) =>
      setItems((p) => p.map((i) => (i.kind === 'round' && i.id === roundId ? fn(i) : i)))

    const queue = [...sizeIds]
    const failures: { label: string; why: string }[] = []
    let stop = ''

    const worker = async () => {
      for (;;) {
        const id = queue.shift()
        if (!id || stop) return
        patch((r) => ({ ...r, status: { ...r.status, [id]: 'busy' } }))
        const payload = JSON.stringify({
          templateId, sizeIds: [id], fields,
          note: [note.trim(), artNote].filter(Boolean).join(' ') || undefined,
          photos: photos.map(({ dataUrl, role }) => ({ dataUrl, role })),
          referenceDataUrl: reference?.dataUrl,
        brandId,
        bleed,
          roundId, chatId: chat, messages,
        })

        // BELT AND BRACES. The photos are shrunk on the way in, so this should
        // never trigger — but if it ever does, the customer gets a sentence
        // naming the cause instead of a bare 413 in the console.
        if (payload.length > 4_000_000) {
          stop = 'Those images are too large to send even after shrinking. Remove one and try again.'
          patch((r) => ({ ...r, status: { ...r.status, [id]: 'fail' } }))
          failures.push({ label: FLYER_SIZES.find((s) => s.id === id)?.label ?? id, why: stop })
          return
        }

        const res = await fetch('/api/flyer-art', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: payload,
        }).then(async (x) => {
          // A 413 never reaches the route, so it has no JSON body and no
          // friendly message — it must be recognised here or it surfaces as
          // "Network error", which is what happened.
          if (x.status === 413) return { error: 'Those images were too large to upload. Remove one and try again.', failed: [{ error: 'request too large (413)' }] }
          return x.json()
        }).catch(() => ({ error: 'Network error' }))

        if (res?.images?.length) {
          const img = res.images[0]
          patch((r) => ({
            ...r,
            designs: [...r.designs, { sizeId: img.sizeId, label: img.label, w: img.w, h: img.h, src: img.png, designId: img.designId }],
            status: { ...r.status, [id]: 'done' },
          }))
          setBalance((b) => (b === null ? b : Math.max(0, b - unit)))
        } else {
          // Running out of credits mid-batch should stop the queue, not
          // produce one identical failure per remaining size.
          if (res?.needed) stop = res.error || 'Not enough credits'

          // KEEP THE REASON. This used to record only the size label, so the
          // customer got "Could not make: Flyer 8.5 x 11 in" and no way to tell
          // whether their photo was rejected, the service was busy, or
          // something needed changing. The server sends a reason; throwing it
          // away made the app unfixable from the outside AND undiagnosable from
          // the inside.
          const why = res?.failed?.[0]?.error || res?.error || 'no reason given'
          failures.push({ label: FLYER_SIZES.find((s) => s.id === id)?.label ?? id, why })
          patch((r) => ({ ...r, status: { ...r.status, [id]: 'fail' } }))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sizeIds.length) }, worker))
    // Anything the credit stop skipped never ran; don't leave it spinning.
    patch((r) => ({
      ...r, live: false, failed: failures.map((f) => f.label),
      status: Object.fromEntries(Object.entries(r.status).map(([k, v]) => [k, v === 'wait' || v === 'busy' ? 'fail' : v])),
    }))
    setMaking(false)
    if (stop) {
      setErr(stop)
    } else if (failures.length) {
      // Group by reason: six sizes failing for one cause should read as one
      // problem, not six. And the reason comes FIRST, because that is the part
      // anyone can act on.
      const byReason = new Map<string, string[]>()
      for (const f of failures) byReason.set(f.why, [...(byReason.get(f.why) ?? []), f.label])
      const lines = [...byReason.entries()].map(([why, labels]) => `${why} (${labels.join(', ')})`)
      setErr(`Couldn't make ${failures.length === 1 ? 'that one' : `${failures.length} of them`} — you were not charged. ${lines.join(' · ')}`)
    }

    // The chat row is only created once something is actually made, so refresh
    // the sidebar now — otherwise a brand-new job stays missing from the list
    // until the next page load. Take ONLY the list: re-reading the rounds here
    // would replace designs that are already on screen.
    fetch(`/api/flyer-history?chat=${chat}`)
      .then((x) => x.json())
      .then((r) => { if (r?.chats) setChats(r.chats) })
      .catch(() => { /* the list refreshes on the next load anyway */ })
  }

  const filled = Object.values(fields).some((v) => (Array.isArray(v) ? v.length : v))
  const cost = unit === null ? null : unit * ticked.length
  /**
   * What is still missing, in the order it will be asked for.
   *
   * Make is not merely disabled — it SAYS what it is waiting for. A dead button
   * with no explanation is how someone ends up pressing the one live control on
   * the screen and buying something they had not designed yet.
   */
  /**
   * THE JOB, AS ONE ORDERED LIST — used by everything that needs it.
   *
   * There were three copies of this order: which row opens next, what the
   * "Next: ..." hint says, and which question gets asked once you describe the
   * job. They disagreed. The assistant jumped from row 2 to row 5, and the
   * hint said "pick a format" while row 3 sat open asking about the look.
   * Three lists means two of them are wrong and nobody notices.
   */
  const TODO: { row: Step; done: boolean; ask: string }[] = [
    { row: 'kind', done: Boolean(kind), ask: 'tell me what you are making' },
    { row: 'content', done: filled, ask: 'tell me what it should say' },
    { row: 'look', done: stylePicked || Boolean(reference), ask: 'pick a look' },
    { row: 'notes', done: ticked.length > 0, ask: 'pick a format' },
  ]
  const firstUndone: Step = TODO.find((s) => !s.done)?.row ?? null
  const shownStep = openStep ?? firstUndone

  // The same list, so the hint can never name a different step from the one
  // sitting open a few inches above it.
  const missing = TODO.find((s) => !s.done && s.row !== 'kind')?.ask ?? null
  const canMake = !making && !missing && unit !== null


  /**
   * Six looks worth showing, rather than all 225.
   *
   * Chosen from the category that suits what is being made, because by this
   * point the conversation knows it is an accounting firm and not a nightclub —
   * and opening a business deck on a wall of club flyers is the same mistake as
   * asking for the look before the format. "See all" is one click away for
   * anyone who wants the full grid.
   */
  const suggestedStyles = (() => {
    const inCategory = VISIBLE_STYLES.filter((t) => t.category === category)
    const chosen = VISIBLE_STYLES.find((t) => t.id === templateId)
    // Always include whatever is currently selected, so the tile they picked
    // last time does not vanish from the six.
    const pool = chosen && !inCategory.some((t) => t.id === chosen.id) ? [chosen, ...inCategory] : inCategory
    return pool.slice(0, 6)
  })()

  /**
   * Which step is worth doing next.
   *
   * Read off what is actually answered rather than tracked as a position, so
   * jumping around, coming back to a saved chat, or being handed a format by
   * the conversation all leave it correct. A remembered step number would go
   * stale the moment somebody did things out of order — which they will.
   *
   * Photos are never "next": they are optional, and pointing at them implies
   * they are owed.
   */
  const nextStep: 'sizes' | 'content' | 'style' | null =
    !ticked.length ? 'sizes'
    : !filled ? 'content'
    : !stylePicked && !reference ? 'style'
    : null

  const styleName = FLYER_TEMPLATES.find((t) => t.id === templateId)?.name ?? 'Style'


  // ── styling ────────────────────────────────────────────────────────────
  const panel = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 10, padding: 14 } as const
  const darkBtn = { padding: '10px 16px', borderRadius: 8, border: 'none', background: INK, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const
  const plain = { padding: '7px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: INK } as const
  // An inline text link — for a quiet "see all" INSIDE a sentence, where a
  // boxed button would shout. Same size/colour as the surrounding text.
  const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: INK, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' } as const
  const chip = (on: boolean) => ({ ...plain, background: on ? INK : 'white', color: on ? 'white' : INK, border: on ? '1px solid transparent' : plain.border }) as const

  /**
   * WHICH ROW IS SHOWING.
   *
   * If nothing has been opened by hand, the first unanswered one. That way the
   * next thing to do is always the thing already in front of you — including
   * after reloading a saved job, where a remembered position would be wrong.
   * '__none' is how a row says "I was closed on purpose", so clicking the open
   * row shuts it rather than snapping straight back open.
   */

  /**
   * Is the wall of looks on screen in the middle?
   *
   * It shows until there is work to show instead. Both the middle and the look
   * row need to know, because they used to be two separate grids of the same
   * tiles side by side — and the row can only say "pick one in the middle"
   * while there IS a middle to pick from.
   */
  const examplesShowing = !items.some((it) => it.kind === 'round' || it.kind === 'deck') && !loadingHistory

  /**
   * THE SIZES, RIGHT IN ROW 5 — no button behind the row, no panel behind
   * the button. "What sizes?" is a required decision, and it used to be two
   * clicks down: open the row, then press "Choose sizes" to open a separate
   * panel. Opening the row now IS the picker. The group that matches what you
   * are making leads (orderedGroups), each size shows its own credit cost,
   * and the bleed toggle, the note and the whole-deck shortcut come with it
   * because they all belong to the same decision.
   */
  const sizesPicker = () => (
    <>
                {orderedGroups(kind).map((g) => (
                  <div key={g.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: SOFT, marginBottom: 5 }}>{g.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 3 }}>
                      {FLYER_SIZES.filter((s) => s.group === g.id).map((s) => (
                        <label key={s.id} className={strobeId === s.id ? 'cg-strobe' : undefined}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', padding: '3px 6px', borderRadius: 6 }}>
                          <input type="checkbox" checked={ticked.includes(s.id)}
                            onChange={(e) => {
                              setSizesPicked(true)
                              setTicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)).slice(0, 8))
                              markPicked(s.id)
                            }} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                          {/* Each design is priced the same, so the per-size cost
                              is the same number — but showing it on every line is
                              what makes "eight sizes" read as a real amount before
                              the button rather than a surprise after. */}
                          {unit !== null && (
                            <span style={{ fontSize: 11, color: SOFT, flexShrink: 0 }}>{unit.toLocaleString()} cr</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* BLEED. Only offered when something printable is ticked,
                    because it means nothing for an Instagram post or a slide.

                    Off by default: the common case is printing at home or on an
                    office machine, where the paper CANNOT be printed edge to
                    edge, and a file with bleed would come out with the design
                    shrunk and a white frame round it. Someone sending work to a
                    real printer knows to tick this; someone who doesn't
                    shouldn't be handed a file they can't use. */}
                {ticked.some((id) => { const s = FLYER_SIZES.find((x) => x.id === id); return s && canBleed(s) }) && (
                  <label
                    title="Tick this only if a professional printer is producing it. It adds an eighth of an inch of extra artwork on every edge for them to trim into, so the colour reaches the very edge of the paper with no white sliver."
                    style={{
                      display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 4, marginBottom: 12,
                      padding: '10px 12px', border: `1px solid ${LINE}`, borderRadius: 9, cursor: 'pointer',
                    }}>
                    <input type="checkbox" checked={bleed} style={{ marginTop: 2 }}
                      onChange={(e) => {
                        setBleed(e.target.checked)
                        say('assistant', e.target.checked
                          ? 'Print shop mode on. Printed pieces come out slightly oversize with an eighth of an inch of extra artwork on every edge, which the printer trims off — that is what stops a white sliver appearing down one side. Not what you want for printing at home.'
                          : 'Back to exact size. Right for printing at home or in the office, where the paper cannot be printed all the way to the edge anyway.')
                      }} />
                    <span>
                      <span style={{ fontSize: 13, fontWeight: 700, display: 'block' }}>Sending this to a print shop</span>
                      <span style={{ fontSize: 12.5, color: SOFT, lineHeight: 1.55 }}>
                        Adds the extra edge (&ldquo;bleed&rdquo;) a commercial printer trims off, so the colour
                        runs right to the edge of the paper. Leave it off for printing at home.
                      </span>
                    </span>
                  </label>
                )}

                <input value={note} onChange={(e) => setNote(e.target.value)}
                  title="Anything the style should do differently — a colour, a mood, something to leave out"
                  placeholder="Anything else about the look? e.g. 'use purple instead of gold'"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 13 }} />
                <p style={{ fontSize: 12, color: SOFT, margin: '8px 0 0' }}>Up to 8 at a time. Each is designed from scratch, not a crop of the others.</p>

                {/* A WHOLE DECK, rather than one slide at a time. Lives in the
                    sizes panel because that is where someone has just ticked
                    "Slide 1920x1080" and thought "actually I need twelve of
                    these". */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Or build a whole deck</div>
                  <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 10px', lineHeight: 1.55 }}>
                    Describe it in the box below and I&rsquo;ll write the running order first — free, and you
                    can change anything before a single slide is drawn. Every slide is then designed to match
                    the first one, so the deck hangs together.
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12.5, color: SOFT, display: 'flex', gap: 6, alignItems: 'center' }}
                      title="How many slides. Between 3 and 20.">
                      Slides
                      <input type="number" min={MIN_DECK} max={MAX_DECK} value={deckCount}
                        onChange={(e) => setDeckCount(Math.max(MIN_DECK, Math.min(MAX_DECK, Number(e.target.value) || MIN_DECK)))}
                        style={{ width: 62, padding: '6px 8px', borderRadius: 7, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 13 }} />
                    </label>
                    <button onClick={planTheDeck} disabled={planning}
                      title="Write the running order. Costs nothing — no slides are drawn yet."
                      style={{ ...plain, opacity: planning ? 0.6 : 1 }}>
                      {planning ? 'Planning…' : 'Plan the deck'}
                    </button>
                    {unit !== null && (
                      <span style={{ fontSize: 12, color: SOFT }}>
                        {(unit * deckCount).toLocaleString()} credits when you build it
                      </span>
                    )}
                  </div>
                </div>
    </>
  )

  /** The five rows, in the order they are worth doing. */
  const STEPS: { id: Step; title: string; answer?: string; done: boolean; optional?: boolean; body: React.ReactNode }[] = [
    {
      id: 'kind', title: 'What are you making?', done: Boolean(kind),
      answer: STARTERS.find((x) => x.kind === kind)?.label,
      body: (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
            {STARTERS.map((x) => (
              <button key={x.kind} onClick={() => chooseKind(x.kind, x.label)}
                title={x.hint}
                style={{ ...plain, textAlign: 'left', padding: '10px 12px', lineHeight: 1.45,
                  background: kind === x.kind ? CREAM : 'white' }}>
                <span style={{ display: 'block', fontSize: 13 }}>{x.label}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: SOFT, marginTop: 2 }}>{x.hint}</span>
              </button>
            ))}
          </div>
          <DropHint what="Already have your logo, photos or a design you like?"
            pasteKey={pasteKey} onFiles={(f) => void takeDropped(f)}
            line={LINE} soft={SOFT} ink={INK} />
          {/* THE ONE LINE WORTH KEEPING from the card that used to duplicate
              this entire row. The box above takes files; this says the same
              gestures work anywhere on the page, and that a web address counts.
              Said once, in the row that is open by default. */}
          <p style={{ fontSize: 12, color: SOFT, margin: '8px 2px 0', lineHeight: 1.55 }}>
            That works anywhere on this page, as many as you like — I&rsquo;ll work out what each
            one is. A website address works too.
          </p>
        </>
      ),
    },
    {
      id: 'content', title: "What's it about?", done: filled,
      answer: fields.headline || undefined,
      // Same source as the chat reply after picking a kind — a deck is asked
      // what it is about, a flyer what it should say. They cannot disagree now.
      body: (
        <p style={{ fontSize: 12.5, color: SOFT, margin: 0, lineHeight: 1.6 }}>
          {contentGuidance(kind).body}
        </p>
      ),
    },
    {
      id: 'look', title: 'How should it look?',
      done: stylePicked || Boolean(reference),
      answer: reference ? 'your own design' : stylePicked ? styleName : undefined,
      // THE ONE PLACE YOU PICK A LOOK. The middle is a preview stage now, not a
      // picker — so the choosing lives here: a few suggested looks, "see all"
      // for the full browser, or drop your own. Whatever you pick loads into
      // the middle preview so you can see the style before you Make.
      body: (
        <>
          {reference ? (
            // Their own design is attached — show it, with a way to drop back to our looks.
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
              <img src={reference.dataUrl} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: `1px solid ${LINE}` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Working from your own design</div>
                <button onClick={() => setReference(null)} style={linkBtn}>Use one of our looks instead</button>
              </div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 10px', lineHeight: 1.55 }}>
                Pick a look — it loads into the preview so you can see the style.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {suggestedStyles.map((t) => (
                  <button key={t.id} onClick={() => pickStyle(t.id)}
                    title={`The ${t.name} look`}
                    style={{ padding: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer', background: '#111',
                      border: templateId === t.id && stylePicked ? `3px solid ${INK}` : `1px solid ${LINE}` }}>
                    <img src={thumbUrl(t.id)} alt={t.name} loading="lazy"
                      style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                    <div style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 3px', background: 'white', color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                <button style={plain} onClick={() => setBrowseLooks(true)}>See all {VISIBLE_STYLES.length} looks</button>
                {brands.length > 0 && (
                  <button style={plain} title="Use your saved colours and logo"
                    onClick={() => { setBrandId(brands[0].id); markPicked('brand') }}>
                    Use my {brands[0].name} colours
                  </button>
                )}
              </div>
            </>
          )}
          <DropHint what="Or work from a design you already like"
            pasteKey={pasteKey} onFiles={(f) => void attachReference(f[0], f[0].name)}
            line={LINE} soft={SOFT} ink={INK} />
        </>
      ),
    },
    {
      id: 'photos', title: 'Your logo and photos', optional: true,
      done: photos.length > 0,
      answer: photos.length ? `${photos.length} added` : undefined,
      body: (
        <>
          <PhotoSheet photos={photos} setPhotos={setPhotos} plain={plain}
            addPhoto={addPhoto} onPicked={() => markPicked('photo')} />
          <DropHint what="Drop your logo, a headshot, the property or the product"
            pasteKey={pasteKey} onFiles={(f) => void takeDropped(f)}
            line={LINE} soft={SOFT} ink={INK} />
        </>
      ),
    },
    {
      id: 'notes', title: 'What sizes?', done: ticked.length > 0,
      answer: ticked.length ? `${ticked.length} size${ticked.length === 1 ? '' : 's'}` : undefined,
      // THE PICKER IS THE ROW. It used to be a button ("Choose sizes") that
      // opened a separate panel — a required decision two clicks down. Opening
      // the row now shows the sizes themselves.
      body: (
        <>
          <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 10px' }}>
            Tick as many as you need. Each one is designed from scratch{unit !== null ? `, ${unit.toLocaleString()} credits each` : ''}.
          </p>
          {sizesPicker()}
        </>
      ),
    },
  ]

  /**
   * THE FULL LOOK BROWSER — rendered in the WIDE middle column, not the rail.
   *
   * This used to open as a cramped panel inside the 420px rail, its tiles and
   * category chips squeezed next to the wide middle column that exists FOR
   * browsing looks. It is the same browser; only where it lives changed. One
   * definition, called once (from the middle when browseLooks is on), so there
   * is never a second grid of the same thumbnails — the thing
   * no-duplicate-asks.mjs watches for.
   */
  const exitBrowse = () => { setBrowseLooks(false); setUnacked(false); setStrobeId(null) }
  const styleBrowser = () => (
    <>
                {/* ONE OR THE OTHER, never both. A style and a reference are
                    each a complete instruction about how the design should
                    look; supply two and the result follows neither. Rather
                    than let someone set both and get a muddle, choosing one
                    clears the other and says so. */}
                <p style={{ fontSize: 13, color: SOFT, margin: '0 0 12px', lineHeight: 1.55 }}>
                  Use <strong style={{ color: INK }}>one of our looks</strong> or{' '}
                  <strong style={{ color: INK }}>a design of your own to work from</strong> — one or the
                  other, not both. Each is a full instruction for how it should look, and two at once means
                  the design follows neither. Picking one clears the other.
                </p>

                {reference ? (
                  <div className={strobeId === 'reference' ? 'cg-strobe' : undefined}
                    title="The look of this design will be copied — its colours, lettering and layout — using your words, not its own"
                    style={{ display: 'flex', gap: 12, alignItems: 'center', border: `1px solid ${LINE}`, borderRadius: 9, padding: 10, marginBottom: 12 }}>
                    <img src={reference.dataUrl} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Copying this design&rsquo;s style</div>
                      <div style={{ fontSize: 12, color: SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reference.name}</div>
                      <div style={{ fontSize: 12, color: SOFT, marginTop: 4, lineHeight: 1.5 }}>
                        Its colours, lettering and layout — never its words, logos or photos.
                      </div>
                    </div>
                    <button onClick={() => setReference(null)} title="Remove this reference and go back to our looks"
                      style={{ ...plain, padding: '5px 9px' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const f = e.dataTransfer.files?.[0]
                      if (!f) return
                      e.preventDefault()
                      void attachReference(f, f.name)
                    }}>
                    <label title="Upload a flyer, ad or card you like the look of — yours will be designed in that style, with your words"
                      style={{ ...plain, display: 'inline-block' }}>
                      + Upload your own design to work from
                      <input type="file" accept="image/*" hidden
                        onChange={async (e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          if (f) await attachReference(f, f.name)
                        }} />
                    </label>

                    {/* WHERE TO FIND ONE. Most people have no design to hand and
                        stall here. Naming the places designers actually browse
                        turns a blank box into a five-second job.

                        The wording matters and is deliberate: the design is a
                        REFERENCE, not something to be reproduced. Those sites
                        sell licensed work, and a customer who prints a close
                        copy is exposed. The engine already enforces this — it is
                        told to take the style and never reproduce the design —
                        so this text describes what actually happens. */}
                    <p style={{ fontSize: 12.5, color: SOFT, margin: '10px 0 0', lineHeight: 1.6 }}>
                      No design to hand? Browse{' '}
                      <strong style={{ color: INK }}>Envato</strong>,{' '}
                      <strong style={{ color: INK }}>Freepik</strong> or{' '}
                      <strong style={{ color: INK }}>Creative Market</strong> for something you like the
                      look of, then <strong style={{ color: INK }}>copy the image and paste it here</strong>{' '}
                      with {pasteKey}. You can also drag one in.
                    </p>
                    <p style={{ fontSize: 12.5, color: SOFT, margin: '6px 0 0', lineHeight: 1.6 }}>
                      We don&rsquo;t copy the design itself. We read its style — the colours, the
                      lettering, the mood — and make you a new one from your own words.
                    </p>
                  </div>
                )}

                <div style={{ opacity: reference ? 0.4 : 1, pointerEvents: reference ? 'none' : 'auto' }}
                  title={reference ? 'Switched off while a reference is attached — remove it to pick one of our looks' : undefined}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {/* SHELVES ARE LOOKS NOW, NOT TRADES. "Food & drink" was
                        only ever a useful shelf while picking it also picked a
                        plate of food. Now that the subject is yours to set, the
                        thing worth browsing is the look — and the warm rustic
                        one belongs to the HVAC company just as much as to the
                        bakery. The count is shown because a shelf with three on
                        it and a shelf with thirteen are different decisions. */}
                    {STYLE_FAMILIES.map((c) => (
                      <button key={c.id} style={chip(family === c.id)} title={`${c.count} ${c.label.toLowerCase()} looks`}
                        onClick={() => {
                          setFamily(c.id); setStyleQuery(''); setStylePicked(true)
                          const first = VISIBLE_STYLES.find((t) => t.family === c.id)
                          if (first) setTemplateId(first.id)
                        }}>{c.label} <span style={{ opacity: 0.5 }}>{c.count}</span></button>
                    ))}
                  </div>

                  {/* SEARCH ACROSS EVERYTHING, including the old subjects.
                      Somebody who remembers the pumpkin sample should find that
                      look by typing "pumpkin" — even though pumpkins are no
                      longer what they would get from it. Typing searches every
                      shelf at once; clearing it returns to the chosen one. */}
                  <input
                    value={styleQuery}
                    onChange={(e) => setStyleQuery(e.target.value)}
                    placeholder="Search all looks — try gold, rustic, neon, hand-drawn…"
                    title="Search every shelf at once"
                    style={{
                      width: '100%', padding: '8px 11px', marginBottom: 10, fontSize: 13,
                      borderRadius: 8, border: `1px solid ${LINE}`, background: 'white',
                      color: INK, fontFamily: 'inherit',
                    }} />

                  {shownStyles.length === 0 && (
                    <p style={{ fontSize: 13, color: SOFT, margin: '4px 0 12px', lineHeight: 1.55 }}>
                      Nothing matches &ldquo;{styleQuery}&rdquo;. Try a plainer word, or upload a design
                      of your own above and we&rsquo;ll work from that instead.
                    </p>
                  )}

                  {/* THE ANSWER TO "CAN I USE THE HALLOWEEN ONE FOR MY HVAC
                      BUSINESS?" — said as a picture rather than a promise. */}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    fontSize: 12.5, color: SOFT, margin: '0 0 10px', lineHeight: 1.5,
                  }}>
                    <input type="checkbox" checked={onRealWork}
                      onChange={(e) => setOnRealWork(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: INK, flexShrink: 0 }} />
                    <span>
                      <strong style={{ color: INK }}>Show these on an everyday job.</strong>{' '}
                      The same van and the same words in every look — so you can see the
                      style on its own, without whatever the sample happened to be about.
                    </span>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 9 }}>
                    {shownStyles.map((t) => (
                      <button key={t.id} className={strobeId === t.id ? 'cg-strobe' : undefined}
                        // CLOSES ITSELF. One choice, made — there is nothing
                        // left to confirm, and asking for a confirmation of a
                        // thing you just clicked is the definition of clunky.
                        onClick={() => { setTemplateId(t.id); setStylePicked(true); markPicked(t.id); exitBrowse() }}
                        title={`Design it in the ${t.name} look`}
                        style={{
                          padding: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer', background: '#111',
                          border: templateId === t.id && !reference ? `3px solid ${INK}` : `1px solid ${LINE}`,
                        }}>
                        <img
                          src={onRealWork && !noProof.includes(t.id) ? proofUrl(t.id) : thumbUrl(t.id)}
                          alt={onRealWork ? `The ${t.name} look on an everyday job` : t.name}
                          // FALL BACK, DO NOT SHOW A HOLE. A look whose proof
                          // tile has not been generated yet keeps its own
                          // sample rather than turning into a broken image.
                          onError={() => setNoProof((n) => (n.includes(t.id) ? n : [...n, t.id]))}
                          style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                        <div style={{ fontSize: 11, fontWeight: 700, padding: '5px 4px', background: 'white', color: INK }}>{t.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
    </>
  )

  return (
    <>
    {/* Zero-height, in normal flow, purely to read the header's height off. */}
    <div ref={marker} />
    <div style={{
      /* STOP AT THE COOKIE BAR, not at the bottom of the window. That bar is
         pinned over everything and nothing made room for it, so a page built to
         fill the window exactly had its bottom row hidden underneath it. The
         bar publishes its own height now; with no bar the value is 0 and this
         behaves exactly as it did.

         DESKTOP is pinned to the window (position:fixed) so the columns each
         scroll once and the typing box never moves. A PHONE cannot do that —
         one tall stacked column has to scroll the PAGE, and a fixed height
         would clip the bottom of it off — so on a phone this is a normal block
         that grows as tall as it needs and lets the page scroll. */
      ...(isPhone
        ? { position: 'relative' as const, background: 'var(--bg,#F4F1EC)' }
        : { position: 'fixed' as const, top, left: 0, right: 0, bottom: 'var(--bottom-bar, 0px)',
            display: 'flex', justifyContent: 'center',
            background: 'var(--bg,#F4F1EC)', overflow: 'hidden' }),
    }}>
    <div style={{
      width: '100%', maxWidth: 1240,
      ...(isPhone
        // The big bottom padding clears the fixed composer (typing box + hint +
        // buttons) so the last row of content is never trapped beneath it.
        ? { padding: '12px 14px 180px', display: 'flex', flexDirection: 'column' as const, gap: 16 }
        : { padding: '0 20px', display: 'flex', gap: 20, overflow: 'hidden' }),
    }}>

      {/* ── PAST JOBS ──────────────────────────────────────────────────────
          One chat is one job. Without this, every design anyone ever made
          shared a single endless scrollback — fine for an afternoon, useless
          after a month. */}
      {/* CLEAR THE HEADER. The site header is pinned to the top of the window
          and is 72px tall, so sticking at 18px parked this underneath it and
          sliced the top off the New chat button as soon as you scrolled. The
          offset has to be the header's height plus a gap, and the height has
          to subtract the same amount or the list runs off the bottom. */}
      {/* No sticky offsets any more. The column is already exactly the height
          of the window, so the sidebar just fills it and scrolls its own list.
          The old `top: 88` and `calc(100vh - 108px)` were two more guesses at a
          header height that is not this page's to know. */}

      {/* PHONE TOP BAR. On a phone the past-jobs list is behind a menu instead
          of eating a third of a narrow screen, so a phone opens straight onto
          the work. The two things worth reaching without opening anything —
          the list, and starting fresh — sit up here in the flow. Desktop never
          sees this; the list is a permanent column there. order:-1 pins it to
          the very top of the stacked layout. */}
      {isPhone && (
        <div style={{ order: -1, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setDrawerOpen(true)} aria-label="Past jobs"
            title="Your past jobs" style={{ ...plain, padding: '9px 12px', fontSize: 18, lineHeight: 1 }}>☰</button>
          <button onClick={newChat} title="Start a separate job with its own conversation."
            style={{ ...darkBtn, flex: 1 }}>+ New chat</button>
        </div>
      )}

      {/* PHONE BACKDROP. Tap anything outside the drawer to close it. */}
      {isPhone && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 60 }} />
      )}

      <aside style={
        isPhone
          ? {
              // A slide-over from the left, on top of everything, only when
              // opened. Off-screen (and non-interactive) when closed so it
              // never steals a tap from the work behind it.
              position: 'fixed', top: 0, bottom: 0, left: 0, width: 264, zIndex: 61,
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform .22s ease', pointerEvents: drawerOpen ? 'auto' : 'none',
              background: 'var(--bg,#F4F1EC)', boxShadow: drawerOpen ? '2px 0 24px rgba(0,0,0,.18)' : 'none',
              padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10,
            }
          : { width: 216, flexShrink: 0, height: '100%', minHeight: 0, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }
      }>
        <button onClick={newChat} title="Start a separate job with its own conversation. Nothing is lost — this one stays in the list."
          style={{ ...darkBtn, width: '100%', flexShrink: 0 }}>
          + New chat
        </button>
        {/* THE LIST SCROLLS, THE BUTTON DOES NOT. minHeight 0 is the part that
            actually does it: without it a flex child refuses to shrink below
            its content, so a long list pushes the column taller instead of
            scrolling, and the button goes with it. */}
        <div className="scroll-visible fade-bottom"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 24 }}>
          {chats.length === 0 && !loadingHistory && (
            <p style={{ fontSize: 12, color: SOFT, margin: '4px 2px', lineHeight: 1.5 }}>
              Jobs you finish show up here, so you can come back to one.
            </p>
          )}
          {chats.map((c) => (
            confirmDelete === c.id ? (
              /* ASKED IN PLACE. A browser dialog greys out the whole app behind
                 a box headed "text2art.app says" in a font we do not control —
                 it reads as though something has gone wrong with the site. Here
                 the row itself asks, with the name of the thing still visible
                 beside the question. */
              <div key={c.id} style={{ padding: '9px 10px', borderRadius: 8, background: '#FDF3F1', border: '1px solid #E3B4A8' }}>
                <div style={{ fontSize: 12.5, color: '#B4432F', lineHeight: 1.45, marginBottom: 8 }}>
                  Delete <strong>{c.title || 'Untitled'}</strong> and every design in it? This cannot be undone.
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setConfirmDelete(null); void removeChat(c) }}
                    style={{ ...plain, padding: '4px 10px', background: '#B4432F', color: 'white', borderColor: 'transparent' }}>
                    Delete
                  </button>
                  <button onClick={() => setConfirmDelete(null)} style={{ ...plain, padding: '4px 10px', fontWeight: 400 }}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
            <div key={c.id} className="chat-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8,
                background: c.id === chatId ? 'white' : 'transparent',
                boxShadow: c.id === chatId ? `inset 0 0 0 1px ${LINE}` : 'none',
              }}>
              <button onClick={() => openChat(c.id)} title={`Open "${c.title}"`}
                style={{
                  flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 4px 9px 11px', borderRadius: 8,
                  cursor: 'pointer', border: '1px solid transparent', background: 'transparent',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: c.id === chatId ? 700 : 400,
                  color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                {/* The pin PREFIX is the always-visible sign that a row is
                    pinned — it stays whether or not the row is hovered, so the
                    pinned state never hides. The pin/delete BUTTONS below reveal
                    on hover (and stay put on touch, which has no hover). */}
                {c.pinned && <span style={{ marginRight: 5 }}>📌</span>}
                {c.title || 'Untitled'}
              </button>

              {/* Hidden until you hover the row (or on a touch device, always),
                  so a list of twenty jobs is twenty names, not sixty controls.
                  A pinned row keeps its pin button visible too, so unpinning is
                  never a hidden action. */}
              <span className={`chat-row-tools${c.pinned ? ' is-pinned' : ''}`}
                style={{ display: 'flex', alignItems: 'center' }}>
                <button onClick={() => togglePin(c)} aria-label={c.pinned ? 'Unpin' : 'Pin'}
                  title={c.pinned ? 'Unpin — let it drop back down the list' : 'Pin to the top of the list'}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 3px',
                    fontSize: 12, opacity: c.pinned ? 1 : 0.55, lineHeight: 1,
                  }}>
                  📌
                </button>
                <button onClick={() => setConfirmDelete(c.id)} aria-label="Delete"
                  title="Delete this job and every design in it — permanently"
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 7px 6px 3px',
                    fontSize: 13, opacity: 0.55, lineHeight: 1, color: INK,
                  }}>
                  ✕
                </button>
              </span>
            </div>
            )
          ))}
        </div>
      </aside>

    {/* ── THE MIDDLE: YOUR WORK, AND NOTHING ELSE ───────────────────────
        Steps, results and the typing box shared one column, so three scroll
        regions fought over the same height and the designs ended up in a
        188-pixel strip. What you PUT IN and what you GET OUT should not share
        a column at all: the work takes the middle with the full height, every
        control sits on the right, and each column scrolls exactly once. */}
    {/* On a phone this drops BELOW the rail (order:2) and takes the full width
        at its natural height — the work you PUT IN comes first, the designs you
        GET OUT follow, and the page scrolls through both. */}
    <div style={
      isPhone
        ? { order: 2, width: '100%', display: 'flex', flexDirection: 'column' }
        : { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingTop: 18, paddingRight: 18 }
    }>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>
          {storefront.nav.find((n) => n.href === '/flyer')?.label ?? 'Designs'}
        </h1>
        {unit !== null && (
          <span style={{ fontSize: 12, color: SOFT }}>
            {unit} credits per design{balance !== null && ` · ${balance.toLocaleString()} left`}
          </span>
        )}
      </div>

      {/* On a phone this does not scroll inside itself — the page scrolls. A
          fixed-height inner scroller here is what buried the designs in a strip
          on desktop, and on a phone it would trap them behind a nested bar. */}
      <div className="scroll-visible"
        style={
          isPhone
            ? { display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 0 8px' }
            : { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 0 8px' }
        }>
        {/* BROWSING ALL THE LOOKS TAKES OVER THE MIDDLE. The full browser used
            to open as a cramped panel in the 420px rail beside this wide space
            that exists FOR browsing. Now "See all looks" swaps the middle to it,
            with a clear way back. It replaces the designs/examples rather than
            adding a second grid, so there is only ever one wall of thumbnails. */}
        {browseLooks ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <button onClick={exitBrowse} style={{ ...plain }}
                title="Back to your designs">← Back</button>
              <strong style={{ fontSize: 15 }}>Pick a look</strong>
            </div>
            {styleBrowser()}
          </div>
        ) : (
        <>
        {items.map((it) => (
          it.kind === 'round' ? <RoundBlock key={it.id} round={it} now={now} onOpen={setViewing} onMoreSizes={() => openQuestion('formats')} />
          : it.kind === 'deck' ? (
            <DeckBlock key={it.id} deck={it} now={now} onOpen={setViewing}
              onApprove={() => makeDeck({
                deckId: it.id,
                // Everything except slide one, which is drawn and paid for.
                indices: it.slides.map((_, n) => n).slice(1),
                slides: it.slides,
                anchorSrc: it.designs.find((d) => d.sizeId === 'slide-1')?.src,
              })}
              onRestyle={() => {
                setStylePicked(false); setOpenStep('look')
                say('assistant', 'Pick another look and I will redraw slide one in it — the rest still have not been made.')
              }}
              onRetry={(indices) => makeDeck({
                deckId: it.id,
                indices,
                slides: it.slides,
                // Slide one, already drawn, keeps the retries matching.
                anchorSrc: it.designs.find((d) => d.sizeId === 'slide-1')?.src,
              })} />
          ) : null
        ))}

        {/* THE PREVIEW STAGE. Nothing made yet, so the middle is not a picker —
            the picking lives in step 3 on the right. This is where you SEE the
            choice: empty at first (a silhouette that says Preview), then the
            chosen style's sample once you pick one in step 3, then your own
            reference if you drop one, and finally the finished designs after
            Make (those render above, as rounds/decks). One place to see, one
            place to choose — no wall of tiles competing with the step-3 picker. */}
        {examplesShowing && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 420, border: `2px dashed ${LINE}`, borderRadius: 14, padding: 24, textAlign: 'center', gap: 14 }}>
            {reference ? (
              // Their own design, dropped in — this is the reference we'll work from.
              <>
                <img src={reference.dataUrl} alt="Your reference design"
                  style={{ maxWidth: 300, maxHeight: 340, borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.14)' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Working from your own design</div>
                <div style={{ fontSize: 12.5, color: SOFT, maxWidth: 320, lineHeight: 1.55 }}>
                  We&rsquo;ll copy its colours, lettering and mood — never its words. Your designs appear here once you press Make.
                </div>
              </>
            ) : stylePicked ? (
              // A style chosen in step 3 — show its sample big, as the look to expect.
              <>
                <img src={thumbUrl(templateId)} alt={`The ${styleName} look`}
                  style={{ maxWidth: 300, maxHeight: 340, borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,.14)' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>The {styleName} look</div>
                <div style={{ fontSize: 12.5, color: SOFT, maxWidth: 320, lineHeight: 1.55 }}>
                  Your design will be made in this style. Change it in step 3 any time. Press <strong style={{ color: INK }}>Make</strong> and your designs appear right here.
                </div>
              </>
            ) : (
              // The empty silhouette — nothing picked yet.
              <>
                <div style={{
                  width: 132, height: 176, borderRadius: 10, background: 'var(--border,#e7e2d8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: SOFT,
                }}>
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.8" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>Preview</div>
                <div style={{ fontSize: 12.5, color: SOFT, maxWidth: 340, lineHeight: 1.6 }}>
                  Pick a look in <strong style={{ color: INK }}>step&nbsp;3</strong> on the right to see the style here — or drop in a design you already like (drag it anywhere, or press {pasteKey}). Your finished designs appear here after you press Make.
                </div>
              </>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>

    {/* ── THE RIGHT RAIL: everything you PUT IN ─────────────────────────
        Steps and conversation share ONE scrolling region. The typing box is
        pinned under it and never moves, however long either gets. */}
    {/* Marked so a check can ask "is this in the rail?" by ancestry rather
        than by guessing an x-coordinate — a guess that was wrong (the rail
        starts at 931, not 1000) and so passed for the wrong reason. */}
    {/* THE WORKING SURFACE. On a phone this comes FIRST (order:1) and full
        width — steps, chat and the typing box are what the customer came for,
        so they are what a phone opens onto. On desktop it is the fixed 420px
        right rail. */}
    <div data-rail="" style={
      isPhone
        ? { order: 1, width: '100%', display: 'flex', flexDirection: 'column' }
        : { width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingTop: 18 }
    }>
      {/* ── THE STEPS ZONE — PINNED, never shoved by the chat ─────────────
          The steps and the conversation used to share ONE scroll region, and
          they want opposite things: steps stay put (you jump between them),
          chat sticks to the newest message. Sharing a scrollbar meant every
          reply pushed the steps off-screen and reading the reply meant losing
          the steps — the scroll-up-scroll-down treadmill. Now the steps sit in
          their own capped box up top: collapsed they are small and always
          visible; a tall open step (the look grid, the size list) scrolls
          INSIDE this box instead of crushing the chat below, which keeps a
          guaranteed floor. On a phone the page scrolls, so no caps there. */}
      <div className="scroll-visible" style={
        isPhone ? {} : { flexShrink: 0, maxHeight: '46vh', overflowY: 'auto', paddingRight: 4 }
      }>


        {/* ── THE JOB, AS FIVE ROWS ────────────────────────────────────────
            One open at a time. A finished row shows the ANSWER rather than the
            question, so the whole job reads at a glance and nothing has to be
            scrolled back to. Each row asks for what it wants where it wants it,
            including the files — which is the thing that was never said. */}
        <div style={{ ...panel, marginBottom: 12, padding: 0, flexShrink: 0 }}>
          {STEPS.map((st, i) => (
            <StepRow key={st.id} n={i + 1} title={st.title} answer={st.answer}
              open={shownStep === st.id} done={st.done} optional={st.optional}
              onToggle={() => setOpenStep(shownStep === st.id ? '__none' as Step : st.id)}
              line={LINE} ink={INK} soft={SOFT}>
              {st.body}
            </StepRow>
          ))}
        </div>
      </div>{/* the steps zone ends here */}

      {/* ── THE THREAD — ITS OWN SCROLL REGION ──────────────────────────
          This ref is also what the follow-the-conversation effect drives. It
          used to point at a non-scrolling inner div while the actual scrollbar
          belonged to the shared wrapper above — so "keep the newest message in
          view" silently did nothing, and every conversation opened at the TOP
          with the reply buried below. Now the thread scrolls itself: new
          messages appear at the bottom you are already looking at, and the
          steps above never move. flex:1 takes whatever the steps zone leaves;
          minHeight keeps the chat readable even with a tall step open. */}
      <div ref={threadRef} className="scroll-visible"
        style={
          isPhone
            ? { display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }
            : { flex: 1, minHeight: 140, overflowY: 'auto', paddingRight: 4, marginTop: 2,
                display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }
        }>
        {loadingHistory && (
          <p style={{ fontSize: 13, color: SOFT, margin: 0 }}>Looking for anything you made before…</p>
        )}

        {items.map((it, i) =>
          it.kind === 'msg' ? (
            <div key={i} style={{
              alignSelf: it.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%',
              padding: '10px 14px', borderRadius: 12, fontSize: 15, lineHeight: 1.5,
              background: it.role === 'user' ? INK : CREAM,
              color: it.role === 'user' ? 'white' : 'inherit',
            }}>{it.text}</div>
          ) : it.kind === 'card' ? (
            <div key={it.id} style={{ ...panel, alignSelf: 'stretch' }}>
              <Picker
                card={it.card} kind={kind}
                brands={brands} onPickBrand={setBrandId}
                ticked={ticked} onTickSize={toggleSize}
                styles={suggestedStyles} templateId={templateId}
                onPickStyle={pickStyle} onSeeAll={() => setBrowseLooks(true)}
                photos={photos} onOpenPhotos={() => setSheet('photos')}
                onReference={async (f) => { await attachReference(f, f.name); answerCard(it.id, 'your own design') }}
                deckCount={deckCount} onPickSlides={pickSlides}
                unit={unit} bleed={bleed} onBleed={setBleed}
                onDone={(summary) => answerCard(it.id, summary)}
              />
            </div>
          ) : it.kind === 'deck' ? (
            // Drawn in the middle column, where there is room for it.
            null
          ) : (
            // Drawn in the middle column, where there is room for it.
            null
          ),
        )}

        {/* Reads like the designer working, not a frozen "Thinking…". The line
            advances through THINKING_STAGES on a timer; the pulsing dot says it
            is alive even between changes. Styled as an assistant turn so it sits
            where the reply will land and is replaced by it. */}
        {thinking && (
          <div style={{
            alignSelf: 'flex-start', maxWidth: '78%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 12, background: CREAM, color: SOFT, fontSize: 15, lineHeight: 1.5,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: INK, flexShrink: 0,
              animation: 'pulse-anim 1s ease infinite',
            }} />
            {THINKING_STAGES[thinkStage]}
          </div>
        )}

        {/* What it has understood so far. Shown as a card rather than prose
            because a customer scanning for a wrong date should not have to
            read a paragraph to find it. */}
        {filled && <BriefCard fields={fields} />}

        <div ref={endRef} />
      </div>{/* the thread's own scroll region ends here */}

      {/* ── THE COMPOSER, pinned below the scroll ─────────────────────── */}
      {/* On desktop it sits at the bottom of the fixed-height rail (the scroller
          above takes all the slack, so this is naturally pinned). On a phone the
          rail has no fixed height, so to keep the typing box always reachable it
          is pinned to the bottom of the window, ABOVE the cookie bar
          (--bottom-bar). The page gets matching bottom padding below so the last
          row of content is never hidden behind it. */}
      <div style={
        isPhone
          ? { position: 'fixed', left: 0, right: 0, bottom: 'var(--bottom-bar, 0px)', zIndex: 40,
              background: 'var(--bg,#F4F1EC)', borderTop: `1px solid ${LINE}`,
              padding: '10px 14px calc(10px + env(safe-area-inset-bottom))' }
          : { flexShrink: 0, paddingBottom: 14, paddingTop: 10 }
      }>
        {sheet && (
          <div style={{ ...panel, marginBottom: 10, maxHeight: '52vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,.10)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>Your own photos</strong>
              {/* Only a way OUT lives up here, and only as an X. The way
                  FORWARD is always at the bottom. Two buttons that both close
                  the panel, one at each end, is what made this feel like a
                  guessing game. */}
              <button onClick={closeSheet} title="Close without changing anything"
                aria-label="Close" style={{ ...plain, padding: '4px 10px', fontSize: 13 }}>✕</button>
            </div>

            <PhotoSheet photos={photos} setPhotos={setPhotos} plain={plain}
              addPhoto={addPhoto} onPicked={() => markPicked('photo')} />

            {/* THE ONE WAY FORWARD, AND IT IS ALWAYS HERE. Doing nothing is a
                real answer here — you may add no photos — so the panel needs a
                Done that also means "skip". (Sizes moved into their step row and
                the style browser into the middle, so photos is the only panel
                left.) */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={closeSheet} className={unacked ? 'cg-done-flash' : undefined}
                title="Your choices are already saved — this just closes the panel"
                style={{ ...plain, padding: '8px 18px', background: INK, color: 'white', borderColor: INK }}>
                {photos.length ? `Done — ${photos.length} added` : 'Skip photos'}
              </button>
            </div>
          </div>
        )}

        {/* THE RUNNING ORDER, before anything is paid for. Shown as plain text
            because that is what makes it correctable — a customer can see that
            slide 4 has the wrong number far more easily here than in a picture
            they have already been charged for. */}
        {deckPlan && (
          <div style={{ ...panel, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: planOpen ? 8 : 0 }}>
              <button onClick={() => setPlanOpen((o) => !o)}
                title={planOpen ? 'Hide the running order' : 'Show the running order'}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: INK, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: SOFT }}>{planOpen ? '▾' : '▸'}</span>
                {deckPlan.title} · {deckPlan.slides.length} slides
              </button>
              <span style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setDeckPlan(null)} title="Throw this running order away" style={{ ...plain, padding: '5px 10px' }}>Discard</button>
                <button onClick={() => makeDeck()} disabled={making}
                  title={unit !== null ? `Draw all ${deckPlan.slides.length} slides — ${(unit * deckPlan.slides.length).toLocaleString()} credits` : 'Draw the deck'}
                  style={{ ...plain, padding: '5px 10px', background: INK, color: 'white', borderColor: INK, opacity: making ? 0.6 : 1 }}>
                  {making ? 'Building…' : `Make deck${unit !== null ? ` · ${(unit * deckPlan.slides.length).toLocaleString()} cr` : ''}`}
                </button>
              </span>
            </div>
            {planOpen && (
              <>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.65 }}>
                  {deckPlan.slides.map((s, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <strong>{s.fields.headline}</strong>
                      {s.fields.subhead ? <span style={{ color: SOFT }}> — {s.fields.subhead}</span> : null}
                      {s.fields.details?.length ? (
                        <span style={{ color: SOFT, display: 'block', fontSize: 12.5 }}>{s.fields.details.join(' · ')}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <p style={{ fontSize: 12.5, color: SOFT, margin: '10px 0 0', lineHeight: 1.55 }}>
                  Nothing has been drawn yet. Say what you want changed and press Plan the deck again.
                </p>
              </>
            )}
          </div>
        )}

        {err && (
          <div style={{ ...panel, marginBottom: 10, borderColor: '#E3B4A8', background: '#FDF3F1', color: '#B4432F', fontSize: 13 }}>{err}</div>
        )}

        {/* WHAT YOU DROPPED IN, ALREADY SORTED.
            Not three labelled buckets to aim at. Making somebody file their own
            images before the app will look at them is the work we are supposed
            to be doing for them. Drop the lot; each one is identified and shown
            with what it was taken to be, and the label is a dropdown because a
            guess you cannot correct is worse than no guess.
            An UNSURE one is marked, not silently assumed — a logo filed as a
            product gets redrawn instead of placed, and that must never happen
            to somebody's real mark. */}
        {dropped.length > 0 && (
          <div style={{ ...panel, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 2 }}>
              {sorting
                ? `Looking at ${dropped.length} image${dropped.length === 1 ? '' : 's'}…`
                : dropped.some((d) => !d.sure)
                ? 'Sorted these — check the ones marked, I was not sure.'
                : `Sorted these. Change any label that is wrong.`}
            </div>
            <p style={{ fontSize: 12, color: SOFT, margin: '0 0 10px' }}>
              A design becomes the style to work from. Everything else goes into the artwork.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {dropped.map((d) => (
                <div key={d.id} style={{
                  width: 156, border: `1px solid ${d.sure || sorting ? LINE : '#E3B4A8'}`,
                  borderRadius: 9, padding: 8, background: d.sure || sorting ? 'white' : '#FDF3F1',
                }}>
                  <img src={d.dataUrl} alt={d.what || d.name}
                    style={{ width: '100%', height: 84, objectFit: 'cover', borderRadius: 6, display: 'block', marginBottom: 6 }} />
                  {d.what && (
                    <div style={{ fontSize: 11, color: SOFT, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={d.what}>{d.what}</div>
                  )}
                  <select value={d.kind} disabled={sorting}
                    onChange={(e) => setDropped((rest) => rest.map((x) =>
                      x.id === d.id ? { ...x, kind: e.target.value as Dropped['kind'], sure: true } : x))}
                    style={{ width: '100%', padding: '5px 6px', borderRadius: 6, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 12 }}>
                    <option value="reference">A design to copy the look of</option>
                    {PHOTO_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button style={{ ...plain, flex: 1, padding: '5px 6px', fontSize: 12 }} disabled={sorting}
                      title="Use it" onClick={() => fileDropped(d)}>Use it</button>
                    <button style={{ ...plain, padding: '5px 8px', fontSize: 12 }}
                      title="Discard" onClick={() => setDropped((rest) => rest.filter((x) => x.id !== d.id))}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {dropped.length > 1 && !sorting && (
              <button style={{ ...plain, marginTop: 10 }}
                title="Accept every label as shown"
                onClick={() => { for (const d of [...dropped]) fileDropped(d) }}>
                Use all {dropped.length}
              </button>
            )}
          </div>
        )}

        {dragOver && (
          <div style={{
            ...panel, marginBottom: 10, borderStyle: 'dashed', borderColor: INK,
            textAlign: 'center', fontSize: 13, fontWeight: 700, color: INK, padding: 18,
          }}>
            Drop them anywhere — I&rsquo;ll work out what each one is
          </div>
        )}

        <div style={{ ...panel, boxShadow: '0 6px 24px rgba(0,0,0,.07)' }}>
          {/* NUMBERED AND SPELLED OUT. As bare chips reading "Editorial",
              "Add your photos" and "2 sizes" these looked like status, not
              controls — there was nothing to say they were steps, or in what
              order. The number carries the order and the label says what the
              button is FOR; the current choice follows in lighter type so you
              can still see it at a glance. */}
          {/* NO BAR OF CONTROLS ANY MORE.
              Style, photos and sizes used to live down here, all available at
              once, with nothing to say what to do first — and a deck planner
              buried inside the sizes panel. It also asked for the LOOK before it
              knew what was being made, which is how a business deck inherited a
              flyer's style.

              The questions are asked one at a time above instead, and what was
              decided sits in the thread as plain conversation. The only thing
              left is the way out of the current chat, and it now sits BELOW the
              typing box rather than between you and it. */}

          {/* WHAT THIS WILL COST AND HOW LONG, before the button rather than
              after the charge. A twelve-slide deck is fifteen minutes and 2,400
              credits, and nothing said so — people assumed it had hung. */}
          {canMake && (
            <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 10px', lineHeight: 1.55 }}>
              {ticked.length} design{ticked.length === 1 ? '' : 's'}
              {cost !== null ? ` · ${cost.toLocaleString()} credits` : ''}
              {` · about ${mmss(Math.ceil(ticked.length / CONCURRENCY) * SECS_PER_SIZE)}`}
              {balance !== null && cost !== null ? ` · ${Math.max(0, balance - cost).toLocaleString()} credits left after` : ''}
            </p>
          )}

          {/* On a phone this WRAPS: the box takes the whole first line and the
              mic + Send + Make sit on the line below, so nothing is pushed off
              the right edge (the Make button was being clipped at 390px). On
              desktop it stays a single row, unchanged. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: isPhone ? 'wrap' : 'nowrap' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }} disabled={thinking}
              title="Describe the job the way you'd say it out loud — what it's for, when, where, how much"
              placeholder={listening ? 'Listening… speak now' : 'Describe it, or drop in your logo and photos'}
              style={{ flex: 1, minWidth: isPhone ? '100%' : 0, padding: '11px 13px', borderRadius: 8, border: `1px solid ${listening ? INK : LINE}`, font: 'inherit', fontSize: 15 }} />

            {/* No "unsupported" state any more. Where the browser has no
                speech engine the hook records and has the server read it back,
                so the button is always live. */}
            <button onClick={toggleMic} disabled={transcribing}
              title={listening
                ? 'Stop and use what I heard'
                : transcribing ? 'Reading your recording back…'
                : 'Talk instead of typing — say what the design is for'}
              aria-label={listening ? 'Stop listening' : 'Dictate'}
              style={{
                ...plain, padding: '10px 12px',
                background: listening ? INK : 'white',
                color: listening ? 'white' : INK,
                border: listening ? '1px solid transparent' : plain.border,
                opacity: transcribing ? 0.5 : 1,
              }}>
              {listening ? '● Stop' : transcribing ? '…' : '🎤'}
            </button>

            {/* SEND. There was no Send button at all, and the only way to
                submit was a control labelled "Preview details" — which reads as
                "show me the design", not "reply to me". So the page invited you
                to talk and gave the talk nowhere to go: asking a question got
                you a red error box reading "no fields came back", because every
                message was fed to a field extractor that had to return design
                data or throw.

                One button, called what it does. Whether a message changes the
                design or is just a question is now the assistant's problem, not
                something the customer has to know before pressing anything. */}
            <button onClick={send} disabled={thinking || !input.trim()}
              title="Send. Free — nothing is made and nothing is charged. Ask a question, or say what you want changed."
              style={{
                ...plain, padding: '10px 16px', whiteSpace: 'nowrap',
                background: INK, color: 'white', border: '1px solid transparent',
                opacity: thinking || !input.trim() ? 0.4 : 1,
              }}>
              {thinking ? 'Thinking…' : 'Send'}
            </button>
            {/* SAY WHAT IT IS WAITING FOR. A live Make button beside an
                unfinished design is how somebody spends 400 credits on two
                formats and a style they were never shown — it was the only
                thing on screen that looked ready. */}
            <button onClick={make} disabled={!canMake}
              title={canMake
                ? `Design ${ticked.length} graphic${ticked.length === 1 ? '' : 's'}${cost !== null ? ` for ${cost.toLocaleString()} credits` : ''}. Takes about two minutes each.`
                : `Not yet — ${missing}.`}
              style={{ ...darkBtn, opacity: canMake ? 1 : 0.45, whiteSpace: 'nowrap' }}>
              {making ? 'Designing…' : canMake
                ? `Make ${ticked.length}${cost !== null ? ` · ${cost.toLocaleString()} cr` : ''}`
                : 'Make'}
            </button>
          </div>

          {/* THE BOTTOM LINE. Clear chat used to sit ABOVE the typing box,
              which put a destructive control between you and the thing you
              came to use — and left the row under the box empty. Now the two
              things that belong down here share it: what to do next on the
              left, the way to start over on the right, with the send buttons
              staying where they are beside the box. */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 10, marginTop: 8, minHeight: 30, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, color: SOFT }}>
              {missing && !loadingHistory ? `Next: ${missing}.` : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {confirmClear ? (
                <>
                  <span style={{ fontSize: 12.5, color: SOFT }}>
                    Clear this conversation? Your saved designs stay in your Library.
                  </span>
                  <button onClick={clearChat} style={{ ...plain, padding: '4px 10px' }}>Clear it</button>
                  <button onClick={() => setConfirmClear(false)} style={{ ...plain, padding: '4px 10px', fontWeight: 400, color: SOFT }}>
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmClear(true)}
                  title="Start the conversation over. Your saved designs stay in your Library and nothing is refunded."
                  style={{ ...plain, fontWeight: 400, color: SOFT }}>
                  Clear chat
                </button>
              )}
            </span>
          </div>
        </div>
      </div>

      {viewing && <Viewer design={viewing} onClose={() => setViewing(null)} />}
    </div>
    </div>
    </div>
    </>
  )
}

/** The current selection, shown after a step's label without competing with it. */
function Chosen({ children, on }: { children: React.ReactNode; on: boolean }) {
  return (
    <span style={{ fontWeight: 400, opacity: on ? 0.85 : 0.6, marginLeft: 2 }}>
      · {children}
    </span>
  )
}

/** What the assistant has understood, at a glance. */
function BriefCard({ fields }: { fields: FlyerFields }) {
  const rows: [string, string][] = []
  const add = (k: string, v?: string) => { if (v) rows.push([k, v]) }
  add('Headline', fields.headline)
  add('Above it', fields.eyebrow)
  add('Under it', fields.subhead)
  add('When', [fields.date, fields.time].filter(Boolean).join(' · '))
  add('Where', [fields.venue, fields.address].filter(Boolean).join(' — '))
  add('Price', fields.price)
  add('Call to action', fields.cta)
  add('Contact', fields.contact)
  for (const d of fields.details ?? []) rows.push(['Detail', d])
  if (!rows.length) return null

  return (
    <div style={{
      alignSelf: 'flex-start', maxWidth: '78%', background: 'white',
      border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: SOFT, marginBottom: 8 }}>
        What goes on the design
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', fontSize: 14 }}>
        {rows.map(([k, v], i) => (
          <div key={i} style={{ display: 'contents' }}>
            <span style={{ color: SOFT, whiteSpace: 'nowrap' }}>{k}</span>
            <span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: SOFT, margin: '10px 0 0', lineHeight: 1.5 }}>
        Wrong? Just say so — &ldquo;the price is $25&rdquo; — and I&apos;ll change it.
      </p>
    </div>
  )
}

/** One press of Make: what was asked for, and everything that came back. */
/**
 * A deck in the thread.
 *
 * Shows the slides in ORDER as they land — which matters more here than for a
 * batch of sizes, because a deck read out of order tells you nothing about
 * whether it hangs together. The download buttons appear only once every slide
 * is in: a PowerPoint missing slide 7 is worse than no PowerPoint, because you
 * find out in front of the room.
 */
function DeckBlock({ deck, now, onOpen, onRetry, onApprove, onRestyle }: {
  deck: Extract<Item, { kind: 'deck' }>
  now: number
  onOpen: (d: Design) => void
  /** Draw only the slides that failed, keeping the ones already paid for. */
  onRetry?: (indices: number[]) => void
  /** Slide one is approved — draw the rest to match it. */
  onApprove?: () => void
  /** Reject the look and choose another before spending on the rest. */
  onRestyle?: () => void
}) {
  const [busy, setBusy] = useState<'pptx' | 'pdf' | null>(null)
  const [problem, setProblem] = useState('')

  const total = deck.slides.length
  const done = Object.values(deck.status).filter((s) => s === 'done' || s === 'fail').length
  const made = deck.designs.length
  const elapsed = deck.startedAt ? Math.round((now - deck.startedAt) / 1000) : 0
  // The first slide runs ALONE — everything after it is anchored to it — so the
  // wait is one full slide plus however many waves the rest take.
  const waves = 1 + Math.ceil(Math.max(0, total - 1) / CONCURRENCY)
  const remaining = Math.max(0, waves * SECS_PER_SIZE - elapsed)

  // Sort by slide number rather than by arrival: they finish in a jumble.
  // Which slots came back empty. Read off the status map rather than the
  // designs list, so a slide that failed twice still counts once.
  const failed = Object.entries(deck.status)
    .filter(([, v]) => v === 'fail')
    .map(([k]) => Number(k))
    .sort((a, b) => a - b)

  const ordered = [...deck.designs].sort((a, b) =>
    Number(a.sizeId.replace('slide-', '')) - Number(b.sizeId.replace('slide-', '')))

  const download = async (format: 'pptx' | 'pdf') => {
    const ids = ordered.map((d) => d.designId).filter(Boolean) as string[]
    if (ids.length !== ordered.length) {
      setProblem('These slides were made before saving was switched on, so they cannot be bundled. Make the deck again.')
      return
    }
    setProblem(''); setBusy(format)
    try {
      const res = await fetch('/api/flyer-deck-export', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ designIds: ids, title: deck.title, format }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.url) { setProblem(data?.error || 'Could not build the file.'); return }
      if (data.dropped) setProblem(`${data.dropped} slide${data.dropped === 1 ? '' : 's'} could not be read and were left out.`)
      window.location.href = data.url
    } catch {
      setProblem('Network error while building the file.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>
          {deck.live ? 'Building deck' : 'Deck'} · {deck.title} · {total} slide{total === 1 ? '' : 's'}
        </strong>
        {deck.live ? (
          <span style={{ fontSize: 12, color: SOFT }}>
            {done} of {total} · {remaining > 0 ? `about ${mmss(remaining)} left` : 'any moment now'}
          </span>
        ) : (
          <span style={{ display: 'flex', gap: 6 }}>
            {failed.length > 0 && onRetry && (
              /* A DECK WITH HOLES IN IT IS WASTED MONEY. Three slides failing
                 used to leave five paid-for slides that could not be presented
                 and no way forward but to build the whole deck again — and pay
                 for all of it twice. This redraws only what is missing, and
                 anchors it to slide one so it still matches. */
              <button onClick={() => onRetry(failed)}
                title={`Draw the ${failed.length} slide${failed.length === 1 ? '' : 's'} that failed. The ones that worked are kept and not charged again.`}
                style={{ ...PLAIN_BTN, padding: '5px 10px', background: INK, color: 'white', borderColor: INK }}>
                Retry {failed.length} slide{failed.length === 1 ? '' : 's'}
              </button>
            )}
            <button onClick={() => download('pptx')} disabled={busy !== null || !made}
              title="Download as a PowerPoint file — one slide per page, opens in PowerPoint, Keynote or Google Slides"
              style={{ ...PLAIN_BTN, padding: '5px 10px' }}>
              {busy === 'pptx' ? 'Building…' : 'PowerPoint'}
            </button>
            <button onClick={() => download('pdf')} disabled={busy !== null || !made}
              title="Download as a PDF — best for emailing"
              style={{ ...PLAIN_BTN, padding: '5px 10px' }}>
              {busy === 'pdf' ? 'Building…' : 'PDF'}
            </button>
          </span>
        )}
      </div>

      {deck.live && (
        <div style={{ height: 4, background: CREAM, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${Math.round((done / total) * 100)}%`, background: INK, transition: 'width .4s' }} />
        </div>
      )}

      {/* THE DECISION, BEFORE THE MONEY. Slide one is on screen and nothing
          else has been drawn yet — so a look that turns out wrong costs 200
          credits to reject here instead of 2,400 at the end. */}
      {deck.awaiting && onApprove && (
        <div style={{ padding: '10px 12px', borderRadius: 9, background: CREAM, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Happy with this look?</div>
          <div style={{ fontSize: 12.5, color: SOFT, lineHeight: 1.5, marginBottom: 10 }}>
            The other {total - 1} slides will be drawn to match it. Nothing else has been made yet.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={onApprove} title={`Draw the remaining ${total - 1} slides in this look`}
              style={{ ...PLAIN_BTN, padding: '6px 12px', background: INK, color: 'white', borderColor: 'transparent' }}>
              Yes — draw the other {total - 1}
            </button>
            <button onClick={onRestyle} style={{ ...PLAIN_BTN, padding: '6px 12px' }}
              title="Pick a different look, then draw slide one again">
              Try a different look
            </button>
          </div>
          <p style={{ fontSize: 12, color: SOFT, margin: '9px 0 0', lineHeight: 1.5 }}>
            Or say what you&rsquo;d change — &ldquo;warmer colours&rdquo;, &ldquo;bigger headline&rdquo; — and I&rsquo;ll redo this one first.
          </p>
        </div>
      )}

      {problem && (
        <p role="alert" style={{ fontSize: 12.5, color: '#b91c1c', margin: '0 0 10px', lineHeight: 1.5 }}>{problem}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 9 }}>
        {ordered.map((d, i) => (
          <button key={d.sizeId} onClick={() => onOpen(d)} title={`Slide ${i + 1} — click to see it full size`}
            style={{ padding: 0, border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', background: '#111', cursor: 'pointer' }}>
            <img src={d.src} alt={`Slide ${i + 1}`}
              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
            <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 5px', background: 'white', color: INK, textAlign: 'left' }}>
              {i + 1}{deck.slides[i]?.fields.headline ? `. ${deck.slides[i].fields.headline}` : ''}
            </div>
          </button>
        ))}
      </div>

      {!deck.live && made > 0 && (
        <p style={{ fontSize: 12.5, color: SOFT, margin: '10px 0 0', lineHeight: 1.55 }}>
          Want a slide changed? Say the number and what you want different — for example
          &ldquo;slide 4 should say 30 days, not 14&rdquo;.
        </p>
      )}
    </div>
  )
}

function RoundBlock({ round, now, onOpen, onMoreSizes }: {
  round: Extract<Item, { kind: 'round' }>
  now: number
  onOpen: (d: Design) => void
  /** Open the formats picker so more sizes can be added to THIS job — the
   *  words and style are already on screen, so it just adds to what's here. */
  onMoreSizes?: () => void
}) {
  const style = FLYER_TEMPLATES.find((t) => t.id === round.templateId)?.name ?? round.templateId
  const done = Object.values(round.status).filter((s) => s === 'done' || s === 'fail').length
  const total = round.sizeIds.length
  const elapsed = round.startedAt ? Math.round((now - round.startedAt) / 1000) : 0
  const waves = Math.ceil(total / CONCURRENCY)
  const remaining = Math.max(0, waves * SECS_PER_SIZE - elapsed)

  return (
    <div style={{ background: 'white', border: `1px solid ${LINE}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>
          {round.live ? 'Designing' : 'Designs'} · {style} · {total} size{total === 1 ? '' : 's'}
        </strong>
        {round.live ? (
          <span style={{ fontSize: 12, color: SOFT }}>
            {done} of {total} · {remaining > 0 ? `about ${mmss(remaining)} left` : 'any moment now'}
          </span>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* MORE SIZES, RIGHT HERE. Adding a size used to mean losing the
                job: the button led to a blank screen with none of your work
                on it. Now it opens the size picker over the design you're
                looking at — same words, same style, just pick what else to
                make and press Make. */}
            {onMoreSizes && (
              <button onClick={onMoreSizes}
                title="Make this same design in more sizes — your words and style stay exactly as they are"
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: 'white',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: INK,
                }}>
                ＋ More sizes
              </button>
            )}
            {round.designs.length > 1 && (
              // One click for the lot. Downloading six sizes one at a time is the
              // sort of small tax nobody mentions and everybody resents.
              <button onClick={() => downloadAll(round)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: 'white',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: INK,
                }}>
                ⬇ Download all {round.designs.length}
              </button>
            )}
          </div>
        )}
      </div>

      {round.note && <p style={{ fontSize: 12, color: SOFT, margin: '0 0 10px' }}>Note: {round.note}</p>}

      {/* The bar measures designs actually finished, not time elapsed — a bar
          that fills on a timer reaches 100% while you are still waiting. */}
      {round.live && (
        <div style={{ height: 8, borderRadius: 99, background: CREAM, overflow: 'hidden', border: `1px solid ${LINE}`, marginBottom: 12 }}>
          <div style={{ height: '100%', background: INK, width: `${Math.round((done / Math.max(total, 1)) * 100)}%`, transition: 'width .5s ease' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        {round.sizeIds.map((id, slot) => {
          // LOOK UP BY POSITION, not by size id.
          //
          // `find` on the size id returns the FIRST design with that size, so a
          // round containing two designs of the same size showed the first one
          // twice. That is exactly what happened to decks, where every slide
          // shares a size — five real slides displayed as five copies of one.
          // Decks are now restored separately, but this is the line that made
          // it possible, and any future repeat would land here again.
          const d = round.designs[slot] ?? round.designs.find((x) => x.sizeId === id)
          const st = round.status[id] ?? 'wait'
          const label = FLYER_SIZES.find((s) => s.id === id)?.label ?? id
          if (d) {
            // NUMBERED, so a change can be asked for out loud: "design 2, make
            // the price $25". Without a number the only way to point at one is
            // to describe it, and two social sizes look alike in a grid.
            const n = slot + 1
            return (
              <figure key={`${id}-${slot}`} style={{ margin: 0 }}>
                <button onClick={() => onOpen(d)} title="Open full size"
                  style={{ display: 'block', width: '100%', padding: 0, border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: '#111', position: 'relative' }}>
                  <img src={d.src} alt={d.label} style={{ width: '100%', display: 'block' }} />
                  <span style={{
                    position: 'absolute', top: 6, left: 6, minWidth: 20, height: 20, borderRadius: 6,
                    background: 'rgba(20,18,16,.82)', color: 'white', fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                  }}>{n}</span>
                  {/*
                    THE WORDS WERE READ BACK OFF THIS DESIGN.
                    Silent when nothing is known — an old design that predates
                    the check must not wear a tick it never earned. A warning
                    NAMES the word, because "check the spelling" on a design
                    with forty words in it is not something anyone can act on.
                  */}
                  {d.checked === false && (
                    <span title={`The design does not clearly show: ${(d.misspelled ?? []).join(', ')}`}
                      style={{
                        position: 'absolute', top: 6, right: 6, borderRadius: 6, padding: '0 6px', height: 20,
                        background: 'rgba(180,67,47,.94)', color: 'white', fontSize: 10, fontWeight: 800,
                        display: 'flex', alignItems: 'center', maxWidth: '78%',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                      ⚠ check “{(d.misspelled ?? ['the wording'])[0]}”
                    </span>
                  )}
                  {d.checked === true && (
                    <span title="Every word from your brief was read back off this design and matched."
                      style={{
                        position: 'absolute', top: 6, right: 6, borderRadius: 6, padding: '0 6px', height: 20,
                        background: 'rgba(28,110,74,.92)', color: 'white', fontSize: 10, fontWeight: 800,
                        display: 'flex', alignItems: 'center',
                      }}>✓ words checked</span>
                  )}
                </button>
                <figcaption style={{ fontSize: 11, color: SOFT, marginTop: 5, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label.replace(/ \d+ ?[×x].*$/, '')}</span>
                  <a href={d.src} download={`design-${n}-${d.sizeId}.png`} style={{ color: INK, fontWeight: 700, textDecoration: 'none' }}>⬇</a>
                </figcaption>
              </figure>
            )
          }
          return (
            <div key={`${id}-${slot}`} style={{
              border: `1px dashed ${LINE}`, borderRadius: 8, minHeight: 120, display: 'flex',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 10,
              fontSize: 11, fontWeight: 700, color: st === 'fail' ? '#B4432F' : SOFT,
              background: st === 'busy' ? CREAM : 'transparent',
            }}>
              {st === 'fail' ? `✕ ${label.replace(/ \d+ ?[×x].*$/, '')} failed` : st === 'busy' ? `● ${label.replace(/ \d+ ?[×x].*$/, '')}` : `· ${label.replace(/ \d+ ?[×x].*$/, '')}`}
            </div>
          )
        })}
      </div>

      {!round.live && round.designs.length > 0 && (
        <p style={{ fontSize: 12, color: SOFT, margin: '10px 0 0', lineHeight: 1.5 }}>
          Click any design to see it full size — worth doing before you print, since the dates,
          prices and phone numbers are drawn by the AI.
          {' '}<strong style={{ color: INK }}>Want one changed? Say the number and what you want</strong> —
          {' '}&ldquo;design {round.designs.length > 1 ? 2 : 1}, make the price $25&rdquo; — and I&apos;ll set it up to redo just that one.
        </p>
      )}
    </div>
  )
}

/** Full screen, because you cannot proofread a phone number at thumbnail size. */
function Viewer({ design, onClose }: { design: Design & { designId?: string }; onClose: () => void }) {
  /**
   * Paint over a part of the design and say what to change there.
   *
   * A design used to be a dead image: right layout, right lettering, wrong
   * sandwich, and the only move was to redraw the whole thing and hope. That is
   * where people gave up and opened Canva.
   *
   * The brush paints onto a canvas laid exactly over the picture. What gets
   * sent is the INVERSE of what you painted — the API's mask marks the region
   * it MAY repaint as transparent and everything to protect as opaque, which is
   * the opposite of what anyone assumes, so it is built explicitly here rather
   * than by sending whatever the brush happened to leave behind.
   */
  const [brushing, setBrushing] = useState(false)
  const [painted, setPainted] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState('')
  const [current, setCurrent] = useState(design)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drawing = useRef(false)

  const sizeCanvas = () => {
    const c = canvasRef.current, i = imgRef.current
    if (!c || !i) return
    c.width = i.clientWidth
    c.height = i.clientHeight
  }

  // The picture changes size when editing starts (it shrinks to make room for
  // the controls). The paint layer sits exactly on top of it, so it has to be
  // re-measured to the new size — otherwise the brush lands in the wrong place.
  // A tiny delay lets the CSS height change settle before we measure.
  useEffect(() => {
    const t = setTimeout(() => { sizeCanvas(); clearBrush() }, 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brushing])

  const paintAt = (e: React.PointerEvent) => {
    const c = canvasRef.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'rgba(255,90,60,0.55)'
    ctx.beginPath()
    // A generous brush on purpose. A thin outline round the burger leaves the
    // burger itself protected, and the edit does nothing — people circle things,
    // they do not colour them in.
    ctx.arc(e.clientX - r.left, e.clientY - r.top, Math.max(14, c.width * 0.045), 0, Math.PI * 2)
    ctx.fill()
    setPainted(true)
  }

  const clearBrush = () => {
    const c = canvasRef.current
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setPainted(false)
  }

  /** Opaque where the picture must survive, transparent where it may change. */
  const buildMask = (): string | null => {
    const c = canvasRef.current
    if (!c) return null
    const out = document.createElement('canvas')
    out.width = c.width; out.height = c.height
    const ctx = out.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, out.width, out.height)
    // Punch the painted area out of the solid sheet.
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(c, 0, 0)
    return out.toDataURL('image/png')
  }

  const applyChange = async () => {
    if (!current.designId) { setProblem('This design was made before edits were possible — make it again to edit it.'); return }
    if (!instruction.trim()) { setProblem('Say what should change in the area you painted.'); return }
    const maskDataUrl = buildMask()
    if (!maskDataUrl || !painted) { setProblem('Paint over the part you want changed first.'); return }

    setProblem(''); setWorking(true)
    try {
      const res = await fetch('/api/flyer-edit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ designId: current.designId, maskDataUrl, instruction }),
      })
      const data = await res.json().catch(() => ({}))
      // Asked to change WORDS? The server won't inpaint text (it invents junk).
      // Show its guidance calmly and drop out of the brush so the person can go
      // type the new wording in the chat.
      if (res.status === 422 && data?.code === 'use_chat_for_text') {
        setProblem(data.error || 'To change the words, type the new wording in the chat and press Make.')
        setBrushing(false); clearBrush()
        return
      }
      if (!res.ok || !data?.png) { setProblem(data?.error || 'That change could not be made.'); return }
      // The old one is still saved; this shows the new one without losing it.
      setCurrent({ ...current, src: data.png, designId: data.designId ?? current.designId })
      clearBrush(); setBrushing(false); setInstruction('')
    } catch {
      setProblem('Network error — you were not charged.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,18,16,.88)',
        // Scroll as a safety net: on a short window, the picture + edit box +
        // toolbar used to run off the bottom and the buttons became unreachable.
        // A scrollable column can never hide its own controls.
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        gap: 12, padding: 20, overflowY: 'auto',
      }}>
      {/* WHEN EDITING, THE PICTURE MAKES ROOM. At full 80vh the image left no
          space for the edit box and the toolbar, so they fell off screen. While
          painting, the picture shrinks so everything you need is visible at once
          — you can still see what you painted, just smaller. */}
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '100%', maxHeight: brushing ? '52vh' : '82vh', margin: 'auto 0' }}>
        <img ref={imgRef} src={current.src} alt={current.label} onLoad={sizeCanvas}
          style={{ maxWidth: '100%', maxHeight: brushing ? '52vh' : '82vh', objectFit: 'contain', borderRadius: 8, background: '#111', display: 'block' }} />
        <canvas ref={canvasRef}
          onPointerDown={(e) => { if (!brushing) return; drawing.current = true; paintAt(e) }}
          onPointerMove={(e) => { if (brushing && drawing.current) paintAt(e) }}
          onPointerUp={() => { drawing.current = false }}
          onPointerLeave={() => { drawing.current = false }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 8,
            pointerEvents: brushing ? 'auto' : 'none',
            cursor: brushing ? 'crosshair' : 'default',
            touchAction: 'none',
          }} />
      </div>

      {brushing && (
        <div onClick={(e) => e.stopPropagation()}
          style={{ background: 'white', borderRadius: 10, padding: 14, width: 'min(560px, 92vw)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
            {painted ? 'What should change there?' : 'Paint over the part you want changed'}
          </div>
          <p style={{ fontSize: 12.5, color: SOFT, margin: '0 0 10px', lineHeight: 1.5 }}>
            This is for pictures — swap an object, change a colour, tidy the background.
            To change the <strong>words</strong>, close this and retype them in the chat, then press Make.
            Cover the whole thing, not just its outline — everything you leave unpainted stays exactly as it is.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. add lettuce and tomato"
              style={{ flex: 1, minWidth: 200, padding: '9px 11px', borderRadius: 8, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 14 }} />
            <button onClick={applyChange} disabled={working || !painted}
              style={{ ...PLAIN_BTN, padding: '9px 14px', background: INK, color: 'white', borderColor: 'transparent', opacity: working || !painted ? 0.5 : 1 }}>
              {working ? 'Changing…' : 'Change it'}
            </button>
            <button onClick={clearBrush} style={{ ...PLAIN_BTN, padding: '9px 12px' }}>Clear</button>
          </div>
          {problem && <p role="alert" style={{ fontSize: 12.5, color: '#b91c1c', margin: '9px 0 0' }}>{problem}</p>}
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'white', fontSize: 13, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontWeight: 700 }}>{current.label}</span>
        <span style={{ opacity: 0.6 }}>{current.w} × {current.h}</span>
        <button onClick={() => { setBrushing((b) => !b); setProblem('') }}
          title="Paint over part of the design and say what to change there. Everything else stays exactly as it is."
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.35)', background: brushing ? 'white' : 'transparent', color: brushing ? '#23201c' : 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
          {brushing ? 'Done editing' : '✎ Change part of it'}
        </button>
        <a href={current.src} download={`${current.sizeId}.png`} title="Save this design to your computer"
          style={{ padding: '8px 14px', borderRadius: 8, background: 'white', color: '#23201c', fontWeight: 700, textDecoration: 'none' }}>
          ⬇ Download
        </a>
        <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.35)', background: 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
          Close
        </button>
      </div>
    </div>
  )
}

function PhotoSheet({ photos, setPhotos, plain, addPhoto, onPicked }: {
  photos: { dataUrl: string; role: PhotoRole; name: string }[]
  setPhotos: React.Dispatch<React.SetStateAction<{ dataUrl: string; role: PhotoRole; name: string }[]>>
  plain: React.CSSProperties
  /** Shared with paste and drag-and-drop so all three behave identically. */
  addPhoto: (f: File) => Promise<void>
  /** Tell the panel a choice was made, so Done starts asking to be pressed. */
  onPicked?: () => void
}) {
  return (
    <>
      <label style={{ ...plain, display: 'inline-block', marginBottom: 10 }}>
        + Add photo
        <input type="file" title="Pick an image from your device" accept="image/*" multiple hidden
          onChange={async (e) => {
            for (const f of [...(e.target.files ?? [])].slice(0, 3 - photos.length)) {
              await addPhoto(f)
              onPicked?.()
            }
            e.target.value = ''
          }} />
      </label>

      {/* SAME THREE WAYS IN AS EVERYTHING ELSE. Told, not implied — a gesture
          nobody knows about is a gesture nobody uses. */}
      <p style={{ fontSize: 12, color: SOFT, margin: '0 0 10px', lineHeight: 1.5 }}>
        Or paste one with {typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘V' : 'Ctrl+V'}, or drag it onto this panel.
      </p>

      {!photos.length ? (
        <p style={{ fontSize: 13, color: SOFT, margin: 0, lineHeight: 1.5 }}>
          Add a headshot, the actual property, or your product and the design gets built around it —
          instead of an invented person or place. Up to 3.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img src={p.dataUrl} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 7, border: `1px solid ${LINE}` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                {/* What it IS decides how it is used — a face gets cut out and
                    placed, a house becomes the scene. */}
                <select value={p.role}
                  onChange={(e) => setPhotos((prev) => prev.map((x, k) => k === i ? { ...x, role: e.target.value as PhotoRole } : x))}
                  style={{ marginTop: 3, padding: '5px 8px', borderRadius: 7, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 12, width: '100%' }}>
                  {PHOTO_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.hint}</option>)}
                </select>
              </div>
              <button onClick={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}
                style={{ ...plain, padding: '5px 9px' }} title="Remove">✕</button>
            </div>
          ))}
          <p style={{ fontSize: 12, color: SOFT, margin: 0, lineHeight: 1.5 }}>
            Your photo is redrawn into the design rather than pasted in, so people stay recognisable
            but are not pixel-for-pixel the original. Check the face before sending it out.
          </p>
        </div>
      )}
    </>
  )
}
