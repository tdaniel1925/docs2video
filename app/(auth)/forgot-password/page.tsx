'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { resetPassword } from '../../_actions/auth'

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  )
}

function ForgotPasswordForm() {
  // A reset link that failed (expired, used twice, or opened in a different
  // browser than the one that asked for it) is sent back here with ?error=.
  const linkFailed = !!useSearchParams().get('error')
  const [formError, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const error = formError ?? (linkFailed
    ? 'That reset link has expired or was already used. Enter your email to get a new one, and open it in this same browser.'
    : null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('') // '' (not null) also hides the ?error= link message
    const formData = new FormData(e.currentTarget)
    const result = await resetPassword(formData)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.success)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <>
        <h1>Check Your Email</h1>
        <p className="auth-sub">{success}</p>
        <div className="auth-foot">
          <Link href="/login">Back to login</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h1>Reset password</h1>
      <p className="auth-sub">Enter your email and we&apos;ll send you a reset link.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="input-label" htmlFor="email">Email Address*</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input"
            placeholder="you@email.com"
          />
        </div>

        {error && (
          <div className="form-group" style={{ color: '#c0392b', fontSize: 14 }}>{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
          {loading ? 'Sending...' : 'Send Reset Link \u2192'}
        </button>
      </form>

      <div className="auth-foot">
        <Link href="/login">Back to login</Link>
      </div>
    </>
  )
}
