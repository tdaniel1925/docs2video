'use client'

import { useEffect, useState } from 'react'

type Pref = 'all' | 'first' | 'off'

const OPTIONS: { value: Pref; label: string; help: string }[] = [
  { value: 'all', label: 'Each new viewer', help: 'One alert per person, then quiet for 12 hours if they come back.' },
  { value: 'first', label: 'First time only', help: 'Only the first time each person opens a video.' },
  { value: 'off', label: 'Off', help: 'No email or text. Views still show in your dashboard.' },
]

/**
 * "When a client watches, tell me…" — the email + text sent on a view.
 * Your own previews never count. Saves right away and says so only when the
 * save really worked.
 */
export default function ViewAlertsSetting() {
  const [pref, setPref] = useState<Pref>('all')
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/analytics/alert-prefs')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPref(d.viewAlerts ?? 'all'); setAvailable(d.available !== false) } })
      .catch(() => {})
  }, [])

  async function choose(next: Pref) {
    if (next === pref || saving) return
    const before = pref
    setPref(next); setSaving(true); setNotice(null)
    try {
      const r = await fetch('/api/analytics/alert-prefs', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewAlerts: next }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setPref(before); setNotice({ ok: false, text: d.error || 'Could not save — try again.' }); return }
      setNotice({ ok: true, text: 'Saved.' })
    } catch {
      setPref(before); setNotice({ ok: false, text: 'Could not save — check your connection.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div id="view-alerts" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '18px 22px', marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', marginBottom: 4 }}>View alerts</div>
      <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-light)', marginBottom: 12 }}>
        When a client opens something you shared, we email you (and text you if your phone is saved). Your own previews never count.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {OPTIONS.map(o => (
          <label key={o.value} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', cursor: available ? 'pointer' : 'default', opacity: available ? 1 : 0.6 }}>
            <input
              type="radio"
              name="view-alerts"
              checked={pref === o.value}
              disabled={!available || saving}
              onChange={() => choose(o.value)}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ fontWeight: 600, fontSize: 'var(--fs-ui)' }}>{o.label}</span>
              <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--ink-light)' }}>{o.help}</span>
            </span>
          </label>
        ))}
      </div>
      {!available && (
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 10 }}>
          This setting isn’t switched on for your account yet. Until it is, you get one alert per viewer every 12 hours.
        </div>
      )}
      {notice && (
        <div role="status" style={{ fontSize: 'var(--fs-caption)', marginTop: 10, color: notice.ok ? 'var(--mint-darker)' : 'var(--error)' }}>{notice.text}</div>
      )}
    </div>
  )
}
