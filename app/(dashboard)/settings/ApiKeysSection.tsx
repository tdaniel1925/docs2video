'use client'

import { useEffect, useState } from 'react'
import { useBrand } from '../../_components/BrandProvider'
import { useToast } from '../../_components/Toast'

type ApiKey = { id: string; key_prefix: string; name: string | null; is_active: boolean; last_used_at: string | null; created_at: string }

/** Self-serve API key management + MCP usage. A key lets the user (or an MCP
 *  client) drive the app via the API, spending their normal subscription credits. */
export default function ApiKeysSection() {
  const storefront = useBrand()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const showToast = useToast()

  const load = () => fetch('/api/keys').then(r => r.ok ? r.json() : { keys: [] }).then(d => { setKeys(d.keys ?? []); setLoading(false) }).catch(() => setLoading(false))
  useEffect(() => { load() }, [])

  async function createKey() {
    setCreating(true)
    try {
      const r = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() || undefined }) })
      const d = await r.json()
      if (!r.ok) { showToast(d.error || 'Could not create key', 'error'); return }
      setFreshKey(d.api_key); setNewName(''); load()
    } finally { setCreating(false) }
  }

  async function revoke(id: string) {
    const r = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
    if (r.ok) load(); else showToast('Could not revoke', 'error')
  }

  const activeKeys = keys.filter(k => k.is_active)

  return (
    <div className="settings-card">
      <h3 style={{ marginBottom: 4 }}>API keys</h3>
      <p className="ssub" style={{ margin: '0 0 16px' }}>
        {storefront.showVideoFeatures
          ? 'Create an API key to build videos and commercials programmatically — from your own scripts or an AI assistant. Usage spends your normal credits.'
          : 'Create an API key to make designs programmatically — from your own scripts or an AI assistant. Usage spends your normal credits.'}
      </p>

      {/* The freshly-created key — shown ONCE. */}
      {freshKey && (
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid var(--accent)', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Your new key — copy it now, it won&apos;t be shown again:</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 'var(--fs-small)', padding: '8px 10px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-light)', overflowX: 'auto', whiteSpace: 'nowrap' }}>{freshKey}</code>
            <button className="btn btn-sm btn-primary" onClick={() => { navigator.clipboard?.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>{copied ? 'Copied' : 'Copy'}</button>
            <button className="btn btn-sm btn-soft" onClick={() => setFreshKey(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Create */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 16 }}>
        <input className="input" placeholder="Key name (optional, e.g. 'MCP')" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1, maxWidth: 280 }} />
        <button className="btn btn-primary" onClick={createKey} disabled={creating}>{creating ? 'Creating…' : 'Generate key'}</button>
      </div>

      {/* List */}
      {loading ? <p className="ssub">Loading…</p> : activeKeys.length === 0 ? (
        <p className="ssub">No keys yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 16 }}>
          {activeKeys.map(k => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-ui)', fontWeight: 600 }}>{k.name || 'Untitled key'}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}><code>{k.key_prefix}…</code> · created {new Date(k.created_at).toLocaleDateString()} {k.last_used_at ? `· last used ${new Date(k.last_used_at).toLocaleDateString()}` : '· never used'}</div>
              </div>
              <button className="btn btn-sm btn-soft" onClick={() => revoke(k.id)}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      {/* MCP usage hint */}
      <details style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--ink)' }}>Use it with an AI assistant (MCP)</summary>
        <div style={{ marginTop: 8, lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px' }}>Point the MCP server at your key to make {storefront.showVideoFeatures ? 'videos and commercials' : 'designs'} from chat. For Claude Code:</p>
          <code style={{ display: 'block', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-light)', overflowX: 'auto', whiteSpace: 'pre', fontSize: 'var(--fs-caption)' }}>{`claude mcp add docs2video \\
  -e DOCS2VIDEO_API_KEY=YOUR_KEY \\
  -- node /path/to/mcp/server.mjs`}</code>
          <p style={{ margin: '8px 0 0' }}>Base URL: <code>{typeof window !== 'undefined' ? window.location.origin : `https://${storefront.domain}`}</code>. See the mcp/README for the full tool list.
          {!storefront.showVideoFeatures && ' The server and key are named after Docs2Video, which runs the accounts behind both sites — the key is yours either way.'}</p>
        </div>
      </details>
    </div>
  )
}
