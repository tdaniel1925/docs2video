import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Real Estate | Win Listings With Videos That Sell',
  description:
    'Real estate agents: turn CMAs and appraisals into branded property videos that win listings and close deals. Docs2Video gives you an unfair advantage at every appointment.',
}

export default function RealEstatePage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for real estate professionals</div>
            <h1 className="hero-title">Agents: your CMA deserves better than a <em>spreadsheet</em></h1>
            <p className="hero-sub">
              Docs2Video turns your CMAs, appraisals, and market data into branded property videos that make you look like you have a production team behind you — in under 90 seconds.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Used by 800+ agents across 40 markets</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/real-estate.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Why listing appointments <em>stall</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>80%</div>
              <h3>of buyers forget what their agent told them</h3>
              <p>Verbal walkthroughs evaporate. Buyers leave showings and can&apos;t remember which house had the updated kitchen or the better school district.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>4.1 hrs</div>
              <h3>wasted per listing on manual presentations</h3>
              <p>Pulling comps, formatting charts in Canva, copying into a deck — time you should be spending on showings and relationship building.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>3 in 5</div>
              <h3>sellers choose the agent with the best presentation</h3>
              <p>Your pricing strategy might be identical to the other agent&apos;s. But the one who presents it visually wins the listing every time.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Listing-ready in <em>90 seconds</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your CMA or appraisal</h3>
              <p>Drop in your comparative market analysis, appraisal report, or MLS data export. Docs2Video extracts comps, pricing, neighborhood stats, and market trends automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI builds a branded property presentation</h3>
              <p>Your headshot, brokerage logo, and brand colors — automatically applied to magazine-quality slides with price trend charts, neighborhood highlights, and comp breakdowns.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with sellers — they watch and list with you</h3>
              <p>Send the video before your listing appointment. Sellers watch a narrated market analysis, share it with their spouse, and show up ready to sign the agreement.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Before vs After */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The transformation</div>
            <h2 className="section-title">Before &amp; after <em>Docs2Video</em></h2>
          </div>
          <div className="comparison-table" style={{ maxWidth: 700, margin: '0 auto' }}>
            <div className="comp-header">
              <div className="comp-label"></div>
              <div className="comp-old">Before</div>
              <div className="comp-new">With Docs2Video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Listing presentation</div>
              <div className="comp-old">MLS printout + verbal pitch</div>
              <div className="comp-new highlight">Branded narrated video with market data</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Seller reaction</div>
              <div className="comp-old">&ldquo;We&apos;re interviewing two more agents&rdquo;</div>
              <div className="comp-new highlight">&ldquo;Where do we sign?&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prep time</div>
              <div className="comp-old">4+ hours in Canva</div>
              <div className="comp-new highlight">90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">After the meeting</div>
              <div className="comp-old">Nothing to share</div>
              <div className="comp-new highlight">Video link sellers forward to family</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Your unfair <em>advantage</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <h3>Property showcase visuals</h3>
              <p>Magazine-quality property presentations with neighborhood stats, school ratings, price trends, and comparable properties — all from a single CMA upload.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3>90-second turnaround</h3>
              <p>Upload before coffee, share before your first showing. No design skills, no templates to configure, no production delays.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <h3>Works for residential and commercial</h3>
              <p>Residential CMAs, commercial cap rate analyses, investment property NOI breakdowns — Docs2Video handles them all with the same ease.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>Shareable with the whole household</h3>
              <p>Sellers forward your video to their spouse, their parents, their financial advisor. Everyone sees the same professional presentation — and your brand.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to win every listing <em>appointment</em>?</h2>
          <p className="final-cta-sub">Join 800+ agents who present like pros. Start free — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
