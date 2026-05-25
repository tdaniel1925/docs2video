import Link from 'next/link'
import ClickToPlayVideo from '../../../_components/ClickToPlayVideo'

export const metadata = {
  title: 'Docs2Video for Coaches & Consultants | Make Your Proposals Impossible to Ignore',
  description:
    'Private coaches and consultants: transform coaching proposals, program outlines, and course materials into branded videos that close more clients.',
}

export default function CoachingPage() {
  return (
    <>
      {/* Hero */}
      <div className="container">
        <section className="hero hero-split" style={{ marginTop: 20 }}>
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span> Built for coaches &amp; consultants</div>
            <h1 className="hero-title">Your proposals look the same as everyone else&apos;s. Your expertise <em>deserves better</em></h1>
            <p className="hero-sub">
              Docs2Video transforms coaching proposals, program outlines, and course materials into branded, narrated videos that showcase your expertise and close more clients.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined btn-lg">See how it works</a>
            </div>
            <div className="hero-trust" style={{ marginTop: 20 }}>Trusted by coaches and consultants worldwide</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/industry-demos/coaching.mp4" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
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
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--rose)', lineHeight: 1, marginBottom: 12 }}>40%</div>
              <h3>more clients closed by coaches who use video</h3>
              <p>When prospects can see and hear your methodology explained visually, they connect with your approach on a deeper level — and say yes faster.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--peach)', lineHeight: 1, marginBottom: 12 }}>83%</div>
              <h3>of prospects prefer video over PDFs</h3>
              <p>Your prospects are busy executives and professionals. They don&apos;t want to read another generic proposal — they want to see what makes you different.</p>
            </div>
            <div className="feature-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--sun)', lineHeight: 1, marginBottom: 12 }}>90 sec</div>
              <h3>is all your proposal gets</h3>
              <p>The average coaching proposal gets just 90 seconds of attention before a prospect decides to move forward or move on. Make those seconds count.</p>
            </div>
          </div>
        </section>
      </div>

      {/* How It Works */}
      <div className="container" id="how-it-works">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Three steps to <em>standout proposals</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>1</span>
              </div>
              <h3>Upload your coaching proposal or program outline</h3>
              <p>Drop in any document — coaching proposals, program outlines, client progress reports, or course materials. Docs2Video reads your methodology, pricing, and outcomes automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>2</span>
              </div>
              <h3>AI generates branded slides with your expertise</h3>
              <p>Your personal brand, your voice, your framework — wrapped around compelling visuals showing your process, expected outcomes, and what makes your approach unique.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>3</span>
              </div>
              <h3>Share with prospects — they watch, connect, and commit</h3>
              <p>Send a shareable link after your discovery call. Prospects watch a personalized 3-minute video that reinforces your expertise and makes saying yes feel easy.</p>
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
              <div className="comp-old">A generic PDF proposal</div>
              <div className="comp-new highlight">A personalized branded video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prospect reaction</div>
              <div className="comp-old">&ldquo;Looks like every other coach&rdquo;</div>
              <div className="comp-new highlight">&ldquo;This person really gets it&rdquo;</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Prep time</div>
              <div className="comp-old">2+ hours customizing each proposal</div>
              <div className="comp-new highlight">Under 90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Close rate</div>
              <div className="comp-old">Lost to cheaper competitors</div>
              <div className="comp-new highlight">Won on perceived value</div>
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <div className="container">
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 50 }}>
            <div className="section-eyebrow">Features</div>
            <h2 className="section-title">Built for coaching <em>workflows</em></h2>
          </div>
          <div className="features-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--mint)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <h3>Personalized proposal videos</h3>
              <p>Each video is tailored to the specific prospect — their goals, their challenges, and how your coaching program addresses their unique situation. No two proposals look alike.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--sky)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h3>Progress report videos</h3>
              <p>Transform client progress data into visual milestone videos. Show clients how far they&apos;ve come with charts and narratives that reinforce the value of your coaching.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--lilac)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <h3>Course material conversion</h3>
              <p>Turn your frameworks, worksheets, and training materials into professional video modules. Build a scalable content library that works for you 24/7.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{ background: 'var(--peach)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </div>
              <h3>One-click shareable links</h3>
              <p>Send via email, text, or LinkedIn DM. Track when prospects view your proposal so you know exactly when to follow up — and never wonder if they saw it.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Final CTA */}
      <div className="container">
        <section className="final-cta">
          <h2>Ready to make your proposals <em>impossible to ignore</em>?</h2>
          <p className="final-cta-sub">Stop blending in with every other coach. Start your free trial today — cancel anytime.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Try a free demo &rarr;</Link>
            <Link href="/" className="btn btn-outlined btn-lg">Learn more</Link>
          </div>
        </section>
      </div>
    </>
  )
}
