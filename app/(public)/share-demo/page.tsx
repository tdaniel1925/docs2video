'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHead } from '../../_components/marketing/PageHead'
import { shareTheme, shareThemeVars } from '../../_lib/share-theme'
import { WATCH_CSS, WatchHero, PresenterPanel, ChapterList, IconCalendar, IconMail, IconPlay, endStop, type WatchIdentity } from '../watch/watch-view'

/*
 * THE CLIENT PAGE, SHOWN (owner, 2026-10-18: the demo and the page still
 * looked like the old cards). This draws the real share page's own parts
 * (app/(public)/watch/watch-view.tsx) with made-up people, so what a visitor
 * sees here is what their client will see. The two samples show the one
 * layout in two brands: a person (photo first) and a company (logo first),
 * each in its own colours.
 */

type Sample = {
  who: WatchIdentity
  colours: { primary: string; accent: string }
  forLine: string
  title: string
  hello: string
  poster: string
  phone: string
  email: string
  website: string
  note: string
}

const SAMPLES: Record<'person' | 'company', Sample> = {
  person: {
    who: { kind: 'person', name: 'Jordan Avery', secondary: 'Senior Advisor · Avery & Co.', image: '/share-demo/presenter.jpg', initials: 'JA' },
    colours: { primary: '#14263F', accent: '#E0A83E' },
    forLine: 'Prepared for the Morales family',
    title: 'Your 2026 Coverage Review',
    hello: 'Morales family',
    poster: '/share-demo/poster-person.jpg',
    phone: '(555) 014-2290',
    email: 'jordan@averyco.example',
    website: 'averyco.example',
    note: 'Your premium went down this year, and nothing you rely on changed. Watch the three minutes, then let’s pick a time to go through the new rider together.',
  },
  company: {
    who: { kind: 'company', name: 'Avery & Co.', secondary: 'Wealth advisors since 2009', image: '/share-demo/avery-logo.svg', initials: 'AC' },
    colours: { primary: '#0F4C3A', accent: '#0F4C3A' },
    forLine: 'Prepared for Harbor Street Bakery',
    title: 'Your Retirement Plan, Explained',
    hello: 'Harbor Street Bakery',
    poster: '/share-demo/poster-company.jpg',
    phone: '(555) 014-7781',
    email: 'hello@averyco.example',
    website: 'averyco.example',
    note: 'Here is how the plan works for your team: what you put in, what the company matches, and what each person can expect. Questions are welcome at any time.',
  },
}

const CHAPTERS = [
  { time: '0:00', title: 'What this review covers' },
  { time: '0:24', title: 'Your premium went down' },
  { time: '0:51', title: 'What you are covered for' },
  { time: '1:32', title: 'The new critical illness rider' },
  { time: '2:10', title: 'Next steps' },
]

const QUOTE = [
  { d: 'Annual coverage review', a: 'Included' },
  { d: 'Critical illness rider, first year', a: '$240.00' },
  { d: 'Policy paperwork and filing', a: 'Included' },
]

function SamplePage({ s }: { s: Sample }) {
  const style = shareThemeVars(shareTheme(s.colours)) as React.CSSProperties
  const first = s.who.kind === 'person' ? s.who.name.split(' ')[0] : s.who.name
  return (
    <div className="wp-root" style={style}>
      <style>{WATCH_CSS}</style>
      <WatchHero
        who={s.who}
        forLine={s.forLine}
        kicker="Video · October 18, 2026"
        title={s.title}
        hello={<>Hi {s.hello} — prepared for you by <strong>{s.who.name}</strong>{endStop(s.who.name)}</>}
      />
      <main className="wp-body">
        <div className="wp-wrap wp-grid">
          <div className="wp-a-player">
            <div className="wp-video-wrap">
              <div className="wp-poster" style={{ backgroundImage: `url(${s.poster})` }} role="img" aria-label={`${s.title}, a sample video`}>
                <span className="wp-poster-play"><IconPlay /></span>
              </div>
            </div>
          </div>
          <aside className="wp-col-side">
            <PresenterPanel
              who={s.who}
              contact={{ phone: s.phone, email: s.email, website: `https://${s.website}`, websiteLabel: s.website }}
              next={
                <div className="wp-next">
                  <span className="wp-btn wp-btn--main"><IconCalendar /> Book a call with {first}</span>
                  <span className="wp-btn"><IconMail /> Ask a question</span>
                </div>
              }
            />
          </aside>
          <div className="wp-col-main">
            <section className="wp-note" aria-label={`A note from ${s.who.name}`}>
              <p>{s.note}</p>
              <div className="wp-note-by">— {s.who.name}</div>
            </section>
            <section>
              <span className="wp-label">In this video</span>
              <h2 className="wp-h2">Jump to a part</h2>
              <ChapterList items={CHAPTERS} active={1} />
            </section>
            <section>
              <span className="wp-label">Your quote</span>
              <h2 className="wp-h2">What it costs</h2>
              <div className="wp-card">
                {QUOTE.map((q) => (
                  <div key={q.d} className="wp-quote-line"><span>{q.d}</span><span>{q.a}</span></div>
                ))}
                <div className="wp-quote-total"><span className="wp-quote-total-label">Total</span><span className="wp-quote-total-value">$240.00</span></div>
                <div className="wp-quote-actions">
                  <span className="wp-btn wp-btn--main wp-btn--grow">Pay $240.00</span>
                  <span className="wp-btn">Request Changes</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <footer className="wp-footer"><span>Powered by Docs2Video</span></footer>
    </div>
  )
}

export default function ShareDemoPage() {
  const [kind, setKind] = useState<'person' | 'company'>('person')

  /* In the public site's shell: the sample client page shown in a browser frame, so it reads as
     what your client sees — the client page keeps its own look (it wears your brand, not ours). */
  return (
    <>
      <PageHead
        kicker="The client page"
        title="What your client sees."
        blue="In your brand."
        sub="Every video lives on its own page in your colours, with your photo or logo, the video, and one clear next step: book a call, ask a question or review a quote. This is a sample with made-up names and numbers."
      />
      <div role="tablist" aria-label="Sample brands" className="hp-tabs">
        <button type="button" role="tab" aria-selected={kind === 'person'} className={kind === 'person' ? 'hp-tab hp-tab-on' : 'hp-tab'} onClick={() => setKind('person')}>A person&rsquo;s brand</button>
        <button type="button" role="tab" aria-selected={kind === 'company'} className={kind === 'company' ? 'hp-tab hp-tab-on' : 'hp-tab'} onClick={() => setKind('company')}>A company&rsquo;s brand</button>
      </div>
      <div className="hp-browser" role="tabpanel">
        <div className="hp-browser-bar" aria-hidden="true"><i /><i /><i /><span>docs2video.com/watch/your-video</span></div>
        <div className="hp-island" style={{ height: 'min(78vh, 820px)', overflow: 'auto' }} data-testid="share-demo-page">
          <SamplePage s={SAMPLES[kind]} />
        </div>
      </div>
      <div className="hp-row">
        <Link href="/signup" className="hp-btn hp-btn-blue hp-btn-lg">Make your first video</Link>
        <Link href="/#share" className="hp-btn hp-btn-line">Back to the client page</Link>
      </div>
    </>
  )
}
