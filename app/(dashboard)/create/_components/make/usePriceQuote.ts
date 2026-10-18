'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PriceQuoteResponse } from '../../../../_lib/price-quote'

/**
 * The server's price for this project, from /api/price-quote — worked out by
 * the SAME functions that charge. There is deliberately no price in the
 * browser: until the quote arrives the screen shows "…", never a guess.
 */
export function usePriceQuote(videoId: string | null) {
  const [quote, setQuote] = useState<PriceQuoteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!videoId)

  /** Re-reads the quote; resolves to the fresh one (or null if it failed). */
  const refresh = useCallback(async (): Promise<PriceQuoteResponse | null> => {
    if (!videoId) return null
    setLoading(true)
    try {
      const res = await fetch(`/api/price-quote?videoId=${encodeURIComponent(videoId)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'We couldn’t work out the price just now.')
      setQuote(data as PriceQuoteResponse)
      setError(null)
      return data as PriceQuoteResponse
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t work out the price just now.')
      return null
    } finally {
      setLoading(false)
    }
  }, [videoId])

  useEffect(() => { void refresh() }, [refresh])

  return { quote, error, loading, refresh }
}

export function formatCredits(n: number): string {
  return `${n.toLocaleString('en-US')} credit${n === 1 ? '' : 's'}`
}
