'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'

const INPUT_METHODS = [
  { id: 'upload', icon: '📄', title: 'Upload Document', desc: 'PDF, DOCX, PPTX, or text file', accept: '.pdf,.doc,.docx,.pptx,.txt,.csv' },
  { id: 'url', icon: '🌐', title: 'Website URL', desc: 'We\'ll extract the page content', accept: '' },
  { id: 'text', icon: '📝', title: 'Paste Text', desc: 'Copy and paste your content directly', accept: '' },
  { id: 'idea', icon: '💡', title: 'Start from Idea', desc: 'Describe your topic, AI writes the content', accept: '' },
]

export default function SourcePage() {
  const router = useRouter()
  const [method, setMethod] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [ideaTopic, setIdeaTopic] = useState('')
  const [ideaAudience, setIdeaAudience] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    const createState = JSON.parse(localStorage.getItem('d2v_create') || '{}')

    try {
      if (method === 'upload') {
        const file = fileRef.current?.files?.[0]
        if (!file) { setError('Please select a file'); setLoading(false); return }
        const formData = new FormData()
        formData.append('file', file)
        if (createState.purpose) formData.append('purpose', createState.purpose)

        // Save extracting state and navigate
        createState.method = 'upload'
        createState.fileName = file.name
        localStorage.setItem('d2v_create', JSON.stringify(createState))

        // Store the formData in sessionStorage as base64
        const reader = new FileReader()
        reader.onload = () => {
          sessionStorage.setItem('d2v_file', reader.result as string)
          sessionStorage.setItem('d2v_fileName', file.name)
          sessionStorage.setItem('d2v_fileType', file.type)
          router.push('/create/extracting')
        }
        reader.readAsDataURL(file)
        return
      }

      if (method === 'url') {
        if (!urlInput.trim()) { setError('Please enter a URL'); setLoading(false); return }
        let url = urlInput.trim()
        if (!/^https?:\/\//i.test(url)) url = `https://${url}`
        createState.method = 'url'
        createState.url = url
        localStorage.setItem('d2v_create', JSON.stringify(createState))
        router.push('/create/extracting')
        return
      }

      if (method === 'text') {
        if (!textInput.trim() || textInput.trim().length < 50) { setError('Please enter at least 50 characters'); setLoading(false); return }
        createState.method = 'text'
        createState.rawText = textInput.trim()
        localStorage.setItem('d2v_create', JSON.stringify(createState))
        router.push('/create/extracting')
        return
      }

      if (method === 'idea') {
        if (!ideaTopic.trim()) { setError('Please describe your topic'); setLoading(false); return }
        createState.method = 'idea'
        createState.ideaTopic = ideaTopic.trim()
        createState.ideaAudience = ideaAudience.trim()
        localStorage.setItem('d2v_create', JSON.stringify(createState))
        router.push('/create/extracting')
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', maxWidth: 900, margin: '0 auto', width: '100%',
    }}>

      {!method ? (
        <div style={{ width: '100%', animation: 'fadeInUp 0.4s ease' }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8 }}>
            Add your content
          </h1>
          <p style={{ fontSize: 18, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 48, lineHeight: 1.6 }}>
            Upload a document, paste a URL, or start from scratch.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {INPUT_METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                style={{
                  padding: '36px 28px', borderRadius: 16, border: '2px solid var(--border-light)',
                  background: 'white', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{m.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>{m.title}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: 600, animation: 'fadeInUp 0.4s ease' }}>
          <button
            onClick={() => { setMethod(null); setError(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', marginBottom: 32, fontFamily: 'inherit' }}
          >
            &larr; Back to options
          </button>

          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>
            {INPUT_METHODS.find(m => m.id === method)?.title}
          </h2>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {method === 'upload' && (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '48px 32px', borderRadius: 16, border: '2px dashed var(--border)',
                  background: 'var(--bg-soft)', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--mint)' }}
                onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.style.borderColor = 'var(--border)'
                  if (e.dataTransfer.files[0] && fileRef.current) {
                    const dt = new DataTransfer()
                    dt.items.add(e.dataTransfer.files[0])
                    fileRef.current.files = dt.files
                  }
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Drop your file here or click to browse</div>
                <div style={{ fontSize: 13, color: 'var(--ink-light)' }}>PDF, DOCX, PPTX, TXT, CSV</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.pptx,.txt,.csv" style={{ display: 'none' }} onChange={() => {}} />
            </div>
          )}

          {method === 'url' && (
            <div>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="https://example.com"
                autoFocus
                style={{
                  width: '100%', padding: '18px 20px', borderRadius: 12, border: '2px solid var(--border)',
                  fontSize: 17, fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
              <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 8 }}>
                We&apos;ll extract the page content and structure it for your video.
              </p>
            </div>
          )}

          {method === 'text' && (
            <div>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Paste your content here..."
                autoFocus
                style={{
                  width: '100%', padding: '18px 20px', borderRadius: 12, border: '2px solid var(--border)',
                  fontSize: 16, fontFamily: 'inherit', outline: 'none', minHeight: 200, resize: 'vertical',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
              <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 8 }}>
                {textInput.length} characters {textInput.length < 50 ? '(minimum 50)' : ''}
              </p>
            </div>
          )}

          {method === 'idea' && (
            <div>
              <label style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 8 }}>What&apos;s the topic?</label>
              <input
                type="text"
                value={ideaTopic}
                onChange={e => setIdeaTopic(e.target.value)}
                placeholder="e.g. Benefits of whole life insurance"
                autoFocus
                style={{
                  width: '100%', padding: '18px 20px', borderRadius: 12, border: '2px solid var(--border)',
                  fontSize: 16, fontFamily: 'inherit', outline: 'none', marginBottom: 20,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
              <label style={{ fontSize: 16, fontWeight: 600, display: 'block', marginBottom: 8 }}>Who&apos;s the audience? (optional)</label>
              <input
                type="text"
                value={ideaAudience}
                onChange={e => setIdeaAudience(e.target.value)}
                placeholder="e.g. First-time homebuyers, small business owners"
                style={{
                  width: '100%', padding: '18px 20px', borderRadius: 12, border: '2px solid var(--border)',
                  fontSize: 16, fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '18px', borderRadius: 12, border: 'none',
              background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', marginTop: 24, fontFamily: 'inherit',
              transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Processing...' : 'Extract & Continue →'}
          </button>
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
