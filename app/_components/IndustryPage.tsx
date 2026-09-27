import Link from 'next/link'
import type { Metadata } from 'next'
import ClickToPlayVideo from './ClickToPlayVideo'
import { INDUSTRIES } from '../_lib/industries'
import { INDUSTRY_PAGES, type IndustryPageCopy } from '../_lib/industry-pages'
import { PLANS } from '../_lib/pricing'

/*
 * One template for every /for/<industry> page. The copy lives in
 * _lib/industry-pages.ts; wording, disclaimers and prices come from the
 * product's own config (industries.ts, pricing.ts) so the page can only
 * say what the product actually does. No stats, testimonials or counts.
 */

const FREE = PLANS.find((p) => p.tier === 'free')!
const FREE_LINE = `${FREE.monthlyCredits.toLocaleString('en-US')} free credits to start — about ${FREE.approxStandardVideos} videos`
const DEMO_BASE = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos'

export function industryMetadata(slug: string): Metadata {
  const p = INDUSTRY_PAGES[slug]
  return { title: p.metaTitle, description: p.metaDescription }
}

function features(p: IndustryPageCopy): { title: string; description: string }[] {
  const cfg = p.industryId ? INDUSTRIES[p.industryId] : null
  const list: { title: string; description: string }[] = []
  if (cfg) {
    list.push({
      title: `Uses ${cfg.label.toLowerCase()} wording`,
      description: `The script is written in plain language with the terms your field uses — like ${cfg.terminology.use.slice(0, 3).join(', ')}.`,
    })
    if (cfg.disclaimerRequired) {
      list.push({
        title: 'Adds the fine print',
        description: `A standard ${cfg.label.toLowerCase()} disclaimer is added to the video for you.`,
      })
    }
  }
  list.push(
    { title: 'Your brand, your real logo', description: `Your uploaded logo (never an AI-drawn one), your colors, and your ${p.reader}’s name on the cover.` },
    { title: 'A share page, not just a file', description: 'One link that plays on any phone or laptop, with an optional booking button and a quote with your own payment link.' },
    { title: 'Know when they watch', description: 'Get an alert when your video is opened, so you can follow up while it’s fresh.' },
    { title: 'Slides from the same work', description: 'Download the same story as a slide deck, as a PDF or PowerPoint.' },
  )
  return list.slice(0, 4)
}

export default function IndustryPage({ slug }: { slug: string }) {
  const p = INDUSTRY_PAGES[slug]
  const [titleA, titleB] = p.heroTitle
  const reader = p.reader

  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for {p.audience}</div>
            <h1 className="hero-title">{titleA}<em>{titleB}</em></h1>
            <p className="hero-sub">{p.heroSub}</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Start free &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>{FREE_LINE}</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src={`${DEMO_BASE}/${p.slug}.mp4`} style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* The problem */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Sound <em>familiar</em>?</h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
            {p.problems.map((x, i) => (
              <div key={x.title} className="feature-card">
                <div className="feature-icon" style={{ background: ['var(--rose)', 'var(--peach)', 'var(--sun)'][i % 3] }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h3>{x.title}</h3>
                <p>{x.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* How it works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps to <em>clarity</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
            {[
              { t: `Upload your ${p.doc}`, d: 'A PDF, Word file or PowerPoint. It reads the whole document and finds the points that matter.', c: 'var(--mint)' },
              { t: 'Check the script, pick a style', d: `Read the narration and change anything before the video is made. Add your logo and your ${reader}’s name.`, c: 'var(--sky)' },
              { t: 'Send one link', d: `Your ${reader} watches on any phone or laptop — no app, no login. You get an alert when they open it.`, c: 'var(--lilac)' },
            ].map((s, i) => (
              <div key={s.t} className="feature-card">
                <div className="feature-icon" style={{ background: s.c }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{i + 1}</span>
                </div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Before vs after */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The difference</div>
            <h2 className="section-title">Before &amp; after <em>Docs2Video</em></h2>
          </div>
          <div className="comparison-table" style={{ maxWidth: 700, margin: '0 auto' }}>
            <div className="comp-header">
              <div className="comp-label"></div>
              <div className="comp-old">Before</div>
              <div className="comp-new">With Docs2Video</div>
            </div>
            {[
              { label: 'What you send', old: `A long ${p.doc} as an attachment`, now: 'A short narrated video on one link' },
              { label: `What your ${reader} does`, old: 'Reads it all, or puts it off', now: 'Presses play' },
              { label: 'Making it', old: 'Building your own summary or slides', now: 'Upload, check the script, pick a style' },
              { label: 'After you send it', old: 'No way to know if they looked', now: 'An alert when they open it' },
            ].map((r) => (
              <div key={r.label} className="comp-row">
                <div className="comp-label">{r.label}</div>
                <div className="comp-old">{r.old}</div>
                <div className="comp-new highlight">{r.now}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for {p.name.toLowerCase()} <em>work</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
            {features(p).map((f, i) => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon" style={{ background: ['var(--mint)', 'var(--sky)', 'var(--lilac)', 'var(--peach)'][i % 4] }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Send your next {p.doc} as a <em>video</em></h2>
          <p className="final-cta-sub">{FREE_LINE}.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Start free &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
