import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Property Management | Turn Lease Agreements Into Videos Tenants Actually Understand',
  description:
    'Property managers: transform lease agreements, property listings, and maintenance guides into clear narrated videos that reduce disputes and fill vacancies faster.',
}

export default function PropertyManagementPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for property management</div>
            <h1 className="hero-title">Your tenants don&apos;t read lease agreements. Your listings look like <em>every other one</em></h1>
            <p className="hero-sub">
              Docs2Video transforms lease agreements, property listings, and maintenance guides into branded, narrated videos that reduce disputes and fill vacancies faster.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by property managers and apartment complexes nationwide</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="/industry-demos/property-management.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
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
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>89%</div>
              <h3>of renters prefer virtual property tours</h3>
              <p>Today&apos;s renters want to explore properties from their couch before scheduling an in-person visit. Static photos and PDF floor plans don&apos;t cut it anymore.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>45%</div>
              <h3>fewer lease disputes with video walkthroughs</h3>
              <p>When tenants watch a video explaining lease terms, pet policies, and maintenance responsibilities, misunderstandings drop dramatically — and so do costly disputes.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>2x</div>
              <h3>more inquiries for properties with video</h3>
              <p>Listings with video walkthroughs generate twice as many qualified inquiries as those with photos alone. Fill vacancies faster and reduce turnover costs.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps to <em>occupancy</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your lease agreement or property listing</h3>
              <p>Drop in any document — lease agreements, property listings, maintenance guides, community updates, or move-in packets. Docs2Video reads terms, amenities, and details automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates branded slides with your property data</h3>
              <p>Your property branding, your community photos, your management voice — wrapped around clear visuals showing floor plans, amenities, lease terms, and move-in checklists.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with tenants and prospects — they watch and act</h3>
              <p>Send a shareable link to prospective tenants or current residents. They watch a branded video that answers their questions and moves them toward signing or renewing.</p>
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
              <div className="comp-old">A dense lease PDF and static photos</div>
              <div className="comp-new highlight">A branded video tour with lease highlights</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prospect reaction</div>
              <div className="comp-old">&ldquo;I need to schedule a visit first&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I&apos;m ready to apply right now&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prep time</div>
              <div className="comp-old">Hours staging and photographing</div>
              <div className="comp-new highlight">Under 90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Tenant disputes</div>
              <div className="comp-old">&ldquo;I didn&apos;t know that was in the lease&rdquo;</div>
              <div className="comp-new highlight">Clear understanding from day one</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for property management <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <h3>Property listing videos</h3>
              <p>Transform static listings into engaging video tours. Highlight floor plans, amenities, neighborhood features, and move-in specials in a format that gets prospects to apply.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h3>Lease agreement walkthroughs</h3>
              <p>Turn 20-page lease agreements into clear 3-minute videos covering key terms, pet policies, maintenance responsibilities, and move-out procedures tenants need to know.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </div>
              <h3>Maintenance guide videos</h3>
              <p>Create videos explaining how to use appliances, submit maintenance requests, and handle common issues. Reduce unnecessary service calls and keep tenants happy.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <h3>One-click shareable links</h3>
              <p>Post listing videos on Zillow, Apartments.com, or your website. Send lease walkthroughs directly to tenants. Track views to see which prospects are most interested.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to fill vacancies faster and reduce <em>disputes</em>?</h2>
          <p className="final-cta-sub">Stop losing prospects to boring listings. Start your free trial today — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
