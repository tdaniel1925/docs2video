import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Medical Practices | Turn Treatment Plans Into Videos Patients Actually Understand',
  description:
    'Doctor\'s offices: transform treatment plans, post-procedure instructions, and insurance explanations into clear narrated videos that reduce callbacks and improve compliance.',
}

export default function MedicalPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for medical practices</div>
            <h1 className="hero-title">Your patients leave confused about their treatment plan. They call back with questions <em>you already answered</em></h1>
            <p className="hero-sub">
              Docs2Video transforms treatment plans, post-procedure instructions, and insurance explanations into branded, narrated videos patients watch at home and actually understand.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by medical practices focused on patient outcomes</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="/industry-demos/medical.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
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
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>80%</div>
              <h3>of medical information is forgotten immediately</h3>
              <p>Patients forget most of what you tell them before they even reach the parking lot. Critical instructions about medications, follow-ups, and warning signs are lost.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>50%</div>
              <h3>fewer callbacks with video instructions</h3>
              <p>When patients can re-watch their care instructions at home, they stop calling your office with questions. Your staff spends less time on the phone and more time on care.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>3x</div>
              <h3>better treatment compliance with video</h3>
              <p>Patients who watch video explanations of their treatment plan are three times more likely to follow through — taking medications correctly, attending follow-ups, and healing faster.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps to better <em>patient outcomes</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your treatment plan or care instructions</h3>
              <p>Drop in any document — treatment plans, post-procedure instructions, insurance explanations, or lab result summaries. Docs2Video reads diagnoses, medications, and care steps automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates branded slides with your care data</h3>
              <p>Your practice branding, your tone, your patient-friendly language — wrapped around clear visuals showing medication schedules, recovery timelines, and what to watch for.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with patients — they watch, understand, and comply</h3>
              <p>Send a shareable link after the appointment. Patients watch at home with their family, re-watch when they have questions, and follow their care plan with confidence.</p>
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
              <div className="comp-old">A printed handout they lose</div>
              <div className="comp-new highlight">A video they re-watch at home</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Patient reaction</div>
              <div className="comp-old">&ldquo;Wait, how many times a day?&rdquo;</div>
              <div className="comp-new highlight">&ldquo;I watched it with my daughter&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Staff time</div>
              <div className="comp-old">Hours answering repeat questions</div>
              <div className="comp-new highlight">Patients self-serve with video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Treatment compliance</div>
              <div className="comp-old">Missed medications and follow-ups</div>
              <div className="comp-new highlight">Patients follow through correctly</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for medical <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3>Treatment plan videos</h3>
              <p>Transform complex treatment plans into clear, narrated videos. Patients see their medication schedule, follow-up timeline, and warning signs explained in plain language.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>HIPAA-conscious design</h3>
              <p>Videos are generated with patient privacy in mind. Shareable links can be password-protected, and no patient data is stored after video generation is complete.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h3>Insurance explanation videos</h3>
              <p>Turn confusing EOBs and coverage documents into videos patients can understand. Reduce billing questions and help patients know what they owe and why before they receive a bill.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <h3>One-click shareable links</h3>
              <p>Send care instruction videos via your patient portal, text, or email. Patients watch on any device and share with family members involved in their care decisions.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to improve patient outcomes and reduce <em>callbacks</em>?</h2>
          <p className="final-cta-sub">Stop repeating yourself. Start your free trial today — no credit card required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
