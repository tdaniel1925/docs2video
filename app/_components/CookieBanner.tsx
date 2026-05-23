'use client'

import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('cookie_consent')) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#1B365D',
      color: '#fff',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      fontSize: 14,
      fontFamily: 'inherit',
    }}>
      <span>We use essential cookies to keep you logged in. No tracking cookies.</span>
      <button
        onClick={accept}
        style={{
          background: '#C7E8A8',
          color: '#1B365D',
          border: 'none',
          borderRadius: 8,
          padding: '8px 20px',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Got it
      </button>
    </div>
  )
}
