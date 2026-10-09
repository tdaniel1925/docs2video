'use client'

import Link from 'next/link'
import { CREDIT_COSTS } from '../../../_lib/credits'
import { NAMES } from '../../../_lib/names'

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 'var(--fs-body)', flexShrink: 0,
}
const step: React.CSSProperties = { display: 'flex', gap: 'var(--space-4)', marginBottom: 28, alignItems: 'flex-start' }
const body: React.CSSProperties = { fontSize: 'var(--fs-body)', color: 'var(--ink-soft)', lineHeight: 1.6 }
const note: React.CSSProperties = {
  background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '14px 16px', margin: '16px 0', fontSize: 'var(--fs-body)', color: 'var(--ink-soft)', lineHeight: 1.6,
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={step}>
      <div style={STEP_CIRCLE}>{n}</div>
      <div>
        <h3 style={{ margin: '4px 0 8px', fontSize: 'var(--fs-lead)', color: 'var(--ink)' }}>{title}</h3>
        <div style={body}>{children}</div>
      </div>
    </div>
  )
}

export default function RestyleDeckHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Help Center</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Restyle a Deck</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'var(--fs-h2)', color: 'var(--ink)', margin: '0 0 8px' }}>Restyle a slide deck</h1>
        <p style={{ ...body, fontSize: 'var(--fs-body)' }}>
          Upload a PowerPoint or PDF you already have. We read it slide by slide, keep your words, and redraw every
          slide in a brand-new look you pick. You get back a matching set of slides — and a single PDF of the whole deck.
        </p>
      </div>

      <Step n={1} title="Choose “A slide deck”, then upload">
        Open Custom Graphics (<strong>{NAMES.newButton}</strong>, then <strong>Custom graphics</strong> under <strong>Making something else?</strong>) and tap <strong>A slide deck</strong>.
        On the <strong>Content</strong> step, find the box called <strong>Already have a deck? Upload it instead</strong>.
        Drop in a <strong>.pptx</strong> or <strong>PDF</strong> (up to 40MB). While it reads, you’ll see “Reading your deck…”,
        then a list of the slides it found.
      </Step>

      <Step n={2} title="Check the slides we found">
        Every slide is listed in order, with its title and points. Remove any you don’t want with the × button. Picked
        the wrong file? Click <strong>Use a different deck</strong>.
        <div style={note}>
          If a slide is just a <strong>picture with no text</strong> (a scanned page, or a chart saved as an image), it’s
          marked <strong>Picture slide (no text — will be skipped)</strong>. We can’t restyle it from its words, so we skip
          it rather than give you a blank slide.
        </div>
      </Step>

      <Step n={3} title="Pick the new look">
        On the <strong>Style</strong> step, choose one of our styles, drop in a design whose <em>style</em> you like, or match
        a website’s brand. Your logo goes on if you add one. Then press <strong>Next: review</strong> — decks skip the Sizes
        step, because every slide is made at widescreen (16:9) size.
      </Step>

      <Step n={4} title="Review and start">
        The Review step shows how many slides will be restyled and what it costs ({CREDIT_COSTS.flyer.toLocaleString('en-US')} credits per slide — each slide is one design). Press{' '}
        <strong>Start designing</strong> and watch the progress — for example “Restyling your deck — 3 of 12 slides”.
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
