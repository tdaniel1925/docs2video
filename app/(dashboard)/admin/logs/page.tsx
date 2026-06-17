'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface ErrorRow {
  id: string
  source: string
  severity: string
  message: string
  detail: string | null
  endpoint: string | null
  count: number
  first_seen: string
  last_seen: string
  resolved: boolean
  recommended_fix: string | null
  fix_source: string | null
}
interface VercelRow { id: string; level: string; message: string; source: string; timestampMs: number }

export default function LogsPage() {
  const [errors, setErrors] = useState<ErrorRow[]>([])
  const [vercel, setVercel] = useState<VercelRow[]>([])
  const [vercelConfigured, setVercelConfigured] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [diagnosing, setDiagnosing] = useState<string | null>(null)
  const [tab, setTab] = useState<'app' | 'vercel'>('app')

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/logs?resolved=${showResolved}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setErrors(d.errors || [])
      setVercel(d.vercel || [])
      setVercelConfigured(d.vercelConfigured)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [showResolved])

  useEffect(() => { load() }, [load])

  async function diagnose(id: string) {
    setDiagnosing(id)
    try {
      const r = await fetch('/api/admin/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ errorId: id }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setErrors(prev => prev.map(e => e.id === id ? { ...e, recommended_fix: d.fix, fix_source: d.source } : e))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diagnosis failed')
    } finally {
      setDiagnosing(null)
    }
  }

  async function toggleResolved(id: string, resolved: boolean) {
    try {
      await fetch('/api/admin/logs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, resolved }) })
      await load()
    } catch { /* ignore */ }
  }

  const sevColor = (sev: string) => sev === 'critical' ? '#dc2626' : sev === 'warning' ? '#d97706' : '#b91c1c'

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Logs &amp; Errors</h1>
            <p style={s.subtitle}>Deduped errors from the app + VPS with recommended fixes.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/admin/system" style={s.linkBtn}>System Status &rarr;</Link>
            <Link href="/admin" style={s.backLink}>&larr; Admin</Link>
          </div>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        <div style={s.tabs}>
          <button onClick={() => setTab('app')} style={{ ...s.tab, ...(tab === 'app' ? s.tabActive : {}) }}>App + VPS</button>
          {vercelConfigured && <button onClick={() => setTab('vercel')} style={{ ...s.tab, ...(tab === 'vercel' ? s.tabActive : {}) }}>Vercel (live)</button>}
          {tab === 'app' && (
            <label style={s.checkboxLabel}>
              <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} /> Show resolved
            </label>
          )}
        </div>

        {loading ? <p style={s.loading}>Loading…</p> : tab === 'app' ? (
          errors.length === 0 ? (
            <div style={s.card}><p style={s.muted}>No {showResolved ? '' : 'unresolved '}errors. 🎉</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {errors.map((e) => (
                <div key={e.id} style={{ ...s.card, borderLeft: `4px solid ${sevColor(e.severity)}`, opacity: e.resolved ? 0.6 : 1 }}>
                  <div style={s.rowHead} onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.msg}>{e.message}</div>
                      <div style={s.subline}>
                        <span style={s.badge}>{e.source}</span>
                        {e.endpoint && <span style={s.badgeMuted}>{e.endpoint}</span>}
                        <span style={s.count}>×{e.count}</span>
                        <span style={s.time}>last: {new Date(e.last_seen).toLocaleString()}</span>
                      </div>
                    </div>
                    <span style={s.chevron}>{expanded === e.id ? '▾' : '▸'}</span>
                  </div>

                  {expanded === e.id && (
                    <div style={s.expand}>
                      {e.detail && <pre style={s.pre}>{e.detail}</pre>}

                      <div style={s.fixHead}>
                        Recommended fix {e.fix_source && <span style={s.fixSrc}>({e.fix_source === 'kb' ? 'known issue' : 'AI'})</span>}
                      </div>
                      {e.recommended_fix ? (
                        <pre style={s.fixBox}>{e.recommended_fix}</pre>
                      ) : (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                          <span style={s.muted}>No fix yet.</span>
                          <button onClick={() => diagnose(e.id)} disabled={diagnosing === e.id} style={s.diagBtn}>
                            {diagnosing === e.id ? 'Diagnosing…' : 'Diagnose (KB → AI)'}
                          </button>
                        </div>
                      )}

                      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                        <button onClick={() => toggleResolved(e.id, !e.resolved)} style={s.resolveBtn}>
                          {e.resolved ? 'Reopen' : 'Mark resolved'}
                        </button>
                        {e.recommended_fix && (
                          <button onClick={() => diagnose(e.id)} disabled={diagnosing === e.id} style={s.rediagBtn}>
                            {diagnosing === e.id ? '…' : 'Re-diagnose'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          vercel.length === 0 ? (
            <div style={s.card}><p style={s.muted}>No recent Vercel errors (or token not configured).</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {vercel.map((v) => (
                <div key={v.id} style={s.vercelRow}>
                  <span style={{ ...s.badge, background: v.level.toLowerCase().includes('error') ? '#fee2e2' : '#fef3c7' }}>{v.level}</span>
                  <span style={s.vercelMsg}>{v.message}</span>
                  <span style={s.time}>{v.timestampMs ? new Date(v.timestampMs).toLocaleTimeString() : ''}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', minHeight: '100vh' },
  container: { maxWidth: 1000, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 0' },
  backLink: { fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' },
  linkBtn: { fontSize: 14, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 },
  tabs: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 },
  tab: { background: 'white', border: '1px solid var(--border-light)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)' },
  tabActive: { background: 'var(--ink)', color: 'white', borderColor: 'var(--ink)' },
  checkboxLabel: { fontSize: 13, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  card: { background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 14 },
  rowHead: { display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  msg: { fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subline: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  badge: { fontSize: 11, fontWeight: 700, background: '#eef2ff', color: '#3730a3', padding: '2px 8px', borderRadius: 6 },
  badgeMuted: { fontSize: 11, color: 'var(--ink-light)', fontFamily: 'monospace' },
  count: { fontSize: 12, fontWeight: 700, color: '#b91c1c' },
  time: { fontSize: 12, color: 'var(--ink-light)' },
  chevron: { fontSize: 14, color: 'var(--ink-light)' },
  expand: { marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 12 },
  pre: { background: '#f8f8f8', border: '1px solid #eee', borderRadius: 8, padding: 10, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto' },
  fixHead: { fontWeight: 700, fontSize: 13, marginTop: 12 },
  fixSrc: { fontWeight: 400, color: 'var(--ink-soft)' },
  fixBox: { background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6, color: '#065f46' },
  diagBtn: { background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  rediagBtn: { background: 'white', color: 'var(--ink)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  resolveBtn: { background: 'white', color: 'var(--ink)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  vercelRow: { display: 'flex', gap: 10, alignItems: 'center', background: 'white', border: '1px solid var(--border-light)', borderRadius: 8, padding: '8px 12px' },
  vercelMsg: { flex: 1, fontSize: 13, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  loading: { color: 'var(--ink-soft)' },
  muted: { color: 'var(--ink-soft)' },
  errorBox: { padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 14, marginBottom: 16 },
}
