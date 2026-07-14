'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Dedicated CUSTOMER flow for the AI Commercial pipeline (separate from the
 * Video/Slides create wizard). One page: URL + optional goal/brand/logo/music +
 * auto-pick style (with an Advanced style override). Posts to
 * /api/generate-commercial (auth + 600-credit gate + fires the VPS director),
 * then hands off to the shared /create/generating progress page which polls the
 * same videos row the director writes progress to.
 */

const COMMERCIAL_COST = 600

// The 22 director styles (source of truth: app/api/v1/commercials STYLE_IDS).
// Friendly labels for the Advanced picker; 'auto' lets the director choose.
const STYLES: { id: string; label: string }[] = [
  { id: 'fintech', label: 'Fintech' }, { id: 'luxury', label: 'Luxury' },
  { id: 'tech', label: 'Tech' }, { id: 'upbeat', label: 'Upbeat' },
  { id: 'emerald', label: 'Emerald' }, { id: 'redblueprint', label: 'Blueprint' },
  { id: 'data', label: 'Data' }, { id: 'playful', label: 'Playful' },
  { id: 'casino', label: 'Bold / Casino' }, { id: 'clean', label: 'Clean' },
  { id: 'glitchcore', label: 'Glitchcore' }, { id: 'cinematic', label: 'Cinematic' },
  { id: 'noir', label: 'Noir' }, { id: 'retro', label: 'Retro' },
  { id: 'vibrant', label: 'Vibrant' }, { id: 'editorial', label: 'Editorial' },
  { id: 'brutalist', label: 'Brutalist' }, { id: 'aurora', label: 'Aurora' },
  { id: 'sport', label: 'Sport' }, { id: 'corporate', label: 'Corporate' },
  { id: 'neon', label: 'Neon' }, { id: 'organic', label: 'Organic' },
]

type SourceMode = 'url' | 'text' | 'pdf' | 'ai'
const SOURCE_TABS: { id: SourceMode; label: string; icon: string }[] = [
  { id: 'url', label: 'Website', icon: '🔗' },
  { id: 'text', label: 'Paste text', icon: '📝' },
  { id: 'pdf', label: 'PDF', icon: '📄' },
  { id: 'ai', label: 'AI writes it', icon: '✨' },
]

export default function CreateCommercialPage() {
  const router = useRouter()
  const [source, setSource] = useState<SourceMode>('url')
  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [goal, setGoal] = useState('')
  const [brandName, setBrandName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [music, setMusic] = useState(true)
  const [style, setStyle] = useState('auto')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/credits/balance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setBalance(d.balance ?? 0); if (d.isAdmin) setIsAdminUser(true) } })
      .catch(() => {})
  }, [])

  const validUrl = /^https?:\/\/.+\..+/i.test(url.trim())
  const sourceReady =
    source === 'url' ? validUrl :
    source === 'text' ? pasted.trim().length >= 40 :
    source === 'pdf' ? !!pdfFile :
    aiTopic.trim().length >= 8
  const sufficient = isAdminUser || (balance !== null && balance >= COMMERCIAL_COST)
  const canSubmit = sourceReady && sufficient && !submitting

  // Resolve the chosen source mode into the API's { url } or { text } payload.
  // The VPS director accepts EITHER a url (it scrapes) or text (it uses directly).
  // pdf → extract to text; ai → a short brief the director expands from.
  async function resolveSource(): Promise<{ url?: string; text?: string } | null> {
    if (source === 'url') return { url: url.trim() }
    if (source === 'text') return { text: pasted.trim() }
    if (source === 'ai') {
      // "AI writes it": the user gives a topic/brief; the director's comprehend+
      // direct expand it. Framed as a brief so it doesn't read as source facts.
      return { text: `Create a commercial about: ${aiTopic.trim()}` }
    }
    // pdf → extract text via the existing document extractor (legacy multipart path)
    if (!pdfFile) return null
    const fd = new FormData()
    fd.append('file', pdfFile)
    fd.append('purpose', 'commercial')
    const ex = await fetch('/api/extract-doc', { method: 'POST', body: fd })
    if (!ex.ok) {
      const j = await ex.json().catch(() => ({}))
      throw new Error(j?.error || 'Could not read that PDF. Try pasting the text instead.')
    }
    const j = await ex.json()
    // Flatten whatever text-bearing fields came back into one blob.
    const parts: string[] = []
    if (j.title) parts.push(String(j.title))
    if (Array.isArray(j.sections)) {
      for (const s of j.sections) {
        if (typeof s === 'string') parts.push(s)
        else if (s && typeof s === 'object') parts.push([s.heading, s.title, s.text, s.content, s.body].filter(Boolean).join('\n'))
      }
    }
    if (typeof j.text === 'string') parts.push(j.text)
    const text = parts.filter(Boolean).join('\n\n').trim().slice(0, 60000)
    if (text.length < 40) throw new Error('That PDF had too little readable text. Try pasting the text instead.')
    return { text }
  }

  async function handleGenerate() {
    setError(null)
    if (!sourceReady) { setError('Add a source first.'); return }
    setSubmitting(true)
    try {
      const src = await resolveSource()
      if (!src) { setError('Add a source first.'); setSubmitting(false); return }

      // Optional logo upload — the director falls back to a scraped logo / wordmark.
      let logoUrl: string | undefined
      if (logoFile) {
        try {
          const fd = new FormData()
          fd.append('file', logoFile)
          const up = await fetch('/api/upload-logo', { method: 'POST', body: fd })
          if (up.ok) { const j = await up.json(); logoUrl = j.url || j.logoUrl }
        } catch { /* non-fatal — proceed without an uploaded logo */ }
      }

      const res = await fetch('/api/generate-commercial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...src,
          goal: goal.trim() || undefined,
          brandName: brandName.trim() || undefined,
          music,
          style: style === 'auto' ? undefined : style,
          logoUrl,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not start the commercial. Please try again.')
        setSubmitting(false)
        return
      }
      router.push(`/create/generating?id=${data.videoId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <Link href="/create/start" style={styles.back}>← Back</Link>
      <div style={styles.header}>
        <span style={styles.icon}>🎥</span>
        <h1 style={styles.h1}>Create a Commercial</h1>
        <p style={styles.sub}>From a website, a document, your own text, or just an idea — we produce a fully-directed, brand-matched commercial with script, voiceover, visuals, and music.</p>
      </div>

      {/* Source mode — four ways to provide what the commercial is about */}
      <div style={styles.sourceTabs}>
        {SOURCE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            style={{ ...styles.sourceTab, ...(source === t.id ? styles.sourceTabActive : {}) }}
            onClick={() => { setSource(t.id); setError(null) }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {source === 'url' && (
        <label style={styles.label}>
          Website URL <span style={styles.req}>*</span>
          <input style={styles.input} type="url" placeholder="https://yourcompany.com" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
          <span style={styles.hint}>We read your site and build the commercial from it.</span>
        </label>
      )}

      {source === 'text' && (
        <label style={styles.label}>
          Paste your content <span style={styles.req}>*</span>
          <textarea style={{ ...styles.input, minHeight: 140, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Paste the copy, product description, or brief you want the commercial built from…" value={pasted} onChange={(e) => setPasted(e.target.value)} autoFocus />
          <span style={styles.hint}>{pasted.trim().length < 40 ? 'Add at least a short paragraph.' : `${pasted.trim().length.toLocaleString()} characters`}</span>
        </label>
      )}

      {source === 'pdf' && (
        <label style={styles.label}>
          Upload a PDF <span style={styles.req}>*</span>
          <input style={styles.file} type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
          <span style={styles.hint}>{pdfFile ? pdfFile.name : 'We extract the text and build the commercial from it.'}</span>
        </label>
      )}

      {source === 'ai' && (
        <label style={styles.label}>
          What&rsquo;s the commercial about? <span style={styles.req}>*</span>
          <textarea style={{ ...styles.input, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} placeholder="e.g. A 30-second spot for a local HVAC company that does 24/7 emergency repair and same-day install." value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} autoFocus />
          <span style={styles.hint}>Describe it in a sentence or two — the AI writes the whole script from your idea.</span>
        </label>
      )}

      {/* Goal — the plain-English brief */}
      <label style={styles.label}>
        What should this video accomplish? <span style={styles.opt}>(optional)</span>
        <textarea
          style={{ ...styles.input, minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="e.g. Get insurance agents to sign up and understand how they earn — not just sell the product."
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <span style={styles.hint}>The director follows this brief. Leave blank to let the AI decide.</span>
      </label>

      {/* Brand + logo row */}
      <div style={styles.row}>
        <label style={{ ...styles.label, flex: 1 }}>
          Brand name <span style={styles.opt}>(optional)</span>
          <input
            style={styles.input}
            type="text"
            placeholder="Auto-detected from your site"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </label>
        <label style={{ ...styles.label, flex: 1 }}>
          Logo <span style={styles.opt}>(optional)</span>
          <input
            style={styles.file}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
          />
          <span style={styles.hint}>{logoFile ? logoFile.name : 'We use your real logo if you upload one.'}</span>
        </label>
      </div>

      {/* Music toggle */}
      <button type="button" style={styles.toggleRow} onClick={() => setMusic((m) => !m)}>
        <span style={{ ...styles.toggle, background: music ? 'var(--mint, #C7E8A8)' : 'var(--border, #ddd)' }}>
          <span style={{ ...styles.knob, transform: music ? 'translateX(20px)' : 'translateX(0)' }} />
        </span>
        <span style={styles.toggleLabel}>Add a custom music track {music ? '(on)' : '(off)'}</span>
      </button>

      {/* Advanced: style override */}
      <button type="button" style={styles.advToggle} onClick={() => setShowAdvanced((s) => !s)}>
        {showAdvanced ? '▾' : '▸'} Advanced — choose a style {style !== 'auto' ? `(${STYLES.find((s) => s.id === style)?.label})` : '(auto)'}
      </button>
      {showAdvanced && (
        <div style={styles.styleGrid}>
          <button
            type="button"
            style={{ ...styles.styleChip, ...(style === 'auto' ? styles.styleChipActive : {}) }}
            onClick={() => setStyle('auto')}
          >Auto-pick ✨</button>
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              style={{ ...styles.styleChip, ...(style === s.id ? styles.styleChipActive : {}) }}
              onClick={() => setStyle(s.id)}
            >{s.label}</button>
          ))}
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {/* Cost + time + CTA */}
      <div style={styles.costBox}>
        {sufficient ? (
          <span style={styles.costOk}>
            <strong>{COMMERCIAL_COST}</strong> credits · takes about 2–3 minutes
            {balance !== null && !isAdminUser && <span style={styles.bal}> · {balance.toLocaleString()} remaining</span>}
          </span>
        ) : (
          <span style={styles.costWarn}>
            You need <strong>{COMMERCIAL_COST}</strong> credits but have <strong>{balance?.toLocaleString() ?? 0}</strong>.{' '}
            <Link href="/billing" style={styles.buyLink}>Buy more</Link>
          </span>
        )}
      </div>

      <button
        style={{ ...styles.cta, ...(canSubmit ? {} : styles.ctaDisabled) }}
        onClick={handleGenerate}
        disabled={!canSubmit}
      >
        {submitting ? 'Starting…' : 'Generate Commercial'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 640, margin: '0 auto', padding: '24px 32px' },
  back: { fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none', display: 'inline-block', marginBottom: 20 },
  header: { marginBottom: 28 },
  icon: { fontSize: 32, display: 'block', marginBottom: 8 },
  h1: { fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.02em' },
  sub: { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.5 },
  sourceTabs: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  sourceTab: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13, fontWeight: 700, borderRadius: 10, border: '1.5px solid var(--border-light, #e0e0e0)', background: 'white', color: 'var(--ink-soft)', cursor: 'pointer' },
  sourceTabActive: { border: '1.5px solid var(--ink)', background: 'var(--ink)', color: 'white' },
  label: { display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 18 },
  req: { color: '#D97706', fontWeight: 700 },
  opt: { color: 'var(--ink-light)', fontWeight: 500 },
  input: { display: 'block', width: '100%', marginTop: 6, padding: '12px 14px', fontSize: 15, borderRadius: 10, border: '1.5px solid var(--border-light, #e0e0e0)', background: 'white', color: 'var(--ink)', boxSizing: 'border-box' },
  file: { display: 'block', width: '100%', marginTop: 6, fontSize: 13, color: 'var(--ink-soft)' },
  hint: { display: 'block', marginTop: 6, fontSize: 12, color: 'var(--ink-light)', fontWeight: 500 },
  row: { display: 'flex', gap: 16 },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 20 },
  toggle: { width: 44, height: 24, borderRadius: 10, position: 'relative', transition: 'background 0.2s', flexShrink: 0 },
  knob: { position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: 10, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s' },
  toggleLabel: { fontSize: 14, fontWeight: 600, color: 'var(--ink)' },
  advToggle: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)', padding: 0, marginBottom: 14, textAlign: 'left' },
  styleGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  styleChip: { padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1.5px solid var(--border-light, #e0e0e0)', background: 'white', color: 'var(--ink-soft)', cursor: 'pointer' },
  styleChipActive: { border: '1.5px solid var(--mint, #C7E8A8)', background: 'rgba(199,232,168,0.18)', color: 'var(--ink)' },
  error: { fontSize: 14, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16 },
  costBox: { marginBottom: 16, fontSize: 14 },
  costOk: { color: 'var(--ink-soft)' },
  bal: { color: 'var(--ink-light)' },
  costWarn: { color: '#92400E' },
  buyLink: { color: 'var(--ink)', fontWeight: 700 },
  cta: { width: '100%', padding: '15px 24px', fontSize: 16, fontWeight: 800, borderRadius: 10, border: 'none', background: 'var(--ink)', color: 'white', cursor: 'pointer', letterSpacing: '-0.01em' },
  ctaDisabled: { opacity: 0.45, cursor: 'not-allowed' },
}
