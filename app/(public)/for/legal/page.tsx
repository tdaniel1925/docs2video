import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Legal | Contracts Your Clients Actually Understand',
  description:
    'Attorneys: transform settlement agreements and contracts into visual summaries and narrated briefs. Clients arrive informed, meetings run faster, and nothing gets lost in the legalese.',
}

export default function LegalPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for legal professionals</div>
            <h1 className="hero-title">Your clients sign documents they don&apos;t <em>understand</em></h1>
            <p className="hero-sub">
              Docs2Video transforms settlement agreements, contracts, and legal documents into visual summaries and narrated executive briefs — so clients arrive informed and meetings run in minutes, not hours.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Used by 400+ attorneys and law firms nationwide</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="/industry-demos/legal.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Legalese is a barrier to <em>justice</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>91%</div>
              <h3>of clients don&apos;t fully read contracts before signing</h3>
              <p>They trust you. But trust without understanding leads to disputes, scope disagreements, and &ldquo;I didn&apos;t agree to that&rdquo; conversations months later.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>3x</div>
              <h3>you explain the same clause to the same client</h3>
              <p>Indemnification, non-compete carve-outs, liquidated damages — your client nods in the meeting and calls back the next morning with the same questions.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>$420</div>
              <h3>average cost of a plain-language summary</h3>
              <p>Writing a summary clients can understand is billable work they resent paying for — but skipping it guarantees confusion and scope disputes.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Clarity in <em>three steps</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your contract or settlement agreement</h3>
              <p>Drop in any legal document — settlement agreements, commercial contracts, lease agreements, merger documents. Docs2Video extracts key terms, obligations, timelines, and financial figures.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates a visual summary with your key terms</h3>
              <p>Complex clauses become clear diagrams — payment waterfalls, obligation timelines, and party relationships laid out visually so clients see the structure, not the legalese.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with clients — they arrive informed and ready</h3>
              <p>Send a narrated video walkthrough before the signing meeting. Your client watches a 5-minute brief, understands every material term, and shows up ready to execute.</p>
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
              <div className="comp-old">30-page contract PDF</div>
              <div className="comp-new highlight">5-minute narrated visual brief</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client arrives</div>
              <div className="comp-old">&ldquo;So what am I signing?&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I understand the terms — let&apos;s proceed&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Signing meeting</div>
              <div className="comp-old">90 minutes of explanation</div>
              <div className="comp-new highlight">15 minutes of strategic discussion</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Post-signing disputes</div>
              <div className="comp-old">Frequent misunderstandings</div>
              <div className="comp-new highlight">Clients understood before they signed</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for legal <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <h3>Key term extraction</h3>
              <p>Docs2Video identifies and highlights the terms that matter most — indemnification, payment terms, termination rights, non-competes — and prioritizes them in the visual summary.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3>Obligation timeline diagrams</h3>
              <p>Automatically generate timeline visuals showing when obligations trigger, when payments are due, and when rights expire — so clients see the contract as a story, not a wall of text.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Privileged document security</h3>
              <p>All documents encrypted in transit and at rest, processed in isolated environments, and never used for model training. BAA and DPA agreements available for firms that require them.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <h3>Clause-level customization</h3>
              <p>Flag the sections that matter most for each engagement. Docs2Video prioritizes those clauses in the summary and narration — every brief is tailored, never generic.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to transform how clients understand their <em>agreements</em>?</h2>
          <p className="final-cta-sub">Informed clients are better clients. Start free — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
