'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SUGGESTIONS = [
  { icon: '🌐', label: 'Explain my website', prompt: 'Create a video that explains what my company does based on our website', needsUrl: true },
  { icon: '📄', label: 'Summarize a document', prompt: 'Turn this document into a clear video summary with key takeaways', needsUpload: true },
  { icon: '🎯', label: 'Sales pitch', prompt: 'Create a compelling sales video that highlights our product benefits and drives conversions' },
  { icon: '📚', label: 'Training video', prompt: 'Create a training video that teaches a process step by step' },
  { icon: '📊', label: 'Present a report', prompt: 'Turn data and results into a visual video presentation' },
  { icon: '🤝', label: 'Client proposal', prompt: 'Create a professional proposal video to win a new client' },
  { icon: '🏠', label: 'Real estate listing', prompt: 'Create a property showcase video highlighting features, neighborhood, and pricing' },
  { icon: '💼', label: 'Company intro', prompt: 'Create a company overview video explaining who we are, what we do, and why clients choose us' },
]

export default function CreatePage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [pendingState, setPendingState] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check for pending creation on mount
  useEffect(() => {
    const existing = localStorage.getItem('d2v_create')
    if (existing) {
      try {
        const state = JSON.parse(existing)
        if (state.purpose || state.extractedData || state.scenes) {
          setPendingState(state)
          return
        }
      } catch { /* ignore */ }
    }
  }, [])

  function handleStartFresh() {
    localStorage.removeItem('d2v_create')
    sessionStorage.removeItem('d2v_file')
    sessionStorage.removeItem('d2v_fileName')
    sessionStorage.removeItem('d2v_fileType')
    setPendingState(null)
  }

  function handleResume() {
    const state = pendingState
    if (state.scenes?.length > 0) router.push('/create/script')
    else if (state.extractedData) router.push('/create/review')
    else if (state.purpose) router.push('/create/source')
    else router.push('/create/source')
  }

  function handleSubmit(text: string) {
    if (!text.trim() || submitting) return
    setSubmitting(true)

    // Clear old state
    localStorage.removeItem('d2v_create')
    sessionStorage.removeItem('d2v_file')
    sessionStorage.removeItem('d2v_fileName')
    sessionStorage.removeItem('d2v_fileType')

    // Save purpose and navigate to source
    const createState = { purpose: text.trim() }
    localStorage.setItem('d2v_create', JSON.stringify(createState))
    router.push('/create/source')
  }

  function handleSuggestionClick(suggestion: typeof SUGGESTIONS[0]) {
    // For suggestions that need URL or upload, set purpose and go to source
    handleSubmit(suggestion.prompt)
  }

  function handleTemplateClick(template: any) {
    localStorage.setItem('d2v_create', JSON.stringify({
      purpose: template.purpose,
      intentType: template.intentType,
      detailLevel: template.detailLevel,
      narrationStyle: template.narrationStyle,
    }))
    router.push('/create/source')
  }

  // Saved templates from localStorage
  const [templates, setTemplates] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  useEffect(() => {
    try { setTemplates(JSON.parse(localStorage.getItem('d2v_templates') || '[]')) } catch { /* */ }
    try { setDrafts(JSON.parse(localStorage.getItem('d2v_drafts') || '[]')) } catch { /* */ }
  }, [])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '60px 24px 40px', maxWidth: 800, margin: '0 auto', width: '100%',
    }}>

      {/* Resume banner */}
      {pendingState && (
        <div style={{
          width: '100%', padding: '16px 20px', borderRadius: 10, marginBottom: 32,
          background: 'rgba(168,240,212,0.12)', border: '1px solid var(--mint)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
              You have an unfinished video
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {pendingState.purpose ? `"${pendingState.purpose.slice(0, 80)}${pendingState.purpose.length > 80 ? '...' : ''}"` : 'Pick up where you left off'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleResume}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'var(--ink)', color: 'white', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Continue &rarr;
            </button>
            <button
              onClick={handleStartFresh}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'white', color: 'var(--ink-soft)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Main heading */}
      <h1 style={{
        fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em',
        textAlign: 'center', marginBottom: 8, color: 'var(--ink)',
        animation: 'fadeInUp 0.4s ease',
      }}>
        What do you want to create?
      </h1>
      <p style={{
        fontSize: 18, color: 'var(--ink-soft)', textAlign: 'center',
        marginBottom: 32, lineHeight: 1.6, animation: 'fadeInUp 0.4s ease 0.05s both',
      }}>
        Describe your video in a sentence, or pick a suggestion below.
      </p>

      {/* Main input */}
      <div style={{
        width: '100%', position: 'relative',
        animation: 'fadeInUp 0.4s ease 0.1s both',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(input)
            }
          }}
          placeholder="e.g. Create a sales video for my roofing company website..."
          rows={3}
          style={{
            width: '100%', padding: '20px 24px', paddingRight: 100, borderRadius: 10,
            border: '2px solid var(--border)', fontSize: 17, fontFamily: 'inherit',
            outline: 'none', transition: 'border-color 0.2s', resize: 'none',
            lineHeight: 1.5, background: 'white',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
        <button
          onClick={() => handleSubmit(input)}
          disabled={!input.trim() || submitting}
          style={{
            position: 'absolute', right: 12, bottom: 12,
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: input.trim() ? 'var(--ink)' : 'var(--border)',
            color: 'white', fontSize: 15, fontWeight: 700,
            cursor: input.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s', fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Going...' : 'Next \u2192'}
        </button>
      </div>

      {/* Suggestion cards */}
      <div style={{
        width: '100%', marginTop: 32,
        animation: 'fadeInUp 0.4s ease 0.15s both',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--ink-light)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
        }}>
          Quick starts
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s.label}
              onClick={() => handleSuggestionClick(s)}
              disabled={submitting}
              style={{
                padding: '16px 14px', borderRadius: 10,
                border: '1.5px solid var(--border-light)', background: 'white',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--mint)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-light)'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Saved templates */}
      {templates.length > 0 && (
        <div style={{ width: '100%', marginTop: 32, animation: 'fadeInUp 0.4s ease 0.2s both' }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--ink-light)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
          }}>
            Your templates
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {templates.map((t: any) => (
              <button
                key={t.id}
                onClick={() => handleTemplateClick(t)}
                style={{
                  padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border-light)',
                  background: 'white', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
              >
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>{t.intentType}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved drafts */}
      {drafts.length > 0 && (
        <div style={{ width: '100%', marginTop: 24, animation: 'fadeInUp 0.4s ease 0.25s both' }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--ink-light)',
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
          }}>
            Saved drafts
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {drafts.map((d: any, idx: number) => (
              <div key={d.id} style={{
                padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border-light)',
                background: 'white', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <button
                  onClick={() => {
                    localStorage.setItem('d2v_create', JSON.stringify(d.state))
                    const updated = drafts.filter((_: any, i: number) => i !== idx)
                    localStorage.setItem('d2v_drafts', JSON.stringify(updated))
                    if (d.state.scenes?.length) router.push('/create/script')
                    else if (d.state.extractedData) router.push('/create/review')
                    else router.push('/create/source')
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0 }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>Saved {new Date(d.savedAt).toLocaleDateString()}</div>
                </button>
                <button
                  onClick={() => {
                    const updated = drafts.filter((_: any, i: number) => i !== idx)
                    localStorage.setItem('d2v_drafts', JSON.stringify(updated))
                    setDrafts(updated)
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', padding: 2 }}
                  title="Delete draft"
                >&times;</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
