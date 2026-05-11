'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '../../_actions/auth'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await signup(formData)
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
      <h1>Create your account</h1>
      <p className="auth-sub">Get 10 free infographics. No card required.</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="input-label" htmlFor="full_name">Full Name</label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            className="input"
            placeholder="Jane Anderson"
          />
        </div>
        <div className="form-group">
          <label className="input-label" htmlFor="email">Email Address*</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input"
            placeholder="jane@agency.com"
          />
        </div>
        <div className="form-group">
          <label className="input-label" htmlFor="password">Password*</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="input"
            placeholder="At least 6 characters"
          />
        </div>

        {error && (
          <div className="form-group" style={{ color: '#c0392b', fontSize: 14 }}>{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
          {loading ? 'Creating account...' : 'Create account \u2192'}
        </button>
      </form>

      <div className="auth-foot">
        Already have an account?{' '}
        <Link href="/login">Sign in</Link>
      </div>
    </>
  )
}
