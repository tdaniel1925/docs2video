import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Non-Profits | Turn Impact Reports Into Videos Donors Actually Watch',
  description:
    'Non-profits: transform grant proposals, annual reports, and impact reports into compelling narrated videos that move donors and grant committees to action.',
}

export default function NonProfitPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for non-profit organizations</div>
            <h1 className="hero-title">Your donors don&apos;t read annual reports. Your grant committees <em>skim your proposals</em></h1>
            <p className="hero-sub">
              Docs2Video transforms grant proposals, annual reports, and impact reports into branded, narrated videos that move donors and grant committees to action.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by non-profits making a difference every day</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="/industry-demos/non-profit.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
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
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>82%</div>
              <h3>of donors want to see impact visually</h3>
              <p>Your supporters care deeply about your mission — but they don&apos;t have time to read a 30-page annual report. They want to see the impact, not read about it.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>4 min</div>
              <h3>is all grant reviewers spend per proposal</h3>
              <p>Grant committees are overwhelmed with applications. If your proposal doesn&apos;t grab attention immediately, your mission gets lost in the stack.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>3x</div>
              <h3>more funding for video proposals</h3>
              <p>Organizations that supplement proposals with video presentations receive significantly more funding because reviewers can feel the impact, not just read about it.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps to <em>impact</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your grant proposal or impact report</h3>
              <p>Drop in any document — grant proposals, annual reports, donor updates, or impact summaries. Docs2Video reads your mission data, financials, and outcomes automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates branded slides with your impact data</h3>
              <p>Your logo, your brand colors, your mission statement — wrapped around compelling visuals showing beneficiaries served, programs funded, and outcomes achieved.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with donors and committees — they watch and give</h3>
              <p>Send a shareable link to donors, board members, or grant committees. They watch a compelling 3-minute video that brings your impact to life and inspires action.</p>
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
              <div className="comp-old">Email a 30-page annual report PDF</div>
              <div className="comp-new highlight">Send a 3-minute branded impact video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Donor reaction</div>
              <div className="comp-old">&ldquo;I&apos;ll read it when I have time&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I shared it with my whole family&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prep time</div>
              <div className="comp-old">Weeks of design and writing</div>
              <div className="comp-new highlight">Under 90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Funding outcome</div>
              <div className="comp-old">Lost in the stack of proposals</div>
              <div className="comp-new highlight">Stands out and inspires action</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for non-profit <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <h3>Impact-focused storytelling</h3>
              <p>Docs2Video automatically highlights key metrics — lives changed, communities served, funds allocated — and presents them in a narrative that resonates with donors emotionally.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>Donor segmentation</h3>
              <p>Create different video versions for major donors, recurring supporters, and prospective funders — each tailored with relevant impact data and personalized messaging.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <h3>Grant-ready formatting</h3>
              <p>Outputs meet the supplemental material requirements of major foundations. Include program budgets, logic models, and outcome data in a format grant reviewers love.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <h3>One-click shareable links</h3>
              <p>Share impact videos via email, social media, or embed on your website. Track views and engagement to see which donors are most interested in your mission.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to show your impact instead of just <em>reporting</em> it?</h2>
          <p className="final-cta-sub">Stop sending reports nobody reads. Start your free trial today — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
