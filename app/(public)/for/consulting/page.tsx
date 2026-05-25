import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Consulting | Deliverables Clients Actually Review',
  description:
    'Consultants: turn 80-page audit reports into visual executive briefs and narrated walkthroughs your clients watch start to finish. Elevate every deliverable with Docs2Video.',
}

export default function ConsultingPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for consultants &amp; advisory firms</div>
            <h1 className="hero-title">You spent weeks on that report. Your client read <em>page one</em>.</h1>
            <p className="hero-sub">
              Docs2Video transforms dense audit reports, strategy decks, and client deliverables into polished visual briefs and narrated video walkthroughs — branded to your firm in under 90 seconds.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Used by 500+ consultants and advisory firms globally</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/consulting.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Great work, buried in <em>pages</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>85%</div>
              <h3>of clients read only the executive summary</h3>
              <p>The findings, risk assessments, and recommendations you spent weeks developing? They start on page 12. Nobody gets there.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>6 hrs</div>
              <h3>of senior consultant time on formatting</h3>
              <p>Partners and senior consultants wrestling with PowerPoint layouts and chart formatting instead of advising clients. That&apos;s expensive design work at consulting rates.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>70%</div>
              <h3>of recommendations go unimplemented</h3>
              <p>Not because they&apos;re wrong. Because the client&apos;s leadership team never fully absorbed the findings buried on page 47 of your report.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">From report to <em>results</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your audit report or deliverable</h3>
              <p>Drop in any Word doc, PDF, or PowerPoint — strategy reports, risk assessments, process audits, due diligence findings. Docs2Video extracts structure, findings, and data automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI builds a branded executive brief</h3>
              <p>Your firm&apos;s colors, logo, and typography — automatically applied to a clean visual deck highlighting risks, recommendations, and next steps at a glance.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with clients — leadership watches and acts</h3>
              <p>Send a narrated video walkthrough the client&apos;s C-suite can watch in 5 minutes. They share it with their board — no meeting required, no findings lost.</p>
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
              <div className="comp-label">Deliverable</div>
              <div className="comp-old">80-page Word document</div>
              <div className="comp-new highlight">Visual executive brief + 5-min video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client reaction</div>
              <div className="comp-old">&ldquo;Can you just walk us through it?&rdquo;</div>
              <div className="comp-new highlight">&ldquo;We watched the video — let&apos;s discuss implementation&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Formatting time</div>
              <div className="comp-old">6+ hours per deliverable</div>
              <div className="comp-new highlight">Under 90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Recommendation adoption</div>
              <div className="comp-old">Findings forgotten</div>
              <div className="comp-new highlight">Board-ready presentation in hand</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Elevate every <em>deliverable</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h3>Multi-format document ingestion</h3>
              <p>Upload .docx, .pdf, .pptx, or plain text. Docs2Video extracts structure, findings, charts, and data — no manual reformatting required.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <h3>Firm brand kit</h3>
              <p>Set up your colors, logo, and fonts once. Every visual, deck, and video is automatically branded — output that looks like your design team spent hours on it.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <h3>Fully editable outputs</h3>
              <p>Adjust copy, reorder sections, swap charts, and add your own annotations before exporting. You stay in control of every detail.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Client data confidentiality</h3>
              <p>Source documents are never stored after processing. Outputs are saved to your private workspace and are never used for training or shared externally.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to deliver reports clients actually <em>absorb</em>?</h2>
          <p className="final-cta-sub">Make every deliverable board-ready. Start free — cancel anytime.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
