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
  // Each planned slide holds the EDITABLE content that will actually be drawn —
  // headline + the lines (subhead first, then details) — plus its story role and
  // one-line purpose. Editing these here is what "see exactly what's on the slide
  // and change it" means (mirrors the Docs2Video script editor).
  const [planPreview, setPlanPreview] = useState<
    { title: string; purpose?: string; audience?: string; slides: { role: string; headline: string; lines: string[]; purpose?: string }[] } | null
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
        // Flatten each slide's real content into the editable lines the viewer
        // will read: subhead first, then details. Headline stays separate.
        slides: (data.slides as { role?: string; purpose?: string; fields?: { headline?: string; subhead?: string; details?: string[] } }[]).map((s) => {
          const f = s.fields ?? {}
          const lines = [f.subhead, ...(f.details ?? [])].filter(Boolean) as string[]
          return { role: s.role || 'point', headline: f.headline || 'Untitled', lines, purpose: s.purpose }
        }),
      })
      setMsgs((m) => [...m, { role: 'assistant', text: `Here’s every slide — the exact headline and lines that will be drawn. Edit any of them right here, add or drop slides, then press Make it a deck.` }])
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Network hiccup — try that again.' }])
    } finally {
      setBusy(false)
    }
  }

  // ── Inline editing of the planned slides (the "see & edit exactly" part) ──
  const editHeadline = (i: number, v: string) =>
    setPlanPreview((p) => p ? { ...p, slides: p.slides.map((s, j) => j === i ? { ...s, headline: v } : s) } : p)
  const editLine = (i: number, li: number, v: string) =>
    setPlanPreview((p) => p ? { ...p, slides: p.slides.map((s, j) => j === i ? { ...s, lines: s.lines.map((l, k) => k === li ? v : l) } : s) } : p)
  const addLine = (i: number) =>
    setPlanPreview((p) => p ? { ...p, slides: p.slides.map((s, j) => j === i ? { ...s, lines: [...s.lines, ''] } : s) } : p)
  const removeLine = (i: number, li: number) =>
    setPlanPreview((p) => p ? { ...p, slides: p.slides.map((s, j) => j === i ? { ...s, lines: s.lines.filter((_, k) => k !== li) } : s) } : p)
  const dropPlanSlide = (idx: number) =>
    setPlanPreview((p) => p ? { ...p, slides: p.slides.filter((_, i) => i !== idx) } : p)
  const addPlanSlide = (after: number) =>
    setPlanPreview((p) => p ? { ...p, slides: [
      ...p.slides.slice(0, after + 1),
      { role: 'point', headline: 'New slide', lines: [], purpose: 'Added by you' },
      ...p.slides.slice(after + 1),
    ] } : p)

  const confirmPlan = () => {
    if (!planPreview || !planPreview.slides.length) return
    // The EDITED content in state is the source of truth — no stashed raw.
    const deckSlides = planPreview.slides.map((s, i) => {
      const heading = s.headline.trim()
      const bullets = s.lines.map((l) => l.trim()).filter(Boolean)
      return { n: i + 1, heading, bullets, imageOnly: !heading && bullets.length === 0, role: s.role }
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

        {/* DECK — every slide, exactly as it'll be drawn, and fully editable.
            (Mirrors the Docs2Video script editor: you see the real headline + lines
            per slide and can change, add, or drop them BEFORE anything is made.) */}
        {planPreview && (
          <div style={{ ...card, marginTop: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: SOFT, marginBottom: 2 }}>Review every slide — edit anything</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{planPreview.title}</div>
            {planPreview.purpose && <div style={{ fontSize: 12.5, color: SOFT, marginBottom: 10 }}>Built as a {planPreview.purpose}{planPreview.audience ? ` for ${planPreview.audience}` : ''}.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'min(52vh, 520px)', overflowY: 'auto', paddingRight: 4 }}>
              {planPreview.slides.map((s, i) => (
                <div key={i} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 12px', background: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'white', background: INK, borderRadius: 5, padding: '2px 7px' }}>Slide {i + 1}</span>
                    {s.purpose && <span style={{ fontSize: 11.5, color: SOFT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.purpose}</span>}
                    <button aria-label={`Delete slide ${i + 1}`} disabled={busy || planPreview.slides.length <= 1}
                      onClick={() => dropPlanSlide(i)}
                      style={{ ...plainBtn, padding: '3px 8px', fontSize: 11.5, color: SOFT }}>Delete</button>
                  </div>

                  {/* Headline — the big line on the slide */}
                  <input
                    value={s.headline}
                    onChange={(e) => editHeadline(i, e.target.value)}
                    placeholder="Slide headline"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 14, fontWeight: 700, color: INK, marginBottom: 6 }}
                  />

                  {/* The supporting lines / bullets, each editable */}
                  {s.lines.map((line, li) => (
                    <div key={li} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ color: SOFT, fontSize: 13, flexShrink: 0 }}>•</span>
                      <input
                        value={line}
                        onChange={(e) => editLine(i, li, e.target.value)}
                        placeholder="Supporting line"
                        style={{ flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 8, border: `1px solid ${LINE}`, font: 'inherit', fontSize: 13, color: INK }}
                      />
                      <button aria-label="Remove line" onClick={() => removeLine(i, li)}
                        style={{ ...plainBtn, padding: '4px 8px', fontSize: 12, color: SOFT, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => addLine(i)} disabled={s.lines.length >= 6}
                    style={{ ...plainBtn, padding: '4px 10px', fontSize: 12, marginTop: 2 }}>+ Add a line</button>
                  <button onClick={() => addPlanSlide(i)}
                    style={{ ...plainBtn, padding: '4px 10px', fontSize: 12, marginTop: 2, marginLeft: 6 }}>+ Slide below</button>
                </div>
              ))}
            </div>

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
