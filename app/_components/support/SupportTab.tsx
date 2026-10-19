'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { OPEN_HELP_EVENT } from '../../_lib/top-bar'
import type { ReportStatus, StatusStep } from '../../_lib/support/report-rules'
import { capturedLogs, installCapture } from './capture'

/*
 * "SOMETHING NOT WORKING?" — the slide-out tab on every signed-in screen
 * (owner, 2026-10-19; the approved help-tab mockup). One sentence from the
 * person; the page, the browser, the app's recent errors and, if the box
 * stays ticked, a screenshot go with it. Then the panel shows each step as
 * it happens: got it → found the cause → fixing it → checked → fixed and
 * live. A how-to question is handed to the help assistant instead.
 */

type Report = { ref: string; status: ReportStatus; headline: string; steps: StatusStep[] }
type View = 'closed' | 'form' | 'tracking'

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const FINAL: ReportStatus[] = ['fixed', 'answered']

export default function SupportTab() {
  const pathname = usePathname() ?? ''
  const search = useSearchParams()
  const [view, setView] = useState<View>('closed')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [withShot, setWithShot] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const tabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { installCapture() }, [])

  // A report sent in the last week opens straight to its progress.
  useEffect(() => {
    fetch('/api/support/report').then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.report) setReport(d.report as Report)
    }).catch(() => { /* the tab still works */ })
  }, [])

  // While the panel is open on a report that is still moving, check on it.
  useEffect(() => {
    if (view !== 'tracking' || !report || FINAL.includes(report.status)) return
    const t = window.setInterval(() => {
      fetch(`/api/support/report?ref=${report.ref}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (d?.report) setReport(d.report as Report)
      }).catch(() => {})
    }, 15000)
    return () => window.clearInterval(t)
  }, [view, report])

  const open = useCallback(() => {
    setError(null)
    setView(report && !FINAL.includes(report.status) ? 'tracking' : 'form')
  }, [report])
  const close = useCallback(() => { setView('closed'); window.setTimeout(() => tabRef.current?.focus(), 0) }, [])

  useEffect(() => {
    if (view === 'closed') return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, close])

  const videoId = (search?.get('id') && UUID_RE.test(search.get('id')!) ? search.get('id') : pathname.match(UUID_RE)?.[0]) ?? null

  async function send() {
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const screenshot = withShot ? await snap() : null
      const res = await fetch('/api/support/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description, steps: steps || null,
          pageUrl: window.location.pathname + window.location.search,
          browser: navigator.userAgent,
          videoId, screenshot,
          ...capturedLogs(),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.report) { setError(d.error || 'We couldn’t send that. Please try again in a minute.'); return }
      setReport(d.report as Report)
      setDescription(''); setSteps('')
      setView('tracking')
    } finally {
      setSending(false)
    }
  }

  function askAssistant() {
    const asked = report ? lastAsked.current : ''
    window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT, { detail: { ask: asked } }))
    close()
  }
  // What the person asked, kept for the hand-off to the help assistant.
  const lastAsked = useRef('')
  useEffect(() => { if (description) lastAsked.current = description }, [description])

  return (
    <>
      {view === 'closed' ? (
        <button ref={tabRef} type="button" className="sup-tab" onClick={open} data-testid="support-tab">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
          <span className="sup-tab-long">Something not working?</span>
          <span className="sup-tab-short">Not working?</span>
        </button>
      ) : (
        <>
          <div className="sup-scrim" onClick={close} aria-hidden="true" />
          <aside className="sup-panel" role="dialog" aria-modal="true" aria-label="Something not working?" data-support-panel="1">
            <div className="sup-head">
              <span className="sup-label">Something not working?</span>
              <button ref={closeRef} type="button" className="sup-x" onClick={close} aria-label="Close">✕</button>
            </div>

            {view === 'form' ? (
              <form className="sup-body" onSubmit={(e) => { e.preventDefault(); void send() }}>
                <h2 className="sup-title">Tell us in a sentence.</h2>
                <p className="sup-lede">You’ll see each step here, and we’ll email you when it’s fixed.</p>
                <label className="sup-field">
                  <span>What happened?</span>
                  <textarea id="sup-what" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. I pressed Free preview on the Look step and it said it didn’t load." required />
                </label>
                <label className="sup-field">
                  <span>What did you do just before? <small>(optional)</small></span>
                  <textarea id="sup-steps" rows={2} value={steps} onChange={(e) => setSteps(e.target.value)} />
                </label>
                <div className="sup-sent">
                  <span className="sup-label">Sent with it, so you don’t have to explain</span>
                  <label className="sup-check"><input id="sup-shot" type="checkbox" checked={withShot} onChange={(e) => setWithShot(e.target.checked)} /> A screenshot of this page</label>
                  <span>✓ Where you were{videoId ? ' and which video' : ''}</span>
                  <span>✓ The errors the app logged just now</span>
                  <span className="sup-fine">Emails, phone numbers and keys are removed from the logs. The screenshot shows this page as you see it — untick it if anything private is on screen.</span>
                </div>
                {error ? <p className="sup-error" role="alert">{error}</p> : null}
                <button type="submit" className="sup-send" disabled={sending || description.trim().length < 12}>{sending ? 'Sending…' : 'Send it'}</button>
              </form>
            ) : report ? (
              <div className="sup-body" aria-live="polite">
                <h2 className="sup-title">{report.headline}</h2>
                <p className="sup-lede">Report <b>#{report.ref}</b></p>
                <ol className="sup-steps">
                  {report.steps.map((s) => (
                    <li key={s.title} className={`sup-step is-${s.state}`}>
                      <span className="sup-dot" aria-hidden="true">{s.state === 'done' ? '✓' : ''}</span>
                      <span><b>{s.title}</b><br /><span className="sup-detail">{s.detail}</span></span>
                    </li>
                  ))}
                </ol>
                {report.status === 'answered' ? (
                  <button type="button" className="sup-send" onClick={askAssistant}>Ask the help assistant</button>
                ) : null}
                {report.status !== 'fixed' && report.status !== 'answered' ? (
                  <p className="sup-fine">If a fix touches payments, sign-in or your data, a person checks it before it goes live.</p>
                ) : null}
                <button type="button" className="sup-ghost" onClick={() => { setError(null); setView('form') }}>Report something else</button>
              </div>
            ) : null}
          </aside>
        </>
      )}
    </>
  )
}

/** A small JPEG of the page, without this panel. Too big, or failed → none. */
async function snap(): Promise<string | null> {
  try {
    const { domToJpeg } = await import('modern-screenshot')
    const filter = (n: Node) => !(n instanceof HTMLElement && (n.dataset.supportPanel === '1' || n.classList.contains('sup-scrim')))
    for (const scale of [0.5, 0.3]) {
      const url = await domToJpeg(document.body, { scale, quality: 0.6, filter, height: Math.min(document.body.scrollHeight, 2400) })
      if (url.length <= 420_000) return url
    }
  } catch { /* no screenshot */ }
  return null
}
