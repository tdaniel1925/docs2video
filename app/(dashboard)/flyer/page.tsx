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
import {
  FLYER_TEMPLATES, FLYER_SIZES, PHOTO_ROLES, thumbUrl,
  type FlyerFields, type PhotoRole,
  canBleed,
} from '../../_lib/flyer-engine'

type Design = { sizeId: string; label: string; w: number; h: number; src: string }
type Status = 'wait' | 'busy' | 'done' | 'fail'

/** A deck's running order, as returned by the planner before anything is drawn. */
type PlannedSlide = { role: string; fields: FlyerFields }
type DeckPlan = { title: string; slides: PlannedSlide[] }

/** Everything in the thread, in the order it happened. */
type Item =
  | { kind: 'msg'; role: 'user' | 'assistant'; text: string }
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
const OPEN_CHAT_KEY = 'text2art:openChat'
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
  const [items, setItems] = useState<Item[]>([{
    kind: 'msg', role: 'assistant',
    text: 'Tell me what this is for — something like "Saturday club night at The Foundry, doors 9pm, $20 cover". Pick a look and your sizes below, then hit Make.',
  }])

  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [err, setErr] = useState('')

  const [fields, setFields] = useState<FlyerFields>({})
  const [templateId, setTemplateId] = useState('rnb')
  const [category, setCategory] = useState<string>(CATEGORIES[0].id)
  const [note, setNote] = useState('')
  const [ticked, setTicked] = useState<string[]>(['letter', 'ig-post'])
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
  const [sheet, setSheet] = useState<null | 'style' | 'photos' | 'sizes'>(null)
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
          past.push({
            kind: 'round', id: round.id, templateId: round.templateId, note: round.note ?? '',
            sizeIds: round.designs.map((d: Design) => d.sizeId),
            designs: round.designs.map((d: { sizeId: string; label: string; w: number; h: number; url: string }) => ({
              sizeId: d.sizeId, label: d.label, w: d.w, h: d.h, src: d.url,
            })),
            status: Object.fromEntries(round.designs.map((d: Design) => [d.sizeId, 'done' as Status])),
            startedAt: 0, live: false,
          })
        }
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
          setTemplateId(last.templateId || 'rnb')
          setFields(last.fields ?? {})
          setNote(last.note ?? '')
        }
      } else {
        // Switched to an empty chat. Reset rather than leaving the last chat's
        // thread on screen under a different name.
        setItems([{
          kind: 'msg', role: 'assistant',
          text: 'Tell me what this is for — something like "Saturday club night at The Foundry, doors 9pm, $20 cover".',
        }])
        setFields({})
      }
      setLoadingHistory(false)
    })()
    return () => { dead = true }
    // openChatKey changes when a chat is chosen or started, which is what
    // reloads the thread. chatId alone is not enough: the server may hand back
    // the same id it was given, and that would not re-run anything.
  }, [openChatKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the thread down as it grows, the way a chat does.
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [items, thinking])

  // Escape closes whatever is open, innermost first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (viewing) setViewing(null)
      else if (sheet) closeSheet()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing, sheet])

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
    if (!q) return FLYER_TEMPLATES.filter((t) => t.category === category)
    const words = q.split(/\s+/)
    return FLYER_TEMPLATES.filter((t) => {
      const hay = `${t.name} ${t.category} ${t.scene} ${t.lettering}`.toLowerCase()
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

  // PASTE ANYWHERE WHILE THE STYLE PANEL IS OPEN. Bound to the window rather
  // than to a box you must click first, because "click here, then paste" is a
  // step people skip and then report the paste as broken.
  useEffect(() => {
    if (sheet !== 'style' || reference) return
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      e.preventDefault()
      void attachReference(file, 'pasted design')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
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
    // Every design in it goes too, and the files behind them. That is not
    // recoverable, so it is spelled out rather than hidden behind "Are you
    // sure?".
    if (!window.confirm(`Delete "${c.title || 'Untitled'}" and every design in it? This cannot be undone.`)) return

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
    // Deliberately does NOT reload from the server. There is nothing saved
    // under a chat that has never been used, so a fetch could only come back
    // empty — and the round trip cost a flicker and, until the server was
    // fixed, dumped the customer back into the previous conversation.
    const fresh = crypto.randomUUID()
    setChatId(fresh)
    rememberChat(fresh)
    setItems([{
      kind: 'msg', role: 'assistant',
      text: 'New job. Tell me what this one is for.',
    }])
    setFields({}); setNote(''); setPhotos([]); setReference(null)
    setStylePicked(false); setSizesPicked(false)
    setInput(''); setErr(''); setSheet(null)
  }

  /** Wipe the conversation and start over — settings and saved history stay. */
  const clearChat = () => {
    if (!window.confirm('Clear this conversation? Your saved designs stay in your Library, and this does not refund anything.')) return
    setItems([{
      kind: 'msg', role: 'assistant',
      text: 'Cleared. Tell me what the next one is for.',
    }])
    setFields({})
    setInput('')
    setErr('')
  }

  const send = async () => {
    const text = input.trim()
    if (!text || thinking) return
    setInput(''); setErr('')
    say('user', text)
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
      if (t) { setTemplateId(t.id); setCategory(t.category); notes.push(`set the look to ${t.name}`) }
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
    } else if (!sizesPicked && r.sizeId && !ticked.includes(r.sizeId)) {
      const s = FLYER_SIZES.find((x) => x.id === r.sizeId)
      if (s) { setTicked([s.id]); notes.push(`switched to ${s.label}`) }
    }

    // Say what was changed on your behalf. A tool that silently rearranges your
    // settings is unnerving even when it guesses right.
    say('assistant', (r.reply || 'Got it.') + (notes.length ? ` (I ${notes.join(' and ')} — change either below if you'd rather.)` : ''))
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
  const makeDeck = async () => {
    if (making || !deckPlan || !unit) return
    setErr(''); setSheet(null); setPlanOpen(false)

    const chat = chatId ?? crypto.randomUUID()
    if (!chatId) { setChatId(chat); rememberChat(chat) }

    const roundId = crypto.randomUUID()
    const plan = deckPlan
    const messages = items.filter((i): i is Extract<Item, { kind: 'msg' }> => i.kind === 'msg')
      .slice(-12).map((m) => ({ role: m.role, text: m.text }))

    setItems((p) => [...p, {
      kind: 'deck', id: roundId, title: plan.title, slides: plan.slides,
      designs: [], status: Object.fromEntries(plan.slides.map((_, i) => [i, 'wait' as Status])),
      startedAt: Date.now(), live: true,
    }])
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
          note: [DECK_DIRECTION[slide.role] ?? DECK_DIRECTION.point, note.trim()].filter(Boolean).join(' '),
          // Slide one carries the customer's own reference if they gave one;
          // every later slide is anchored to slide one instead.
          referenceDataUrl: anchor ?? reference?.dataUrl,
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
          designs: [...r.designs, { sizeId: `slide-${index + 1}`, label: `Slide ${index + 1}`, w: img.w, h: img.h, src: img.png, designId: img.designId }],
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

    // Slide one first, alone. Everything else waits on it.
    const full = await drawSlide(0)
    // Send it on as a SMALL reference, not as the 2.6 MB original — see
    // shrinkForReference. Three full-size anchors in flight at once is what
    // broke slides 2, 3 and 4.
    const anchor = full ? await shrinkForReference(full) : null

    if (anchor && !stop) {
      const queue = plan.slides.map((_, i) => i).slice(1)
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
          templateId, sizeIds: [id], fields, note: note.trim() || undefined,
          photos: photos.map(({ dataUrl, role }) => ({ dataUrl, role })),
          referenceDataUrl: reference?.dataUrl,
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
            designs: [...r.designs, { sizeId: img.sizeId, label: img.label, w: img.w, h: img.h, src: img.png }],
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
  const canMake = !making && !!ticked.length && filled && unit !== null
  const styleName = FLYER_TEMPLATES.find((t) => t.id === templateId)?.name ?? 'Style'

  // ── styling ────────────────────────────────────────────────────────────
  const panel = { background: 'white', border: `1px solid ${LINE}`, borderRadius: 10, padding: 14 } as const
  const darkBtn = { padding: '10px 16px', borderRadius: 8, border: 'none', background: INK, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const
  const plain = { padding: '7px 12px', borderRadius: 8, border: `1px solid ${LINE}`, background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: INK } as const
  const chip = (on: boolean) => ({ ...plain, background: on ? INK : 'white', color: on ? 'white' : INK, border: on ? '1px solid transparent' : plain.border }) as const

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '18px 20px 0', minHeight: '100vh', display: 'flex', gap: 20 }}>

      {/* ── PAST JOBS ──────────────────────────────────────────────────────
          One chat is one job. Without this, every design anyone ever made
          shared a single endless scrollback — fine for an afternoon, useless
          after a month. */}
      {/* CLEAR THE HEADER. The site header is pinned to the top of the window
          and is 72px tall, so sticking at 18px parked this underneath it and
          sliced the top off the New chat button as soon as you scrolled. The
          offset has to be the header's height plus a gap, and the height has
          to subtract the same amount or the list runs off the bottom. */}
      <aside style={{ width: 216, flexShrink: 0, position: 'sticky', top: 88, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 108px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={newChat} title="Start a separate job with its own conversation. Nothing is lost — this one stays in the list."
          style={{ ...darkBtn, width: '100%' }}>
          + New chat
        </button>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {chats.length === 0 && !loadingHistory && (
            <p style={{ fontSize: 12, color: SOFT, margin: '4px 2px', lineHeight: 1.5 }}>
              Jobs you finish show up here, so you can come back to one.
            </p>
          )}
          {chats.map((c) => (
            <div key={c.id}
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
                {c.pinned && <span style={{ marginRight: 5 }}>📌</span>}
                {c.title || 'Untitled'}
              </button>

              <button onClick={() => togglePin(c)} aria-label={c.pinned ? 'Unpin' : 'Pin'}
                title={c.pinned ? 'Unpin — let it drop back down the list' : 'Pin to the top of the list'}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 3px',
                  fontSize: 12, opacity: c.pinned ? 1 : 0.35, lineHeight: 1,
                }}>
                📌
              </button>
              <button onClick={() => removeChat(c)} aria-label="Delete"
                title="Delete this job and every design in it — permanently"
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 7px 6px 3px',
                  fontSize: 13, opacity: 0.35, lineHeight: 1, color: INK,
                }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </aside>

    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Custom Graphics</h1>
        {unit !== null && (
          <span style={{ fontSize: 12, color: SOFT }}>
            {unit} credits per design{balance !== null && ` · ${balance.toLocaleString()} left`}
          </span>
        )}
      </div>

      {/* ── THE THREAD ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 0 8px' }}>
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
          ) : it.kind === 'deck' ? (
            <DeckBlock key={it.id} deck={it} now={now} onOpen={setViewing} />
          ) : (
            <RoundBlock key={it.id} round={it} now={now} onOpen={setViewing} />
          ),
        )}

        {thinking && <div style={{ fontSize: 13, color: SOFT }}>Thinking…</div>}

        {/* What it has understood so far. Shown as a card rather than prose
            because a customer scanning for a wrong date should not have to
            read a paragraph to find it. */}
        {filled && <BriefCard fields={fields} />}

        <div ref={endRef} />
      </div>

      {/* ── THE COMPOSER ───────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', bottom: 0, paddingBottom: 18, background: 'linear-gradient(to bottom, transparent, var(--bg,#F4F1EC) 22%)' }}>
        {sheet && (
          <div style={{ ...panel, marginBottom: 10, maxHeight: '52vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,.10)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13 }}>
                {sheet === 'style' ? 'Pick a look' : sheet === 'photos' ? 'Your own photos' : 'Which sizes?'}
              </strong>
              {/* Pulses once you have chosen something, so it is obvious the
                  panel is done with and waiting to be closed. */}
              <button onClick={closeSheet} className={unacked ? 'cg-done-flash' : undefined}
                title="Close this panel — your choice is already saved"
                style={{ ...plain, padding: '6px 14px' }}>Done</button>
            </div>

            {sheet === 'style' && (
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
                    {CATEGORIES.map((c) => (
                      <button key={c.id} style={chip(category === c.id)} title={`Show the ${c.label.toLowerCase()} looks`}
                        onClick={() => {
                          setCategory(c.id); setStylePicked(true)
                          const first = FLYER_TEMPLATES.find((t) => t.category === c.id)
                          if (first) setTemplateId(first.id)
                        }}>{c.label}</button>
                    ))}
                  </div>

                  {/* SEARCH ACROSS EVERYTHING. With twenty-five looks in each of
                      nine groups, hunting by eye means scrolling past two
                      hundred tiles — and someone who wants a taco night should
                      not have to know we filed it under Food & drink. Typing
                      searches every group at once; clearing it goes back to the
                      chosen one. */}
                  <input
                    value={styleQuery}
                    onChange={(e) => setStyleQuery(e.target.value)}
                    placeholder="Search all looks — try taco, wedding, gold, retro…"
                    title="Search every group at once by name"
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 9 }}>
                    {shownStyles.map((t) => (
                      <button key={t.id} className={strobeId === t.id ? 'cg-strobe' : undefined}
                        onClick={() => { setTemplateId(t.id); setStylePicked(true); markPicked(t.id) }}
                        title={`Design it in the ${t.name} look`}
                        style={{
                          padding: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer', background: '#111',
                          border: templateId === t.id && !reference ? `3px solid ${INK}` : `1px solid ${LINE}`,
                        }}>
                        <img src={thumbUrl(t.id)} alt={t.name}
                          style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                        <div style={{ fontSize: 11, fontWeight: 700, padding: '5px 4px', background: 'white', color: INK }}>{t.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {sheet === 'photos' && (
              <PhotoSheet photos={photos} setPhotos={setPhotos} setErr={setErr} plain={plain}
                onPicked={() => markPicked('photo')} />
            )}

            {sheet === 'sizes' && (
              <>
                {GROUPS.map((g) => (
                  <div key={g.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: SOFT, marginBottom: 5 }}>{g.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 3 }}>
                      {FLYER_SIZES.filter((s) => s.group === g.id).map((s) => (
                        <label key={s.id} className={strobeId === s.id ? 'cg-strobe' : undefined}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', padding: '2px 6px', borderRadius: 6 }}>
                          <input type="checkbox" checked={ticked.includes(s.id)}
                            onChange={(e) => {
                              setSizesPicked(true)
                              setTicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)).slice(0, 8))
                              markPicked(s.id)
                            }} />
                          {s.label}
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
            )}
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
                <button onClick={makeDeck} disabled={making}
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

        <div style={{ ...panel, boxShadow: '0 6px 24px rgba(0,0,0,.07)' }}>
          {/* NUMBERED AND SPELLED OUT. As bare chips reading "Editorial",
              "Add your photos" and "2 sizes" these looked like status, not
              controls — there was nothing to say they were steps, or in what
              order. The number carries the order and the label says what the
              button is FOR; the current choice follows in lighter type so you
              can still see it at a glance. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
            <button style={chip(sheet === 'style')} onClick={() => { setUnacked(false); setStrobeId(null); setSheet(sheet === 'style' ? null : 'style') }}
              title="Choose how it should look — one of our ready-made looks, or a design of your own to copy. One or the other, not both.">
              1. Pick Your Style <Chosen on={sheet === 'style'}>{reference ? 'Your reference' : styleName}</Chosen>
            </button>
            <button style={chip(sheet === 'photos')} onClick={() => { setUnacked(false); setStrobeId(null); setSheet(sheet === 'photos' ? null : 'photos') }}
              title="Add up to three of your own pictures — a headshot, the property, your product or a logo — and the design is built around them instead of invented people">
              2. Add Photos <span style={{ fontWeight: 400 }}>(Optional)</span>
              {photos.length > 0 && <Chosen on={sheet === 'photos'}>{photos.length}</Chosen>}
            </button>
            <button style={chip(sheet === 'sizes')} onClick={() => { setUnacked(false); setStrobeId(null); setSheet(sheet === 'sizes' ? null : 'sizes') }}
              title="Tick every size you need — print, social posts, banners, business cards. Each is designed from scratch, so each costs one design.">
              3. Choose Format <Chosen on={sheet === 'sizes'}>{ticked.length} size{ticked.length === 1 ? '' : 's'}</Chosen>
            </button>

            <button onClick={clearChat} title="Start the conversation over. Your saved designs stay in your Library and nothing is refunded."
              style={{ ...plain, marginLeft: 'auto', fontWeight: 400, color: SOFT }}>
              Clear chat
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }} disabled={thinking}
              title="Describe the job the way you'd say it out loud — what it's for, when, where, how much"
              placeholder={listening ? 'Listening… speak now' : 'Describe it — "doors at 9, $20 cover, DJ Sable headlining"'}
              style={{ flex: 1, padding: '11px 13px', borderRadius: 8, border: `1px solid ${listening ? INK : LINE}`, font: 'inherit', fontSize: 15 }} />

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

            {/* "Preview details" rather than "Send": pressing this does not
                make anything or cost anything — it reads what you typed back
                to you as the card above, so you can correct a wrong date
                before paying to have it drawn. */}
            <button onClick={send} disabled={thinking || !input.trim()}
              title="Read it back to me — free, and nothing is made yet. Check the details before you pay to have it drawn."
              style={{ ...plain, padding: '10px 14px', whiteSpace: 'nowrap', opacity: thinking || !input.trim() ? 0.5 : 1 }}>
              Preview details
            </button>
            <button onClick={make} disabled={!canMake}
              title={canMake
                ? `Design ${ticked.length} graphic${ticked.length === 1 ? '' : 's'}${cost !== null ? ` for ${cost.toLocaleString()} credits` : ''}. Takes about two minutes each.`
                : 'Tell me what it\'s for and tick at least one size first'}
              style={{ ...darkBtn, opacity: canMake ? 1 : 0.5, whiteSpace: 'nowrap' }}>
              {making ? 'Designing…' : `Make ${ticked.length}${cost !== null ? ` · ${cost.toLocaleString()} cr` : ''}`}
            </button>
          </div>

          {!filled && !loadingHistory && (
            <p style={{ fontSize: 12, color: SOFT, margin: '8px 0 0' }}>Tell me what it&apos;s for first.</p>
          )}
        </div>
      </div>

      {viewing && <Viewer design={viewing} onClose={() => setViewing(null)} />}
    </div>
    </div>
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
function DeckBlock({ deck, now, onOpen }: {
  deck: Extract<Item, { kind: 'deck' }>
  now: number
  onOpen: (d: Design) => void
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
              {i + 1}. {deck.slides[i]?.fields.headline ?? ''}
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

function RoundBlock({ round, now, onOpen }: {
  round: Extract<Item, { kind: 'round' }>
  now: number
  onOpen: (d: Design) => void
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
        ) : round.designs.length > 1 && (
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

      {round.note && <p style={{ fontSize: 12, color: SOFT, margin: '0 0 10px' }}>Note: {round.note}</p>}

      {/* The bar measures designs actually finished, not time elapsed — a bar
          that fills on a timer reaches 100% while you are still waiting. */}
      {round.live && (
        <div style={{ height: 8, borderRadius: 99, background: CREAM, overflow: 'hidden', border: `1px solid ${LINE}`, marginBottom: 12 }}>
          <div style={{ height: '100%', background: INK, width: `${Math.round((done / Math.max(total, 1)) * 100)}%`, transition: 'width .5s ease' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        {round.sizeIds.map((id) => {
          const d = round.designs.find((x) => x.sizeId === id)
          const st = round.status[id] ?? 'wait'
          const label = FLYER_SIZES.find((s) => s.id === id)?.label ?? id
          if (d) {
            // NUMBERED, so a change can be asked for out loud: "design 2, make
            // the price $25". Without a number the only way to point at one is
            // to describe it, and two social sizes look alike in a grid.
            const n = round.designs.indexOf(d) + 1
            return (
              <figure key={id} style={{ margin: 0 }}>
                <button onClick={() => onOpen(d)} title="Open full size"
                  style={{ display: 'block', width: '100%', padding: 0, border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: '#111', position: 'relative' }}>
                  <img src={d.src} alt={d.label} style={{ width: '100%', display: 'block' }} />
                  <span style={{
                    position: 'absolute', top: 6, left: 6, minWidth: 20, height: 20, borderRadius: 6,
                    background: 'rgba(20,18,16,.82)', color: 'white', fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                  }}>{n}</span>
                </button>
                <figcaption style={{ fontSize: 11, color: SOFT, marginTop: 5, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label.replace(/ \d+ ?[×x].*$/, '')}</span>
                  <a href={d.src} download={`design-${n}-${d.sizeId}.png`} style={{ color: INK, fontWeight: 700, textDecoration: 'none' }}>⬇</a>
                </figcaption>
              </figure>
            )
          }
          return (
            <div key={id} style={{
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
function Viewer({ design, onClose }: { design: Design; onClose: () => void }) {
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,18,16,.88)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
      }}>
      <img src={design.src} alt={design.label} onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, background: '#111' }} />
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'white', fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>{design.label}</span>
        <span style={{ opacity: 0.6 }}>{design.w} × {design.h}</span>
        <a href={design.src} download={`${design.sizeId}.png`} title="Save this design to your computer"
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

function PhotoSheet({ photos, setPhotos, setErr, plain, onPicked }: {
  photos: { dataUrl: string; role: PhotoRole; name: string }[]
  setPhotos: React.Dispatch<React.SetStateAction<{ dataUrl: string; role: PhotoRole; name: string }[]>>
  setErr: (s: string) => void
  plain: React.CSSProperties
  /** Tell the panel a choice was made, so Done starts asking to be pressed. */
  onPicked?: () => void
}) {
  return (
    <>
      <label style={{ ...plain, display: 'inline-block', marginBottom: 10 }}>
        + Add photo
        <input type="file" title="Pick an image from your device" accept="image/*" multiple hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])].slice(0, 3 - photos.length)
            for (const f of files) {
              // Shrunk here rather than rejected for being big. A phone photo
              // straight from the camera is 4000px and 12 MB; posted as JSON
              // that is a ~16 MB request, and the host refuses anything over
              // 4.5 MB — which is what was making designs fail with no
              // explanation.
              let dataUrl: string
              try {
                dataUrl = await shrinkForUpload(f)
              } catch (err) {
                setErr(err instanceof Error ? err.message : `Could not read ${f.name}.`)
                continue
              }
              setPhotos((p) => [...p, { dataUrl, name: f.name, role: 'person' as PhotoRole }].slice(0, 3))
              onPicked?.()
            }
            e.target.value = ''
          }} />
      </label>

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
