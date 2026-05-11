import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Personal Trainers & Gyms | Turn Workout Plans Into Videos Clients Actually Follow',
  description:
    'Personal trainers and gyms: transform workout programs, nutrition plans, and progress reports into engaging narrated videos your clients actually follow.',
}

export default function FitnessPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for fitness professionals</div>
            <h1 className="hero-title">Your workout plans and nutrition guides sit <em>unread</em> in your clients&apos; inboxes</h1>
            <p className="hero-sub">
              Docs2Video transforms workout programs, nutrition plans, and progress reports into branded, narrated videos your clients actually watch and follow.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by personal trainers and gym owners nationwide</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="/industry-demos/fitness.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
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
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>23%</div>
              <h3>of clients follow written workout plans</h3>
              <p>You spend hours crafting the perfect program, but only a fraction of your clients actually follow it. The rest wing it at the gym and wonder why they&apos;re not seeing results.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>4x</div>
              <h3>better form compliance with video instructions</h3>
              <p>When clients can see exercises demonstrated with proper form cues, they perform movements correctly and avoid injuries — saving you from liability and them from setbacks.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>60%</div>
              <h3>more client retention with video check-ins</h3>
              <p>Trainers who send personalized video check-ins and progress updates keep clients engaged and committed far longer than those who rely on text messages alone.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps to <em>results</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your workout program or nutrition plan</h3>
              <p>Drop in any document — workout programs, nutrition guides, progress reports, or membership packages. Docs2Video reads exercises, macros, and milestones automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates branded slides with your fitness data</h3>
              <p>Your logo, your brand, your coaching voice — wrapped around clear visuals showing workout splits, nutrition breakdowns, and progress charts your clients can follow.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with clients — they watch, follow, and get results</h3>
              <p>Send a shareable link via text or email. Clients watch a branded video explaining their program, understand what to do and why, and show up to the gym ready to execute.</p>
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
              <div className="comp-old">A spreadsheet workout plan</div>
              <div className="comp-new highlight">A branded video walkthrough</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client reaction</div>
              <div className="comp-old">&ldquo;What&apos;s a Romanian deadlift again?&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I watched it before every session&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prep time</div>
              <div className="comp-old">Hours building custom PDFs</div>
              <div className="comp-new highlight">Under 90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client retention</div>
              <div className="comp-old">Clients ghost after 2 months</div>
              <div className="comp-new highlight">Clients stay and refer friends</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for fitness <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h3>Progress tracking videos</h3>
              <p>Transform client progress data into visual milestone videos. Show before-and-after metrics, strength gains, and body composition changes that keep clients motivated.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <h3>Nutrition plan breakdowns</h3>
              <p>Turn complex macro calculations and meal plans into easy-to-follow visual guides. Clients see exactly what to eat, when, and why — no more confusion about portions or timing.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h3>Workout program walkthroughs</h3>
              <p>Each workout gets a narrated video explaining the exercises, sets, reps, and rest periods. Clients arrive at the gym confident and prepared instead of confused and scrolling their phone.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <h3>One-click shareable links</h3>
              <p>Text a link to your client. They watch on their phone at the gym — no app download, no login required. You see when they viewed it so you know they&apos;re staying on track.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to transform how you train <em>clients</em>?</h2>
          <p className="final-cta-sub">Stop sending plans nobody follows. Start your free trial today — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
