import Link from 'next/link'
import MobileNav from './_components/MobileNav'
import FaqSection from './_components/FaqSection'
// DemoButton removed — using Get Started only
import SharePagePreview from './_components/SharePagePreview'
// RotatingWords removed — using static hero title
import ClickToPlayVideo from './_components/ClickToPlayVideo'
import IndustryMegaMenu from './_components/IndustryMegaMenu'
import { createAdminClient } from './_lib/supabase/admin'

const FALLBACK_VIDEO = 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/site-assets/hero-video.mp4'
const HERO_VIDEO_ID = 'ef7cd8fd-247e-438b-91e5-35bed0be98f0'

async function getHeroVideoUrl(): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('videos')
      .select('video_url')
      .eq('id', HERO_VIDEO_ID)
      .single()
    return data?.video_url || FALLBACK_VIDEO
  } catch {
    return FALLBACK_VIDEO
  }
}

export default async function HomePage() {
  const heroVideoUrl = await getHeroVideoUrl()
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
          Start free — 2 short videos included
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
              <a href="#pricing">Pricing</a>
              <Link href="/blog">Blog</Link>
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
              <Link href="/signup" className="btn btn-primary btn-lg">Start free &mdash; 2 short videos &rarr;</Link>
              <a href="#how-it-works" className="btn btn-outlined">Watch demo</a>
            </div>
            <div className="hero-trust" style={{marginTop:20,fontSize:13,color:'var(--ink-soft)'}}>Cancel anytime &middot; No commitment</div>
          </div>
          <div className="hero-right">
            <ClickToPlayVideo
              src={heroVideoUrl}
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
              <p>AI-narrated video with branded slides, professional voiceover, and a shareable watch page with calendar booking and payments.</p>
              <div style={{fontSize:24,fontWeight:800,color:'var(--mint-darker, #0d9488)',marginTop:16}}>$10</div>
            </div>
            <div className="feature-card" style={{textAlign:'center',padding:'40px 28px'}}>
              <div style={{fontSize:40,marginBottom:16}}>&#128221;</div>
              <h3>Slide Deck</h3>
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
              <p>Video + calendar booking + payments &mdash; all on one branded link your clients can access instantly.</p>
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

        {/* ───── Templates (Major Differentiator) ───── */}
        <section className="section" id="templates" style={{background:'var(--ink)',color:'white',borderRadius:10,padding:'64px 48px',margin:'0 -24px'}}>
          <div style={{textAlign:'center',marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mint)',marginBottom:12}}>What sets us apart</div>
            <h2 className="section-title" style={{color:'white'}}>Stunning AI-illustrated styles. <em style={{color:'var(--mint)'}}>Every video is a work of art.</em></h2>
            <p style={{fontSize:16,color:'rgba(255,255,255,0.7)',maxWidth:650,margin:'12px auto 0',lineHeight:1.7}}>
              Choose from curated illustration styles or upload any image as a reference. Every slide is a custom piece of AI-generated artwork &mdash; not a generic template.
            </p>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:16,maxWidth:900,margin:'32px auto'}}>
            {[
              {src:'/style-previews/warm-story.png', label:'Warm Story', desc:'Cozy illustrations, families, nature'},
              {src:'/style-previews/corporate-clean.png', label:'Corporate Clean', desc:'Professional flat vector, data-forward'},
              {src:'/style-previews/bold-infographic.png', label:'Bold Infographic', desc:'High contrast, big numbers, impactful'},
              {src:'/style-previews/watercolor.png', label:'Watercolor', desc:'Soft painted scenes, artistic, gentle'},
              {src:'/style-previews/dark-cinematic.png', label:'Dark Cinematic', desc:'Navy & gold, dramatic, luxurious'},
              {src:'/style-previews/playful-cartoon.png', label:'Playful Cartoon', desc:'Bright colors, friendly characters, fun'},
            ].map((t) => (
              <div key={t.label} style={{borderRadius:10,overflow:'hidden',border:'1px solid rgba(255,255,255,0.1)',transition:'transform 0.2s'}} className="activity-row">
                <img src={t.src} alt={t.label} loading="lazy" style={{width:'100%',aspectRatio:'16/9',objectFit:'cover',display:'block'}} />
                <div style={{padding:'10px 12px'}}>
                  <div style={{fontSize:14,fontWeight:700,color:'white',marginBottom:2}}>{t.label}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{textAlign:'center',marginTop:32}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:24,flexWrap:'wrap',justifyContent:'center'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:42,fontWeight:800,color:'var(--mint)',lineHeight:1}}>60+</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginTop:4}}>Built-in styles</div>
              </div>
              <div style={{width:1,height:40,background:'rgba(255,255,255,0.15)'}} />
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:42,fontWeight:800,color:'var(--mint)',lineHeight:1}}>AI</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginTop:4}}>Custom template maker</div>
              </div>
              <div style={{width:1,height:40,background:'rgba(255,255,255,0.15)'}} />
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:42,fontWeight:800,color:'var(--mint)',lineHeight:1}}>1-click</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginTop:4}}>Brand matching</div>
              </div>
            </div>
            <div style={{marginTop:28}}>
              <Link href="/signup" className="btn btn-mint" style={{fontSize:16,padding:'14px 32px'}}>Start free &mdash; try any template &rarr;</Link>
            </div>
          </div>
        </section>

        {/* ───── Industry Intelligence (Key Differentiator) ───── */}
        <section className="section" id="industries">
          <div style={{textAlign:'center',marginBottom:48}}>
            <div className="section-eyebrow">Industry intelligence</div>
            <h2 className="section-title">The only explainer platform that <em>speaks your language</em></h2>
            <p className="section-sub" style={{maxWidth:650,margin:'12px auto 0'}}>Other tools generate generic videos. Docs2Video auto-detects your industry and applies the right terminology, compliance language, storytelling structure, and visual style — automatically.</p>
          </div>

          {/* Industry grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:12,maxWidth:1000,margin:'0 auto 40px'}}>
            {[
              {icon:'🛡', label:'Insurance', detail:'Carrier rules, disclaimers, policy structure'},
              {icon:'📊', label:'Financial', detail:'SEC compliance, portfolio terminology'},
              {icon:'🏠', label:'Real Estate', detail:'Property features, market comps, MLS'},
              {icon:'🏦', label:'Mortgage', detail:'APR, LTV, TILA/RESPA disclosures'},
              {icon:'⚕', label:'Healthcare', detail:'Benefits, EOBs, patient-friendly terms'},
              {icon:'⚖', label:'Legal', detail:'Plain-English contracts, liability terms'},
              {icon:'📋', label:'Consulting', detail:'ROI, findings, strategic frameworks'},
              {icon:'🎓', label:'Education', detail:'Research, curriculum, academic style'},
              {icon:'📑', label:'Accounting', detail:'GAAP, tax implications, CPA language'},
              {icon:'💻', label:'Technology', detail:'Specs, architecture, security audits'},
              {icon:'👥', label:'HR', detail:'Compensation, benefits, offer letters'},
              {icon:'💼', label:'Sales', detail:'Proposals, case studies, pricing'},
            ].map((ind) => (
              <div key={ind.label} style={{background:'white',border:'1px solid var(--border-light)',borderRadius:10,padding:'16px 14px',textAlign:'center',transition:'transform 0.2s'}} className="activity-row">
                <div style={{fontSize:28,marginBottom:8}}>{ind.icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--ink)',marginBottom:4}}>{ind.label}</div>
                <div style={{fontSize:11,color:'var(--ink-soft)',lineHeight:1.4}}>{ind.detail}</div>
              </div>
            ))}
          </div>

          {/* What makes this different */}
          <div style={{background:'var(--ink)',color:'white',borderRadius:10,padding:'40px 48px',maxWidth:900,margin:'0 auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mint)',marginBottom:12}}>What other tools do</div>
                <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:10}}>
                  {['Generic scripts for every document','Same tone regardless of industry','No compliance awareness','Manual disclaimer writing','Generic "contact us" CTAs'].map((item,i) => (
                    <li key={i} style={{fontSize:14,color:'rgba(255,255,255,0.5)',display:'flex',alignItems:'center',gap:8}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,100,0.7)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mint)',marginBottom:12}}>What Docs2Video does</div>
                <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:10}}>
                  {['Auto-detects your industry from the document','Applies industry-specific terminology and tone','Adds required legal disclaimers automatically','Uses proven storytelling frameworks per industry','Industry-appropriate CTAs that convert'].map((item,i) => (
                    <li key={i} style={{fontSize:14,color:'rgba(255,255,255,0.9)',display:'flex',alignItems:'center',gap:8}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ───── Share Page Section ───── */}
        <section className="section" id="share-page">
          <div style={{textAlign:'center',marginBottom:40}}>
            <div className="section-eyebrow">The share page</div>
            <h2 className="section-title">One link replaces <em>five tools</em></h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:24,maxWidth:1000,margin:'0 auto 48px'}}>
            <div style={{background:'white',borderRadius:10,padding:32,border:'1px solid var(--border-light)',transition:'transform 0.2s, box-shadow 0.2s'}} className="activity-row">
              <div style={{width:56,height:56,borderRadius:10,background:'var(--mint)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14" />
                  <rect x="2" y="6" width="13" height="12" rx="2" />
                  <path d="M6 12h4" />
                </svg>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:'var(--ink)',marginBottom:8}}>Video explainer</div>
              <div style={{fontSize:14,color:'var(--ink-soft)',lineHeight:1.7}}>Professional narrated video that walks your client through the data in plain language. They watch, understand, and take action.</div>
            </div>
            <div style={{background:'white',borderRadius:10,padding:32,border:'1px solid var(--border-light)',transition:'transform 0.2s, box-shadow 0.2s'}} className="activity-row">
              <div style={{width:56,height:56,borderRadius:10,background:'var(--lilac)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
                  <path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" />
                  <path d="M8 18h.01" /><path d="M12 18h.01" />
                </svg>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:'var(--ink)',marginBottom:8}}>Calendar booking</div>
              <div style={{fontSize:14,color:'var(--ink-soft)',lineHeight:1.7}}>Embed your Calendly, Cal.com, or Google Calendar so clients can book a follow-up meeting right from the share page.</div>
            </div>
            <div style={{background:'white',borderRadius:10,padding:32,border:'1px solid var(--border-light)',transition:'transform 0.2s, box-shadow 0.2s'}} className="activity-row">
              <div style={{width:56,height:56,borderRadius:10,background:'var(--sky)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M7 15h0" /><path d="M2 9.5h20" />
                  <path d="M17 15h-4" />
                </svg>
              </div>
              <div style={{fontSize:18,fontWeight:800,color:'var(--ink)',marginBottom:8}}>Quotes &amp; payments</div>
              <div style={{fontSize:14,color:'var(--ink-soft)',lineHeight:1.7}}>Attach a line-item quote. Your client reviews, accepts, and pays via their Stripe &mdash; no separate invoice tool needed.</div>
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
              <div className="comp-new highlight">&#10003; Video + pay + book</div>
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
            <h2 className="section-title">Credits for videos, decks &amp; PDFs &mdash; <em>use them your way</em></h2>
          </div>
          <div style={{maxWidth:700,margin:'0 auto',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)'}}>
                  <th style={{textAlign:'left',padding:'12px 16px',color:'var(--ink-soft)',fontWeight:600}}>What you create</th>
                  <th style={{textAlign:'center',padding:'12px 16px',color:'var(--ink-soft)',fontWeight:600}}>Credits</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>Quick video (under 60s)</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>250</td>
                </tr>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>Standard video (2-3 min)</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>500</td>
                </tr>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>Detailed video (5+ min)</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>750</td>
                </tr>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>Slide deck (PPTX)</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>400</td>
                </tr>
                <tr>
                  <td style={{padding:'12px 16px',fontWeight:600}}>PDF document</td>
                  <td style={{textAlign:'center',padding:'12px 16px'}}>300</td>
                </tr>
              </tbody>
            </table>
            <p style={{textAlign:'center',fontSize:13,color:'var(--ink-light)',marginTop:16}}>Podcast narration adds 200 credits. Style previews: 50 credits (first free).</p>
          </div>
        </section>

        {/* ───── Pricing ───── */}
        <section className="section" id="pricing">
          <div style={{textAlign:'center',marginBottom:50}}>
            <div className="section-eyebrow">Pricing</div>
            <h2 className="section-title">Simple, transparent <em>pricing</em></h2>
            <p className="section-sub" style={{maxWidth:600,margin:'0 auto'}}>Every plan includes credits for videos, slide decks, and PDFs. Need more? Buy extra credits anytime.</p>
          </div>
          <div className="pricing-grid-5">
            {/* Free */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Free</div>
              <div className="pricing-price">$0</div>
              <div className="pricing-period">per month</div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--mint-darker, #0d9488)',margin:'8px 0 4px'}}>2 short videos</div>
              <div style={{fontSize:12,color:'var(--ink-soft)',marginBottom:12}}>~2 standard explainers</div>
              <ul className="pricing-features">
                <li>All features included</li>
                <li>Full quality, no watermark</li>
                <li>Download MP4, PDF, PPTX</li>
              </ul>
              <Link href="/signup" className="btn btn-outlined btn-full">Start free</Link>
            </div>
            {/* Starter */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Starter</div>
              <div className="pricing-price">$29</div>
              <div className="pricing-period">per month</div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--mint-darker, #0d9488)',margin:'8px 0 4px'}}>5,000 credits</div>
              <div style={{fontSize:12,color:'var(--ink-soft)',marginBottom:12}}>~10 standard explainers</div>
              <ul className="pricing-features">
                <li>Multi-voice narration</li>
                <li>2 brand profiles</li>
                <li>All slide templates</li>
              </ul>
              <Link href="/signup" className="btn btn-mint btn-full">Subscribe</Link>
            </div>
            {/* Pro */}
            <div className="pricing-card popular" style={{padding:24}}>
              <div className="pricing-badge">MOST POPULAR</div>
              <div className="pricing-name">Pro</div>
              <div className="pricing-price">$79</div>
              <div className="pricing-period">per month</div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--mint-darker, #0d9488)',margin:'8px 0 4px'}}>25,000 credits</div>
              <div style={{fontSize:12,color:'var(--ink-soft)',marginBottom:12}}>~50 standard explainers</div>
              <ul className="pricing-features">
                <li>Priority generation</li>
                <li>Unlimited brands</li>
                <li>Style previews</li>
              </ul>
              <Link href="/signup" className="btn btn-primary btn-full">Subscribe</Link>
            </div>
            {/* Business */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Business</div>
              <div className="pricing-price">$199</div>
              <div className="pricing-period">per month</div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--mint-darker, #0d9488)',margin:'8px 0 4px'}}>75,000 credits</div>
              <div style={{fontSize:12,color:'var(--ink-soft)',marginBottom:12}}>~150 standard explainers</div>
              <ul className="pricing-features">
                <li>White-label share pages</li>
                <li>Priority support</li>
                <li>Extra credits: $4/1,000</li>
              </ul>
              <Link href="/signup" className="btn btn-mint btn-full">Subscribe</Link>
            </div>
            {/* Enterprise */}
            <div className="pricing-card" style={{padding:24}}>
              <div className="pricing-name">Enterprise</div>
              <div className="pricing-price">$499</div>
              <div className="pricing-period">per month</div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--mint-darker, #0d9488)',margin:'8px 0 4px'}}>200,000 credits</div>
              <div style={{fontSize:12,color:'var(--ink-soft)',marginBottom:12}}>~400 standard explainers</div>
              <ul className="pricing-features">
                <li>API access + bulk creation</li>
                <li>Dedicated support</li>
                <li>Extra credits: $3/1,000</li>
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
            <div style={{fontWeight:800,fontSize:16}}>Bill Propper</div>
            <div style={{fontSize:14,color:'var(--ink-soft)'}}>CEO, 3Mark Financial</div>
          </div>

          {/* Testimonial grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:24,maxWidth:900,margin:'0 auto'}}>
            <div className="feature-card" style={{padding:28}}>
              <p style={{fontSize:14,lineHeight:1.7,color:'var(--ink-soft)',marginBottom:16}}>&ldquo;What impressed me most is the consistency and polish of every video. The template styles look professional, the voiceover quality is remarkable, and the branded share pages with built-in scheduling and payments are features I haven&apos;t seen anywhere else. It&apos;s a genuinely well-built product.&rdquo;</p>
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
            <Link href="/signup" className="btn btn-primary btn-lg">Start free &mdash; 2 short videos &rarr;</Link>
          </div>
          <div className="final-cta-perks">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              2 short videos included
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
                <li><a href="#pricing">Pricing</a></li>
                <li><Link href="/analytics">Analytics</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <ul>
                <li><Link href="/blog">Blog</Link></li>
                <li><a href="#use-cases">Use Cases</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><Link href="/cookies">Cookie Policy</Link></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><Link href="/contact">Contact</Link></li>
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
