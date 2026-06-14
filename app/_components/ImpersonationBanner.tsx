'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../_lib/supabase/client'

const IMP_COOKIE = 'd2v_impersonating'

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * Persistent banner shown while an admin is impersonating a user. Exit signs
 * out of the impersonated session and clears the cookie, returning the admin to
 * the login screen (where they sign back into their own account).
 */
export default function ImpersonationBanner() {
  const [email, setEmail] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    setEmail(readCookie(IMP_COOKIE))
  }, [])

  if (!email) return null

  async function exit() {
    setExiting(true)
    try {
      await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'exit' }),
      }).catch(() => {})
      const supabase = createClient()
      await supabase.auth.signOut().catch(() => {})
      window.location.href = '/login'
    } finally {
      setExiting(false)
    }
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      background: '#7c2d12', color: '#fff', padding: '8px 16px',
      fontSize: 13, fontWeight: 600,
    }}>
      <span>⚠ Impersonating <strong>{email}</strong> — actions affect their account.</span>
      <button
        onClick={exit}
        disabled={exiting}
        style={{
          background: '#fff', color: '#7c2d12', border: 'none', borderRadius: 8,
          padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {exiting ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  )
}
