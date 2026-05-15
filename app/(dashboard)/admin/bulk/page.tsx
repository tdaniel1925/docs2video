'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../_lib/supabase/client'
import { isAdmin } from '../../../_lib/admin'
import Link from 'next/link'

interface BulkItem {
  name: string
  email: string
  documentUrl: string
  documentText?: string
}

interface BulkResult {
  index: number
  status: string
  videoId?: string
  error?: string
}

export default function BulkGeneratePage() {
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [items, setItems] = useState<BulkItem[]>([])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BulkResult[]>([])
  const [completed, setCompleted] = useState(0)
  const [csvText, setCsvText] = useState('')
  const [mode, setMode] = useState<'csv' | 'urls'>('csv')
  const [urlsText, setUrlsText] = useState('')
  const [bulkEmail, setBulkEmail] = useState('')
  const [bulkName, setBulkName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isAdmin(user.email)) {
        setAuthState('denied')
        return
      }
      setAuthState('ok')
    }
    checkAuth()
  }, [])

  function parseCsv(text: string): BulkItem[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    // Skip header row
    return lines.slice(1).map(line => {
      const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
      return {
        name: parts[0] ?? '',
        email: parts[1] ?? '',
        documentUrl: parts[2] ?? '',
      }
    }).filter(item => item.name || item.email || item.documentUrl)
  }

  function handleCsvPaste() {
    const parsed = parseCsv(csvText)
    setItems(parsed)
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      const parsed = parseCsv(text)
      setItems(parsed)
    }
    reader.readAsText(file)
  }

  function handleUrlsParse() {
    if (!bulkEmail) return
    const urls = urlsText.trim().split('\n').filter(u => u.trim())
    setItems(urls.map((url, i) => ({
      name: bulkName || `Video ${i + 1}`,
      email: bulkEmail,
      documentUrl: url.trim(),
    })))
  }

  async function handleRun() {
    if (items.length === 0) return
    setRunning(true)
    setResults([])
    setCompleted(0)

    // Process in batches of 1 (sequential) to avoid overwhelming the server
    const allResults: BulkResult[] = []

    for (let i = 0; i < items.length; i++) {
      try {
        const res = await fetch('/api/admin/bulk-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [items[i]] }),
        })
        const data = await res.json()
        const result = data.results?.[0] ?? { index: i, status: 'failed', error: 'No response' }
        result.index = i
        allResults.push(result)
      } catch (err) {
        allResults.push({ index: i, status: 'failed', error: 'Network error' })
      }
      setCompleted(i + 1)
      setResults([...allResults])
    }

    setRunning(false)
  }

  if (authState === 'loading') {
    return (
      <div style={{ maxWidth: 900 }}>
        <div className="page-head"><div><h1>Bulk Video Creation</h1></div></div>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner lg" /></div>
      </div>
    )
  }

  if (authState === 'denied') {
    return (
      <div style={{ maxWidth: 900 }}>
        <div className="page-head"><div><h1>Bulk Video Creation</h1></div></div>
        <div style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>403 -- Access denied. Admin only.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--ink-light)', textDecoration: 'none', fontWeight: 600 }}>
        &larr; Back to Admin
      </Link>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h1>Bulk Video Creation</h1>
          <p>Upload a CSV or paste document URLs to generate multiple videos at once.</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setMode('csv')}
          className={mode === 'csv' ? 'btn btn-primary' : 'btn btn-soft'}
          style={{ fontSize: 13 }}
        >
          Upload CSV
        </button>
        <button
          onClick={() => setMode('urls')}
          className={mode === 'urls' ? 'btn btn-primary' : 'btn btn-soft'}
          style={{ fontSize: 13 }}
        >
          Paste URLs
        </button>
      </div>

      {mode === 'csv' && (
        <div style={{
          background: 'white',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
          padding: 24,
          marginBottom: 20,
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>CSV Upload</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
            Format: <code>name,email,document_url</code> (first row is header)
          </p>

          <div style={{ marginBottom: 16 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleCsvFile}
              style={{ marginBottom: 8 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Or paste CSV content:</label>
            <textarea
              className="input"
              rows={6}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={'name,email,document_url\nJohn Doe,john@example.com,https://example.com/doc.pdf'}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <button onClick={handleCsvPaste} className="btn btn-soft" style={{ fontSize: 13 }}>
            Parse CSV
          </button>
        </div>
      )}

      {mode === 'urls' && (
        <div style={{
          background: 'white',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
          padding: 24,
          marginBottom: 20,
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Paste Document URLs</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
            One URL per line. All videos will be assigned to the email below.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Name</label>
              <input
                className="input"
                value={bulkName}
                onChange={e => setBulkName(e.target.value)}
                placeholder="Client name"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Email</label>
              <input
                className="input"
                type="email"
                value={bulkEmail}
                onChange={e => setBulkEmail(e.target.value)}
                placeholder="client@example.com"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Document URLs (one per line)</label>
            <textarea
              className="input"
              rows={6}
              value={urlsText}
              onChange={e => setUrlsText(e.target.value)}
              placeholder={'https://example.com/doc1.pdf\nhttps://example.com/doc2.pdf'}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>

          <button onClick={handleUrlsParse} className="btn btn-soft" style={{ fontSize: 13 }} disabled={!bulkEmail}>
            Parse URLs
          </button>
        </div>
      )}

      {/* Parsed items preview */}
      {items.length > 0 && (
        <div style={{
          background: 'white',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
          padding: 24,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {items.length} video{items.length !== 1 ? 's' : ''} ready
            </h3>
            <button
              onClick={handleRun}
              disabled={running}
              className="btn btn-primary"
              style={running ? { opacity: 0.6 } : undefined}
            >
              {running ? `Generating... ${completed} of ${items.length}` : 'Start Bulk Generation'}
            </button>
          </div>

          {/* Progress bar */}
          {running && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(completed / items.length) * 100}%`,
                  background: 'var(--mint)',
                  borderRadius: 8,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6, textAlign: 'center' }}>
                {completed} of {items.length} complete
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase' }}>Document</th>
                  {results.length > 0 && (
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--ink-soft)', fontSize: 12, textTransform: 'uppercase' }}>Status</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const result = results.find(r => r.index === i)
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--ink-soft)' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '8px 12px' }}>{item.email}</td>
                      <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.documentUrl || '(text)'}
                      </td>
                      {results.length > 0 && (
                        <td style={{ padding: '8px 12px' }}>
                          {result ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              background: result.status === 'started' || result.status === 'queued' ? 'var(--mint, #d4f5e9)' : '#fee2e2',
                              color: result.status === 'started' || result.status === 'queued' ? '#166534' : '#991b1b',
                            }}>
                              {result.status === 'started' ? 'Started' : result.status === 'queued' ? 'Queued' : 'Failed'}
                            </span>
                          ) : (
                            running && i >= completed ? (
                              <span style={{ color: 'var(--ink-light)' }}>Waiting...</span>
                            ) : null
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
