'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resetPassword } from '../../_actions/auth'

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
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
