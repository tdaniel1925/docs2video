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
// WHY THE BUTTONS STAYED. Picking a look from fifteen pictures is three clicks
// and describing it is a sentence that gets it wrong, so style, photos and
// sizes are controls in the typing bar rather than things you must type. Chat
// is the spine; clicking is kept for whatever is faster to click.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import {
  FLYER_TEMPLATES, FLYER_SIZES, PHOTO_ROLES, thumbUrl,
  type FlyerFields, type PhotoRole,
} from '../../_lib/flyer-engine'

type Design = { sizeId: string; label: string; w: number; h: number; src: string }
type Status = 'wait' | 'busy' | 'done' | 'fail'

/** Everything in the thread, in the order it happened. */
type Item =
  | { kind: 'msg'; role: 'user' | 'assistant'; text: string }
  | {
      kind: 'round'; id: string; templateId: string; note: string
      sizeIds: string[]; designs: Design[]; status: Record<string, Status>
      startedAt: number; live: boolean; failed?: string[]
    }

// Three at a time: quick enough, and few enough not to trip the image API's
// rate limit and turn a queue into a wall of errors.
const CONCURRENCY = 3
// MEASURED against production, not guessed — the first estimate here was 75s
// and it was wrong. Better to quote the real number and finish early.
const SECS_PER_SIZE = 115

const CATEGORIES = [
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'business', label: 'Business' },
  { id: 'community', label: 'Community' },
  { id: 'realestate', label: 'Real estate' },
  { id: 'fitness', label: 'Fitness' },
] as const

const GROUPS = [
  { id: 'print', label: 'Print' },
  { id: 'social', label: 'Social posts' },
  { id: 'banner', label: 'Banners & headers' },
  { id: 'card', label: 'Business cards' },
] as const

const INK = 'var(--ink,#23201c)'
const SOFT = 'var(--ink-soft,#6b6459)'
const LINE = 'var(--border,#ddd6cc)'
const CREAM = 'var(--cream,#F4F1EC)'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
  const [category, setCategory] = useState<string>('nightlife')
  const [note, setNote] = useState('')
  const [ticked, setTicked] = useState<string[]>(['letter', 'ig-post'])
  const [photos, setPhotos] = useState<{ dataUrl: string; role: PhotoRole; name: string }[]>([])
  // A design to copy the LOOK of. Mutually exclusive with a template style —
  // see the note in the style sheet for why.
  const [reference, setReference] = useState<{ dataUrl: string; name: string } | null>(null)
  const [listening, setListening] = useState(false)

  // Has the customer made these choices THEMSELVES yet? The conversation is
  // allowed to set the look and the sizes while they are still on the
  // defaults, but the moment someone picks for themselves, their choice wins
  // and stays won. Nothing is more annoying than a tool that quietly undoes
  // what you just clicked.
  const [stylePicked, setStylePicked] = useState(false)
  const [sizesPicked, setSizesPicked] = useState(false)

  const [making, setMaking] = useState(false)
  const [sheet, setSheet] = useState<null | 'style' | 'photos' | 'sizes'>(null)
  const [viewing, setViewing] = useState<Design | null>(null)
  const [unit, setUnit] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Project chats. One chat is one job — the summer party flyer, a client's
  // cards — instead of every design anyone ever made sharing one endless
  // scrollback.
  const [chats, setChats] = useState<{ id: string; title: string; updated_at: string }[]>([])
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
      const r = await fetch(`/api/flyer-history${chatId ? `?chat=${chatId}` : ''}`)
        .then((x) => x.json()).catch(() => null)
      if (dead || !r) { setLoadingHistory(false); return }
      setUnit(typeof r.unit === 'number' ? r.unit : null)
      setBalance(typeof r.balance === 'number' ? r.balance : null)
      setChats(r.chats ?? [])
      if (r.openChat) setChatId(r.openChat)
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
      else if (sheet) setSheet(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing, sheet])

  const say = (role: 'user' | 'assistant', text: string) =>
    setItems((p) => [...p, { kind: 'msg', role, text }])

  // ── talking to it ──────────────────────────────────────────────────────
  //
  // EVERY FAILURE HERE MUST BE VISIBLE. The first version swallowed all of
  // them — an unsupported browser hid the button entirely, a denied microphone
  // reset the state and said nothing, and a thrown start() was caught and
  // discarded. The result was a button that did nothing with no way to find
  // out why, which is exactly what got reported.
  const recogRef = useRef<any>(null)
  const [micSupported, setMicSupported] = useState(true)
  const heardAnythingRef = useRef(false)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setMicSupported(false); return }
    const r = new SR()
    r.lang = navigator.language || 'en-US'
    r.continuous = true
    r.interimResults = false

    r.onresult = (e: any) => {
      // Append rather than replace: dictation arrives in chunks and each one
      // should add to the sentence, not wipe what came before.
      let heard = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) heard += e.results[i][0].transcript
      }
      if (heard.trim()) {
        heardAnythingRef.current = true
        setInput((p) => (p ? `${p.trim()} ${heard.trim()}` : heard.trim()))
      }
    }

    r.onerror = (e: any) => {
      setListening(false)
      // Say WHICH thing went wrong. "It didn't work" sends someone into their
      // settings at random.
      const why: Record<string, string> = {
        'not-allowed': 'Your browser is blocking the microphone for this site. Click the padlock in the address bar, allow the microphone, then try again.',
        'service-not-allowed': 'Your browser blocked speech recognition for this site. Check the padlock in the address bar.',
        'no-speech': 'I didn\'t hear anything. Check the right microphone is selected and try again.',
        'audio-capture': 'No microphone found. Plug one in or check it isn\'t in use by another app.',
        'network': 'Speech recognition needs the internet and could not reach the service. Type it instead, or try again.',
        'aborted': '',
      }
      const msg = why[e?.error] ?? `The microphone stopped: ${e?.error || 'unknown reason'}. You can type it instead.`
      if (msg) setErr(msg)
    }

    r.onend = () => {
      setListening(false)
      // Ended cleanly having heard nothing at all — usually a muted mic or the
      // wrong input device. Silence here is the confusing case.
      if (!heardAnythingRef.current) {
        setErr((prev) => prev || 'I didn\'t catch anything. Check your microphone is on and is the one your browser is using.')
      }
    }

    recogRef.current = r
    return () => { try { r.abort() } catch { /* already stopped */ } }
  }, [])

  const toggleMic = async () => {
    const r = recogRef.current
    if (!r) {
      setErr('This browser can\'t do speech. Chrome or Edge on a computer can — or just type it.')
      return
    }
    if (listening) { try { r.stop() } catch { /* already stopped */ } setListening(false); return }

    setErr('')
    heardAnythingRef.current = false

    // Ask for the microphone EXPLICITLY first. Left to the speech API the
    // prompt sometimes never appears — the call just fails — and then there is
    // nothing on screen to act on. Doing it here means the browser's own
    // permission dialog shows up, and a refusal is reportable.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Release it immediately; speech recognition opens its own.
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      setErr('I need permission to use your microphone. Click the padlock in the address bar, allow the microphone, then press the mic again.')
      return
    }

    try {
      r.start()
      setListening(true)
    } catch (e) {
      // start() throws if it is already running. Stop and let the user retry
      // rather than leaving a button that appears dead.
      try { r.abort() } catch { /* fine */ }
      setListening(false)
      setErr('The microphone was already busy — press it once more.')
    }
  }

  /** Open a saved project chat. */
  const openChat = (id: string) => {
    if (id === chatId) return
    setChatId(id)
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
    setChatId(crypto.randomUUID())
    setOpenChatKey((k) => k + 1)
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
  const make = async () => {
    if (making || !ticked.length || !unit) return
    setErr(''); setSheet(null)

    // Every job lives in a chat. If this is the first thing made in a brand
    // new session there is no id yet, so mint one now.
    const chat = chatId ?? crypto.randomUUID()
    if (!chatId) setChatId(chat)

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
    const failures: string[] = []
    let stop = ''

    const worker = async () => {
      for (;;) {
        const id = queue.shift()
        if (!id || stop) return
        patch((r) => ({ ...r, status: { ...r.status, [id]: 'busy' } }))
        const res = await fetch('/api/flyer-art', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateId, sizeIds: [id], fields, note: note.trim() || undefined,
            photos: photos.map(({ dataUrl, role }) => ({ dataUrl, role })),
            referenceDataUrl: reference?.dataUrl,
            roundId, chatId: chat, messages,
          }),
        }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))

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
          failures.push(FLYER_SIZES.find((s) => s.id === id)?.label ?? id)
          patch((r) => ({ ...r, status: { ...r.status, [id]: 'fail' } }))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sizeIds.length) }, worker))
    // Anything the credit stop skipped never ran; don't leave it spinning.
    patch((r) => ({
      ...r, live: false, failed: failures,
      status: Object.fromEntries(Object.entries(r.status).map(([k, v]) => [k, v === 'wait' || v === 'busy' ? 'fail' : v])),
    }))
    setMaking(false)
    if (stop) setErr(stop)
    else if (failures.length) setErr(`Could not make: ${failures.join(', ')} — you were not charged for those.`)
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
      <aside style={{ width: 216, flexShrink: 0, position: 'sticky', top: 18, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            <button key={c.id} onClick={() => openChat(c.id)} title={`Open "${c.title}"`}
              style={{
                textAlign: 'left', padding: '9px 11px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid transparent', fontFamily: 'inherit', fontSize: 13,
                background: c.id === chatId ? 'white' : 'transparent',
                boxShadow: c.id === chatId ? `inset 0 0 0 1px ${LINE}` : 'none',
                fontWeight: c.id === chatId ? 700 : 400,
                color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
              {c.title || 'Untitled'}
            </button>
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
              <button onClick={() => setSheet(null)} title="Close this panel — your choice is already saved" style={{ ...plain, padding: '4px 9px' }}>Done</button>
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
                  <strong style={{ color: INK }}>a design of your own to copy</strong> — one or the other,
                  not both. Each is a full instruction for how it should look, and two at once means the
                  design follows neither. Picking one clears the other.
                </p>

                {reference ? (
                  <div title="The look of this design will be copied — its colours, lettering and layout — using your words, not its own"
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
                  <label title="Upload a flyer, ad or card you like — yours will be designed in the same style"
                    style={{ ...plain, display: 'inline-block', marginBottom: 12 }}>
                    + Add Reference — copy a design I already have
                    <input type="file" accept="image/*" hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (!f) return
                        if (f.size > 12 * 1024 * 1024) { setErr(`${f.name} is too big — 12 MB max.`); return }
                        const dataUrl: string = await new Promise((res) => {
                          const r = new FileReader()
                          r.onload = () => res(String(r.result))
                          r.readAsDataURL(f)
                        })
                        setReference({ dataUrl, name: f.name })
                        setStylePicked(true)
                        say('assistant', 'Got your reference — I\'ll copy its look and use your words. Our own styles are switched off while it\'s attached; remove it to go back to them.')
                      }} />
                  </label>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 9 }}>
                    {FLYER_TEMPLATES.filter((t) => t.category === category).map((t) => (
                      <button key={t.id} onClick={() => { setTemplateId(t.id); setStylePicked(true) }}
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
              <PhotoSheet photos={photos} setPhotos={setPhotos} setErr={setErr} plain={plain} />
            )}

            {sheet === 'sizes' && (
              <>
                {GROUPS.map((g) => (
                  <div key={g.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: SOFT, marginBottom: 5 }}>{g.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 3 }}>
                      {FLYER_SIZES.filter((s) => s.group === g.id).map((s) => (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', padding: '2px 0' }}>
                          <input type="checkbox" checked={ticked.includes(s.id)}
                            onChange={(e) => {
                              setSizesPicked(true)
                              setTicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)).slice(0, 8))
                            }} />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  title="Anything the style should do differently — a colour, a mood, something to leave out"
                  placeholder="Anything else about the look? e.g. 'use purple instead of gold'"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 13 }} />
                <p style={{ fontSize: 12, color: SOFT, margin: '8px 0 0' }}>Up to 8 at a time. Each is designed from scratch, not a crop of the others.</p>
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
            <button style={chip(sheet === 'style')} onClick={() => setSheet(sheet === 'style' ? null : 'style')}
              title="Choose how it should look — one of our fifteen looks, or a design of your own to copy. One or the other, not both.">
              1. Pick Your Style <Chosen on={sheet === 'style'}>{reference ? 'Your reference' : styleName}</Chosen>
            </button>
            <button style={chip(sheet === 'photos')} onClick={() => setSheet(sheet === 'photos' ? null : 'photos')}
              title="Add up to three of your own pictures — a headshot, the property, your product or a logo — and the design is built around them instead of invented people">
              2. Add Photos <span style={{ fontWeight: 400 }}>(Optional)</span>
              {photos.length > 0 && <Chosen on={sheet === 'photos'}>{photos.length}</Chosen>}
            </button>
            <button style={chip(sheet === 'sizes')} onClick={() => setSheet(sheet === 'sizes' ? null : 'sizes')}
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

            {/* ALWAYS SHOWN, even where it cannot work. Hiding it left anyone
                on an unsupported browser with no button and no explanation —
                indistinguishable from a broken one. */}
            <button onClick={toggleMic} disabled={!micSupported}
              title={!micSupported
                ? 'This browser can\'t do speech — Chrome or Edge on a computer can. Type it instead.'
                : listening ? 'Stop listening' : 'Talk instead of typing — say what the design is for'}
              aria-label={listening ? 'Stop listening' : 'Dictate'}
              style={{
                ...plain, padding: '10px 12px',
                background: listening ? INK : 'white',
                color: listening ? 'white' : INK,
                border: listening ? '1px solid transparent' : plain.border,
                opacity: micSupported ? 1 : 0.4,
                cursor: micSupported ? 'pointer' : 'not-allowed',
              }}>
              {listening ? '● Stop' : '🎤'}
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

function PhotoSheet({ photos, setPhotos, setErr, plain }: {
  photos: { dataUrl: string; role: PhotoRole; name: string }[]
  setPhotos: React.Dispatch<React.SetStateAction<{ dataUrl: string; role: PhotoRole; name: string }[]>>
  setErr: (s: string) => void
  plain: React.CSSProperties
}) {
  return (
    <>
      <label style={{ ...plain, display: 'inline-block', marginBottom: 10 }}>
        + Add photo
        <input type="file" title="Pick an image from your device" accept="image/*" multiple hidden
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])].slice(0, 3 - photos.length)
            for (const f of files) {
              // 12 MB is a generous phone photo. Bigger and the upload stalls
              // long before the design ever starts.
              if (f.size > 12 * 1024 * 1024) { setErr(`${f.name} is too big — 12 MB max.`); continue }
              const dataUrl: string = await new Promise((res) => {
                const r = new FileReader()
                r.onload = () => res(String(r.result))
                r.readAsDataURL(f)
              })
              setPhotos((p) => [...p, { dataUrl, name: f.name, role: 'person' as PhotoRole }].slice(0, 3))
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
