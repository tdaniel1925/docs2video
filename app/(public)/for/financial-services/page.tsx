import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Financial Services | Clarity That Builds Trust',
  description:
    'Financial advisors: turn portfolio reports and retirement projections into branded explainer videos that build trust and eliminate "what does this mean?" calls.',
}

export default function FinancialServicesPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for financial advisors</div>
            <h1 className="hero-title">Your clients deserve to <em>understand</em> their money</h1>
            <p className="hero-sub">
              Docs2Video transforms portfolio reports, 401k statements, and retirement projections into branded visual summaries and narrated explainer videos — so clients understand their wealth without calling your office.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by 600+ RIAs, CFPs, and wealth management firms</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/financial-services.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Your reports are thorough. Your clients aren&apos;t <em>reading</em> them.</h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>81%</div>
              <h3>of clients can&apos;t interpret their own portfolio report</h3>
              <p>They see numbers, charts, and disclaimers — but they can&apos;t answer the one question that matters: &ldquo;Am I going to be okay?&rdquo;</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>47%</div>
              <h3>of client calls are &ldquo;can you explain this?&rdquo;</h3>
              <p>Nearly half your inbound calls exist because a statement or report created anxiety instead of confidence. That&apos;s expensive hand-holding.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>5 hrs</div>
              <h3>per quarter spent on review presentations</h3>
              <p>Exporting data, building charts in Excel, copying into PowerPoint, formatting for each client. An entire afternoon per household, every quarter.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">From statement to <em>understanding</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your portfolio report or statement</h3>
              <p>Drop in any custodial statement from Schwab, Fidelity, Vanguard, or Pershing. Docs2Video extracts holdings, performance, allocation, and benchmarks automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI creates branded retirement visuals</h3>
              <p>Your firm logo, colors, and compliance disclaimers — wrapped around clear allocation charts, retirement timelines, and performance summaries a 10-year-old could understand.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with clients — they watch and feel confident</h3>
              <p>Clients receive a narrated video walkthrough of their portfolio. They watch it, share it with their spouse, and arrive at the annual review already informed.</p>
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
              <div className="comp-label">Quarterly report</div>
              <div className="comp-old">12-page PDF with tables</div>
              <div className="comp-new highlight">3-minute narrated video summary</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client reaction</div>
              <div className="comp-old">&ldquo;Can you just tell me if I&apos;m on track?&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I watched the video — I feel great about where we are&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Review prep</div>
              <div className="comp-old">5 hours per quarter</div>
              <div className="comp-new highlight">Under 2 minutes</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Referrals</div>
              <div className="comp-old">Clients don&apos;t share reports</div>
              <div className="comp-new highlight">Clients forward videos to friends</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Purpose-built for <em>advisory firms</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h3>Retirement projection visuals</h3>
              <p>Color-coded timelines that show clients exactly where they stand: &ldquo;You&apos;re here, your goal is there, and here&apos;s the path.&rdquo; No spreadsheets, no guessing.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>SOC 2 compliant infrastructure</h3>
              <p>All uploads encrypted in transit and at rest. Source documents are never stored after processing. Your compliance team will sign off on day one.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <h3>ADV and compliance disclosures</h3>
              <p>Add required disclaimers, ADV language, and compliance footnotes to every visual and video. Set it once in your brand settings — it appears on every output automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h3>Performance vs. benchmark charts</h3>
              <p>Auto-generated charts showing portfolio performance against relevant benchmarks. Clients see the big picture without drowning in ticker-level detail.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to transform how clients experience their <em>wealth</em>?</h2>
          <p className="final-cta-sub">Give your clients the clarity they deserve. Start free — cancel anytime.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
