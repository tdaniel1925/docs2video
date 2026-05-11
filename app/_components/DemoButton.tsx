'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import DemoForm from './DemoForm'

export default function DemoButton() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      // Hide all videos so they don't render above the modal
      document.querySelectorAll('video').forEach(v => {
        (v as HTMLElement).style.visibility = 'hidden'
      })
    } else {
      document.body.style.overflow = ''
      document.querySelectorAll('video').forEach(v => {
        (v as HTMLElement).style.visibility = ''
      })
    }
    return () => {
      document.body.style.overflow = ''
      document.querySelectorAll('video').forEach(v => {
        (v as HTMLElement).style.visibility = ''
      })
    }
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  const modal = open ? (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(27,58,92,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 700,
          background: 'var(--bg)', borderRadius: 10,
          padding: '36px 32px', position: 'relative',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <button
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--border)', border: 'none',
            color: 'var(--ink)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}
        >
          &times;
        </button>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
          See it in action
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 24 }}>
          Enter your info and we&apos;ll generate a free branded demo video for your company
        </p>
        <DemoForm />
      </div>
    </div>
  ) : null

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary btn-lg">
        Try a free demo &rarr;
      </button>
      {mounted && modal && createPortal(modal, document.body)}
    </>
  )
}
