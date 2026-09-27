'use client'

import { useEffect, useState } from 'react'
import { greetingFor } from './derive'

/**
 * "Good morning, Jordan." — the time of day comes from the viewer's own
 * clock. The server runs in another timezone, so it renders a neutral
 * "Hello" and the browser swaps in the right greeting once it loads.
 */
export default function Greeting({ firstName, className }: { firstName: string | null; className?: string }) {
  const [hello, setHello] = useState('Hello')
  useEffect(() => { setHello(greetingFor(new Date().getHours())) }, [])
  return (
    <h1 className={className}>
      {hello}{firstName ? <>, <em>{firstName}.</em></> : '.'}
    </h1>
  )
}
