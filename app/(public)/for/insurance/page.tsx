import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Insurance | Stop Sending Illustrations Nobody Reads',
  description:
    'Insurance agents: turn 50-page policy illustrations into branded 3-minute explainer videos your clients actually watch. Close more cases with Docs2Video.',
}

export default function InsurancePage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for insurance professionals</div>
            <h1 className="hero-title">Insurance agents: stop sending illustrations <em>nobody reads</em></h1>
            <p className="hero-sub">
              Docs2Video transforms dense policy illustrations into branded, narrated explainer videos your clients actually watch — and share with their spouse before signing.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by 1,200+ insurance professionals nationwide</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/insurance.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">The numbers don&apos;t lie</h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>73%</div>
              <h3>of clients never read their policy illustration</h3>
              <p>They skim the cover page, flip to the premium, and miss every detail that differentiates your recommendation from a competitor&apos;s quote.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>3.2 hrs</div>
              <h3>spent per client on manual summaries</h3>
              <p>Copying numbers into PowerPoint, formatting charts, double-checking figures — hours of unpaid work for every single appointment.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>62%</div>
              <h3>of prospects stall because they&apos;re confused</h3>
              <p>Not because the product is wrong. Not because the price is high. Because they literally cannot understand the illustration you sent them.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps to <em>clarity</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your policy illustration</h3>
              <p>Drop in any carrier illustration — Prudential, MetLife, John Hancock, Pacific Life, or any other. Docs2Video reads premiums, death benefits, cash values, and riders automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates branded slides with your policy data</h3>
              <p>Your logo, your colors, your compliance disclosures — wrapped around crystal-clear charts showing how the policy performs over 10, 20, and 30 years.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with clients — they watch, understand, and sign</h3>
              <p>Send a shareable link via text or email. Your client watches a 3-minute branded video, shares it with their spouse, and comes to the meeting ready to move forward.</p>
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
              <div className="comp-old">Email a 50-page illustration PDF</div>
              <div className="comp-new highlight">Send a 3-minute branded video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client reaction</div>
              <div className="comp-old">&ldquo;I&apos;ll look at it later&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I watched it twice and showed my wife&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prep time</div>
              <div className="comp-old">3+ hours in PowerPoint</div>
              <div className="comp-new highlight">Under 90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Close rate</div>
              <div className="comp-old">Stalled by confusion</div>
              <div className="comp-new highlight">Accelerated by understanding</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for insurance <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h3>Multi-carrier illustration parsing</h3>
              <p>Works with illustrations from Prudential, MetLife, John Hancock, Pacific Life, Lincoln Financial, and dozens more. Upload any PDF — Docs2Video extracts the data automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <h3>Side-by-side product comparisons</h3>
              <p>Upload two illustrations and get a clear visual comparison — premiums, cash value growth, death benefit, and riders laid out so clients can see why your recommendation wins.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Compliance-ready outputs</h3>
              <p>Every infographic includes space for required disclosures and compliance language. Your broker-dealer approves the template once, and you reuse it for every client.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <h3>One-click shareable links</h3>
              <p>Text or email a link to your client. They watch on any device — no app download, no login required. You see when they viewed it so you know when to follow up.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to transform how you communicate with <em>clients</em>?</h2>
          <p className="final-cta-sub">Stop losing cases to confusion. Start your free trial today — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
