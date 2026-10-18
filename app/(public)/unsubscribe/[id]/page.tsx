'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function UnsubscribePage() {
  const params = useParams()
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [brandName, setBrandName] = useState<string | null>(null)

  useEffect(() => {
    async function unsub() {
      const contactId = params.id as string
      try {
        // Server endpoint (service role) — anon can no longer write this table.
        const res = await fetch(`/api/public/unsubscribe/${contactId}`, { method: 'POST' })
        if (res.ok) {
          const body = await res.json().catch(() => null)
          setBrandName(body?.brand?.name ?? null)
        }
        setStatus(res.ok ? 'done' : 'error')
      } catch {
        setStatus('error')
      }
    }
    unsub()
  }, [params.id])

  return (
    <section className="hp-lone" aria-live="polite">
      {status === 'loading' && (
        <>
          <h1 className="hp-h3">Processing…</h1>
          <p className="hp-soft">Please wait while we update your preferences.</p>
        </>
      )}
      {status === 'done' && (
        <>
          <h1 className="hp-h2">Unsub<span className="hp-blue">scribed</span></h1>
          <p className="hp-soft hp-measure">You have been unsubscribed. You will not receive any more emails from this campaign.</p>
        </>
      )}
      {status === 'error' && (
        <>
          <h1 className="hp-h3">Something went <span className="hp-blue">wrong</span></h1>
          <p className="hp-soft hp-measure">We could not process your request. Please try again or <a href="/contact">contact support</a>.</p>
        </>
      )}
      {brandName && <span className="hp-small">{brandName}</span>}
    </section>
  )
}
