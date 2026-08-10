'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '../../_actions/auth'
import { useBrand } from '../../_components/BrandProvider'

export default function LoginPage() {
  const brand = useBrand()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <>
      <h1>Sign in</h1>
      <p className="auth-sub">Welcome back to {brand.name}.</p>

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
        <div className="form-group">
          <label className="input-label" htmlFor="password">Password*</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="input"
            placeholder="Enter password"
          />
        </div>

        <div className="auth-row">
          <span></span>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>

        {error && (
          <div className="form-group" style={{ color: '#c0392b', fontSize: 14 }}>{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
          {loading ? 'Signing in...' : 'Login now \u2192'}
        </button>
      </form>

      <div className="auth-foot">
        Don&apos;t have an account?{' '}
        <Link href="/signup">Create an account</Link>
      </div>
    </>
  )
}
