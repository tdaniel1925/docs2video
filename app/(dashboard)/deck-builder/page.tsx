'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import BrandStylePicker from '../../_components/BrandStylePicker'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Step = 'source' | 'template' | 'plan' | 'generating' | 'done'
type InputTab = 'upload' | 'text' | 'url' | 'research'

interface ExtractedSource {
  title: string
  subtitle?: string | null
  keyMetrics?: { label: string; value: string; highlight?: boolean }[]
  sections?: { title: string; content: string }[]
  bulletPoints?: string[]
  additionalNotes?: string[]
}

interface SlidePlan {
  slideNumber: number
  layout: string
  headline: string
  body: string
  imagePrompt?: string
  rationale?: string
  // API may return nested content structure
  content?: {
    headline: string
    subheadline?: string
    bodyBlocks: string[]
    stats?: { value: string; label: string }[]
    imagePrompt?: string
  }
  templateLayoutIndex?: number
  layoutType?: string
}

interface TemplateLayout {
  name: string
  description?: string
  index?: number
}

const STEP_KEYS: Step[] = ['source', 'template', 'plan', 'generating']
const STEP_LABELS = ['1. Source', '2. Template', '3. Review Plan', '4. Generate']

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DeckBuilderPage() {
  /* ---- Step ---- */
  const [step, setStep] = useState<Step>('source')

  /* ---- Source state ---- */
  const [inputTab, setInputTab] = useState<InputTab>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rawText, setRawText] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [researchTopic, setResearchTopic] = useState('')
  const [researchDepth, setResearchDepth] = useState<'quick' | 'detailed'>('quick')
  const [extractedData, setExtractedData] = useState<ExtractedSource | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ---- Template state ---- */
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [templateLayouts, setTemplateLayouts] = useState<TemplateLayout[]>([])
  const [useBuiltinStyle, setUseBuiltinStyle] = useState(true)
  const [analyzingTemplate, setAnalyzingTemplate] = useState(false)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [styleId, setStyleId] = useState('executive')

  /* ---- Plan state ---- */
  const [plan, setPlan] = useState<SlidePlan[]>([])
  const [planning, setPlanning] = useState(false)

  /* ---- Generate state ---- */
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /* ---- Elapsed timer ---- */
  const [extractingElapsed, setExtractingElapsed] = useState(0)
  const extractingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startExtractingTimer() {
    setExtractingElapsed(0)
    if (extractingTimerRef.current) clearInterval(extractingTimerRef.current)
    extractingTimerRef.current = setInterval(() => setExtractingElapsed(p => p + 1), 1000)
  }
  function stopExtractingTimer() {
    if (extractingTimerRef.current) { clearInterval(extractingTimerRef.current); extractingTimerRef.current = null }
  }

  /* ================================================================ */
  /*  Source extraction handlers                                       */
  /* ================================================================ */

  async function handleExtractPDF() {
    if (!file) return
    setExtracting(true); setError(null); startExtractingTimer()
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setExtractedData(data.general || data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF extraction failed')
    } finally {
      setExtracting(false); stopExtractingTimer()
    }
  }

  async function handleExtractText() {
    if (!rawText.trim()) return
    setExtracting(true); setError(null); startExtractingTimer()
    try {
      const res = await fetch('/api/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setExtractedData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Text extraction failed')
    } finally {
      setExtracting(false); stopExtractingTimer()
    }
  }

  async function handleExtractURL() {
    if (!urlInput.trim()) return
    setExtracting(true); setError(null); startExtractingTimer()
    try {
      const res = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'URL extraction failed')
      setExtractedData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'URL extraction failed')
    } finally {
      setExtracting(false); stopExtractingTimer()
    }
  }

  async function handleResearch() {
    if (!researchTopic.trim()) return
    setExtracting(true); setError(null); startExtractingTimer()
    try {
      const res = await fetch('/api/ai-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: researchTopic, depth: researchDepth }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Research failed')
      setExtractedData(data.research || data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
    } finally {
      setExtracting(false); stopExtractingTimer()
    }
  }

  function handleFileSelect(selectedFile: File) {
    if (selectedFile.type !== 'application/pdf') { setError('Please upload a PDF file'); return }
    if (selectedFile.size > 20 * 1024 * 1024) { setError('File must be under 20MB'); return }
    setFile(selectedFile)
    setError(null)
  }

  /* ================================================================ */
  /*  Template analysis                                                */
  /* ================================================================ */

  async function handleAnalyzeTemplate() {
    if (!templateFile) return
    setAnalyzingTemplate(true); setError(null)
    try {
      const reader = new FileReader()
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] || result)
        }
        reader.onerror = reject
        reader.readAsDataURL(templateFile)
      })
      const res = await fetch('/api/deck-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze-template', templateFile: base64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Template analysis failed')
      setTemplateLayouts(data.layouts || [])
      setUseBuiltinStyle(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template analysis failed')
    } finally {
      setAnalyzingTemplate(false)
    }
  }

  /* ================================================================ */
  /*  Plan generation                                                  */
  /* ================================================================ */

  async function handlePlanDeck() {
    setPlanning(true); setError(null)
    try {
      const res = await fetch('/api/deck-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan-deck',
          sourceData: extractedData,
          layouts: useBuiltinStyle ? undefined : templateLayouts,
          brandName: brandId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Planning failed')
      // Normalize: API may return nested content structure or flat structure
      const rawSlides = data.slides ?? data.plan ?? []
      const normalized = rawSlides.map((s: any, i: number) => ({
        slideNumber: s.slideNumber ?? i + 1,
        layout: s.layoutType ?? s.layout ?? 'content',
        headline: s.content?.headline ?? s.headline ?? '',
        body: Array.isArray(s.content?.bodyBlocks) ? s.content.bodyBlocks.join('\n') : (s.body ?? ''),
        imagePrompt: s.content?.imagePrompt ?? s.imagePrompt,
        rationale: s.rationale ?? '',
        content: s.content,
        templateLayoutIndex: s.templateLayoutIndex,
      }))
      setPlan(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan generation failed')
    } finally {
      setPlanning(false)
    }
  }

  /* ================================================================ */
  /*  Deck generation                                                  */
  /* ================================================================ */

  async function handleGenerateDeck() {
    setStep('generating'); setGenerating(true); setProgress(0); setError(null)

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { clearInterval(interval); return 90 }
        return prev + Math.random() * 12
      })
    }, 900)

    try {
      const res = await fetch('/api/deck-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-deck',
          plan,
          brandId: brandId || undefined,
          styleId: styleId || undefined,
          templateImages: useBuiltinStyle ? undefined : templateLayouts,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      clearInterval(interval)
      setProgress(100)
      setDownloadUrl(data.downloadUrl || data.url || null)
      setTimeout(() => { setStep('done'); setGenerating(false) }, 400)
    } catch (err) {
      clearInterval(interval)
      setError(err instanceof Error ? err.message : 'Deck generation failed')
      setStep('plan'); setGenerating(false)
    }
  }

  /* ================================================================ */
  /*  Plan editing helpers                                             */
  /* ================================================================ */

  function updatePlanSlide(idx: number, patch: Partial<SlidePlan>) {
    setPlan(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function removePlanSlide(idx: number) {
    if (plan.length <= 1) return
    setPlan(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, slideNumber: i + 1 })))
  }

  function movePlanSlide(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= plan.length) return
    const next = [...plan]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setPlan(next.map((s, i) => ({ ...s, slideNumber: i + 1 })))
  }

  function handleReset() {
    setStep('source')
    setFile(null); setRawText(''); setUrlInput(''); setResearchTopic('')
    setExtractedData(null); setExtracting(false)
    setTemplateFile(null); setTemplateLayouts([]); setUseBuiltinStyle(true)
    setPlan([]); setPlanning(false)
    setGenerating(false); setProgress(0); setDownloadUrl(null); setError(null)
  }

  /* ================================================================ */
  /*  Step progress index                                              */
  /* ================================================================ */

  const currentStepIdx = step === 'done' ? STEP_KEYS.length : STEP_KEYS.indexOf(step)

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div>
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1>Deck Builder</h1>
          <p>Create polished PowerPoint decks from any source. Upload a document, paste text, or let AI research your topic.</p>
        </div>
        <div style={{
          background: 'rgba(168,240,212,0.15)', border: '1px solid var(--mint)',
          borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          $19 per deck
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(255,199,194,0.15)', border: '1px solid var(--rose)',
          borderRadius: 10, padding: '14px 20px', fontSize: 14, color: '#C03A1F', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="btn btn-soft btn-sm">Dismiss</button>
        </div>
      )}

      {/* Step progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: '100%', height: 4, borderRadius: 2,
              background: i <= currentStepIdx ? 'var(--mint)' : 'var(--border-light)',
              transition: 'background 0.3s',
            }} />
            <span style={{ fontSize: 11, fontWeight: i === currentStepIdx ? 700 : 500, color: i <= currentStepIdx ? 'var(--ink)' : 'var(--ink-light)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ================================================================ */}
      {/*  STEP 1: SOURCE INPUT                                            */}
      {/* ================================================================ */}
      {step === 'source' && !extracting && !extractedData && (
        <div className="wizard-card">
          <h2>What content should your deck cover?</h2>
          <p className="wizard-sub">Upload a document, paste text, provide a URL, or let AI research a topic for you.</p>

          {/* Tab pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'var(--surface-raised, #f1f5f9)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {([
              { key: 'upload' as InputTab, label: 'Upload PDF', accent: false },
              { key: 'text' as InputTab, label: 'Type or Paste', accent: false },
              { key: 'url' as InputTab, label: 'From URL', accent: false },
              { key: 'research' as InputTab, label: 'AI Research', accent: true },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setInputTab(tab.key)}
                className="btn btn-sm"
                style={{
                  borderRadius: 10,
                  background: inputTab === tab.key
                    ? (tab.accent ? 'var(--lilac, #C4B5FD)' : 'var(--mint, #A8F0D4)')
                    : 'transparent',
                  color: inputTab === tab.key ? 'var(--ink, #1a1a2e)' : 'var(--ink-soft, #64748b)',
                  fontWeight: inputTab === tab.key ? 700 : 500,
                  border: 'none',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  fontSize: 14,
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Upload PDF */}
          {inputTab === 'upload' && (
            <div
              className={`upload-zone${dragOver ? ' dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }}
            >
              {file ? (
                <>
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{file.name}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 18 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button onClick={() => { setFile(null); setError(null) }} className="btn btn-soft btn-sm">Change</button>
                    <button onClick={handleExtractPDF} className="btn btn-primary btn-sm">Extract Data</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Drop your document here</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-light)', marginBottom: 18 }}>PDF up to 20 MB</div>
                  <label className="btn btn-mint btn-sm" style={{ cursor: 'pointer' }}>
                    Choose File
                    <input
                      ref={fileInputRef}
                      type="file" accept=".pdf" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {/* Tab: Type or Paste */}
          {inputTab === 'text' && (
            <div>
              <div className="form-group">
                <textarea
                  className="input"
                  style={{ minHeight: 220, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                  placeholder="Paste meeting notes, report content, bullet points, or any text you want turned into a deck..."
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                  {rawText.length.toLocaleString()} / 50,000 characters
                </div>
              </div>
              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={handleExtractText}
                  disabled={!rawText.trim()}
                  className="btn btn-primary"
                >
                  Extract &amp; Continue &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Tab: From URL */}
          {inputTab === 'url' && (
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Page URL</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleExtractURL() }}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                  We&apos;ll extract the page content and structure it for your deck.
                </div>
              </div>
              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={handleExtractURL}
                  disabled={!urlInput.trim()}
                  className="btn btn-primary"
                >
                  Extract &amp; Continue &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Tab: AI Research */}
          {inputTab === 'research' && (
            <div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">What should we research?</label>
                <textarea
                  className="input"
                  style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6 }}
                  placeholder={"e.g., Benefits of whole life insurance vs term life\nor: Solar energy market trends 2025\nor: How AI is transforming healthcare"}
                  value={researchTopic}
                  onChange={e => setResearchTopic(e.target.value)}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                  AI will research this topic, find real data and statistics, and structure it for your deck.
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Research Depth</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setResearchDepth('quick')}
                    className={`btn ${researchDepth === 'quick' ? 'btn-primary' : 'btn-soft'}`}
                    type="button"
                    style={{ flex: 1 }}
                  >
                    Quick (4-6 data points)
                  </button>
                  <button
                    onClick={() => setResearchDepth('detailed')}
                    className={`btn ${researchDepth === 'detailed' ? 'btn-primary' : 'btn-soft'}`}
                    type="button"
                    style={{ flex: 1 }}
                  >
                    Detailed (8-12 data points)
                  </button>
                </div>
              </div>
              <div className="wizard-actions" style={{ marginTop: 16 }}>
                <button
                  onClick={handleResearch}
                  disabled={!researchTopic.trim()}
                  className="btn btn-primary"
                >
                  Research &amp; Continue &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extracting progress */}
      {step === 'source' && extracting && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ maxWidth: 400, margin: '0 auto 28px', height: 6, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 10, background: 'var(--mint)',
              transition: 'width 1s ease',
              width: extractingElapsed < 3 ? '10%'
                : extractingElapsed < 8 ? '30%'
                : extractingElapsed < 15 ? '55%'
                : extractingElapsed < 25 ? '75%'
                : extractingElapsed < 40 ? '88%'
                : '95%',
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 28 }}>
            {[
              { label: inputTab === 'upload' ? 'Uploading' : inputTab === 'research' ? 'Researching' : 'Reading', threshold: 0 },
              { label: 'Analyzing', threshold: 5 },
              { label: 'Structuring', threshold: 12 },
            ].map((stage, i) => {
              const isActive = extractingElapsed >= stage.threshold
              const isDone = i < 2 && extractingElapsed >= [5, 12, 999][i]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: isDone ? 'var(--mint)' : isActive ? 'var(--ink)' : 'var(--border)',
                    color: isDone ? 'var(--ink)' : isActive ? 'white' : 'var(--ink-light)',
                    transition: 'all 0.3s ease',
                  }}>
                    {isDone ? '\u2713' : i + 1}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--ink)' : 'var(--ink-light)',
                    transition: 'all 0.3s ease',
                  }}>
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>

          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            {extractingElapsed < 3
              ? (inputTab === 'upload' ? 'Uploading your document...' : inputTab === 'research' ? 'AI is researching your topic...' : 'Reading your content...')
              : extractingElapsed < 8 ? 'AI is analyzing the content...'
              : extractingElapsed < 15 ? 'Extracting key data points and metrics...'
              : extractingElapsed < 25 ? 'Almost there — organizing your data...'
              : 'Still working — complex content takes a little longer...'}
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-light)' }}>
            {extractingElapsed}s elapsed
          </p>
        </div>
      )}

      {/* Source review */}
      {step === 'source' && !extracting && extractedData && (
        <div className="wizard-card">
          <h2>Does this look right?</h2>
          <p className="wizard-sub">Here&apos;s what we extracted. Review it, then continue to choose your template.</p>

          {/* Title */}
          {extractedData.title && (
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Title</label>
              <div style={{
                padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-light)',
                background: 'var(--bg-soft)', fontSize: 16, fontWeight: 700,
              }}>
                {extractedData.title}
              </div>
            </div>
          )}

          {/* Key metrics */}
          {extractedData.keyMetrics && extractedData.keyMetrics.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Key Metrics</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {extractedData.keyMetrics.map((m, i) => (
                  <div key={i} style={{
                    padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-light)',
                    background: m.highlight ? 'rgba(168,240,212,0.15)' : 'white',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {extractedData.sections && extractedData.sections.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Sections ({extractedData.sections.length})</label>
              {extractedData.sections.map((sec, i) => (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-light)',
                  background: 'white', marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{sec.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {sec.content.length > 200 ? sec.content.slice(0, 200) + '...' : sec.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bullet points */}
          {extractedData.bulletPoints && extractedData.bulletPoints.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Key Points ({extractedData.bulletPoints.length})</label>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
                {extractedData.bulletPoints.map((bp, i) => <li key={i}>{bp}</li>)}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              onClick={() => { setExtractedData(null); setFile(null); setError(null) }}
              className="btn btn-soft"
              style={{ flex: 1 }}
            >
              &larr; Start Over
            </button>
            <button
              onClick={() => setStep('template')}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              Looks good, next &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  STEP 2: TEMPLATE                                                */}
      {/* ================================================================ */}
      {step === 'template' && (
        <div>
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <h2>Choose a Template Approach</h2>
            <p className="wizard-sub">Upload your own PowerPoint template or let AI design the slides for you.</p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {/* Option 1: Upload template */}
              <div
                onClick={() => setUseBuiltinStyle(false)}
                style={{
                  flex: 1, padding: '20px 16px', borderRadius: 10, cursor: 'pointer',
                  border: !useBuiltinStyle ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                  background: !useBuiltinStyle ? 'rgba(168,240,212,0.08)' : 'white',
                  textAlign: 'center', transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>&#128196;</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Upload a PowerPoint Template</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Use your own .pptx as the base</div>
              </div>

              {/* Option 2: AI style */}
              <div
                onClick={() => { setUseBuiltinStyle(true); setTemplateFile(null); setTemplateLayouts([]) }}
                style={{
                  flex: 1, padding: '20px 16px', borderRadius: 10, cursor: 'pointer',
                  border: useBuiltinStyle ? '2px solid var(--mint)' : '2px solid var(--border-light)',
                  background: useBuiltinStyle ? 'rgba(168,240,212,0.08)' : 'white',
                  textAlign: 'center', transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>&#10024;</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Use Docs2Video Styles</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>AI will design the slides for you</div>
              </div>
            </div>

            {/* Template upload area */}
            {!useBuiltinStyle && (
              <div style={{ marginBottom: 20 }}>
                {!templateFile ? (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      const f = e.dataTransfer.files?.[0]
                      if (f && f.name.endsWith('.pptx')) { setTemplateFile(f); setError(null) }
                      else setError('Please upload a .pptx file')
                    }}
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = '.pptx'
                      input.onchange = (e) => {
                        const f = (e.target as HTMLInputElement).files?.[0]
                        if (f) { setTemplateFile(f); setError(null) }
                      }
                      input.click()
                    }}
                    style={{
                      border: '2px dashed var(--border)', borderRadius: 10, padding: '28px 20px',
                      textAlign: 'center', background: 'var(--bg-soft)', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 6 }}>&#128196;</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Drop or click to upload .pptx</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>PowerPoint template file</div>
                  </div>
                ) : (
                  <div style={{
                    padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border-light)',
                    background: 'white', display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ fontSize: 20 }}>&#128196;</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{templateFile.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{(templateFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    </div>
                    {templateLayouts.length === 0 ? (
                      <button onClick={handleAnalyzeTemplate} disabled={analyzingTemplate} className="btn btn-primary btn-sm">
                        {analyzingTemplate ? 'Analyzing...' : 'Analyze Template'}
                      </button>
                    ) : (
                      <button onClick={() => { setTemplateFile(null); setTemplateLayouts([]) }} className="btn btn-soft btn-sm">
                        Remove
                      </button>
                    )}
                  </div>
                )}

                {/* Show analyzing spinner */}
                {analyzingTemplate && (
                  <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <div className="spinner" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Analyzing template layouts...</div>
                  </div>
                )}

                {/* Show classified layouts */}
                {templateLayouts.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <label className="input-label">Detected Layouts ({templateLayouts.length})</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                      {templateLayouts.map((layout, i) => (
                        <div key={i} style={{
                          padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-light)',
                          background: 'white',
                        }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{layout.name}</div>
                          {layout.description && (
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{layout.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Builtin style message */}
            {useBuiltinStyle && (
              <div style={{
                padding: '16px 20px', borderRadius: 10, background: 'rgba(168,240,212,0.1)',
                border: '1px solid var(--mint)', fontSize: 14, color: 'var(--ink-soft)', marginBottom: 20,
              }}>
                AI will design your slides with a clean, professional look. Your brand colors and logo will be applied automatically.
              </div>
            )}
          </div>

          {/* Brand picker */}
          <div className="wizard-card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Brand &amp; Style</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Select a brand to apply your colors and logo.
            </p>
            <BrandStylePicker
              onSelect={({ brandId: b, styleId: s }) => { setBrandId(b); setStyleId(s) }}
              initialBrandId={brandId}
              initialStyleId={styleId}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep('source')} className="btn btn-soft" style={{ flex: 1 }}>
              &larr; Back
            </button>
            <button
              onClick={() => { setStep('plan'); handlePlanDeck() }}
              disabled={!useBuiltinStyle && templateLayouts.length === 0 && !!templateFile}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              Generate Deck Plan &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  STEP 3: REVIEW PLAN                                             */}
      {/* ================================================================ */}
      {step === 'plan' && (
        <div>
          {/* Planning spinner */}
          {planning && (
            <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }} />
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Planning Your Deck</h2>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', maxWidth: 420, margin: '0 auto' }}>
                AI is analyzing your content and creating an optimal slide structure...
              </p>
            </div>
          )}

          {/* Plan review */}
          {!planning && plan.length > 0 && (
            <div>
              <div className="wizard-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Deck Plan</h2>
                    <p className="wizard-sub" style={{ margin: '4px 0 0' }}>{plan.length} slides planned. Edit headlines, remove slides, or reorder them.</p>
                  </div>
                  <button
                    onClick={() => { setPlan([]); handlePlanDeck() }}
                    className="btn btn-soft btn-sm"
                  >
                    Regenerate Plan
                  </button>
                </div>

                {plan.map((slide, i) => (
                  <div key={i} style={{
                    background: 'white', border: '1px solid var(--border-light)',
                    borderRadius: 10, padding: '16px 18px', marginBottom: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      {/* Slide number */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, background: 'var(--mint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 13, flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>

                      {/* Layout badge */}
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                        padding: '3px 10px', borderRadius: 6, background: 'var(--bg-soft)',
                        border: '1px solid var(--border-light)', color: 'var(--ink-soft)',
                      }}>
                        {slide.layout}
                      </span>

                      <div style={{ flex: 1 }} />

                      {/* Reorder buttons */}
                      <button
                        onClick={() => movePlanSlide(i, -1)}
                        disabled={i === 0}
                        style={{
                          background: 'none', border: '1px solid var(--border-light)',
                          borderRadius: 6, width: 28, height: 28, cursor: i === 0 ? 'default' : 'pointer',
                          opacity: i === 0 ? 0.3 : 1, fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        onClick={() => movePlanSlide(i, 1)}
                        disabled={i === plan.length - 1}
                        style={{
                          background: 'none', border: '1px solid var(--border-light)',
                          borderRadius: 6, width: 28, height: 28,
                          cursor: i === plan.length - 1 ? 'default' : 'pointer',
                          opacity: i === plan.length - 1 ? 0.3 : 1, fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Move down"
                      >
                        &#9660;
                      </button>
                      <button
                        onClick={() => removePlanSlide(i)}
                        disabled={plan.length <= 1}
                        style={{
                          background: 'none', border: '1px solid var(--border-light)',
                          borderRadius: 6, width: 28, height: 28, cursor: 'pointer',
                          color: '#C03A1F', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: plan.length <= 1 ? 0.3 : 1,
                        }}
                        title="Remove slide"
                      >
                        &#10005;
                      </button>
                    </div>

                    {/* Headline (editable) */}
                    <input
                      type="text"
                      className="input"
                      value={slide.headline ?? ''}
                      onChange={e => updatePlanSlide(i, { headline: e.target.value })}
                      style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}
                    />

                    {/* Body preview */}
                    {slide.body && (
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 6 }}>
                        {slide.body.length > 150 ? slide.body.slice(0, 150) + '...' : slide.body}
                      </div>
                    )}

                    {/* Image prompt if any */}
                    {slide.imagePrompt && (
                      <div style={{
                        fontSize: 12, color: 'var(--ink-light)', fontStyle: 'italic',
                        padding: '6px 10px', borderRadius: 6, background: 'var(--bg-soft)', marginBottom: 6,
                      }}>
                        Image: {slide.imagePrompt}
                      </div>
                    )}

                    {/* Rationale */}
                    {slide.rationale && (
                      <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>
                        {slide.rationale}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep('template')} className="btn btn-soft" style={{ flex: 1 }}>
                  &larr; Back
                </button>
                <button
                  onClick={handleGenerateDeck}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  Generate Deck ({plan.length} slides, $19)
                </button>
              </div>
            </div>
          )}

          {/* No plan and not planning (error case) */}
          {!planning && plan.length === 0 && (
            <div className="wizard-card" style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 16 }}>No deck plan was generated. Try again or go back to adjust your content.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => setStep('template')} className="btn btn-soft">&larr; Back</button>
                <button onClick={handlePlanDeck} className="btn btn-primary">Retry Plan</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/*  STEP 4: GENERATING                                              */}
      {/* ================================================================ */}
      {step === 'generating' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Building Your Deck</h2>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', maxWidth: 420, margin: '0 auto 24px' }}>
            AI is designing slides, generating backgrounds, and assembling your {plan.length}-slide presentation. This usually takes 30-60 seconds.
          </p>

          {/* Progress bar */}
          <div style={{
            width: '100%', maxWidth: 400, height: 8, borderRadius: 4,
            background: 'var(--border-light)', margin: '0 auto 12px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(progress, 100)}%`, height: '100%',
              background: 'var(--mint)', borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>
            {progress < 30 ? 'Generating slide content...' :
             progress < 60 ? 'Designing layouts and backgrounds...' :
             progress < 90 ? 'Assembling PPTX file...' :
             'Finalizing...'}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  DONE                                                            */}
      {/* ================================================================ */}
      {step === 'done' && (
        <div className="wizard-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>&#9989;</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Your Deck is Ready!</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 8, maxWidth: 480, margin: '0 auto 8px' }}>
            <strong>{extractedData?.title || 'Untitled Deck'}</strong> &mdash; {plan.length} slides
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 28 }}>
            Download your PPTX file and open it in PowerPoint, Google Slides, or Keynote. All text is fully editable.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="btn btn-primary btn-lg"
                style={{ textDecoration: 'none' }}
              >
                Download PPTX
              </a>
            )}
            <button onClick={handleReset} className="btn btn-soft btn-lg">
              Create Another
            </button>
          </div>
        </div>
      )}
      </div>{/* end hidden div */}
    </div>
  )
}
