'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const STAGES = [
  { label: 'Reading', threshold: 0 },
  { label: 'Analyzing', threshold: 5 },
  { label: 'Structuring', threshold: 12 },
]

export default function ExtractingPage() {
  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function extract() {
      const createState = JSON.parse(localStorage.getItem('d2v_create') || '{}')
      const method = createState.method

      try {
        let result: any

        if (method === 'url') {
          const res = await fetch('/api/extract-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: createState.url }),
            signal: AbortSignal.timeout(120000),
          })
          result = await res.json()
          if (!res.ok) throw new Error(result.error || 'Extraction failed')
        } else if (method === 'upload') {
          const fileData = sessionStorage.getItem('d2v_file')
          const fileName = sessionStorage.getItem('d2v_fileName')
          const fileType = sessionStorage.getItem('d2v_fileType')
          if (!fileData) throw new Error('File data not found. Please go back and re-upload.')

          // Convert data URL back to file
          const resp = await fetch(fileData)
          const blob = await resp.blob()
          const file = new File([blob], fileName || 'document', { type: fileType || 'application/pdf' })

          const formData = new FormData()
          formData.append('file', file)
          if (createState.purpose) formData.append('purpose', createState.purpose)

          const res = await fetch('/api/extract', { method: 'POST', body: formData, signal: AbortSignal.timeout(120000) })
          result = await res.json()
          if (!res.ok) throw new Error(result.error || 'Extraction failed')
          sessionStorage.removeItem('d2v_file')
          sessionStorage.removeItem('d2v_fileName')
          sessionStorage.removeItem('d2v_fileType')
        } else if (method === 'text') {
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: createState.rawText, purpose: createState.purpose }),
            signal: AbortSignal.timeout(120000),
          })
          result = await res.json()
          if (!res.ok) throw new Error(result.error || 'Extraction failed')
        } else if (method === 'idea') {
          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idea: createState.ideaTopic, audience: createState.ideaAudience, purpose: createState.purpose }),
            signal: AbortSignal.timeout(120000),
          })
          result = await res.json()
          if (!res.ok) throw new Error(result.error || 'Extraction failed')
        }

        // Save extracted data
        const { suggestedTheme, autoBrandId, autoLogoUrl, ...contentData } = result || {}
        createState.extractedData = contentData
        createState.suggestedTheme = suggestedTheme || null
        createState.autoBrandId = autoBrandId || null
        createState.autoLogoUrl = autoLogoUrl || null
        localStorage.setItem('d2v_create', JSON.stringify(createState))

        router.push('/create/review')
      } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          setError('Extraction timed out. The content may be too large or the server is busy. Please try again.')
        } else {
          setError(err instanceof Error ? err.message : 'Extraction failed')
        }
      }
    }

    extract()
  }, [router])

  const pct = elapsed < 3 ? 10 : elapsed < 8 ? 30 : elapsed < 15 ? 55 : elapsed < 25 ? 75 : elapsed < 40 ? 88 : 95

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#9888;&#65039;</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Extraction failed</h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginBottom: 24, lineHeight: 1.6 }}>{error}</p>
          <button onClick={() => router.push('/create/source')} style={{
            padding: '14px 32px', borderRadius: 12, border: 'none', background: 'var(--ink)',
            color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            &larr; Go back and try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 400, height: 8, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 40 }}>
        <div style={{
          height: '100%', borderRadius: 10,
          background: 'linear-gradient(90deg, var(--mint), #4ade80)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
          transition: 'width 1s ease',
          width: `${pct}%`,
        }} />
      </div>

      {/* Stage indicators */}
      <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
        {STAGES.map((stage, i) => {
          const isActive = elapsed >= stage.threshold
          const isDone = i < STAGES.length - 1 && elapsed >= STAGES[i + 1].threshold
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: isDone ? 'var(--mint)' : isActive ? 'var(--ink)' : 'var(--border)',
                color: isDone ? 'var(--ink)' : isActive ? 'white' : 'var(--ink-light)',
                transition: 'all 0.3s ease',
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 15, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--ink)' : 'var(--ink-light)',
                transition: 'all 0.3s ease',
              }}>
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Status message */}
      <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, textAlign: 'center' }}>
        {elapsed < 3 ? 'Reading your content...' :
         elapsed < 8 ? 'AI is analyzing the structure...' :
         elapsed < 15 ? 'Extracting key data points...' :
         elapsed < 25 ? 'Almost there — organizing your data...' :
         elapsed < 60 ? 'Still working — complex content takes a little longer...' :
         'Taking longer than expected — please wait...'}
      </h2>
      <p style={{ fontSize: 14, color: 'var(--ink-light)' }}>{elapsed}s elapsed</p>
    </div>
  )
}
