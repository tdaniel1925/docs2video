'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface CheckResult { name: string; ok: boolean; ms: number; error?: string; detail?: Record<string, unknown> }
interface SystemCheckRow { id: string; run_at: string; trigger: string; overall_ok: boolean; results: CheckResult[]; duration_ms: number }
interface HistoryRow { id: string; run_at: string; overall_ok: boolean; duration_ms: number; trigger: string }

const LABELS: Record<string, string> = {
  render_path: 'Render path (VPS · Gemini · sharp · TTS · storage)',
  supabase: 'Supabase (database)',
  stripe: 'Stripe (payments)',
  resend: 'Resend (email)',
  ai_keys: 'AI keys (Gemini · OpenAI · Anthropic)',
}

export default function SystemStatusPage() {
  const [latest, setLatest] = useState<SystemCheckRow | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/system-status')
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setLatest(d.latest)
      setHistory(d.history || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function runNow() {
    setRunning(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/system-status', { method: 'POST' })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spot test failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>System Status</h1>
            <p style={s.subtitle}>Live health of every subsystem. Automated spot-test runs every 6 hours.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/admin/logs" style={s.linkBtn}>Logs &rarr;</Link>
            <Link href="/admin" style={s.backLink}>&larr; Admin</Link>
          </div>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        <div style={s.toolbar}>
          <button onClick={runNow} disabled={running} style={{ ...s.runBtn, opacity: running ? 0.6 : 1 }}>
            {running ? 'Running spot test…' : 'Run spot test now'}
          </button>
          {latest && (
            <span style={s.meta}>
              Last run: {new Date(latest.run_at).toLocaleString()} ({latest.trigger}) · {latest.duration_ms}ms
            </span>
          )}
        </div>

        {loading ? (
          <p style={s.loading}>Loading…</p>
        ) : !latest ? (
          <div style={s.card}><p style={s.muted}>No checks have run yet. Click “Run spot test now”.</p></div>
        ) : (
          <>
            <div style={{ ...s.banner, background: latest.overall_ok ? '#ecfdf5' : '#fef2f2', borderColor: latest.overall_ok ? '#a7f3d0' : '#fca5a5', color: latest.overall_ok ? '#065f46' : '#991b1b' }}>
              {latest.overall_ok ? '✓ All systems operational' : '✗ One or more systems are failing'}
            </div>

            <div style={s.grid}>
              {latest.results.map((r) => (
                <div key={r.name} style={{ ...s.card, borderLeft: `4px solid ${r.ok ? '#10b981' : '#ef4444'}` }}>
                  <div style={s.cardHead}>
                    <span style={{ ...s.dot, background: r.ok ? '#10b981' : '#ef4444' }} />
                    <span style={s.cardTitle}>{LABELS[r.name] || r.name}</span>
                    <span style={s.ms}>{r.ms}ms</span>
                  </div>
                  {r.ok ? (
                    <div style={s.okText}>Operational</div>
                  ) : (
                    <div style={s.failText}>{r.error}</div>
                  )}
                </div>
              ))}
            </div>

            {history.length > 1 && (
              <div style={{ marginTop: 28 }}>
                <h2 style={s.h2}>Recent runs</h2>
                <div style={s.sparkRow}>
                  {history.slice().reverse().map((h) => (
                    <div
                      key={h.id}
                      title={`${new Date(h.run_at).toLocaleString()} · ${h.overall_ok ? 'OK' : 'FAIL'} · ${h.duration_ms}ms`}
                      style={{ ...s.sparkBar, background: h.overall_ok ? '#10b981' : '#ef4444' }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', minHeight: '100vh' },
  container: { maxWidth: 1000, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 0' },
  backLink: { fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' },
  linkBtn: { fontSize: 14, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
  runBtn: { background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  meta: { fontSize: 13, color: 'var(--ink-soft)' },
  banner: { padding: '14px 18px', borderRadius: 10, border: '1px solid', fontWeight: 700, fontSize: 15, marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 },
  card: { background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  cardTitle: { fontWeight: 700, fontSize: 14, flex: 1 },
  ms: { fontSize: 12, color: 'var(--ink-light)' },
  okText: { fontSize: 13, color: '#059669', marginTop: 6 },
  failText: { fontSize: 13, color: '#dc2626', marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  h2: { fontSize: 16, fontWeight: 700, marginBottom: 10 },
  sparkRow: { display: 'flex', gap: 3, alignItems: 'flex-end' },
  sparkBar: { width: 14, height: 28, borderRadius: 3 },
  loading: { color: 'var(--ink-soft)' },
  muted: { color: 'var(--ink-soft)' },
  errorBox: { padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 16 },
}
