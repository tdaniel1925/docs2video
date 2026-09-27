'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'

// Last-resort error page: shown when the ROOT layout itself fails, so nothing
// from it is available — no globals.css, no brand context, no fonts. It must
// render its own <html>/<body> and carry its own styles. Colours mirror the
// :root tokens in globals.css. Friendly copy only; never the error or stack.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <meta name="robots" content="noindex" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body
        style={{
          margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '64px 16px', boxSizing: 'border-box', background: '#F0F4F8',
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif", color: '#002B63',
        }}
      >
        <div
          style={{
            maxWidth: 520, width: '100%', textAlign: 'center', background: '#FFFFFF',
            border: '1px solid #E8EDF2', borderRadius: 10, padding: '40px 28px',
            boxShadow: '0 4px 16px rgba(27,58,92,0.08)', boxSizing: 'border-box',
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            Something went <em style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>wrong</em>
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#2A4A77', margin: '0 0 24px' }}>
            We couldn&apos;t load this page. Please try again in a moment. If it keeps happening,
            email <a href="mailto:support@docs2video.com" style={{ color: '#002B63', fontWeight: 700 }}>support@docs2video.com</a>.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{
                padding: '12px 22px', borderRadius: 10, border: 'none', background: '#002B63',
                color: '#FFFFFF', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Try again
            </button>
            {/* A plain <a>, not next/link: the router may be the thing that broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: '12px 22px', borderRadius: 10, border: '1px solid #D4DCE4', background: '#FFFFFF',
                color: '#002B63', fontSize: 15, fontWeight: 700, textDecoration: 'none',
              }}
            >
              Go to the homepage
            </a>
          </div>
          {error.digest && (
            <p style={{ fontSize: 12, color: '#6B84A3', marginTop: 20, marginBottom: 0 }}>
              Reference code: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
