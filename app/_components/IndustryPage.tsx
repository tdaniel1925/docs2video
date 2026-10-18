import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import ClickToPlayVideo from './ClickToPlayVideo'
import { PageHead } from './marketing/SiteChrome'
import { INDUSTRIES } from '../_lib/industries'
import { INDUSTRY_PAGES, type IndustryPageCopy } from '../_lib/industry-pages'
import { PLANS } from '../_lib/pricing'

/*
 * One template for every /for/<industry> page, in the public site's dark
 * style (marketing/SiteChrome, redesign 2026-10-18). The copy lives in
 * _lib/industry-pages.ts; wording, disclaimers and prices come from the
 * product's own config (industries.ts, pricing.ts) so the page can only
 * say what the product actually does. No stats, testimonials or counts.
 */

const FREE = PLANS.find((p) => p.tier === 'free')!
const FREE_LINE = `${FREE.monthlyCredits.toLocaleString('en-US')} free credits to start — about ${FREE.approxStandardVideos} videos`
const DEMO_BASE = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos'

/*
 * The hero picture for each field: made-up people, no real firm. Eight fields
 * have their own (public/home); the rest use the nearest one.
 */
const PHOTO: Record<string, { src: string; alt: string }> = {
  insurance: { src: '/home/table.jpg', alt: 'An older couple watching their coverage video at the kitchen table' },
  'financial-services': { src: '/home/finance.jpg', alt: 'An advisor and a couple watching a short video with growth charts' },
  consulting: { src: '/home/finance.jpg', alt: 'An advisor and clients watching a short video with charts' },
  'real-estate': { src: '/home/realestate.jpg', alt: 'A couple in an empty sunlit house watching a short video on a phone' },
  'property-management': { src: '/home/realestate.jpg', alt: 'A couple in a sunlit home watching a short video on a phone' },
  mortgage: { src: '/home/mortgage.jpg', alt: 'A buyer at a cafe watching a short video beside a loan estimate' },
  healthcare: { src: '/home/healthcare.jpg', alt: 'A nurse showing a patient a short video on a tablet' },
  medical: { src: '/home/healthcare.jpg', alt: 'A nurse showing a patient a short video on a tablet' },
  'human-resources': { src: '/home/hr.jpg', alt: 'A new employee watching a benefits welcome video at her desk' },
  legal: { src: '/home/legal.jpg', alt: 'A lawyer handing a client a tablet playing a short video' },
  education: { src: '/home/education.jpg', alt: 'A learner taking notes while watching a short course video' },
  coaching: { src: '/home/education.jpg', alt: 'Someone taking notes while watching a short video' },
}
const HERO = { src: '/home/hero.jpg', alt: 'A couple on their sofa at dusk, watching a short video together on a tablet' }
export const photoFor = (slug: string) => PHOTO[slug] ?? HERO

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
    { title: 'Slides from the same work', description: 'Download its slides as a PDF or PowerPoint for the meeting.' },
  )
  return list.slice(0, 4)
}

export default function IndustryPage({ slug }: { slug: string }) {
  const p = INDUSTRY_PAGES[slug]
  const [titleA, titleB] = p.heroTitle
  const reader = p.reader
  const photo = photoFor(slug)

  const steps = [
    { t: `Upload your ${p.doc}`, d: 'A PDF, Word file or PowerPoint. It reads the whole document and finds the points that matter.' },
    { t: 'Check the script, pick a style', d: `Read the narration and change anything before the video is made. Add your logo and your ${reader}’s name.` },
    { t: 'Send one link', d: `Your ${reader} watches on any phone or laptop — no app, no login. You get an alert when they open it.` },
  ]
  const rows = [
    { label: 'What you send', old: `A long ${p.doc} as an attachment`, now: 'A short narrated video on one link' },
    { label: `What your ${reader} does`, old: 'Reads it all, or puts it off', now: 'Presses play' },
    { label: 'Making it', old: 'Building your own summary or slides', now: 'Upload, check the script, pick a style' },
    { label: 'After you send it', old: 'No way to know if they looked', now: 'An alert when they open it' },
  ]

  return (
    <>
      {/* Hero: the field's own picture */}
      <section className="hp-fhero" aria-labelledby="hp-field-title">
        <Image src={photo.src} alt={photo.alt} fill priority sizes="(max-width: 1312px) 100vw, 1216px" />
        <div className="hp-fhero-shade" aria-hidden="true" />
        <div className="hp-fhero-copy">
          <span className="hp-kicker">✦ Built for {p.audience}</span>
          <h1 id="hp-field-title" className="hp-h2">{titleA}<span className="hp-blue">{titleB}</span></h1>
          <p>{p.heroSub}</p>
          <div className="hp-row">
            <Link href="/signup" className="hp-btn hp-btn-blue hp-btn-lg">Make your first video</Link>
            <a href="#how-it-works" className="hp-btn hp-btn-line">See how it works</a>
          </div>
          <span className="hp-small">{FREE_LINE}</span>
        </div>
      </section>

      {/* A sample video for this field */}
      <section className="hp-section" aria-labelledby="hp-sample-title">
        <PageHead kicker="A sample for your field" title="See one" blue="play" />
        <div className="hp-sample">
          <div className="hp-sample-bar"><span className="hp-caps" id="hp-sample-title">{p.name}</span><span className="hp-small">Press to play, with sound</span></div>
          <ClickToPlayVideo src={`${DEMO_BASE}/${p.slug}.mp4`} />
        </div>
      </section>

      {/* The problem */}
      <section className="hp-section" aria-labelledby="hp-problem-title">
        <span className="hp-kicker">✦ The problem</span>
        <h2 id="hp-problem-title" className="hp-h3">Sound <span className="hp-blue">familiar?</span></h2>
        <div className="hp-grid">
          {p.problems.map((x) => (
            <div key={x.title} className="hp-card"><h3>{x.title}</h3><p>{x.description}</p></div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="hp-section" id="how-it-works" aria-labelledby="hp-how-title">
        <span className="hp-kicker">✦ How it works</span>
        <h2 id="hp-how-title" className="hp-h3">Three steps to <span className="hp-blue">clarity</span></h2>
        <ol className="hp-grid">
          {steps.map((s, i) => (
            <li key={s.t} className="hp-card"><span className="hp-num-big">{String(i + 1).padStart(2, '0')}</span><h3>{s.t}</h3><p>{s.d}</p></li>
          ))}
        </ol>
      </section>

      {/* Before vs after */}
      <section className="hp-section" aria-labelledby="hp-diff-title">
        <span className="hp-kicker">✦ The difference</span>
        <h2 id="hp-diff-title" className="hp-h3">Before &amp; after <span className="hp-blue">Docs2Video</span></h2>
        <div className="hp-compare" role="table" aria-label="Before and after Docs2Video">
          <div className="hp-compare-head" role="row"><span role="columnheader" /><span role="columnheader">Before</span><span role="columnheader">With Docs2Video</span></div>
          {rows.map((r) => (
            <div key={r.label} role="row"><span role="rowheader">{r.label}</span><span role="cell">{r.old}</span><span role="cell">{r.now}</span></div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="hp-section" aria-labelledby="hp-feat-title">
        <span className="hp-kicker">✦ Features</span>
        <h2 id="hp-feat-title" className="hp-h3">Built for {p.name.toLowerCase()} <span className="hp-blue">work</span></h2>
        <div className="hp-grid">
          {features(p).map((f) => (
            <div key={f.title} className="hp-card"><span className="hp-check" aria-hidden="true">✓ </span><h3>{f.title}</h3><p>{f.description}</p></div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="hp-cta-band" aria-labelledby="hp-fcta-title">
        <div>
          <h2 id="hp-fcta-title" className="hp-h3">Send your next {p.doc} as a <span className="hp-blue">video</span></h2>
          <span className="hp-soft">{FREE_LINE}.</span>
        </div>
        <div className="hp-row">
          <Link href="/signup" className="hp-btn hp-btn-blue hp-btn-lg">Make your first video</Link>
          <Link href="/" className="hp-btn hp-btn-line">See everything it does</Link>
        </div>
      </section>
    </>
  )
}
