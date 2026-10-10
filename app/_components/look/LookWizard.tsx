'use client'

// =============================================================================
// THE LOOK SCREEN — "Make it look like…" (approved design: look wizard v2).
//
// One screen. Pick a start (My brand / Something I like / A ready style) and
// every setting is filled in; "We picked this from …" shows what was picked,
// each part changeable; nudges with Undo; the contrast guard says what it
// fixed and why; fine controls fold away under "Fine-tune (optional)".
// The preview on the right (first on phones) is the REAL scene kit playing
// the person's own scenes in the browser (LookPreview, loaded lazily).
//
// Used from step 3 (/create/look?id=…, "Use this look" → this video's draft +
// the brand) and from Brands (/brands/[id]/look, "Save look" → the brand).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Note } from '../kit'
import BottomBar from '../../(dashboard)/create/_components/workspace/BottomBar'
import { formatFigure, KIT_FONTS, MUSIC_PICKS, type KitPlan, type Look, type FontId } from '../../../remotion/src/kit/spec'
import {
  BACKGROUND_CHOICES, canUndo, commit, CORNER_CHOICES, FEEL_CHOICES, fontLabel, GUARD_WHY, guardNotes, HEADLINE_CHOICES,
  headlineKey, LOGO_CHOICES, lookFromBrand, NUDGES, nudge, READY_STYLES, readyStyle, startHistory, undo, withColors, withHeadline,
  type LookHistory, type SavedLook, type StartMode,
} from '../../_lib/look-wizard'
import type { PaletteColors } from '../../_lib/look-palette'
import type { LookPreviewHandle } from './LookPreview'
import s from './LookWizard.module.css'

// The player + the kit load only on this screen.
const LookPreview = dynamic(() => import('./LookPreview'), { ssr: false, loading: () => <div className={s.playerWait} aria-hidden="true" /> })

type BrandInfo = { id: string; name: string; primary_color: string | null; secondary_color: string | null; accent_color: string | null; fonts: string[]; logo_chip: boolean; hasLogo: boolean; hasLogoKit: boolean }
type LookData = { plan: KitPlan; sample: boolean; brand: BrandInfo | null; looks: { current: SavedLook | null; saved: SavedLook[] }; draftLook: Look | null; editable: boolean }
type RefState = { status: 'idle' | 'reading' | 'done' | 'failed'; name?: string; thumb?: string; message?: string; seconds?: number; fontLabel?: string; alternatives?: PaletteColors[]; base?: PaletteColors; altIndex?: number }

const COLOR_KEYS: { key: keyof Look['colors']; name: string }[] = [
  { key: 'bg', name: 'Background' }, { key: 'glow', name: 'Second colour' }, { key: 'accent', name: 'Accent' }, { key: 'text', name: 'Words' },
]

function sceneLabel(sc: KitPlan['scenes'][number]): string {
  switch (sc.type) {
    case 'title': return 'Cover'
    case 'bignumber': return formatFigure(sc.figure)
    case 'comparison': return `${sc.left.label} / ${sc.right.label}`.slice(0, 28)
    case 'cta': return 'Closing'
    case 'chart': return 'Chart'
    case 'timeline': return 'Timeline'
    case 'checklist': return 'Checklist'
    case 'quote': return 'Quote'
  }
}

function musicName(look: Look): string {
  const pick = MUSIC_PICKS.find((m) => m.id === (look.music ?? 'match'))
  if (!pick || pick.id === 'match') return `${look.feel === 'calm' ? 'Gentle piano' : look.feel === 'energetic' ? 'Upbeat' : 'Soft pulse'} · matches the feel`
  return pick.name
}
function musicSample(look: Look): string | null {
  const m = look.music ?? 'match'
  if (m === 'none') return null
  if (m === 'piano' || (m === 'match' && look.feel === 'calm')) return '/look-music/piano.mp3'
  if (m === 'bright' || (m === 'match' && look.feel === 'energetic')) return '/look-music/bright.mp3'
  return '/look-music/pulse.mp3'
}

/** Brand alternatives: the brand's other colours as the accent, and the same on a light page. */
function brandAlternatives(brand: BrandInfo | null, current: Look): PaletteColors[] {
  if (!brand) return []
  const cands = [brand.accent_color, brand.primary_color, brand.secondary_color].filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c))
  const out: PaletteColors[] = cands.filter((c) => c.toLowerCase() !== current.colors.accent.toLowerCase()).map((accent) => ({ ...current.colors, accent }))
  out.push({ bg: '#f5f2ec', glow: '#e7e0d3', accent: current.colors.accent, text: '#16181f' })
  return out
}

export default function LookWizard({ mode, videoId, brandId }: { mode: 'draft' | 'brand'; videoId?: string; brandId?: string }) {
  const router = useRouter()
  const [data, setData] = useState<LookData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [start, setStart] = useState<StartMode>('brand')
  const [styleId, setStyleId] = useState<string>(READY_STYLES[0].id)
  const [h, setH] = useState<LookHistory | null>(null)
  const [refState, setRefState] = useState<RefState>({ status: 'idle' })
  const [fallbackMsg, setFallbackMsg] = useState<string | null>(null)
  const [whyOpen, setWhyOpen] = useState(false)
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlText, setUrlText] = useState('')
  const [readFont, setReadFont] = useState<{ id: FontId; label: string } | null>(null)
  const [brandAlt, setBrandAlt] = useState(0)
  const [musicOn, setMusicOn] = useState(false)
  const preview = useRef<LookPreviewHandle>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const lastEdit = useRef<{ key: string; at: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // ── load ──
  useEffect(() => {
    let alive = true
    const q = mode === 'draft' ? `videoId=${encodeURIComponent(videoId || '')}` : `brandId=${encodeURIComponent(brandId || '')}`
    fetch(`/api/look?${q}`).then(async (r) => {
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'We couldn’t open the look screen.')
      return j as LookData
    }).then((d) => {
      if (!alive) return
      setData(d)
      const first = d.draftLook ?? d.looks.current ?? (d.brand ? lookFromBrand(d.brand) : readyStyle('animated-slides').look)
      setStart(d.brand ? 'brand' : 'style')
      setH(startHistory(first))
    }).catch((e) => { if (alive) setLoadError(e instanceof Error ? e.message : 'We couldn’t open the look screen.') })
    return () => { alive = false }
  }, [mode, videoId, brandId])

  const look = h?.present ?? null
  const set = useCallback((next: Look, key?: string) => {
    setSaved(false)
    setH((cur) => {
      if (!cur) return cur
      // Dragging a colour picker sends many small changes: they are one step for Undo.
      const now = Date.now()
      const same = key && lastEdit.current && lastEdit.current.key === key && now - lastEdit.current.at < 900
      lastEdit.current = key ? { key, at: now } : null
      return same ? { ...cur, present: next } : commit(cur, next)
    })
  }, [])

  const notes = useMemo(() => (look ? guardNotes(look) : { fixes: [] as string[] }), [look])

  // ── starts ──
  function pickStart(m: StartMode) {
    setStart(m); setFallbackMsg(null)
    if (!data) return
    if (m === 'brand') set(data.looks.current ?? (data.brand ? lookFromBrand(data.brand) : readyStyle('animated-slides').look))
    if (m === 'style') set(readyStyle(styleId).look)
    if (m === 'reference' && refState.status === 'idle') window.setTimeout(() => fileInput.current?.focus(), 30)
  }

  function brandFallback(message: string) {
    setFallbackMsg(message)
    setRefState((r) => ({ ...r, status: 'failed', message }))
    if (data) set(data.looks.current ?? (data.brand ? lookFromBrand(data.brand) : readyStyle('animated-slides').look))
  }

  async function readReference(body: FormData | { url: string }, name: string, thumb?: string) {
    setFallbackMsg(null)
    setRefState({ status: 'reading', name, thumb })
    const t0 = performance.now()
    try {
      const res = await fetch('/api/look/reference', body instanceof FormData
        ? { method: 'POST', body }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j) return brandFallback('We couldn’t read that one, so we started from your brand instead.')
      if (!j.ok) return brandFallback(j.message)
      const secs = Math.max(1, Math.round((performance.now() - t0) / 1000))
      setRefState({ status: 'done', name, thumb, seconds: secs, fontLabel: j.fontLabel, alternatives: j.palette.alternatives, base: { bg: j.palette.bg, glow: j.palette.glow, accent: j.palette.accent, text: j.palette.text }, altIndex: 0 })
      setReadFont({ id: j.look.headFont, label: j.fontLabel })
      set(j.look as Look)
    } catch {
      brandFallback('We couldn’t reach the reader, so we started from your brand instead.')
    }
  }

  function onFile(f: File | null | undefined) {
    if (!f) return
    const fd = new FormData()
    fd.append('file', f)
    const thumb = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
    void readReference(fd, f.name, thumb)
  }

  function tryOtherColours() {
    if (!look) return
    if (start === 'reference' && refState.status === 'done' && refState.base) {
      const sets = [refState.base, ...(refState.alternatives ?? [])]
      const next = ((refState.altIndex ?? 0) + 1) % sets.length
      setRefState((r) => ({ ...r, altIndex: next }))
      set(withColors(look, sets[next]))
    } else if (data?.brand) {
      const base = data.looks.current ?? lookFromBrand(data.brand)
      const sets = [base.colors, ...brandAlternatives(data.brand, base)]
      const next = (brandAlt + 1) % sets.length
      setBrandAlt(next)
      set(withColors(look, sets[next]))
    }
  }
  const canTryOther = (start === 'reference' && refState.status === 'done' && !!refState.alternatives?.length) || (start === 'brand' && !!data?.brand)

  // ── music sample (only after a click, quiet) ──
  function toggleMusic() {
    if (!look) return
    if (musicOn) { audio.current?.pause(); setMusicOn(false); return }
    const src = musicSample(look)
    if (!src) return
    if (!audio.current) audio.current = new Audio()
    const a = audio.current
    a.src = src; a.dataset.src = src; a.volume = 0.25; a.currentTime = 0
    a.onended = () => setMusicOn(false)
    a.onpause = () => setMusicOn(false)
    void a.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false))
  }
  useEffect(() => () => { audio.current?.pause() }, [])
  // A different music pick stops the old sample (the pause event turns the button back).
  const sampleNow = look ? musicSample(look) : null
  useEffect(() => { const a = audio.current; if (a && !a.paused && a.dataset.src !== sampleNow) a.pause() }, [sampleNow])

  // ── saving ──
  async function save() {
    if (!look || !data || saving) return
    setSaving(true); setError(null)
    try {
      if (mode === 'brand') {
        const r = await fetch('/api/look', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId, look }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'We couldn’t save the look.')
        setData((d) => (d ? { ...d, looks: j.looks } : d))
        setSaved(true)
      } else {
        const r = await fetch('/api/look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, look, brandId: data.brand?.id }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'We couldn’t save the look.')
        setSaved(true)
        router.push(`/create/theme?id=${encodeURIComponent(videoId || '')}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t save the look.')
    } finally {
      setSaving(false)
    }
  }

  // ── free preview (draft only): the real renderer draws one true frame ──
  const [still, setStill] = useState<{ busy: boolean; url?: string; error?: string; key?: string }>({ busy: false })
  const lookKey = look ? JSON.stringify(look) : ''
  async function freePreview() {
    if (!look || !videoId || still.busy) return
    setStill({ busy: true })
    try {
      const r1 = await fetch('/api/look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, look }) })
      if (!r1.ok) { const j = await r1.json().catch(() => ({})); throw new Error(j.error || 'We couldn’t save the look for the preview.') }
      const r = await fetch('/api/preview-first-scene', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId, output: 'video', look: 'kit:custom' }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'We couldn’t make the preview just now.')
      setStill({ busy: false, url: j.imageUrl, key: lookKey })
    } catch (e) {
      setStill({ busy: false, error: e instanceof Error ? e.message : 'We couldn’t make the preview just now.' })
    }
  }

  if (loadError) return <div className={`cf-page ${s.page}`}><h1 className="cf-h1">We couldn’t open the look screen.</h1><p className="cf-hint">{loadError}</p></div>
  if (!data || !look || !h) return <div className={`cf-page ${s.page}`}><div className={s.loading}><div className="spinner" /></div></div>

  const brandName = data.brand?.name ?? null
  const pickedTitle = start === 'brand'
    ? (data.draftLook || data.looks.current ? 'We picked your saved look' : 'We picked this from your brand')
    : start === 'reference' ? (refState.status === 'done' ? 'We picked this from your reference' : 'We’ll pick from your reference') : 'We picked this from the style'
  const hk = headlineKey(look)
  const refFontChip = readFont && !HEADLINE_CHOICES.some((c) => c.head === readFont.id) ? readFont : null
  const scenes = data.plan.scenes
  const fix = notes.fixes[0]

  const previewCol = (
    <aside className={s.pv} aria-label="Preview">
      <div className={s.pvHead}>
        <b>{data.sample ? 'A sample video, in this look' : 'Your video, in this look'}</b>
        <button type="button" className={s.play} onClick={() => (playing ? preview.current?.stop() : preview.current?.play10())} data-testid="play-10">
          {playing ? '■ Stop' : '▶ Play 10 seconds'}
        </button>
      </div>
      <div className={s.sceneTabs} role="tablist" aria-label="Scenes">
        {scenes.map((sc, i) => (
          <button key={sc.id ?? i} type="button" role="tab" aria-selected={scene === i} className={s.stab} onClick={() => { setScene(i); preview.current?.showScene(i) }}>
            {sceneLabel(sc)}
          </button>
        ))}
      </div>
      <div className={s.frame} data-testid="look-preview">
        <LookPreview ref={preview} plan={data.plan} look={look} onPlaying={setPlaying} onScene={setScene} />
      </div>
      <div className={s.music}>
        <span aria-hidden="true">♪</span>
        <span className={s.musicText}><b>{musicName(look)}</b>{look.music === 'none' ? '' : <span className={s.musicSub}> · sits under the voice</span>}</span>
        {musicSample(look) ? <button type="button" className="cf-link" onClick={toggleMusic}>{musicOn ? 'Stop' : 'Hear it'}</button> : null}
      </div>
      <p className={s.pvNote}>
        {data.sample
          ? 'This is the real video engine playing a short sample. Your videos use your own scenes.'
          : 'This is the real video engine playing your own scenes from step 2. Free. Nothing is made until you press Make it.'}
      </p>
      {still.busy || still.url || still.error ? (
        <div className={s.still}>
          {still.busy ? <p className="cf-hint" role="status"><span className="spinner" aria-hidden="true" /> Drawing one true frame — about 15 seconds.</p> : null}
          {still.error ? <Note tone="warn">{still.error}</Note> : null}
          {still.url && !still.busy ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a stored PNG */}
              <img src={still.url} alt="One frame of your video, drawn by the real renderer" />
              {still.key !== lookKey ? <p className={s.pvNote}>You changed the look — press Free preview again to see it.</p> : <p className={s.pvNote}>One frame drawn by the same renderer as your finished video.</p>}
            </>
          ) : null}
        </div>
      ) : null}
    </aside>
  )

  return (
    <div className={`cf-page ${s.page}`}>
      <div className={s.body}>
        <div className={s.main}>
          {mode === 'draft' ? <button type="button" className={`cf-link ${s.back}`} onClick={() => router.push(`/create/theme?id=${encodeURIComponent(videoId || '')}`)}>← Back to looks</button> : null}
          <h1 className={`cf-h1 ${s.h1}`}>Make it look <em>like…</em></h1>
          <p className={s.sub}>Pick one. We set everything else.</p>

          <div className={s.starts} role="radiogroup" aria-label="Start from">
            <button type="button" role="radio" aria-checked={start === 'brand'} className={s.start} onClick={() => pickStart('brand')} disabled={!data.brand} data-testid="start-brand">
              <span className={s.ic} aria-hidden="true">B</span>
              <b>My brand</b>
              <span>{brandName ? `${brandName} · ${data.brand?.hasLogo ? 'logo and colours' : 'colours'}` : 'Add a brand first'}</span>
            </button>
            <button type="button" role="radio" aria-checked={start === 'reference'} className={s.start} onClick={() => pickStart('reference')} data-testid="start-reference">
              <span className={s.ic} aria-hidden="true">↑</span>
              <b>Something I like</b>
              <span>Picture, PDF or website</span>
            </button>
            <button type="button" role="radio" aria-checked={start === 'style'} className={s.start} onClick={() => pickStart('style')} data-testid="start-style">
              <span className={s.ic} aria-hidden="true">★</span>
              <b>A ready style</b>
              <span>Calm paper, bold, classic…</span>
            </button>
          </div>

          {start === 'reference' ? (
            <div
              className={s.drop}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
              data-testid="reference-drop"
            >
              <div className={s.dropRow}>
                {refState.thumb
                  // eslint-disable-next-line @next/next/no-img-element -- the person's own picture, shown back to them
                  ? <img className={s.thumb} src={refState.thumb} alt="" />
                  : <span className={s.thumbEmpty} aria-hidden="true">↑</span>}
                <div className={s.dropText}>
                  <b>{refState.name ?? 'Drop a picture or PDF here'}</b>
                  <span>We borrow colours, fonts and feel. Never logos, words or photos.</span>
                  {refState.status === 'reading' ? <span className={s.reading} role="status">Reading…</span> : null}
                  {refState.status === 'done' ? <span className={s.reading}>Read in {refState.seconds} second{refState.seconds === 1 ? '' : 's'} ✓</span> : null}
                </div>
                <button type="button" className="cf-chip" onClick={() => fileInput.current?.click()}>Choose a file</button>
                <input ref={fileInput} type="file" accept="image/*,application/pdf,.pdf" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} data-testid="reference-file" />
              </div>
              <form className={s.urlRow} onSubmit={(e) => { e.preventDefault(); if (urlText.trim()) void readReference({ url: urlText.trim() }, urlText.trim()) }}>
                <input className="cf-input" type="text" inputMode="url" placeholder="…or paste a website address" value={urlText} onChange={(e) => setUrlText(e.target.value)} aria-label="A website you like" />
                <button type="submit" className="cf-chip" disabled={!urlText.trim() || refState.status === 'reading'}>Read it</button>
              </form>
              <span className={s.small}>A video you like? Pause it, take a screenshot, and drop the picture here.</span>
            </div>
          ) : null}

          {start === 'style' ? (
            <div className="cf-chips" role="radiogroup" aria-label="Ready styles">
              {READY_STYLES.map((st) => (
                <button key={st.id} type="button" role="radio" aria-checked={styleId === st.id} className="cf-chip" onClick={() => { setStyleId(st.id); set(st.look) }}>
                  <span className={s.mini} style={{ background: st.look.colors.bg }} aria-hidden="true"><i style={{ background: st.look.colors.accent }} /></span>
                  {st.name}
                </button>
              ))}
            </div>
          ) : null}

          {fallbackMsg ? <Note tone="warn">{fallbackMsg}</Note> : null}

          {start === 'brand' && data.looks.saved.length > 1 ? (
            <div className={s.savedRow}>
              <span className={s.k}>Saved looks</span>
              <div className="cf-chips">
                {data.looks.saved.map((sl) => (
                  <button key={sl.name + sl.savedAt} type="button" className="cf-chip" onClick={() => set(sl)}>{sl.name}</button>
                ))}
              </div>
            </div>
          ) : null}

          <section className={s.picked} aria-labelledby="picked-title">
            <h3 id="picked-title">{pickedTitle}</h3>
            <div className={s.prow}>
              <span className={s.k}>Colours</span>
              <div className={s.val}>
                {COLOR_KEYS.map((c) => (
                  <label key={c.key} className={s.dot} style={{ background: look.colors[c.key] }} title={c.name}>
                    <span className={s.srOnly}>{c.name}</span>
                    <input type="color" value={look.colors[c.key]} onChange={(e) => set({ ...look, id: 'custom', colors: { ...look.colors, [c.key]: e.target.value } }, `color-${c.key}`)} aria-label={`${c.name} colour`} />
                  </label>
                ))}
                {canTryOther ? <button type="button" className={s.alt} onClick={tryOtherColours}>Try other colours from it</button> : null}
              </div>
            </div>
            <div className={s.prow}>
              <span className={s.k}>Headline</span>
              <div className={s.val} role="radiogroup" aria-label="Headline font">
                {HEADLINE_CHOICES.map((c) => (
                  <button key={c.key} type="button" role="radio" aria-checked={hk === c.key} className={s.chip} onClick={() => set(withHeadline(look, c.head, c.body))} title={KIT_FONTS[c.head].family}>{c.name}</button>
                ))}
                {refFontChip ? (
                  <button type="button" role="radio" aria-checked={look.headFont === refFontChip.id} className={s.chip} onClick={() => set(withHeadline(look, refFontChip.id))}>{refFontChip.label}</button>
                ) : null}
                {!hk && !refFontChip ? <span className={s.small}>{fontLabel(look.headFont, true)}</span> : null}
                {readFont && !refFontChip && look.headFont === readFont.id ? <span className={s.small} data-testid="closest-font">{readFont.label}</span> : null}
              </div>
            </div>
            <div className={s.prow}>
              <span className={s.k}>Feel</span>
              <div className={s.val} role="radiogroup" aria-label="Feel">
                {FEEL_CHOICES.map((f) => (
                  <button key={f.id} type="button" role="radio" aria-checked={look.feel === f.id} className={s.chip} onClick={() => set({ ...look, feel: f.id })}>{f.name}</button>
                ))}
              </div>
            </div>
            <div className={s.prow}>
              <span className={s.k}>Logo</span>
              <div className={s.val} role="radiogroup" aria-label="Logo">
                {LOGO_CHOICES.map((l) => (
                  <button key={l.id} type="button" role="radio" aria-checked={look.logoMode === l.id} className={s.chip} onClick={() => set({ ...look, logoMode: l.id })}>{l.name}</button>
                ))}
              </div>
            </div>
            {data.brand && !data.brand.hasLogo ? <p className={s.small}>No logo uploaded — your name shows as words. We never draw a logo.</p> : null}
          </section>

          <div className={s.nudges}>
            {NUDGES.map((n) => (
              <button key={n.id} type="button" className={s.nudge} onClick={() => set(nudge(look, n.id))}>{n.name}</button>
            ))}
            <button type="button" className={s.undo} onClick={() => setH((cur) => (cur ? undo(cur) : cur))} disabled={!canUndo(h)}>Undo</button>
          </div>

          {fix ? (
            <div className={s.fix} role="status" data-testid="contrast-note">
              {fix}{' '}
              <button type="button" className={s.why} onClick={() => setWhyOpen((o) => !o)} aria-expanded={whyOpen}>Why?</button>
              {whyOpen ? <span className={s.whyText}>{GUARD_WHY}</span> : null}
            </div>
          ) : null}

          <details className={s.fine} data-testid="fine-tune">
            <summary>Fine-tune (optional)</summary>
            <div className={s.fineIn}>
              <div className={s.prow}>
                <span className={s.k}>Background</span>
                <div className={s.val} role="radiogroup" aria-label="Background">
                  {BACKGROUND_CHOICES.map((b) => (
                    <button key={b.id} type="button" role="radio" aria-checked={look.background === b.id} className={s.chip} onClick={() => set({ ...look, background: b.id })}>{b.name}</button>
                  ))}
                </div>
              </div>
              <div className={s.prow}>
                <span className={s.k}>Corners</span>
                <div className={s.val} role="radiogroup" aria-label="Corners">
                  {CORNER_CHOICES.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={look.corners === c.id} className={s.chip} onClick={() => set({ ...look, corners: c.id })}>{c.name}</button>
                  ))}
                </div>
              </div>
              <div className={s.prow}>
                <span className={s.k}>Music</span>
                <div className={s.val} role="radiogroup" aria-label="Music">
                  {MUSIC_PICKS.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={(look.music ?? 'match') === m.id} className={s.chip} onClick={() => set({ ...look, music: m.id })}>{m.name}</button>
                  ))}
                </div>
              </div>
              <p className={s.small}>Music follows the feel unless you pick one. It always sits quietly under the voice.</p>
              <label className={s.prow}>
                <span className={s.k}>Look name</span>
                <input className={`cf-input ${s.name}`} value={look.name} maxLength={60} onChange={(e) => set({ ...look, name: e.target.value }, 'name')} />
              </label>
            </div>
          </details>
        </div>

        {previewCol}
      </div>

      <BottomBar
        label="Your look"
        info="Look ready"
        sub={saved
          ? (brandName ? `Saved to ${brandName} · your next videos start here` : 'Saved')
          : (brandName ? `Saves to ${brandName} · your next videos start here` : mode === 'draft' ? 'Used for this video' : null)}
        notice={error ? <Note tone="stop">{error}</Note> : (mode === 'draft' && !data.editable ? <Note tone="info">This video has already been made — its look can’t change.</Note> : null)}
        helper={mode === 'draft' ? (
          <button type="button" className="kit-btn kit-btn--secondary cf-helper-btn" onClick={() => void freePreview()} disabled={still.busy || !data.editable || data.sample} data-testid="look-free-preview">
            {still.busy ? 'Making your preview…' : still.url && still.key !== lookKey ? 'Preview again' : 'Free preview'}
          </button>
        ) : null}
        onMain={() => void save()}
        mainLabel={saving ? 'Saving…' : mode === 'draft' ? 'Use this look' : saved ? 'Saved ✓' : 'Save look'}
        disabled={saving || (mode === 'draft' && !data.editable)}
        busy={saving}
      />
    </div>
  )
}
