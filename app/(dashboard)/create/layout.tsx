'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const STEPS = [
  { path: '/create', label: 'Create' },
  { path: '/create/generating', label: 'Build' },
]

// Steps for advanced flow (edit script first)
const ADVANCED_STEPS = [
  { path: '/create', label: 'Goal' },
  { path: '/create/source', label: 'Content' },
  { path: '/create/styling', label: 'Style' },
  { path: '/create/review', label: 'Review' },
  { path: '/create/script', label: 'Script' },
  { path: '/create/options', label: 'Options' },
  { path: '/create/generating', label: 'Build' },
]

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Detect if user is in the advanced flow (source/review/script/options pages)
  const isAdvancedFlow = ['/create/source', '/create/extracting', '/create/styling', '/create/review', '/create/script', '/create/options'].some(p => pathname === p)
  const steps = isAdvancedFlow ? ADVANCED_STEPS : STEPS

  // Map extracting to Content step (it's part of that flow)
  const effectivePath = pathname === '/create/extracting' ? '/create/source' : pathname
  const currentIdx = steps.findIndex(s => effectivePath === s.path || effectivePath?.startsWith(s.path + '/'))
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  // Hide step bar on generating and extracting pages
  const isGenerating = pathname === '/create/generating'
  const isExtracting = pathname === '/create/extracting'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isGenerating && !isExtracting && (
        <div style={{
          padding: '20px 32px 0',
          maxWidth: 900,
          width: '100%',
          margin: '0 auto',
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {steps.map((step, i) => (
              <div key={step.path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: i <= activeIdx ? 32 : 10,
                  height: 10,
                  borderRadius: 5,
                  background: i < activeIdx ? 'var(--mint)' : i === activeIdx ? 'var(--ink)' : 'var(--border)',
                  transition: 'all 0.4s ease',
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-light)', fontWeight: 600, letterSpacing: '0.05em' }}>
              STEP {activeIdx + 1} OF {steps.length} &mdash; {steps[activeIdx]?.label.toUpperCase()}
            </div>
            <SaveForLater />
          </div>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

function SaveForLater() {
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  function handleSave() {
    if (!name.trim()) return
    const state = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    const drafts = JSON.parse(localStorage.getItem('d2v_drafts') || '[]')
    drafts.push({
      id: Date.now().toString(),
      name: name.trim(),
      state,
      savedAt: new Date().toISOString(),
    })
    localStorage.setItem('d2v_drafts', JSON.stringify(drafts))
    localStorage.removeItem('d2v_create')
    setSaved(true)
    setTimeout(() => router.push('/dashboard'), 1000)
  }

  if (saved) {
    return <span style={{ fontSize: 12, color: 'var(--mint-darker, #2d7a4f)', fontWeight: 600 }}>&#10003; Saved!</span>
  }

  return (
    <>
      <button
        onClick={() => setShow(true)}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 8,
          padding: '4px 12px', fontSize: 12, fontWeight: 600, color: 'var(--ink-light)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Save for later
      </button>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShow(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: 'white', borderRadius: 16, padding: 28,
            maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Save this draft</h3>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>Give it a name so you can find it later.</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="e.g. Teachers Pension sales video"
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 10, border: '2px solid var(--border)',
                fontSize: 15, fontFamily: 'inherit', outline: 'none', marginBottom: 16,
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShow(false)} style={{
                padding: '12px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-soft)', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={handleSave} disabled={!name.trim()} style={{
                flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
                background: name.trim() ? 'var(--ink)' : 'var(--border)', color: 'white',
                fontSize: 14, fontWeight: 700, cursor: name.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
              }}>Save &amp; exit</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
