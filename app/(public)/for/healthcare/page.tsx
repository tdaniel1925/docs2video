import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Healthcare | Benefits Docs Employees Actually Read',
  description:
    'Healthcare administrators: transform confusing benefits packets, EOBs, and compliance reports into clear explainer videos. Reduce enrollment errors and inbound calls by 60%.',
}

export default function HealthcarePage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for healthcare organizations</div>
            <h1 className="hero-title">Your employees pick the wrong plan because your benefits packet is <em>unreadable</em></h1>
            <p className="hero-sub">
              Docs2Video transforms 40-page benefits guides, EOBs, and compliance reports into clear infographics and narrated explainer videos employees and patients actually watch.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by 300+ health systems, hospitals, and benefits teams</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/healthcare.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Confusion costs everyone <em>more</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>68%</div>
              <h3>of employees choose the wrong benefits plan</h3>
              <p>They skim, guess, and select based on premium alone — then blame HR when claims get denied or out-of-pocket costs surprise them.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>42%</div>
              <h3>of patient calls are about billing confusion</h3>
              <p>EOBs are walls of codes and fine print. Patients call your office instead of understanding what they owe — tying up staff who should be focused on care.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>3 weeks</div>
              <h3>spent building open-enrollment materials</h3>
              <p>Every year, your benefits team starts from scratch — formatting comparison charts, writing summaries, creating slide decks — for content employees barely glance at.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">From 40-page packet to <em>5-minute video</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your benefits guide or EOB</h3>
              <p>Drop in your open-enrollment packet, benefits summary, EOB, or compliance report. Docs2Video extracts plan details, coverage tiers, costs, and key terms automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI creates clear, branded visual breakdowns</h3>
              <p>Side-by-side plan comparisons, cost breakdowns, and coverage summaries — branded with your health system logo and colors, designed so anyone can understand them in under a minute.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with employees and patients — they watch and act</h3>
              <p>Employees watch a narrated benefits overview and choose the right plan the first time. Patients watch a billing explainer and understand what they owe without calling your office.</p>
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
              <div className="comp-label">Benefits communication</div>
              <div className="comp-old">40-page PDF nobody reads</div>
              <div className="comp-new highlight">5-minute narrated video + 1-page infographic</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Enrollment accuracy</div>
              <div className="comp-old">Employees guess and regret</div>
              <div className="comp-new highlight">Employees choose confidently</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Patient billing calls</div>
              <div className="comp-old">Dozens per day</div>
              <div className="comp-new highlight">Reduced by 60%</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Material creation time</div>
              <div className="comp-old">3 weeks of manual work</div>
              <div className="comp-new highlight">Under 5 minutes</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Designed for healthcare <em>communication</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <h3>Side-by-side plan comparisons</h3>
              <p>Upload your benefits summary and get a clear visual comparing every plan tier — premiums, deductibles, copays, and out-of-pocket maximums in one scannable view.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3>Patient-friendly billing explainers</h3>
              <p>Turn complex EOBs into simple visual breakdowns patients understand — reducing inbound calls, accelerating collections, and improving patient satisfaction scores.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Secure document handling</h3>
              <p>All documents processed securely with encryption in transit and at rest. Source files are never stored after generation. Control exactly what information appears in every output.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg>
              </div>
              <h3>Compliance report dashboards</h3>
              <p>Convert HIPAA audit findings, quality metrics, and accreditation reports into visual executive dashboards that drive action instead of collecting dust.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to transform how you communicate with employees and <em>patients</em>?</h2>
          <p className="final-cta-sub">Clarity reduces calls, errors, and frustration. Start free — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
