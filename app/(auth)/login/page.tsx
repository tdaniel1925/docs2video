'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login } from '../../_actions/auth'
import { useBrand } from '../../_components/BrandProvider'

// Messages for ?error= codes sent here by the email-link routes. Before, a
// failed confirmation or reset link dropped the user on a plain login form
// with no hint of what went wrong.
function linkErrorText(code: string): string {
  switch (code) {
    case 'otp_expired':
    case 'link_expired':
      return 'That email link has expired or was already used. Sign in below, or use “Forgot password?” to get a new link.'
    case 'auth_failed':
    default:
      return 'We couldn’t sign you in from that email link. It may have expired, or it was opened in a different browser than the one you signed up in. Sign in below, or use “Forgot password?” to get a new link.'
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const brand = useBrand()
  const searchParams = useSearchParams()
  const linkError = searchParams.get('error')
  const [formError, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const error = formError ?? (linkError ? linkErrorText(linkError) : null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('') // '' (not null) also hides the ?error= link message
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
        {/* Where to go after sign-in; the server only honors in-app paths. */}
        <input type="hidden" name="next" value={searchParams.get('next') ?? ''} />
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
