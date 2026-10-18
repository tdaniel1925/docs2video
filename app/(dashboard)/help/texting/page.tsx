'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { CREDIT_COSTS } from '../../../_lib/credits'
import { CLIENT_TEXT_DAILY_CAP, ALERT_TEXT_DAILY_CAP } from '../../../_lib/texting'
import { TEXTING_ON } from '../../../_lib/texting-switch'

// TEXTING AND ALERTS — hot-client alerts (Settings → Email & sending) and
// Send by text (the Text tab on a finished project's send panel). Written from
// the screens' own words (settings/HotClientAlerts.tsx, videos/[id]/send/
// SendByText.tsx). Update with the screens.

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '28px 32px', marginBottom: 20 }
const h2: React.CSSProperties = { fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const body: React.CSSProperties = { fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }
const B = ({ children }: { children: ReactNode }) => <strong style={{ color: 'var(--ink)' }}>{children}</strong>
const price = CREDIT_COSTS['client-text'].toLocaleString('en-US')

export default function TextingHelpPage() {
  // Switched off for now (texting-switch.ts): say so instead of describing screens that are hidden.
  if (!TEXTING_ON) return <div style={{ padding: 32 }}><h1>Texting is switched off for now</h1><p>Send videos by email or copy the link. You still get an email when a client watches. <Link href="/help">Back to help</Link></p></div>
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Help Center</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Texting and alerts</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Texting and alerts</h1>
          <p>Two things: we can tell YOU the moment a client is ready to talk, and you can send a video to a client by text instead of email.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Get told when a client is ready</h2>
        <ol style={{ ...body, paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 10 }}>Open <B>Settings</B> and pick <B>Email &amp; sending</B>. Find the box <B>Tell me when a client is ready</B>.</li>
          <li style={{ marginBottom: 10 }}>Want texts? Under <B>Your mobile number</B>, type your cell number and press <B>Send code</B>. A text with a 6-digit code arrives. Type it in and press <B>Confirm</B>. You see your number with <B>confirmed</B> next to it. This is free.</li>
          <li style={{ marginBottom: 10 }}>Under <B>How should we tell you?</B> pick <B>Text</B>, <B>Email</B>, <B>Text and email</B> or <B>Off</B>. It saves straight away and says <B>Saved.</B></li>
          <li>Under <B>Tell me when they…</B> tick the moments that matter to you: <B>Watched to the end</B>, <B>Came back a second time</B>, <B>Opened the PDF</B>, <B>Pressed Book a call</B>.</li>
        </ol>
        <div style={{ ...body, marginTop: 16 }}>
          <p style={{ marginBottom: 10 }}>An alert looks like: <em>“Maria watched “Your coverage” to the end, twice. Call now?”</em> with her number (if you texted her) and a link to the video’s page.</p>
          <p style={{ marginBottom: 10 }}><B>No flood:</B> at most one alert per client, per video, per kind of moment, each day — and no more than {ALERT_TEXT_DAILY_CAP} alert texts a day in total (after that they come by email).</p>
          <p style={{ marginBottom: 10 }}><B>No night texts:</B> between 9pm and 8am (your time, from your computer’s clock) alerts wait, and arrive at 8am.</p>
          <p><B>Your own views never count</B> — check your share page as often as you like. Alerts cost no credits.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Send a video by text</h2>
        <ol style={{ ...body, paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 10 }}>Open the finished video from your Library. In <B>Ready to send</B>, press the <B>Text</B> tab (next to <B>Email</B>).</li>
          <li style={{ marginBottom: 10 }}>Write <B>A short note</B> if you like — a short one goes into the text too.</li>
          <li style={{ marginBottom: 10 }}>Type their <B>Client mobile number</B>. US numbers can be typed any way; other countries start with +. If the client has a phone number saved, it is filled in for you.</li>
          <li style={{ marginBottom: 10 }}>Look at <B>What they get</B>: the real text, with your name, the link to their page and “Reply STOP to opt out.” On US and Canadian phones it comes with the video’s picture.</li>
          <li style={{ marginBottom: 10 }}>Tick <B>This client agreed to get texts from me</B>. You only do this once per number — we remember it.</li>
          <li>Press the button (it shows the price: {price} credits a text). A green line says <B>Texted to</B> their number.</li>
        </ol>
        <div style={{ ...body, marginTop: 16 }}>
          <p style={{ marginBottom: 10 }}><B>If it doesn’t go through</B> (a wrong number, a phone that can’t get texts) your credits come back by themselves.</p>
          <p style={{ marginBottom: 10 }}><B>Who watched</B> lists texts like emails (“Texted …”) and how far they got. When a client texts back, the reply shows under <B>Text replies</B> with a <B>Call back</B> link, and we pass it on to you the same way as your alerts.</p>
          <p style={{ marginBottom: 10 }}><B>If they reply STOP</B> they get no more texts from you, and the Text tab says so. If they text START, they can be texted again.</p>
          <p>You need a card on file to send texts, and you can send up to {CLIENT_TEXT_DAILY_CAP} a day (3 a day to the same person).</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>“Texting clients isn’t switched on yet”</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>Phone carriers only deliver business texts from numbers that are registered with them. Until our texting number is approved, the Text tab shows this note and you can send by email or copy the link instead. Alerts to your own phone may still work.</p>
          <p>Don’t see the <B>Text</B> tab or the alerts box at all? Texting isn’t turned on for your account yet. Your emails and “someone watched” alerts work as before.</p>
        </div>
      </div>
    </div>
  )
}
