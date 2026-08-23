'use client'

import { useEffect, useRef, useState } from 'react'
import type { FlyerFields } from '../../../_lib/flyer-engine'
import { useWizard } from '../useWizard'
import { useDictation } from '../../../_components/useDictation'
import { INK, SOFT, LINE, MINT, CREAM, card, plainBtn, primaryBtn, StepShell } from '../ui'

/**
 * STEP 3 — THE CONTENT, AS A CHAT.
 *
 * Four ways in, all landing in the same place — the flyer's words:
 *   • Type or SPEAK it (useDictation — the proven mic, not a rebuilt one).
 *   • Ask the AI to WRITE it from a topic ("write it for me about …").
 *   • PASTE text.
 *   • UPLOAD a document (PDF / Word / txt) — we pull the text out.
 * Every one of these becomes a message to /api/flyer-chat, which already turns
 * plain talk into the structured fields (headline, details, cta, contact) and
 * replies. Documents/paste get their raw text via /api/extract first, then the
 * same chat turns that text into the words. The running fields live in wizard
 * state, so the next steps and the generator see them.
 */
type Msg = { role: 'user' | 'assistant'; text: string }

export default function ContentStep() {
  const { state, patch, ready } = useWizard()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [manual, setManual] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Deck flow: the brief waiting for a length choice, and the planned running
  // order the user reviews (with per-slide purpose) BEFORE anything is drawn.
  const [deckBrief, setDeckBrief] = useState('')
  const [planPreview, setPlanPreview] = useState<
    { title: string; purpose?: string; audience?: string; slides: { role: string; headline: string; purpose?: string }[] } | null
  >(null)

  const dictation = useDictation((text) => setInput((v) => (v ? v + ' ' : '') + text),
    { onError: (m) => setNote(m) })

  // Greet once, tailored to what they're making.
  useEffect(() => {
    if (!ready || msgs.length) return
    const isDeck = state.kind === 'deck'
    setMsgs([{ role: 'assistant', text: isDeck
      ? 'Tell me what the deck is about and who it’s for — or paste all your notes — and I’ll plan it into a full set of matching slides. (Or upload a deck to restyle instead.)'
      : 'Tell me what this needs to say — the event, the offer, the details. You can talk it, type it, paste text, or upload a document and I’ll write it for you.' }])
  }, [ready])

  // Only follow the conversation down if the user is ALREADY near the bottom.
  // Auto-scrolling while they've scrolled up to re-read an answer is the jarring
  // behaviour the audit flagged.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs, busy])

  if (!ready) return null

  // MAKE A WHOLE DECK FROM WHAT YOU TYPED OR PASTED — in three moves:
  //   1. take the brief, then ask how long it should run (length chips);
  //   2. plan it into a story and SHOW the running order to review/trim;
  //   3. confirm → set deckSlides (locks Sizes to 16:9, lights up the render).
  // Nobody pays for a pile of images from an order they never saw.
  const takeDeckBrief = (brief: string) => {
    setDeckBrief(brief)
    setPlanPreview(null)
    setMsgs((m) => [...m, { role: 'user', text: brief.length > 200 ? brief.slice(0, 200) + '…' : brief }])
    setMsgs((m) => [...m, { role: 'assistant', text: 'Got it. How long should this deck run? I’ll plan it into a story, then show you the running order to check before anything’s made.' }])
  }

  const runPlan = async (length: 'short' | 'medium' | 'long') => {
    if (!deckBrief || busy) return
    setBusy(true)
    setMsgs((m) => [...m, { role: 'assistant', text: `Planning a ${length} deck — reading it as a story…` }])
    try {
      const r = await fetch('/api/flyer-deck', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief: deckBrief, length }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !Array.isArray(data.slides) || !data.slides.length) {
        setMsgs((m) => [...m, { role: 'assistant', text: data?.error || 'I couldn’t plan that into slides — try adding a bit more detail.' }])
        return
      }
      setPlanPreview({
        title: data.title || 'Your deck',
        purpose: data.purpose, audience: data.audience,
        slides: (data.slides as { role?: string; purpose?: string; fields?: { headline?: string } }[]).map((s) => ({
          role: s.role || 'point', headline: s.fields?.headline || 'Untitled', purpose: s.purpose,
        })),
      })
      // Stash the FULL slide data (with subhead/details) for confirm, keyed by index.
      ;(runPlan as unknown as { _raw?: unknown })._raw = data.slides
      setMsgs((m) => [...m, { role: 'assistant', text: `Here’s the running order — ${data.slides.length} slides${data.purpose ? `, built as a ${data.purpose}` : ''}. Drop any you don’t want, then press Make it a deck. Or pick a different length.` }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Network hiccup — try that again.' }])
    } finally {
      setBusy(false)
    }
  }

  const dropPlanSlide = (idx: number) => {
    setPlanPreview((p) => p ? { ...p, slides: p.slides.filter((_, i) => i !== idx) } : p)
    const raw = (runPlan as unknown as { _raw?: unknown[] })._raw
    if (Array.isArray(raw)) (runPlan as unknown as { _raw?: unknown[] })._raw = raw.filter((_, i) => i !== idx)
  }

  const confirmPlan = () => {
    const raw = (runPlan as unknown as { _raw?: { role?: string; fields?: { headline?: string; subhead?: string; details?: string[] } }[] })._raw
    if (!planPreview || !Array.isArray(raw) || !raw.length) return
    // PlannedSlide.fields → DeckSlide { heading, bullets }. Carry the story role
    // through so the generator can keep the logo in a fixed corner on body slides.
    const deckSlides = raw.map((s, i) => {
      const f = s.fields ?? {}
      const bullets = [f.subhead, ...(f.details ?? [])].filter(Boolean) as string[]
      return { n: i + 1, heading: f.headline || '', bullets, imageOnly: !f.headline && bullets.length === 0, role: s.role || 'point' }
    })
    patch({ deckSlides, deckName: planPreview.title, sizes: ['slide-16x9'] })
    setMsgs((m) => [...m, { role: 'assistant', text: `Locked in ${deckSlides.length} slides. Pick a look next and press Make — every slide comes out matching, at 16:9.` }])
    setPlanPreview(null); setDeckBrief('')
  }

  // Send one message to the flyer-chat brain; it returns updated fields + a reply.
  const talk = async (message: string, opts?: { asContent?: boolean }) => {
    const clean = message.trim()
    if (!clean || busy) return
    // A deck (with no uploaded file) plans the WHOLE deck from these words.
    // First we take the brief and ask how long it should run; the length chips
    // then trigger the actual plan. A new message here re-briefs from scratch.
    if (state.kind === 'deck' && !state.deckSlides) { takeDeckBrief(clean); return }
    setNote('')
    setMsgs((m) => [...m, { role: 'user', text: opts?.asContent ? 'Here’s my content — turn it into the words.' : clean }])
    setBusy(true)
    try {
      const r = await fetch('/api/flyer-chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: opts?.asContent ? `Here is my content — write the flyer's words from it:\n\n${clean}` : clean,
          fields: state.fields,
          sizeId: state.sizes[0],
          history: msgs.slice(-8),
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        // A 502 here is usually the writing service being down or out of credit,
        // not the user. Say so plainly instead of "I couldn't think of a reply".
        const msg = r.status >= 500
          ? 'The writing helper is unavailable right now — that’s on us, not you. You can still type your words in yourself and press Next.'
          : (data?.error || 'Say that again?')
        setMsgs((m) => [...m, { role: 'assistant', text: msg }])
        return
      }
      if (data.fields) patch({ fields: data.fields })
      // A website was read: keep its colours for the design to be tinted with,
      // and (if it had a logo) nudge them to the reference box to place it — we
      // never auto-place someone's logo for them.
      if (Array.isArray(data.brandColors) && data.brandColors.length) patch({ brandColors: data.brandColors })
      let note = String(data.reply || 'Got it.')
      if (data.siteLogoFound) note += ' I spotted their logo on the site too — on the Look step, use the “your logo & photos” box to add it.'
      setMsgs((m) => [...m, { role: 'assistant', text: note }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Network hiccup — try that again.' }])
    } finally {
      setBusy(false)
    }
  }

  const send = () => { const v = input; setInput(''); void talk(v) }

  // Paste flow: a small prompt asks for the pasted text, then it becomes content.
  const onPaste = async (e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData('text') ?? ''
    if (text.trim().length > 120) { e.preventDefault(); setInput(''); await talk(text, { asContent: true }) }
  }

  // Upload: pull the document's text out via /api/extract, then chat writes the words.
  const onFile = async (file: File | undefined) => {
    if (!file || busy) return
    setNote(''); setBusy(true)
    setMsgs((m) => [...m, { role: 'user', text: `📎 ${file.name}` }])
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/extract', { method: 'POST', body: fd })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setMsgs((m) => [...m, { role: 'assistant', text: data?.error || 'Could not read that file.' }]); return }
      // Flatten whatever structure came back into plain text for the chat.
      const parts: string[] = []
      if (data.title) parts.push(String(data.title))
      for (const s of data.sections ?? []) parts.push(`${s.heading ?? ''}\n${s.content ?? ''}`)
      for (const b of data.bulletPoints ?? []) parts.push(`• ${b}`)
      const text = parts.join('\n').trim() || JSON.stringify(data).slice(0, 4000)
      await talk(text, { asContent: true })
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Could not read that file — try a PDF, Word doc, or text file.' }])
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Ready to move on when there's a headline/detail OR — for a deck — a planned
  // set of slides. A deck's words live in deckSlides, not fields.
  const hasWords = Boolean(
    state.fields.headline || (state.fields.details ?? []).length ||
    (state.deckSlides && state.deckSlides.length),
  )

  const bubble = (m: Msg, i: number) => (
    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '78%', padding: '9px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        background: m.role === 'user' ? INK : 'white', color: m.role === 'user' ? 'white' : INK,
        border: m.role === 'user' ? 'none' : `1px solid ${LINE}`,
      }}>{m.text}</div>
    </div>
  )

  return (
    <StepShell title="What should it *say*?"
      subtitle="Talk it, type it, paste it, or drop in a document — I’ll turn it into the words on your design. Add or change anything until it’s right."
      back="/design/style" next="/design/sizes" nextLabel="Next: pick sizes" nextReady={hasWords}
      nextHint="Tell me the content first">

      <div style={{ maxWidth: 720 }}>
        {/* transcript */}
        <div ref={scrollerRef} style={{ ...card, padding: 14, height: 'min(46vh,420px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, background: CREAM }}>
          {msgs.map(bubble)}
          {busy && <div style={{ fontSize: 12.5, color: SOFT, paddingLeft: 4 }}>Working…</div>}
        </div>

        {/* DECK — how long? (only after a brief, before a plan exists) */}
        {deckBrief && !planPreview && (
          <div style={{ ...card, marginTop: 10, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>How long should this deck run?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['short', 'Short', '5–7 slides'], ['medium', 'Medium', '8–14 slides'], ['long', 'Long', '15–24 slides']] as const).map(([k, label, sub]) => (
                <button key={k} disabled={busy} onClick={() => void runPlan(k)}
                  style={{ ...plainBtn, padding: '10px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{label}</span>
                  <span style={{ fontSize: 12, color: SOFT }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DECK — the running order, reviewed BEFORE anything is drawn */}
        {planPreview && (
          <div style={{ ...card, marginTop: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: SOFT, marginBottom: 2 }}>Running order</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{planPreview.title}</div>
            {planPreview.purpose && <div style={{ fontSize: 12.5, color: SOFT, marginBottom: 8 }}>Built as a {planPreview.purpose}{planPreview.audience ? ` for ${planPreview.audience}` : ''}.</div>}
            <ol style={{ margin: '4px 0 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {planPreview.slides.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', border: `1px solid ${LINE}`, borderRadius: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: SOFT, minWidth: 20 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{s.headline}</div>
                    {s.purpose && <div style={{ fontSize: 12, color: SOFT }}>{s.purpose}</div>}
                  </div>
                  <button aria-label={`Remove slide ${i + 1}`} disabled={busy || planPreview.slides.length <= 1}
                    onClick={() => dropPlanSlide(i)}
                    style={{ ...plainBtn, padding: '4px 8px', fontSize: 12, color: SOFT }}>Remove</button>
                </li>
              ))}
            </ol>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={confirmPlan} disabled={busy} style={{ ...primaryBtn, padding: '10px 16px' }}>Make it a deck ({planPreview.slides.length} slides)</button>
              <button onClick={() => setPlanPreview(null)} disabled={busy} style={plainBtn}>Choose a different length</button>
            </div>
          </div>
        )}

        {/* what we've captured so far */}
        {hasWords && !deckBrief && !planPreview && (
          <div style={{ ...card, marginTop: 10, padding: '10px 14px', background: `${MINT}33`, border: `1px solid ${MINT}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: SOFT, marginBottom: 4 }}>On your design so far</div>
            {state.fields.headline && <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{state.fields.headline}</div>}
            {(state.fields.details ?? []).map((d, i) => <div key={i} style={{ fontSize: 13, color: INK }}>· {d}</div>)}
            {state.fields.cta && <div style={{ fontSize: 13, color: INK, marginTop: 2 }}>▸ {state.fields.cta}</div>}
          </div>
        )}

        {/* composer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onPaste={onPaste}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={2} placeholder="Type or paste here — or press the mic and talk…"
            style={{ flex: 1, resize: 'none', padding: '10px 12px', borderRadius: 10, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 14, color: INK }} />
          <button onClick={() => dictation.toggle()} disabled={busy}
            aria-label={dictation.listening ? 'Stop recording' : 'Talk to type'}
            aria-pressed={dictation.listening}
            title={dictation.listening ? 'Stop' : 'Talk'}
            style={{ ...plainBtn, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, background: dictation.listening ? '#C0392B' : 'white', color: dictation.listening ? 'white' : INK }}>
            <span aria-hidden>{dictation.transcribing ? '…' : dictation.listening ? '■' : '🎤'}</span>
            <span style={{ fontSize: 12 }}>{dictation.transcribing ? 'Transcribing…' : dictation.listening ? 'Listening…' : 'Talk'}</span>
          </button>
          <button onClick={send} disabled={busy || !input.trim()} style={{ ...primaryBtn, padding: '10px 16px', opacity: busy || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>

        {/* quick actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button style={plainBtn} disabled={busy} onClick={() => void talk('Write it for me — ask me for a topic if you need one.')}>✍️ Write it for me</button>
          <button style={plainBtn} disabled={busy} onClick={() => fileRef.current?.click()}>📎 Upload a document</button>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.pptx" hidden
            onChange={(e) => void onFile(e.target.files?.[0])} />
          <button style={plainBtn} onClick={() => setManual((v) => !v)}>✏️ Type it in myself</button>
        </div>
        <p style={{ fontSize: 12, color: SOFT, margin: '8px 2px 0' }}>
          Tip: paste a website (like <strong style={{ color: INK }}>jordyn.app</strong>) and I’ll pull the words and colours from it.
        </p>

        {/* Always-available manual fields — works even if the writing helper is
            down. It shares the PARENT's state/patch (not its own useWizard copy),
            so a saved headline immediately enables Next. */}
        {manual && <ManualFields fields={state.fields} onSave={(f) => patch({ fields: { ...state.fields, ...f } })} />}

        {note && <p style={{ fontSize: 12.5, color: '#B4432F', margin: '8px 0 0' }}>{note}</p>}
      </div>
    </StepShell>
  )
}

/**
 * The type-it-yourself fallback. Always works — no AI — so the step is never a
 * dead end if the writing helper is unavailable. It does NOT call useWizard
 * itself (that would be a SEPARATE state copy — a saved headline wouldn't reach
 * the parent, and Next would never enable). Instead it saves through the
 * parent's patch, so the parent re-renders and Next lights up.
 */
function ManualFields({ fields, onSave }: { fields: FlyerFields; onSave: (f: FlyerFields) => void }) {
  const [headline, setHeadline] = useState(fields.headline ?? '')
  const [details, setDetails] = useState((fields.details ?? []).join('\n'))
  const [cta, setCta] = useState(fields.cta ?? '')

  const save = () => onSave({
    headline: headline.trim() || undefined,
    details: details.split('\n').map((s) => s.trim()).filter(Boolean),
    cta: cta.trim() || undefined,
  })
  const box = { width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 14, boxSizing: 'border-box' as const, color: INK }
  const lbl = { fontSize: 12.5, fontWeight: 700, color: INK, display: 'block', margin: '0 0 5px' }

  return (
    <div style={{ ...card, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={lbl}>Headline</label>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} onBlur={save} placeholder="e.g. Grand Opening BBQ" style={box} />
      </div>
      <div>
        <label style={lbl}>The details <span style={{ color: SOFT, fontWeight: 400 }}>(one per line)</span></label>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} onBlur={save} rows={3} placeholder={'Saturday, Sept 12\n$89 tune-up\nFree food'} style={{ ...box, resize: 'vertical' }} />
      </div>
      <div>
        <label style={lbl}>Call to action <span style={{ color: SOFT, fontWeight: 400 }}>(optional)</span></label>
        <input value={cta} onChange={(e) => setCta(e.target.value)} onBlur={save} placeholder="e.g. Book now · RSVP" style={box} />
      </div>
    </div>
  )
}
