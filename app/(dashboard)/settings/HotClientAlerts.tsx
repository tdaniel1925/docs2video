'use client'

import { useEffect, useState } from 'react'
import { BellRing, Mail, MessageSquare, Smartphone, BellOff } from 'lucide-react'
import { Button, Choices, Note } from '../../_components/kit'
import { TRIGGER_LABELS, HOT_TRIGGERS, normalizePhone, type AlertChannel, type AlertSettings, type HotTrigger } from '../../_lib/texting'

type Loaded = {
  available: boolean
  settings?: AlertSettings
  phoneDisplay?: string | null
  email?: string | null
  health?: { agentTexts: boolean; clientTexts: boolean; state: string; detail: string }
}

/**
 * "Tell me when a client is ready" — Settings → Email & sending.
 *
 * Hot-client alerts: a text and/or email the moment a client does something
 * that means "call me now" (watched to the end, came back, opened the PDF,
 * pressed Book a call). One per client per video per kind per day; none at
 * night (9pm–8am your time — they wait until 8am). Your own views never
 * count. Texts need your mobile confirmed once with a code.
 *
 * Every change saves straight away and says "Saved" only when it really did.
 */
export default function HotClientAlerts() {
  const [data, setData] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  // Mobile number check
  const [phoneText, setPhoneText] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [changingPhone, setChangingPhone] = useState(false)

  function load() {
    fetch('/api/texting/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Loaded) => { setData(d); setFailed(false) })
      .catch(() => setFailed(true))
  }
  useEffect(load, [])

  async function save(patch: { channel?: AlertChannel; triggers?: Partial<Record<HotTrigger, boolean>> }) {
    if (!data?.settings || saving) return
    const before = data.settings
    // Show the change at once; put it back if the save fails.
    setData({ ...data, settings: { ...before, ...(patch.channel ? { channel: patch.channel } : {}), triggers: { ...before.triggers, ...(patch.triggers ?? {}) } } })
    setSaving(true); setNotice(null)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const r = await fetch('/api/texting/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, timeZone: tz }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setData((cur) => (cur ? { ...cur, settings: before } : cur)); setNotice({ ok: false, text: d.error || 'That was NOT saved — try again.' }); return }
      setData((cur) => (cur ? { ...cur, settings: d.settings } : cur))
      setNotice({ ok: true, text: 'Saved.' })
    } catch {
      setData((cur) => (cur ? { ...cur, settings: before } : cur))
      setNotice({ ok: false, text: 'That was NOT saved — check your connection.' })
    } finally {
      setSaving(false)
    }
  }

  async function sendCode() {
    const phone = normalizePhone(phoneText)
    if (!phone) { setVerifyMsg({ ok: false, text: 'Enter your mobile number — 10 digits, like 512 555 0100.' }); return }
    setVerifyBusy(true); setVerifyMsg(null)
    try {
      const r = await fetch('/api/texting/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', phone }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setVerifyMsg({ ok: false, text: d.error || 'The code did NOT send. Try again.' }); return }
      setCodeSent(true); setCode('')
      setVerifyMsg({ ok: true, text: d.message || 'Code sent.' })
    } catch {
      setVerifyMsg({ ok: false, text: 'The code did NOT send — check your connection.' })
    } finally {
      setVerifyBusy(false)
    }
  }

  async function checkCode() {
    setVerifyBusy(true); setVerifyMsg(null)
    try {
      const r = await fetch('/api/texting/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', code }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setVerifyMsg({ ok: false, text: d.error || 'That didn’t work. Try again.' }); return }
      setVerifyMsg({ ok: true, text: d.message || 'Confirmed.' })
      setCodeSent(false); setChangingPhone(false); setPhoneText('')
      load()
    } catch {
      setVerifyMsg({ ok: false, text: 'Couldn’t check the code — check your connection.' })
    } finally {
      setVerifyBusy(false)
    }
  }

  const s = data?.settings
  const verified = !!s?.phoneVerified
  const textDown = data?.health && !data.health.agentTexts

  return (
    <div className="settings-card" id="hot-alerts">
      <h3>Tell me when a client is ready</h3>
      <p className="ssub">
        A text or email the moment a client does something that means “call me now”. At most one per client, per video, per kind, each day — and none between 9pm and 8am your time (those wait until 8am). Your own views never count.
      </p>

      {failed && <Note tone="warn">Couldn’t load this just now. Refresh the page to try again.</Note>}
      {!data && !failed && <p className="ssub">Loading…</p>}
      {data && !data.available && (
        <Note tone="info" title="Not switched on yet.">
          Client alerts are being set up for your account. Until then you still get the “someone watched” emails below.
        </Note>
      )}

      {data?.available && s && (
        <>
          <Choices<AlertChannel>
            legend="How should we tell you?"
            value={s.channel}
            onChange={(c) => save({ channel: c })}
            choices={[
              { value: 'text', label: 'Text', hint: verified ? `To ${data.phoneDisplay}.` : 'Confirm your mobile below first.', icon: <MessageSquare size={20} />, disabled: !verified || saving },
              { value: 'email', label: 'Email', hint: data.email ? `To ${data.email}.` : 'To your sign-in email.', icon: <Mail size={20} />, disabled: saving },
              { value: 'both', label: 'Text and email', hint: verified ? 'Both, at the same moment.' : 'Confirm your mobile below first.', icon: <BellRing size={20} />, disabled: !verified || saving },
              { value: 'off', label: 'Off', hint: 'No client-ready alerts.', icon: <BellOff size={20} />, disabled: saving },
            ]}
          />

          <fieldset className="hca-triggers" disabled={s.channel === 'off' || saving}>
            <legend className="kit-choices-legend">Tell me when they…</legend>
            {HOT_TRIGGERS.map((t) => (
              <label key={t} className="hca-check">
                <input type="checkbox" checked={s.triggers[t]} onChange={(e) => save({ triggers: { [t]: e.target.checked } })} />
                <span>
                  <span className="hca-check-label">{TRIGGER_LABELS[t].label}</span>
                  <span className="hca-check-hint">{TRIGGER_LABELS[t].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="hca-phone">
            <div className="kit-choices-legend hca-legend"><Smartphone size={16} aria-hidden="true" />Your mobile number</div>
            {verified && !changingPhone ? (
              <p className="ssub">
                <strong>{data.phoneDisplay}</strong> — confirmed.{' '}
                <button type="button" className="hca-link" onClick={() => { setChangingPhone(true); setVerifyMsg(null) }}>Change number</button>
              </p>
            ) : (
              <>
                <p className="ssub">We text a 6-digit code to check it’s yours. Free — it costs no credits.</p>
                {textDown && <Note tone="warn" className="hca-gap">Texts can’t be sent right now ({data.health!.detail}) — choose Email for now.</Note>}
                <div className="hca-row">
                  <input
                    className="input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-label="Your mobile number"
                    placeholder="e.g. (512) 555-0100"
                    value={phoneText}
                    onChange={(e) => { setPhoneText(e.target.value); setVerifyMsg(null) }}
                  />
                  <Button size="sm" variant="secondary" onClick={sendCode} disabled={verifyBusy || !!textDown}>{codeSent ? 'Send a new code' : 'Send code'}</Button>
                </div>
                {codeSent && (
                  <div className="hca-row hca-gap">
                    <input
                      className="input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="The 6-digit code"
                      placeholder="6-digit code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    />
                    <Button size="sm" onClick={checkCode} disabled={verifyBusy || code.length !== 6}>Confirm</Button>
                  </div>
                )}
              </>
            )}
            {verifyMsg && <div role="status" className={verifyMsg.ok ? 'hca-ok' : 'hca-err'}>{verifyMsg.text}</div>}
          </div>

          {notice && <div role="status" className={notice.ok ? 'hca-ok' : 'hca-err'}>{notice.text}</div>}
        </>
      )}
      <style>{HCA_CSS}</style>
    </div>
  )
}

const HCA_CSS = `
.hca-triggers { margin: 18px 0 0; padding: 0; border: 0; display: grid; gap: var(--space-2); }
.hca-triggers:disabled { opacity: 0.55; }
.hca-check { display: flex; gap: var(--space-3); align-items: flex-start; padding: 10px 12px; border: 1px solid var(--border-light); border-radius: 10px; background: var(--bg-card); cursor: pointer; }
.hca-check:has(input:focus-visible) { outline: 2px solid var(--link); outline-offset: 2px; }
.hca-check input { margin-top: 3px; width: 18px; height: 18px; accent-color: var(--accent-ink); flex-shrink: 0; }
.hca-check-label { display: block; font-size: var(--fs-ui); font-weight: 700; color: var(--ink); }
.hca-check-hint { display: block; font-size: var(--fs-small); color: var(--ink-soft); }
.hca-phone { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); }
.hca-legend { display: flex; align-items: center; gap: var(--space-2); }
.hca-row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.hca-row .input { flex: 1 1 200px; min-width: 0; }
.hca-gap { margin-top: 10px; }
.hca-link { background: none; border: none; padding: 0; font: inherit; font-weight: 600; color: var(--link); text-decoration: underline; cursor: pointer; }
.hca-ok { margin-top: 10px; font-size: var(--fs-small); color: var(--mint-darker); font-weight: 600; }
.hca-err { margin-top: 10px; font-size: var(--fs-small); color: var(--error-text); background: var(--error-bg); padding: 8px 10px; border-radius: 8px; }
`
