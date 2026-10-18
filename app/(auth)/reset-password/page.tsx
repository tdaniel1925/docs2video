'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../_lib/supabase/client'
import { updatePassword } from '../../_actions/auth'

// The new-password form a reset link lands on. It lives OUTSIDE the dashboard
// on purpose: the dashboard sends anyone who hasn't finished onboarding to
// /setup, which used to trap people who reset their password before finishing
// setup — they could never reach the form.
//
// Arrives with a session already set (via /auth/callback or /auth/confirm), or
// with tokens in the URL #fragment (links made by the server, e.g. new
// accounts created after an Apex purchase).
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<'checking' | 'ok' | 'no-session'>('checking')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const supabase = createClient()
      // getSession() first — it waits for the client to read any session out
      // of the URL itself.
      let { data: { session } } = await supabase.auth.getSession()
      if (!session && typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const access_token = hash.get('access_token')
        const refresh_token = hash.get('refresh_token')
        if (access_token && refresh_token) {
          const res = await supabase.auth.setSession({ access_token, refresh_token })
          session = res.data.session
        }
      }
      // Don't leave tokens sitting in the address bar / history.
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname)
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!cancelled) setReady(user ? 'ok' : 'no-session')
    }
    init().catch(() => { if (!cancelled) setReady('no-session') })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await updatePassword(new FormData(e.currentTarget))
    setLoading(false)
    if (result?.error) setError(result.error)
    else setDone(true)
  }

  if (ready === 'checking') {
    return (
      <>
        <h1>Set a new password</h1>
        <p className="auth-sub">Checking your reset link…</p>
      </>
    )
  }

  if (ready === 'no-session') {
    return (
      <>
        <h1>This link has expired</h1>
        <p className="auth-sub">
          Password reset links work once and expire after a while. Ask for a new one and use it from the same email.
        </p>
        <Link href="/forgot-password" className="btn btn-primary btn-lg btn-full" style={{ textAlign: 'center' }}>
          Send a new reset link &rarr;
        </Link>
        <div className="auth-foot">
          <Link href="/login">Back to login</Link>
        </div>
      </>
    )
  }

  if (done) {
    return (
      <>
        <h1>Password updated</h1>
        <p className="auth-sub">You&apos;re signed in with your new password.</p>
        <Link href="/dashboard" className="btn btn-primary btn-lg btn-full" style={{ textAlign: 'center' }}>
          Continue &rarr;
        </Link>
      </>
    )
  }

  return (
    <>
      <h1>Set a new password</h1>
      <p className="auth-sub">Choose a password with at least 8 characters.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="input-label" htmlFor="password">New password*</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="At least 8 characters" />
        </div>
        <div className="form-group">
          <label className="input-label" htmlFor="confirm_password">Confirm new password*</label>
          <input id="confirm_password" name="confirm_password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="Type it again" />
        </div>

        {error && (
          <div className="form-group" style={{ color: '#c0392b', fontSize: 14 }}>{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
          {loading ? 'Saving...' : 'Save new password →'}
        </button>
      </form>
    </>
  )
}
