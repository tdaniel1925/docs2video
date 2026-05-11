'use client'

import { useState } from 'react'

const DEMO_VIDEO_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/7c22a559-ad5b-495e-8ebc-6839fdbc9b34.mp4'
const DEMO_THUMB_URL = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/7c22a559-ad5b-495e-8ebc-6839fdbc9b34_thumb.png'

export default function SharePagePreview() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-primary btn-lg"
      >
        See a live share page &rarr;
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(10, 22, 18, 0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}
          >
            &times;
          </button>

          {/* Share page mockup */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 800,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg)',
              borderRadius: 10,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header bar */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--mint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: 'var(--ink)',
                }}>HF</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Henderson Financial</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Prepared for Michael Chen</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-light)' }}>Shared via Docs2Video</div>
            </div>

            {/* Video player */}
            <div style={{ padding: '20px 24px' }}>
              <video
                src={DEMO_VIDEO_URL}
                poster={DEMO_THUMB_URL}
                controls
                playsInline
                style={{ width: '100%', borderRadius: 10, display: 'block', background: '#000' }}
              />
            </div>

            {/* Key metrics */}
            <div style={{ padding: '0 24px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Key Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-light)', fontWeight: 700 }}>Policy Type</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>IUL</div>
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-light)', fontWeight: 700 }}>Death Benefit</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>$500,000</div>
                </div>
                <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-light)', fontWeight: 700 }}>Premium</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>$4,200/yr</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
              <button style={{
                flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                background: 'var(--mint)', color: 'var(--ink)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign:'-2px',marginRight:6}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Book a Meeting
              </button>
              <button style={{
                flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
                background: 'var(--ink)', color: 'white',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign:'-2px',marginRight:6}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Ask AI Questions
              </button>
              <button style={{
                flex: 1, padding: '14px 0', borderRadius: 10,
                border: '2px solid var(--mint)', background: 'transparent',
                color: 'var(--ink)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{verticalAlign:'-2px',marginRight:6}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Accept &amp; Pay
              </button>
            </div>

            {/* AI Chat preview */}
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{
                background: 'var(--surface)', borderRadius: 10,
                border: '1px solid var(--border)', padding: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2" style={{verticalAlign:'-2px',marginRight:6}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  AI Assistant
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ alignSelf: 'flex-end', background: 'var(--ink)', color: 'white', padding: '8px 12px', borderRadius: '10px 10px 2px 10px', fontSize: 13, maxWidth: '70%' }}>
                    What does the guaranteed cash value look like at year 20?
                  </div>
                  <div style={{ alignSelf: 'flex-start', background: 'var(--mint)', color: 'var(--ink)', padding: '8px 12px', borderRadius: '10px 10px 10px 2px', fontSize: 13, maxWidth: '70%' }}>
                    At year 20, your guaranteed cash value would be $42,800. The current illustrated value is projected at $68,500 based on today&apos;s rates.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--ink-light)' }}>
                    Ask a question about this document...
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--border)',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--ink-light)',
            }}>
              Powered by Docs2Video
            </div>
          </div>
        </div>
      )}
    </>
  )
}
