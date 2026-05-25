import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Education | Research That Reaches Beyond the Abstract',
  description:
    'Educators and researchers: turn dense papers, grant reports, and course materials into engaging explainer videos and visual summaries. Increase comprehension by 35%.',
}

export default function EducationPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for educators &amp; researchers</div>
            <h1 className="hero-title">Your research is groundbreaking. Your students are <em>asleep</em>.</h1>
            <p className="hero-sub">
              Docs2Video transforms dense research papers, grant reports, and course materials into engaging visual summaries and narrated explainer videos — in seconds, not semesters.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Used by professors at 150+ universities worldwide</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/education.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
          </div>
        </section>
      </div>

      {/* Pain Points */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">Brilliant work, limited <em>reach</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>82%</div>
              <h3>of assigned readings go unread</h3>
              <p>You assign a 50-page paper. Students skim the abstract, skip the methodology, and show up to lecture with zero context for the discussion.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>50%</div>
              <h3>of published research is never cited</h3>
              <p>Groundbreaking findings locked in PDF format never reach the practitioners, policymakers, or public who could act on them.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>8 hrs</div>
              <h3>to create a conference poster or presentation</h3>
              <p>Reformatting findings from a full paper into a poster, grant summary, or department presentation is tedious, repetitive work that pulls you away from research.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">From paper to <em>impact</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your research paper or course material</h3>
              <p>Drop in any academic document — journal articles, grant reports, dissertations, or lecture notes. Docs2Video parses structure, key findings, tables, and citations automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI creates visual summaries and study guides</h3>
              <p>Methodology, key findings, and implications — distilled into clear infographics students can absorb in under a minute, or conference posters that stand out in a sea of text.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with students and colleagues — they engage</h3>
              <p>Embed a narrated explainer video in your course site. Post a visual summary on social media. Students watch before class, colleagues share at conferences, and your research reaches further.</p>
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
              <div className="comp-label">Assigned reading</div>
              <div className="comp-old">50-page PDF nobody finishes</div>
              <div className="comp-new highlight">5-minute narrated summary + infographic</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Student preparation</div>
              <div className="comp-old">Blank stares in lecture</div>
              <div className="comp-new highlight">Students arrive ready to discuss</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Conference presentation</div>
              <div className="comp-old">8 hours reformatting a paper</div>
              <div className="comp-new highlight">90 seconds to generate a visual poster</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Research impact</div>
              <div className="comp-old">Cited by a handful of peers</div>
              <div className="comp-new highlight">Shared, watched, and acted on</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for the <em>academic</em> workflow</h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              </div>
              <h3>Academic paper parsing</h3>
              <p>Docs2Video understands the structure of academic papers — abstract, methodology, results, discussion. It extracts key findings and translates them into accessible visuals.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <h3>LMS-ready video embeds</h3>
              <p>Export as MP4 for Canvas, Blackboard, or Moodle. Embed directly in course sites so students can watch before lecture — no app download required.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <h3>Conference-ready poster exports</h3>
              <p>Generate publication-quality visual posters from any paper. Export as PNG or PDF in standard poster dimensions — perfect for academic conferences and departmental showcases.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h3>Academic and institutional pricing</h3>
              <p>Discounted plans for universities, departments, and student groups. Volume licensing for campus-wide deployment. Students can use it for their own study guides and presentations.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to make your research <em>accessible</em>?</h2>
          <p className="final-cta-sub">Give your work the audience it deserves. Start free — cancel anytime.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
