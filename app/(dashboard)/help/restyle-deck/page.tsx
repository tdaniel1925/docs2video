'use client'

import Link from 'next/link'

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 15, flexShrink: 0,
}
const step: React.CSSProperties = { display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-start' }
const body: React.CSSProperties = { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }
const note: React.CSSProperties = {
  background: 'var(--cream)', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '14px 16px', margin: '16px 0', fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6,
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={step}>
      <div style={STEP_CIRCLE}>{n}</div>
      <div>
        <h3 style={{ margin: '4px 0 8px', fontSize: 18, color: 'var(--ink)' }}>{title}</h3>
        <div style={body}>{children}</div>
      </div>
    </div>
  )
}

export default function RestyleDeckHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Help Center</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Restyle a Deck</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 30, color: 'var(--ink)', margin: '0 0 8px' }}>Restyle a slide deck</h1>
        <p style={{ ...body, fontSize: 16 }}>
          Upload a PowerPoint or PDF you already have. We read it slide by slide, keep your words, and redraw every
          slide in a brand-new look you pick. You get back a matching set of slides — and a single PDF of the whole deck.
        </p>
      </div>

      <Step n={1} title="Choose “A slide deck”, then upload">
        Start a new design, pick <strong>A slide deck</strong>, and choose <strong>Restyle a deck you already have</strong>.
        Drop in a <strong>.pptx</strong> or <strong>PDF</strong>. We read it and show you a list: “We found 12 slides.”
      </Step>

      <Step n={2} title="Check the slides we found">
        Every slide is listed in order, with its title and points. Remove any you don’t want with the × button.
        <div style={note}>
          If a slide is just a <strong>picture with no text</strong> (a scanned page, or a chart saved as an image), we
          can’t restyle it from its words — we’ll flag it and skip it, so you never get a blank slide.
        </div>
      </Step>

      <Step n={3} title="Pick the new look">
        Choose one of our styles, or drop in a design whose <em>style</em> you like. Your logo goes on if you add one.
        The deck skips the “what should it say” step — your words already came from the file.
      </Step>

      <Step n={4} title="Review and start">
        You’ll see how many slides will be restyled and what it costs (one credit-charge per slide), all at 16:9 slide
        size. Press <strong>Start designing</strong> and watch the progress — “slide 3 of 12”.
      </Step>

      <Step n={5} title="Download, share, or fix any slide">
        When it’s done you get every slide to download, a <strong>Download as PDF</strong> of the whole deck, a share
        button, and the <strong>Edit a part</strong> tool to repaint just one region of any slide.
      </Step>

      <div style={note}>
        <strong>Good to know.</strong> You get slide <em>images</em> and a PDF, not an editable PowerPoint file. Cost and
        time grow with the number of slides — a 30-slide deck is 30 designs, so it takes a few minutes.
      </div>
    </div>
  )
}
