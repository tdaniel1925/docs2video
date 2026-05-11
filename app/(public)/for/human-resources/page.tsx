import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Human Resources | Turn Benefits Guides Into Videos Employees Actually Watch',
  description:
    'HR teams: transform 47-page benefits guides, employee handbooks, and onboarding materials into clear narrated videos your employees actually understand.',
}

export default function HumanResourcesPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for HR professionals</div>
            <h1 className="hero-title">Your employees pick the wrong benefits because your enrollment packet is <em>47 pages</em></h1>
            <p className="hero-sub">
              Docs2Video transforms dense benefits guides, employee handbooks, and onboarding materials into branded, narrated videos your team actually watches and understands.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by HR teams at companies of every size</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/human-resources.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
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
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>67%</div>
              <h3>of employees don&apos;t understand their benefits</h3>
              <p>They pick the wrong health plan, miss the HSA match, and skip disability coverage — all because they couldn&apos;t get through the enrollment packet.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>3x</div>
              <h3>longer onboarding with text-only materials</h3>
              <p>New hires sit through hours of reading policies they won&apos;t remember. Productivity suffers while they try to absorb everything from dense documents.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>65%</div>
              <h3>retention with video vs 10% for reading</h3>
              <p>Employees retain 65% of information from video training after 3 days, compared to just 10% from reading the same material. The gap is staggering.</p>
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
              <h3>Upload your benefits guide or handbook</h3>
              <p>Drop in any HR document — benefits enrollment packets, employee handbooks, onboarding checklists, or policy updates. Docs2Video reads plans, deadlines, and key details automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates branded slides with your HR data</h3>
              <p>Your company logo, your brand colors, your tone — wrapped around clear visuals showing plan comparisons, enrollment deadlines, and key policies employees need to know.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with employees — they watch, understand, and enroll</h3>
              <p>Send a shareable link company-wide. Employees watch a 3-minute branded video, understand their options, and make informed decisions before the enrollment deadline.</p>
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
              <div className="comp-old">Email a 47-page benefits PDF</div>
              <div className="comp-new highlight">Send a 3-minute branded video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Employee reaction</div>
              <div className="comp-old">&ldquo;I just picked the same plan as last year&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I finally understand my options&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prep time</div>
              <div className="comp-old">Weeks of formatting and meetings</div>
              <div className="comp-new highlight">Under 90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Support tickets</div>
              <div className="comp-old">Flooded with questions during enrollment</div>
              <div className="comp-new highlight">Employees self-serve with video</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for HR <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h3>Multi-carrier benefits parsing</h3>
              <p>Works with benefits documents from any carrier — Aetna, Blue Cross, UnitedHealthcare, Cigna, and more. Upload any PDF and Docs2Video extracts plan details automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <h3>Side-by-side plan comparisons</h3>
              <p>Upload multiple plan documents and get clear visual comparisons — premiums, deductibles, copays, and coverage limits laid out so employees can pick the right plan.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>Role-based content</h3>
              <p>Create different video versions for executives, managers, and individual contributors — each showing the benefits and policies most relevant to their role and level.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <h3>One-click company-wide distribution</h3>
              <p>Share via email, Slack, Teams, or your HRIS. Track who has watched to identify employees who still need a nudge before the enrollment deadline closes.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to transform how you communicate with <em>employees</em>?</h2>
          <p className="final-cta-sub">Stop losing employees to benefits confusion. Start your free trial today — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
