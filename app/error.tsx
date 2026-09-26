'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import { useBrand } from './_components/BrandProvider'

// Branded "something went wrong" page for any crash below the root layout.
// Friendly copy only — never the error message or stack (server errors arrive
// here scrubbed anyway; the digest is shown as a reference code so support can
// match it to the server log).
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const brand = useBrand()

  useEffect(() => {
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <main
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '64px 16px', background: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 520, width: '100%', textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 10, padding: '40px 28px', boxShadow: 'var(--shadow)',
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px' }}>
          Something went <em style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>wrong</em>
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '0 0 24px' }}>
          This page hit a problem on our side. Try again, or head back to your
          {brand.id === 'text2art' ? ' designs' : ' dashboard'}. If it keeps happening, email{' '}
          <a href="mailto:support@docs2video.com" style={{ color: 'var(--ink)', fontWeight: 700 }}>support@docs2video.com</a>.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => unstable_retry()} className="btn btn-primary">
            Try again
          </button>
          <Link href={brand.home} className="btn btn-soft">
            Go to my {brand.id === 'text2art' ? 'designs' : 'dashboard'}
          </Link>
        </div>
        {error.digest && (
          <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 20, marginBottom: 0 }}>
            Reference code: {error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
