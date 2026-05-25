import Link from 'next/link'

interface IndustryPageProps {
  industry: string
  tagline: string
  heroDescription: string
  painPoints: { title: string; description: string }[]
  howItHelps: { title: string; description: string }[]
  exampleBefore: string
  exampleAfter: string
  testimonial: {
    quote: string
    name: string
    title: string
    initials: string
    color?: string
  }
  faqs: { q: string; a: string }[]
}

export default function IndustryPage({
  industry,
  tagline,
  heroDescription,
  painPoints,
  howItHelps,
  exampleBefore,
  exampleAfter,
  testimonial,
  faqs,
}: IndustryPageProps) {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero" style={{ marginTop: 20 }}>
          <div className="hero-eyebrow"><span className="star">&#10022;</span>Built for {industry.toLowerCase()} professionals</div>
          <h1 className="hero-title">Docs2Video for <em>{industry}</em></h1>
          <p className="hero-sub">{tagline}</p>
          <div className="hero-ctas">
            <Link className="btn btn-primary btn-lg" href="/signup">Start free trial &rarr;</Link>
            <Link className="btn btn-outlined btn-lg" href="/#templates">See templates</Link>
          </div>
          <div className="hero-note">2 free short videos &middot; cancel anytime</div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Sound <em>familiar</em>?</h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {painPoints.map((p, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon" style={{ background: ['var(--rose)', 'var(--peach)', 'var(--sun)'][i % 3] }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* How Docs2Video Helps */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The solution</div>
            <h2 className="section-title">How Docs2Video <em>helps</em></h2>
            <p className="section-sub" style={{ maxWidth: 600, margin: '0 auto' }}>{heroDescription}</p>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {howItHelps.map((h, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon" style={{ background: ['var(--mint)', 'var(--sky)', 'var(--lilac)'][i % 3] }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h3>{h.title}</h3>
                <p>{h.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Before → After */}
      <div className="container">
        <section className="section">
          <div className="comparison-table" style={{ maxWidth: 700, margin: '0 auto' }}>
            <div className="comp-header">
              <div className="comp-label"></div>
              <div className="comp-old">Before</div>
              <div className="comp-new">With Docs2Video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Input</div>
              <div className="comp-old">{exampleBefore}</div>
              <div className="comp-new highlight">{exampleAfter}</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Time</div>
              <div className="comp-old">2-4 hours</div>
              <div className="comp-new highlight">30 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Design skills</div>
              <div className="comp-old">Required</div>
              <div className="comp-new highlight">None needed</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Video explainer</div>
              <div className="comp-old">Not possible</div>
              <div className="comp-new highlight">Auto-generated</div>
            </div>
          </div>
        </section>
      </div>

      {/* Testimonial */}
      <div className="container">
        <section className="testimonial-section">
          <h2>Trusted by {industry.toLowerCase()} <em>professionals</em></h2>
          <div className="testimonial-grid" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="testimonial-card">
              <div className="testimonial-stars">&#9733; &#9733; &#9733; &#9733; &#9733;</div>
              <blockquote>&ldquo;{testimonial.quote}&rdquo;</blockquote>
              <div className="testimonial-author">
                <div className="testimonial-avatar" style={testimonial.color ? { background: testimonial.color } : undefined}>{testimonial.initials}</div>
                <div>
                  <div className="testimonial-name">{testimonial.name}</div>
                  <div className="testimonial-title">{testimonial.title}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* FAQ */}
      <div className="container">
        <section className="section">
          <div className="faq-section">
            <div>
              <div className="section-eyebrow">FAQ</div>
              <h2 className="section-title">{industry} <em>questions</em></h2>
            </div>
            <div className="faq-list">
              {faqs.map((faq, i) => (
                <div key={i} className={`faq-item${i === 0 ? ' open' : ''}`}>
                  <div className="faq-item-head">
                    <div className="faq-q">{faq.q}</div>
                    <div className="faq-toggle">+</div>
                  </div>
                  {i === 0 && <div className="faq-a">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to transform your {industry.toLowerCase()} <em>workflow</em>?</h2>
          <p className="final-cta-sub">Start free. No commitment required.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Start free trial</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
