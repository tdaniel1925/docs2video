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

  const [making, setMaking] = useState(false)
  const [sheet, setSheet] = useState<null | 'style' | 'photos' | 'sizes'>(null)
  const [viewing, setViewing] = useState<Design | null>(null)
  const [unit, setUnit] = useState<number | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

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
    ;(async () => {
      const r = await fetch('/api/flyer-history').then((x) => x.json()).catch(() => null)
      if (dead || !r) { setLoadingHistory(false); return }
      setUnit(typeof r.unit === 'number' ? r.unit : null)
      setBalance(typeof r.balance === 'number' ? r.balance : null)
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
      }
      setLoadingHistory(false)
    })()
    return () => { dead = true }
  }, [])

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

  const send = async () => {
    const text = input.trim()
    if (!text || thinking) return
    setInput(''); setErr('')
    say('user', text)
    setThinking(true)
    const history = items.filter((i): i is Extract<Item, { kind: 'msg' }> => i.kind === 'msg')
      .slice(-6).map((m) => ({ role: m.role, text: m.text }))
    const r = await fetch('/api/flyer-chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: text, fields, layoutId: templateId, sizeId: ticked[0] ?? 'letter', history }),
    }).then((x) => x.json()).catch(() => ({ error: 'Network error' }))
    setThinking(false)
    if (r?.error) { setErr(r.error); return }
    setFields(r.fields ?? {})
    say('assistant', r.reply || 'Got it — pick your sizes and hit Make.')
  }

  // ONE REQUEST PER SIZE, not one for all of them. Asking for everything at
  // once means nothing appears until the last one lands; split apart, each
  // design shows the moment it is ready, the bar counts real completions
  // rather than a made-up percentage, and one failure costs one size.
  const make = async () => {
    if (making || !ticked.length || !unit) return
    setErr(''); setSheet(null)

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
            roundId, messages,
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
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '18px 20px 0', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Flyer, ad &amp; card maker</h1>
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
              <button onClick={() => setSheet(null)} style={{ ...plain, padding: '4px 9px' }}>Done</button>
            </div>

            {sheet === 'style' && (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {CATEGORIES.map((c) => (
                    <button key={c.id} style={chip(category === c.id)} onClick={() => {
                      setCategory(c.id)
                      const first = FLYER_TEMPLATES.find((t) => t.category === c.id)
                      if (first) setTemplateId(first.id)
                    }}>{c.label}</button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 9 }}>
                  {FLYER_TEMPLATES.filter((t) => t.category === category).map((t) => (
                    <button key={t.id} onClick={() => setTemplateId(t.id)} title={t.name}
                      style={{
                        padding: 0, borderRadius: 9, overflow: 'hidden', cursor: 'pointer', background: '#111',
                        border: templateId === t.id ? `3px solid ${INK}` : `1px solid ${LINE}`,
                      }}>
                      <img src={thumbUrl(t.id)} alt={t.name}
                        style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                      <div style={{ fontSize: 11, fontWeight: 700, padding: '5px 4px', background: 'white', color: INK }}>{t.name}</div>
                    </button>
                  ))}
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
                            onChange={(e) => setTicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)).slice(0, 8))} />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <input value={note} onChange={(e) => setNote(e.target.value)}
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <button style={chip(sheet === 'style')} onClick={() => setSheet(sheet === 'style' ? null : 'style')}>🎨 {styleName}</button>
            <button style={chip(sheet === 'photos')} onClick={() => setSheet(sheet === 'photos' ? null : 'photos')}>
              📷 {photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Add your photos'}
            </button>
            <button style={chip(sheet === 'sizes')} onClick={() => setSheet(sheet === 'sizes' ? null : 'sizes')}>
              📐 {ticked.length} size{ticked.length === 1 ? '' : 's'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }} disabled={thinking}
              placeholder='Describe it — "doors at 9, $20 cover, DJ Sable headlining"'
              style={{ flex: 1, padding: '11px 13px', borderRadius: 8, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 15 }} />
            <button onClick={send} disabled={thinking || !input.trim()}
              style={{ ...plain, padding: '10px 14px', opacity: thinking || !input.trim() ? 0.5 : 1 }}>Send</button>
            <button onClick={make} disabled={!canMake} style={{ ...darkBtn, opacity: canMake ? 1 : 0.5, whiteSpace: 'nowrap' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>
          {round.live ? 'Designing' : 'Designs'} · {style} · {total} size{total === 1 ? '' : 's'}
        </strong>
        {round.live && (
          <span style={{ fontSize: 12, color: SOFT }}>
            {done} of {total} · {remaining > 0 ? `about ${mmss(remaining)} left` : 'any moment now'}
          </span>
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
            return (
              <figure key={id} style={{ margin: 0 }}>
                <button onClick={() => onOpen(d)} title="Open full size"
                  style={{ display: 'block', width: '100%', padding: 0, border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: '#111' }}>
                  <img src={d.src} alt={d.label} style={{ width: '100%', display: 'block' }} />
                </button>
                <figcaption style={{ fontSize: 11, color: SOFT, marginTop: 5, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label.replace(/ \d+ ?[×x].*$/, '')}</span>
                  <a href={d.src} download={`${d.sizeId}.png`} style={{ color: INK, fontWeight: 700, textDecoration: 'none' }}>⬇</a>
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
        <a href={design.src} download={`${design.sizeId}.png`}
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
        <input type="file" accept="image/*" multiple hidden
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
