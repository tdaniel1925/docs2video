'use client'

import { useEffect, useState } from 'react'
import { shortDate } from './library-items'

/**
 * A card's date, drawn the same on the server and in the browser first
 * (UTC), then switched to the person's own day once the page is awake.
 * Writing it straight in local time made the server's words and the
 * browser's words differ — React error #418 on every Library load for anyone
 * not on the server's clock (audit 2026-10-09).
 */
export default function LocalDate({ iso }: { iso: string }) {
  const [awake, setAwake] = useState(false)
  useEffect(() => { setAwake(true) }, [])
  return <time dateTime={iso}>{shortDate(iso, new Date(), awake ? undefined : 'UTC')}</time>
}
