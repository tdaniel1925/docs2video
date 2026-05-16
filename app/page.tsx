import Link from 'next/link'
import TemplateGallery from './_components/TemplateGallery'
import MobileNav from './_components/MobileNav'
import FaqSection from './_components/FaqSection'
// DemoButton removed — using Get Started only
import SharePagePreview from './_components/SharePagePreview'
// RotatingWords removed — using static hero title
import ClickToPlayVideo from './_components/ClickToPlayVideo'
import IndustryMegaMenu from './_components/IndustryMegaMenu'

export default function HomePage() {
  return (
    <>
      {/* ───── Coming Soon Banner ───── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: 'var(--mint)', textAlign: 'center',
        padding: '10px 16px', fontSize: 14, fontWeight: 600,
        color: 'var(--ink)',
      }}>
        <Link href="/signup" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
          Start free — 5 explainer videos included, no credit card required
        </Link>
      </div>

      <div id="top" className="container">

        {/* ───── Nav ───── */}
        <nav className="top-nav">
          <div className="top-nav-inner">
            <Link href="/" className="logo"><img src="/logo.png" alt="Docs2Video" style={{height:72}} /></Link>
            <div className="top-nav-links">
              <a href="#how-it-works">How It Works</a>
              <a href="#features">Features</a>
              <IndustryMegaMenu />
              <a href="#compare">Compare</a>
              <a href="#templates">Templates</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="top-nav-right">
              <Link href="/login" style={{color:'rgba(255,255,255,0.85)',textDecoration:'none',fontSize:'14px',fontWeight:500}}>Login</Link>
              <Link href="/signup" className="btn btn-mint">Get Started</Link>
            </div>
            <MobileNav />
          </div>
        </nav>

        {/* ───── Hero (side-by-side) ───── */}
        <section className="hero hero-split">
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span>Built for professionals who explain complex things</div>
            <h1 className="hero-title">Turn any document into a professional <em>explainer video</em></h1>
            <p className="hero-sub">Upload a PDF, paste text, or describe an idea. Get a branded narrated video with a shareable client page &mdash; in minutes, not hours.</p>
            <div style={{display:'flex',gap:12,alignItems:'center',marginTop:28,flexWrap:'wrap'}}>
              <Link href="/signup" className="btn btn-primary btn-lg">Start free &mdash; 5 videos included &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined">Watch demo</a>
            </div>
            <div className="hero-trust" style={{marginTop:20,fontSize:13,color:'var(--ink-soft)'}}>No credit card required &middot; Cancel anytime</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo
              src="https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/hero-video.mp4"
              style={{ boxShadow: '0 20px 60px rgba(27,58,92,0.25)' }}
            />
          </div>
        </section>

        {/* ───── Problem / Solution Stats ───── */}
        <section className="section">
          <div style={{textAlign:'center',marginBottom:50}}>
            <div className="section-eyebrow">The problem</div>
            <h2 className="section-title">You send documents. <em>They don&apos;t read them.</em></h2>
            <p className="section-sub" style={{maxWidth:600,margin:'12px auto 0'}}>The average professional document gets less than 2 minutes of attention. Your insights, recommendations, and hard work &mdash; ignored.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:24,maxWidth:800,margin:'0 auto'}}>
            <div style={{textAlign:'center',padding:32,background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)'}}>
              <div style={{fontSize:48,fontWeight:800,color:'var(--mint-darker, #0d9488)',lineHeight:1}}>73%</div>
              <div style={{fontSize:14,color:'var(--ink-soft)',marginTop:8}}>of PDFs are never fully read</div>
            </div>
            <div style={{textAlign:'center',padding:32,background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)'}}>
              <div style={{fontSize:48,fontWeight:800,color:'var(--mint-darker, #0d9488)',lineHeight:1}}>2.7x</div>
              <div style={{fontSize:14,color:'var(--ink-soft)',marginTop:8}}>higher engagement with video</div>
            </div>
            <div style={{textAlign:'center',padding:32,background:'var(--surface)',borderRadius:12,border:'1px solid var(--border)'}}>
              <div style={{fontSize:48,fontWeight:800,color:'var(--mint-darker, #0d9488)',lineHeight:1}}>41%</div>
              <div style={{fontSize:14,color:'var(--ink-soft)',marginTop:8}}>faster close rate with video explainers</div>
            </div>
          </div>
        </section>

        {/* ───── How It Works — 3 Steps ───── */}
        <section className="section" id="how-it-works">
          <div style={{textAlign:'center',marginBottom:60}}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Upload. Pick a format. <em>Done.</em></h2>
            <p className="section-sub" style={{maxWidth:500,margin:'12px auto 0'}}>Three steps. No design skills required.</p>
          </div>
          <div className="steps-row">
            <div className="step-card">
              <div className="step-num-circle">1</div>
              <div className="step-icon mint">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <h3>Drop in any document</h3>
              <p>Upload a PDF, proposal, report, or any document. Our AI reads every page and extracts the key information.</p>
            </div>
            <div className="step-connector"><svg width="40" height="2"><line x1="0" y1="1" x2="40" y2="1" stroke="var(--border)" strokeWidth="2" strokeDasharray="6,4"/></svg></div>
            <div className="step-card">
              <div className="step-num-circle">2</div>
              <div className="step-icon peach">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </div>
              <h3>Choose your format</h3>
              <p>Narrated explainer video, editable slide deck, multi-episode course, or data infographic &mdash; AI builds it in minutes.</p>
            </div>
            <div className="step-connector"><svg width="40" height="2"><line x1="0" y1="1" x2="40" y2="1" stroke="var(--border)" strokeWidth="2" strokeDasharray="6,4"/></svg></div>
            <div className="step-card">
              <div className="step-num-circle">3</div>
              <div className="step-icon lilac">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
              </div>
              <h3>Share &amp; close faster</h3>
              <p>Send a branded share page, download an editable PPTX, or embed your infographic &mdash; whatever works for your client.</p>
            </div>
          </div>
        </section>

        {/* ───── 4 Services ───── */}
        <section className="section" id="features">
          <div style={{textAlign:'center',marginBottom:50}}>
            <div className="section-eyebrow">Four formats, one platform</div>
            <h2 className="section-title">One document. <em>Four ways to share it.</em></h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))',gap:24,maxWidth:1100,margin:'0 auto'}}>
            <div className="feature-card" style={{textAlign:'center',padding:'40px 28px'}}>
              <div style={{fontSize:40,marginBottom:16}}>&#128249;</div>
              <h3>Video Explainer</h3>
              <p>AI-narrated video with branded slides, professional voiceover, and a shareable watch page with built-in chat, calendar booking, and payments.</p>
              <div style={{fontSize:24,fontWeight:800,color:'var(--mint-darker, #0d9488)',marginTop:16}}>$10</div>
            </div>
            <div className="feature-card" style={{textAlign:'center',padding:'40px 28px'}}>
              <div style={{fontSize:40,marginBottom:16}}>&#128221;</div>
              <h3>Slide Deck <span style={{fontSize:13,fontWeight:500,color:'var(--ink-soft)'}}>(Coming Soon)</span></h3>
              <p>Editable PPTX with AI-generated backgrounds and structured text. Download it, customize it, present it &mdash; no design skills needed.</p>
              <div style={{fontSize:24,fontWeight:800,color:'var(--mint-darker, #0d9488)',marginTop:16}}>$10</div>
            </div>
            <div className="feature-card" style={{textAlign:'center',padding:'40px 28px'}}>
              <div style={{fontSize:40,marginBottom:16}}>&#127891;</div>
              <h3>Video Course <span style={{fontSize:13,fontWeight:500,color:'var(--ink-soft)'}}>(Coming Soon)</span></h3>
              <p>Multi-episode narrated series. Turn training manuals, onboarding docs, or educational content into a binge-worthy course.</p>
              <div style={{fontSize:24,fontWeight:800,color:'var(--mint-darker, #0d9488)',marginTop:16}}>$249</div>
            </div>
            <div className="feature-card" style={{textAlign:'center',padding:'40px 28px'}}>
              <div style={{fontSize:40,marginBottom:16}}>&#128202;</div>
              <h3>Infographic <span style={{fontSize:13,fontWeight:500,color:'var(--ink-soft)'}}>(Coming Soon)</span></h3>
              <p>Turn data-heavy reports into beautiful visual summaries. AI extracts charts, stats, and key findings into a single shareable graphic.</p>
              <div style={{fontSize:24,fontWeight:800,color:'var(--mint-darker, #0d9488)',marginTop:16}}>$10</div>
            </div>
          </div>
        </section>

        {/* ───── CTA ───── */}
        <div style={{textAlign:'center',margin:'60px 0'}}>
          <Link href="/signup" className="btn btn-mint btn-lg">Get Started &rarr;</Link>
        </div>

        {/* ───── Why Docs2Video ───── */}
        <section className="section">
          <div style={{textAlign:'center',marginBottom:50}}>
            <div className="section-eyebrow">Why Docs2Video</div>
            <h2 className="section-title">The explainer video <em>workflow</em></h2>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon" style={{background:'var(--mint)'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <h3>Upload anything</h3>
              <p>PDFs, text, ideas &mdash; drop in any document or describe what you want explained. Our AI reads and understands it all.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{background:'var(--peach)'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <h3>AI extracts &amp; writes</h3>
              <p>AI pulls out the key data points, findings, and structure &mdash; then writes a professional narration script automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{background:'var(--lilac)'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </div>
              <h3>Choose your style</h3>
              <p>16+ professionally designed templates or create a completely custom style with AI. Match your brand in one click.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{background:'var(--sky)'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              </div>
              <h3>Professional voiceover</h3>
              <p>6 natural-sounding voices narrate your video. AI matches tone and pacing to your content automatically.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{background:'var(--sun)'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h3>Branded share page</h3>
              <p>Video + calendar booking + AI chat + payments &mdash; all on one branded link your clients can access instantly.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon" style={{background:'var(--rose)'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3>Track &amp; follow up</h3>
              <p>Get notified when clients view your video. Automated follow-up emails keep deals moving without manual effort.</p>
            </div>
          </div>
        </section>

        {/* ───── Share Page Section ───── */}
        <section className="section" id="share-page">
          <div style={{textAlign:'center',marginBottom:40}}>
            <div className="section-eyebrow">The share page</div>
            <h2 className="section-title">One link replaces <em>five tools</em></h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:16,maxWidth:900,margin:'0 auto 40px'}}>
            <div style={{background:'var(--surface)',borderRadius:10,padding:20,border:'1px solid var(--border)'}}>
              <div style={{width:36,height:36,borderRadius:10,background:'var(--mint)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--ink)',marginBottom:4}}>Video explainer</div>
              <div style={{fontSize:13,color:'var(--ink-soft)',lineHeight:1.5}}>Professional narrated video that walks your client through the data in plain language.</div>
            </div>
            <div style={{background:'var(--surface)',borderRadius:10,padding:20,border:'1px solid var(--border)'}}>
              <div style={{width:36,height:36,borderRadius:10,background:'var(--peach)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--ink)',marginBottom:4}}>AI chatbot</div>
              <div style={{fontSize:13,color:'var(--ink-soft)',lineHeight:1.5}}>Your client can ask follow-up questions about the document and get instant AI answers.</div>
            </div>
            <div style={{background:'var(--surface)',borderRadius:10,padding:20,border:'1px solid var(--border)'}}>
              <div style={{width:36,height:36,borderRadius:10,background:'var(--lilac)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--ink)',marginBottom:4}}>Calendar booking</div>
              <div style={{fontSize:13,color:'var(--ink-soft)',lineHeight:1.5}}>Embed your calendar so clients can book a follow-up meeting right from the page.</div>
            </div>
            <div style={{background:'var(--surface)',borderRadius:10,padding:20,border:'1px solid var(--border)'}}>
              <div style={{width:36,height:36,borderRadius:10,background:'var(--sky)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--ink)',marginBottom:4}}>Quotes &amp; payments</div>
              <div style={{fontSize:13,color:'var(--ink-soft)',lineHeight:1.5}}>Attach a quote. Your client accepts and pays via Stripe &mdash; no separate invoice needed.</div>
            </div>
          </div>
          <div style={{textAlign:'center'}}>
            <SharePagePreview />
          </div>
        </section>

        {/* ───── Competitor Comparison ───── */}
        <section className="section" id="compare">
          <div style={{textAlign:'center',marginBottom:40}}>
            <div className="section-eyebrow">See the difference</div>
            <h2 className="section-title">Docs2Video vs. <em>everyone else</em></h2>
          </div>
          <div className="comparison-table">
            <div className="comp-header">
              <div className="comp-label"></div>
              <div className="comp-new">Docs2Video</div>
              <div className="comp-old">Loom</div>
              <div className="comp-old">Synthesia</div>
              <div className="comp-old">Canva</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Reads your document</div>
              <div className="comp-new highlight">&#10003; AI extracts all data</div>
              <div className="comp-old">&#10007; Manual</div>
              <div className="comp-old">&#10007; Manual</div>
              <div className="comp-old">&#10007; Manual</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Output formats</div>
              <div className="comp-new highlight">&#10003; Video, Deck, Course, Infographic</div>
              <div className="comp-old">Video only</div>
              <div className="comp-old">Video only</div>
              <div className="comp-old">~  Slides &amp; graphics</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">AI narration</div>
              <div className="comp-new highlight">&#10003; 6 pro voices</div>
              <div className="comp-old">&#10007; Your own voice</div>
              <div className="comp-old">&#10003; Avatar-based</div>
              <div className="comp-old">&#10007; None</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Editable slide decks</div>
              <div className="comp-new highlight">&#10003; PPTX download</div>
              <div className="comp-old">&#10007; No</div>
              <div className="comp-old">&#10007; No</div>
              <div className="comp-old">~  Canva format only</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Professional styling</div>
              <div className="comp-new highlight">&#10003; AI-designed slides</div>
              <div className="comp-old">~  Brand kit</div>
              <div className="comp-old">~  Manual setup</div>
              <div className="comp-old">~  Brand kit</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Time to create</div>
              <div className="comp-new highlight">Minutes</div>
              <div className="comp-old">10-30 min</div>
              <div className="comp-old">15-60 min</div>
              <div className="comp-old">1-4 hours</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client engagement page</div>
              <div className="comp-new highlight">&#10003; Video + pay + book + chat</div>
              <div className="comp-old">&#10007; Video link only</div>
              <div className="comp-old">&#10007; Video link only</div>
              <div className="comp-old">&#10007; Static file</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Design skills needed</div>
              <div className="comp-new highlight">None</div>
              <div className="comp-old">Presentation skills</div>
              <div className="comp-old">Script writing</div>
              <div className="comp-old">Design skills</div>
            </div>
          </div>
        </section>

        {/* ───── Template Gallery ───── */}
        <section className="section" id="templates">
          <div style={{textAlign:'center',marginBottom:40}}>
            <div className="section-eyebrow">39 styles</div>
            <h2 className="section-title">Every video looks like you hired <em>a design team</em></h2>
            <p className="section-sub" style={{maxWidth:600,margin:'0 auto'}}>From executive boardroom to watercolor to hand-drawn doodles. Pick a style that matches your message, or create your own with AI.</p>
          </div>
          <TemplateGallery />
        </section>

        {/* ───── Stats Strip ───── */}
        <section className="stats-strip">
          <div className="stats-strip-inner">
            <div className="strip-stat">
              <div className="strip-num">10K+</div>
              <div className="strip-label">Documents converted</div>
            </div>
            <div className="strip-divider" />
            <div className="strip-stat">
              <div className="strip-num">2,500+</div>
              <div className="strip-label">Professionals</div>
            </div>
            <div className="strip-divider" />
            <div className="strip-stat">
              <div className="strip-num">4.9/5</div>
              <div className="strip-label">Average rating</div>
            </div>
            <div className="strip-divider" />
            <div className="strip-stat">
              <div className="strip-num">&lt;90s</div>
              <div className="strip-label">Average generation time</div>
            </div>
          </div>
        </section>

        {/* ───── Use Cases ───── */}
        <section className="section">
          <div style={{textAlign:'center',marginBottom:50}}>
            <div className="section-eyebrow" id="use-cases">Built for every industry</div>
            <h2 className="section-title">Complex documents, <em>simple</em> videos</h2>
          </div>
          <div className="use-cases-grid">
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--mint)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3>Insurance</h3>
              <p>Turn 30-page policy illustrations into clear 3-minute explainers your clients actually understand before they sign.</p>
              <div className="uc-example">Illustration PDF &rarr; Narrated policy explainer</div>
            </div>
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--peach)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <h3>Real Estate</h3>
              <p>Transform property appraisals and CMAs into visual walkthroughs that sell the listing before the showing.</p>
              <div className="uc-example">Appraisal &rarr; Property showcase video</div>
            </div>
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--lilac)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <h3>Financial Services</h3>
              <p>Convert portfolio reports and retirement projections into polished client presentations that build trust.</p>
              <div className="uc-example">401k statement &rarr; Retirement summary video</div>
            </div>
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--sky)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <h3>Legal</h3>
              <p>Turn dense settlement terms and case summaries into executive-friendly explainers clients can share with their teams.</p>
              <div className="uc-example">Contract &rarr; Executive brief video</div>
            </div>
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--sun)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <h3>Healthcare</h3>
              <p>Simplify benefits packages and medical reports into clear visual summaries for employees and patients.</p>
              <div className="uc-example">Benefits summary &rarr; Employee explainer</div>
            </div>
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--rose)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <h3>Consulting</h3>
              <p>Deliver audit findings and strategic recommendations as professional video presentations that command attention.</p>
              <div className="uc-example">Audit report &rarr; Visual findings presentation</div>
            </div>
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--mint)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <h3>Education</h3>
              <p>Transform research papers and course materials into engaging video content students will actually watch.</p>
              <div className="uc-example">Research paper &rarr; Visual summary</div>
            </div>
            <div className="use-case-card">
              <div className="uc-icon" style={{background:'var(--peach)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
              </div>
              <h3>Mortgage</h3>
              <p>Turn loan estimates and closing disclosures into clear borrower explainers that reduce callbacks by 60%.</p>
              <div className="uc-example">Loan estimate &rarr; Borrower summary video</div>
            </div>
          </div>
        </section>

        {/* ───── CTA ───── */}
        <div style={{textAlign:'center',margin:'60px 0'}}>
          <Link href="/signup" className="btn btn-mint btn-lg">Get Started &rarr;</Link>
        </div>

        {/* ───── Before / After Comparison ───── */}
        <section className="section">
          <div style={{textAlign:'center',marginBottom:40}}>
            <div className="section-eyebrow">Before &amp; after</div>
            <h2 className="section-title">The old way is <em>costing</em> you deals</h2>
          </div>
          <div className="comparison-table">
            <div className="comp-header">
              <div className="comp-label"></div>
              <div className="comp-old">Without Docs2Video</div>
              <div className="comp-new">With Docs2Video</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Time to create</div>
              <div className="comp-old">2-4 hours in PowerPoint</div>
              <div className="comp-new highlight">90 seconds</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client comprehension</div>
              <div className="comp-old">Skimmed, confused, ghosted</div>
              <div className="comp-new highlight">Watched, understood, engaged</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Design skills needed</div>
              <div className="comp-old">PowerPoint, Canva, Photoshop</div>
              <div className="comp-new highlight">None</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Follow-up</div>
              <div className="comp-old">&ldquo;Did you read the PDF?&rdquo;</div>
              <div className="comp-new highlight">View tracking + AI follow-ups</div>
            </div>
            <div className="comp-row">
              <div className="comp-label">Client action</div>
              <div className="comp-old">Separate email, calendar, invoice</div>
              <div className="comp-new highlight">Watch, book, pay &mdash; one link</div>
            </div>
          </div>
        </section>

        {/* ───── How Pricing Works ───── */}
        <section className="section" id="how-pricing-works">
          <div style={{textAlign:'center',marginBottom:40}}>
            <div className="section-eyebrow">Pricing that scales with you</div>
            <h2 className="section-title">Start free &mdash; pay as you go or <em>subscribe for discounts</em></h2>
          </div>
          <div style={{maxWidth:700,margin:'0 auto',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',padding:'12px 16px',color:'var(--ink-soft)',fontWeight:600}}></th>
                  <th style={{textAlign:'center',padding:'12px 16px',color:'var(--ink-soft)',fontWeight:600}}>Pay Per Project</th>
                  <th style={{textAlign:'center',padding:'12px 16px',color:'var(--ink-soft)',fontWeight:600}}>Pro ($25/mo)</th>
                  <th style={{textAlign:'center',padding:'12px 16px',fontWeight:700,color:'var(--mint-darker, #0d9488)'}}>Business ($99/mo)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>Per video</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>$10</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>$6 (40% off)</td>
                  <td style={{textAlign:'center',padding:'12px 16px',fontWeight:700,color:'var(--mint-darker, #0d9488)'}}>$0 (included)</td>
                </tr>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>10 videos/mo</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>$100</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>$85</td>
                  <td style={{textAlign:'center',padding:'12px 16px',fontWeight:700,color:'var(--mint-darker, #0d9488)'}}>$99</td>
                </tr>
                <tr>
                  <td style={{padding:'12px 16px',fontWeight:600}}>50 videos/mo</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>$500</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>$325</td>
                  <td style={{textAlign:'center',padding:'12px 16px',fontWeight:700,color:'var(--mint-darker, #0d9488)'}}>$99</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ───── Pricing ───── */}
        <section className="section" id="pricing">
          <div style={{textAlign:'center',marginBottom:50}}>
            <div className="section-eyebrow">Pricing</div>
            <h2 className="section-title">Simple, transparent <em>pricing</em></h2>
            <p className="section-sub" style={{maxWidth:600,margin:'0 auto'}}>Start free with 5 videos included. Then pay per project or subscribe for discounts.</p>
          </div>
          <div className="pricing-grid-5">
            {/* Pay Per Project */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Pay Per Project</div>
              <div className="pricing-price">$0</div>
              <div className="pricing-period">per month</div>
              <ul className="pricing-features">
                <li>$10 per video, deck, or infographic</li>
                <li>Full quality, no watermark</li>
                <li>Share pages with AI chat</li>
                <li>Download MP4, PDF, PPTX</li>
              </ul>
              <Link href="/signup" className="btn btn-outlined btn-full">Start free</Link>
            </div>
            {/* Pro */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Pro</div>
              <div className="pricing-price">$25</div>
              <div className="pricing-period">per month</div>
              <ul className="pricing-features">
                <li>$6 per project (40% off)</li>
                <li>Priority generation</li>
                <li>Unlimited brands</li>
                <li>Everything in Free</li>
              </ul>
              <Link href="/signup" className="btn btn-mint btn-full">Subscribe</Link>
            </div>
            {/* Business */}
            <div className="pricing-card popular" style={{padding:24}}>
              <div className="pricing-badge">MOST POPULAR</div>
              <div className="pricing-name">Business</div>
              <div className="pricing-price">$99</div>
              <div className="pricing-period">per month</div>
              <ul className="pricing-features">
                <li>50 projects per month included</li>
                <li>No per-project fees</li>
                <li>Priority support</li>
                <li>Courses at $99 each</li>
              </ul>
              <Link href="/signup" className="btn btn-primary btn-full">Subscribe</Link>
            </div>
            {/* Agency */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Agency</div>
              <div className="pricing-price">$249</div>
              <div className="pricing-period">per month</div>
              <ul className="pricing-features">
                <li>150 projects per month</li>
                <li>5 video courses included</li>
                <li>Team sharing (coming soon)</li>
                <li>White-label (coming soon)</li>
              </ul>
              <Link href="/signup" className="btn btn-mint btn-full">Subscribe</Link>
            </div>
            {/* Enterprise */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Enterprise</div>
              <div className="pricing-price">Custom</div>
              <div className="pricing-period">&nbsp;</div>
              <ul className="pricing-features">
                <li>Unlimited everything</li>
                <li>Dedicated account manager</li>
                <li>Custom integrations</li>
                <li>SLA guarantee</li>
              </ul>
              <a href="mailto:support@docs2video.com" className="btn btn-outlined btn-full">Contact Sales</a>
            </div>
          </div>
        </section>

        {/* ───── Trust Badges ───── */}
        <section className="trust-strip">
          <div className="trust-inner">
            <div className="trust-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Bank-level encryption</span>
            </div>
            <div className="trust-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>SOC 2 compliant</span>
            </div>
            <div className="trust-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Documents processed securely</span>
            </div>
            <div className="trust-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>99.9% uptime</span>
            </div>
          </div>
        </section>

        {/* ───── Testimonials ───── */}
        <section className="section" id="testimonials">
          <div style={{textAlign:'center',marginBottom:50}}>
            <div className="section-eyebrow">What professionals say</div>
            <h2 className="section-title">Trusted by professionals who <em>explain complex things</em></h2>
          </div>

          {/* Featured testimonial */}
          <div style={{background:'white',border:'1px solid var(--border-light)',borderRadius:10,padding:40,maxWidth:800,margin:'0 auto 32px',textAlign:'center'}}>
            <p style={{fontSize:18,lineHeight:1.8,color:'var(--ink)',marginBottom:24,fontStyle:'italic'}}>&ldquo;The quality of the videos Docs2Video produces is outstanding. You upload a document, and within minutes you have a professional, polished explainer video that looks like it was made by a production studio. The AI narration sounds natural, the slides are beautifully designed, and the share pages make it easy for anyone to watch and take action.&rdquo;</p>
            <div style={{fontWeight:800,fontSize:16}}>Bill Ropper</div>
            <div style={{fontSize:14,color:'var(--ink-soft)'}}>CEO, 3Mark Financial</div>
          </div>

          {/* Testimonial grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:24,maxWidth:900,margin:'0 auto'}}>
            <div className="feature-card" style={{padding:28}}>
              <p style={{fontSize:14,lineHeight:1.7,color:'var(--ink-soft)',marginBottom:16}}>&ldquo;What impressed me most is the consistency and polish of every video. The template styles look professional, the voiceover quality is remarkable, and the branded share pages with built-in scheduling and AI chat are features I haven&apos;t seen anywhere else. It&apos;s a genuinely well-built product.&rdquo;</p>
              <div style={{fontWeight:700,fontSize:14}}>Betsy Riley</div>
              <div style={{fontSize:13,color:'var(--ink-soft)'}}>CFO, 3Mark Financial</div>
            </div>
            <div className="feature-card" style={{padding:28}}>
              <p style={{fontSize:14,lineHeight:1.7,color:'var(--ink-soft)',marginBottom:16}}>&ldquo;The video quality is incredible — it takes a dense, complicated document and turns it into something anyone can understand in a few minutes. The AI knows exactly what data to highlight, the narration sounds like a real person, and the final product looks like something you&apos;d pay thousands for. Hands down the best tool I&apos;ve used.&rdquo;</p>
              <div style={{fontWeight:700,fontSize:14}}>Phil Resch</div>
              <div style={{fontSize:13,color:'var(--ink-soft)'}}>President, Valor Financial Strategies</div>
            </div>
          </div>
        </section>

        {/* ───── FAQ ───── */}
        <FaqSection />

        {/* ───── Final CTA ───── */}
        <section className="final-cta">
          <h2>Stop sending documents <em>nobody reads</em></h2>
          <p className="final-cta-sub">Join 2,500+ professionals who use Docs2Video to turn complex documents into professional explainer videos their clients actually watch.</p>
          <div className="final-cta-buttons">
            <Link href="/signup" className="btn btn-primary btn-lg">Start free &mdash; 5 videos included &rarr;</Link>
          </div>
          <div className="final-cta-perks">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              No credit card required
            </span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              Ready in under 5 minutes
            </span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              No design skills needed
            </span>
          </div>
        </section>

      </div>

      {/* ───── Footer ───── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="logo"><img src="/logo.png" alt="Docs2Video" style={{height:60}} /></div>
              <p>Turn any document into a branded, narrated explainer video your clients will actually watch. Powered by AI. Ready in 90 seconds.</p>
              <div className="footer-contact">
                <a href="mailto:support@docs2video.com">support@docs2video.com</a>
              </div>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#compare">Compare</a></li>
                <li><Link href="/templates">Templates</Link></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><Link href="/analytics">Analytics</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <ul>
                <li><a href="#use-cases">Use Cases</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><Link href="/cookies">Cookie Policy</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="mailto:support@docs2video.com">Contact</a></li>
                <li><Link href="/terms">Terms of Service</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div>&copy; 2026 Docs2Video. All rights reserved.</div>
            <div className="footer-socials">
              <a href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.8a8.5 8.5 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3 8.4 8.4 0 0 1-2.7 1A4.2 4.2 0 0 0 11.5 9c0 .3 0 .6.1.9A12 12 0 0 1 3 4.6a4.2 4.2 0 0 0 1.3 5.6 4.2 4.2 0 0 1-1.9-.5v.1a4.2 4.2 0 0 0 3.4 4.1 4.2 4.2 0 0 1-1.9.1 4.2 4.2 0 0 0 3.9 2.9A8.4 8.4 0 0 1 2 18.5a12 12 0 0 0 6.5 1.9c7.8 0 12.1-6.5 12.1-12.1v-.6A8.6 8.6 0 0 0 22 5.8z"/></svg>
              </a>
              <a href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3zM6.5 8.3a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.5zM19 19h-3v-4.7c0-1.1 0-2.5-1.5-2.5S13 13 13 14.2V19h-3v-9h2.9v1.3a3.1 3.1 0 0 1 2.8-1.5c3 0 3.6 2 3.6 4.5z"/></svg>
              </a>
              <a href="#">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.8.2 2.3.4.6.2 1 .5 1.5 1s.8.9 1 1.5c.2.5.4 1.1.4 2.3.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.2 1.8-.4 2.3a4 4 0 0 1-1 1.5 4 4 0 0 1-1.5 1c-.5.2-1.1.4-2.3.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.8-.2-2.3-.4a4 4 0 0 1-1.5-1 4 4 0 0 1-1-1.5c-.2-.5-.4-1.1-.4-2.3-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c0-1.2.2-1.8.4-2.3.2-.6.5-1 1-1.5s.9-.8 1.5-1c.5-.2 1.1-.4 2.3-.4 1.2-.1 1.6-.1 4.8-.1zm0 5.6a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zm0 6.9a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4zm5.4-7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

    </>
  )
}
