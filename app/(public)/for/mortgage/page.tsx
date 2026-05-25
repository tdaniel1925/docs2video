import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Mortgage | Loan Estimates Borrowers Actually Understand',
  description:
    'Loan officers: turn confusing loan estimates and rate comparisons into clear borrower-friendly videos. Close faster, reduce fall-through, and stand out from every other LO.',
}

export default function MortgagePage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for loan officers &amp; mortgage pros</div>
            <h1 className="hero-title">Your borrowers are confused. That&apos;s why deals <em>fall through</em>.</h1>
            <p className="hero-sub">
              Docs2Video transforms loan estimates, rate comparisons, and amortization schedules into clear visual breakdowns and narrated borrower videos — so borrowers understand their loan and close with confidence.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by 700+ loan officers and mortgage brokerages</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/mortgage.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Confusion kills <em>closings</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>76%</div>
              <h3>of borrowers can&apos;t explain their own loan terms</h3>
              <p>They signed paperwork they didn&apos;t understand because the Loan Estimate is three pages of APR disclosures, escrow breakdowns, and regulatory fine print.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>32%</div>
              <h3>of first-time buyers shop 3+ lenders out of confusion</h3>
              <p>They&apos;re not shopping for a better rate. They&apos;re shopping for someone who can explain it clearly. Be that loan officer.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>2.5 hrs</div>
              <h3>per borrower on manual rate comparison decks</h3>
              <p>Copying numbers into slides, formatting payment charts, building scenario comparisons by hand — time that should be spent originating, not designing.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">From Loan Estimate to <em>borrower clarity</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your Loan Estimate or rate sheet</h3>
              <p>Drop in any standard CFPB Loan Estimate, rate comparison, or amortization schedule. Docs2Video extracts rates, fees, escrow, monthly payments, and closing costs automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI creates a branded visual breakdown</h3>
              <p>Your brokerage logo and colors — automatically applied to a clear one-pager showing monthly payment, total interest, and closing costs in plain language borrowers trust.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Text it to borrowers — they watch and close</h3>
              <p>Send a 60-second narrated video walking your borrower through their specific loan terms. They watch it, share it with their co-borrower, and arrive at closing confident and ready.</p>
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
              <div className="comp-label">What you send</div>
              <div className="comp-old">3-page Loan Estimate PDF</div>
              <div className="comp-new highlight">60-second narrated video + visual one-pager</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Borrower reaction</div>
              <div className="comp-old">&ldquo;I need to think about it&rdquo;</div>
              <div className="comp-new highlight">&ldquo;This makes sense — let&apos;s lock the rate&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Rate comparison</div>
              <div className="comp-old">Confusing spreadsheet</div>
              <div className="comp-new highlight">Clear visual side-by-side</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Fall-through risk</div>
              <div className="comp-old">Borrower gets cold feet</div>
              <div className="comp-new highlight">Borrower understands and commits</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Your edge over every other <em>LO</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <h3>Multi-scenario rate comparisons</h3>
              <p>Upload two or three Loan Estimates and Docs2Video generates a clear visual comparison — highlighting the differences that matter most to borrowers, not the ones that matter to underwriters.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h3>Visual amortization charts</h3>
              <p>Turn amortization tables into intuitive charts showing borrowers exactly how their balance drops and equity grows over time. No more explaining compound interest verbally.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3>Text-friendly shareable links</h3>
              <p>Every video gets a shareable link you can text to borrowers. They watch on any device, share with co-borrowers, and you see when they&apos;ve viewed it so you know when to follow up.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Borrower data security</h3>
              <p>Source documents are never stored after processing. Borrower information stays in your private workspace and is never shared or used for training. Your compliance officer will approve.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to close more loans with <em>clarity</em>?</h2>
          <p className="final-cta-sub">Be the loan officer who actually makes it make sense. Start free — cancel anytime.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
