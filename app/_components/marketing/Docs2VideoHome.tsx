import Image from 'next/image'
import Link from 'next/link'
import { Schibsted_Grotesk, JetBrains_Mono } from 'next/font/google'
import HomeMenu from './HomeMenu'
import { PLANS, SELLABLE_PLAN_TIERS } from '../../_lib/pricing'
import { INDUSTRIES, type IndustryId } from '../../_lib/industries'
import './home.css'

/*
 * The Docs2Video public front page (approved design "Home-after", 2026-10-14).
 * Light only: white and pale grey grounds, ink, one cobalt accent. Everything is
 * scoped under .hp (styles in ./home.css) and the two fonts are loaded here,
 * so the app's own fonts and colours are untouched.
 *
 * TRUTH RULES for this page — every line must be true of the product today:
 *   - Prices and "about N videos" come from PLANS (pricing.ts). Starter is
 *     retired, so only Free + SELLABLE_PLAN_TIERS are shown.
 *   - Industry wording, fine print and the closing ask come from INDUSTRIES.
 *   - The four looks are the ones step 3 offers today (scene kit): Animated
 *     slides, Editorial, Bright, Drawn slides. Pictures are their real sample
 *     frames from /public/style-samples, which carry only made-up names
 *     ("Your Agency", the Rivera family) — never a real carrier or company.
 *   - No popularity claims: the Pro badge says "Recommended" (the design's
 *     popularity badge is banned by tests/no-false-claims.test.ts).
 */

const sans = Schibsted_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--hp-sans', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--hp-mono', display: 'swap', preload: false })

// ── Industries ──────────────────────────────────────────────────────────────
const ALL_INDUSTRIES = (Object.keys(INDUSTRIES) as IndustryId[]).filter((id) => id !== 'general')
const MADE_FOR = ['Insurance', 'Financial advice', 'Mortgage', 'Real estate', 'Healthcare', 'Legal']
const MORE_INDUSTRIES = Math.max(0, ALL_INDUSTRIES.length - MADE_FOR.length)

const INDUSTRY_CHIPS = [
  { label: 'Insurance', href: '/for/insurance' },
  { label: 'Financial', href: '/for/financial-services' },
  { label: 'Mortgage', href: '/for/mortgage' },
  { label: 'Real estate', href: '/for/real-estate' },
  { label: 'Legal', href: '/for/legal' },
]

const INSURANCE = INDUSTRIES.insurance
const INSURANCE_TERMS = INSURANCE.terminology.use
  .filter((t) => ['policyholder', 'coverage', 'cash value growth', 'guaranteed values', 'illustrated values'].includes(t))
  .join(' · ')

// ── Pricing (from pricing.ts) ───────────────────────────────────────────────
const FREE_PLAN = PLANS.find((p) => p.tier === 'free')!
const TOP_UP_LINE = FREE_PLAN.features.find((f) => f.startsWith('Top up')) ?? ''

function pricingCards() {
  const free = FREE_PLAN
  const paid = PLANS.filter((p) => (SELLABLE_PLAN_TIERS as readonly string[]).includes(p.tier))
  return [
    {
      // One name for the free plan everywhere: pricing.ts's label (audit 2026-10-09).
      key: 'free', name: free.label, price: '$0', per: '', popular: false,
      videos: `About ${free.approxStandardVideos} videos to try`,
      cta: 'Start free',
    },
    ...paid.map((p) => ({
      key: p.tier, name: p.label, price: `$${p.monthlyPrice / 100}`, per: '/mo', popular: p.tier === 'pro',
      videos: `About ${p.approxStandardVideos} videos a month`,
      cta: `Choose ${p.label}`,
    })),
  ]
}

// ── Copy ────────────────────────────────────────────────────────────────────
const LOOKS = [
  { name: 'Animated slides', src: '/style-samples/kit-animated-slides-data.png', alt: 'Animated slides look: a big gold $500,000 on a deep navy background' },
  { name: 'Editorial', src: '/style-samples/kit-editorial-cover.png', alt: 'Editorial look: a calm cream cover with a serif headline and the agent’s photo' },
  { name: 'Bright', src: '/style-samples/kit-bright-data.png', alt: 'Bright look: a big orange number on a light, colourful background' },
  { name: 'Drawn slides', src: '/style-samples/drawn-3d.png', alt: 'Drawn slides look: glossy 3D cards showing coverage, monthly premium and age' },
]

const CLOSE_POINTS = [
  { t: 'Plays anywhere', d: 'Any browser, any phone or laptop. No app and no login for your client.' },
  { t: 'A booking button', d: 'Add your Calendly, Cal.com or Google Calendar link and they get a big “Book a call” button.' },
  { t: 'Quotes and payments', d: 'Attach a line-item quote and your own payment link. They see the total and a Pay button.' },
  { t: 'Know when they watch', d: 'An alert the moment they open it, and how far they got. Follow up while it’s fresh.' },
]

const FAQ = [
  { q: 'Do I need to record anything?', a: 'No. A natural AI voice narrates the video. You never have to be on camera.' },
  { q: 'Will it get my numbers right?', a: 'It uses the figures in your document as written, and you read the script and change it before anything is made.' },
  { q: 'Can I put my own branding on it?', a: 'Yes. Your real logo, your colours, and your client’s name on the cover.' },
  { q: 'What does my client need?', a: 'Just the link. It plays in any browser, on any phone.' },
]

// Section links: ids kept from the old page (#how, #share, #industries,
// #pricing) so links already shared or bookmarked still land.
export const HOME_NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#share', label: 'The client page' },
  { href: '#industries', label: 'Industries' },
  { href: '#pricing', label: 'Pricing' },
] as const

const FOOTER_INDUSTRIES = [
  { href: '/for/insurance', label: 'Insurance' },
  { href: '/for/financial-services', label: 'Financial services' },
  { href: '/for/real-estate', label: 'Real estate' },
  { href: '/for/mortgage', label: 'Mortgage' },
  { href: '/for/healthcare', label: 'Healthcare' },
  { href: '/for/legal', label: 'Legal' },
  { href: '/for/consulting', label: 'Consulting' },
  { href: '/for/education', label: 'Education' },
]

function jsonLd() {
  const offers = pricingCards().map((c) => ({
    '@type': 'Offer',
    name: c.name,
    price: c.price.replace('$', ''),
    priceCurrency: 'USD',
  }))
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Docs2Video',
      url: 'https://docs2video.com',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Turn a long document into a short narrated video, sent on a branded page where your client can book a call and pay.',
      offers,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]
}

function Mark() {
  return (
    <span className="hp-mark" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5v14l11-7z" /></svg>
    </span>
  )
}

export default function Docs2VideoHome() {
  const tiers = pricingCards()

  return (
    <div className={`hp ${sans.variable} ${mono.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      <a href="#main" className="hp-skip">Skip to content</a>

      {/* ───── Header ───── */}
      <header className="hp-header">
        <div className="hp-header-in">
          <Link href="/" className="hp-brand" aria-label="Docs2Video home">
            <Mark />
            <span>Docs2Video</span>
          </Link>
          <nav className="hp-nav" aria-label="Main">
            {HOME_NAV.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
          <Link href="/login" className="hp-login">Log in</Link>
          <Link href="/signup" className="hp-btn hp-btn-ink hp-btn-sm">Start free</Link>
          <HomeMenu links={HOME_NAV.map((l) => ({ href: l.href, label: l.label }))} />
        </div>
      </header>

      <main id="main">
        {/* ───── Hero ───── */}
        <section className="hp-hero" aria-labelledby="hp-hero-title">
          <div className="hp-hero-in">
            <div className="hp-hero-copy">
              <span className="hp-tag">Proposals · policies · reports · plans</span>
              <h1 id="hp-hero-title" className="hp-h1"><span className="hp-line">Long document in.</span> <span className="hp-line hp-blue">Short video out.</span></h1>
              <p className="hp-lede">The thing your client should read, turned into the thing they will actually watch. Narrated, branded, and sent on a page where they can book a call and say yes.</p>
              <div className="hp-cta-row">
                <Link href="/signup" className="hp-btn hp-btn-blue hp-btn-lg">Start free · {FREE_PLAN.approxStandardVideos} videos on us</Link>
                <a href="#share" className="hp-btn hp-btn-line hp-btn-lg"><span aria-hidden="true">▶</span> See what your client gets</a>
              </div>
              <p className="hp-note">No card needed for the free preview · PDF, Word, PowerPoint, a website, or just the topic</p>
            </div>

            <div className="hp-hero-art">
              <div className="hp-cover">
                <Image
                  src="/style-samples/kit-animated-slides-cover.png"
                  alt="A finished video cover: Your Family’s Protection Plan, prepared for the Rivera family, with the agent’s photo"
                  width={960} height={540} priority
                  sizes="(max-width: 1000px) calc(100vw - 58px), 556px"
                />
                <div className="hp-cover-meta">
                  <span className="hp-avatar" aria-hidden="true">JA</span>
                  <div className="hp-cover-text"><b>Your Family’s Protection Plan</b><span>From a 38-page illustration · 3 minutes</span></div>
                  <span className="hp-watched">Watched 92%</span>
                </div>
              </div>
              <div className="hp-alert" aria-label="Example alert">
                <span className="hp-dot" aria-hidden="true" />
                <span><b>The Riveras opened your video.</b> Good time to call.</span>
              </div>
            </div>
          </div>
        </section>

        {/* ───── Made for ───── */}
        <section className="hp-madefor" aria-label="Made for">
          <div className="hp-madefor-in">
            <b>Made for</b>
            {MADE_FOR.map((m) => <span key={m}>{m}</span>)}
            {MORE_INDUSTRIES > 0 && <span>+ {MORE_INDUSTRIES} more industries</span>}
          </div>
        </section>

        {/* ───── How it works ───── */}
        <section id="how" className="hp-sec hp-wrap" aria-labelledby="hp-how-title">
          <h2 id="hp-how-title" className="hp-h2">Upload. Pick a look. Send.</h2>
          <p className="hp-sub">No design skills, no recording, no editing timeline.</p>
          <ol className="hp-steps">
            <li className="hp-step">
              <div className="hp-mini hp-mini-drop" aria-hidden="true"><b>illustration.pdf</b> · 38 pages</div>
              <span className="hp-num" aria-hidden="true">01</span>
              <h3>Drop in the document</h3>
              <p>A PDF, Word file, PowerPoint or website, or describe the topic. It reads the whole thing and finds the points that matter.</p>
            </li>
            <li className="hp-step">
              <div className="hp-mini hp-mini-story" aria-hidden="true"><b>Your family keeps its home if the worst happens.</b><span>6 scenes · about 3 minutes</span></div>
              <span className="hp-num" aria-hidden="true">02</span>
              <h3>Check the story, pick a look</h3>
              <p>Read it like a script and change anything in plain words. Choose a look and a narrator. Your logo and your client’s name go on the cover.</p>
            </li>
            <li className="hp-step">
              <div className="hp-mini hp-mini-send" aria-hidden="true"><span>docs2video.com/watch/rivera</span><b>Send</b></div>
              <span className="hp-num" aria-hidden="true">03</span>
              <h3>Send it and follow up</h3>
              <p>Share one link by email or text. Hear when they open it, and let them book a call or pay your quote from the same page.</p>
            </li>
          </ol>
        </section>

        {/* ───── Two ways to share ───── */}
        <section className="hp-sec-s hp-wrap" aria-labelledby="hp-two-title">
          <h2 id="hp-two-title" className="hp-h2 hp-mb">One document. Two ways to share it.</h2>
          <div className="hp-two">
            <div className="hp-two-item">
              <Image src="/style-samples/kit-animated-slides-data.png" alt="A video scene showing $500,000 paid to your family" width={960} height={540} sizes="(max-width: 940px) calc(100vw - 48px), 566px" />
              <h3>A narrated video</h3>
              <p>A natural voice walks your client through it. Branded with your real logo, a few minutes long.</p>
            </div>
            <div className="hp-two-item">
              <Image src="/style-samples/kit-editorial-cover.png" alt="An interactive presentation cover in a calm editorial style" width={960} height={540} sizes="(max-width: 940px) calc(100vw - 48px), 566px" className="hp-bordered" />
              <h3>An interactive presentation</h3>
              <p>They click through at their own pace, with narration. Its slides download as a PDF or PowerPoint for the meeting.</p>
            </div>
          </div>
        </section>

        {/* ───── The client page ───── */}
        <section id="share" className="hp-band-wrap" aria-labelledby="hp-share-title">
          <div className="hp-band">
            <div className="hp-page" role="img" aria-label="Example client page: a personal greeting, the video, and buttons to book a call, review a quote and get the original document">
              <div className="hp-page-bar" aria-hidden="true">docs2video.com/watch/chen</div>
              <div className="hp-page-body" aria-hidden="true">
                <div className="hp-page-from">
                  <span className="hp-avatar">JA</span>
                  <div><b>Prepared for the Chen family</b><span>From Jordan Avery · your coverage in 3 minutes</span></div>
                </div>
                <Image src="/style-samples/kit-animated-slides-cover.png" alt="" width={960} height={540} sizes="(max-width: 940px) calc(100vw - 120px), 520px" />
                <div className="hp-page-actions">
                  <span className="hp-pa-main">Book a call</span>
                  <span>Review the quote</span>
                  <span>Your document</span>
                </div>
              </div>
            </div>
            <div className="hp-band-copy">
              <h2 id="hp-share-title" className="hp-h2 hp-on-dark">Not just a video.<br /><span className="hp-soft-blue">A page that closes.</span></h2>
              <ul className="hp-points">
                {CLOSE_POINTS.map((p) => (
                  <li key={p.t}><b>{p.t}</b><p>{p.d}</p></li>
                ))}
              </ul>
              <Link href="/signup" className="hp-btn hp-btn-white">Make your first one free</Link>
            </div>
          </div>
        </section>

        {/* ───── Looks ───── */}
        <section id="looks" className="hp-sec hp-wrap" aria-labelledby="hp-looks-title">
          <div className="hp-split">
            <h2 id="hp-looks-title" className="hp-h2">Pick a look. Or make your own.</h2>
            <p>Start from your brand, a picture you like, or a ready style. Your real logo, never an AI-drawn one.</p>
          </div>
          <ul className="hp-looks">
            {LOOKS.map((l) => (
              <li key={l.name}>
                <figure>
                  <Image src={l.src} alt={l.alt} width={960} height={540} sizes="(max-width: 600px) calc(100vw - 48px), (max-width: 1140px) 45vw, 277px" className={l.name === 'Editorial' ? 'hp-bordered' : undefined} />
                  <figcaption>{l.name}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>

        {/* ───── Industries / compliance ───── */}
        <section id="industries" className="hp-sec hp-wrap" aria-labelledby="hp-ind-title">
          <div className="hp-ind">
            <div className="hp-ind-copy">
              <h2 id="hp-ind-title" className="hp-h2 hp-h2-sm">Speaks your industry.<br />Minds your compliance.</h2>
              <p>It uses your field’s words, adds the right fine print, and ends with a clear next step. It never names a carrier or product it shouldn’t.</p>
              <div className="hp-chips">
                {INDUSTRY_CHIPS.map((c, i) => (
                  <Link key={c.href} href={c.href} className={i === 0 ? 'hp-chip hp-chip-on' : 'hp-chip'}>{c.label}</Link>
                ))}
              </div>
              <Link href="/for/insurance" className="hp-textlink">More for insurance →</Link>
            </div>
            <div className="hp-ind-card">
              <div><span className="hp-label">Knows the language</span><p>{INSURANCE_TERMS}</p></div>
              {INSURANCE.disclaimerText && (
                <div><span className="hp-label">Adds the fine print</span><p className="hp-fine">{INSURANCE.disclaimerText}</p></div>
              )}
              <div><span className="hp-label">Ends with a clear ask</span><p className="hp-ask">“{INSURANCE.ctaText}”</p></div>
            </div>
          </div>
        </section>

        {/* ───── Pricing ───── */}
        <section id="pricing" className="hp-sec hp-wrap" aria-labelledby="hp-pricing-title">
          <h2 id="hp-pricing-title" className="hp-h2">Start free. Grow when it works.</h2>
          <p className="hp-sub">{TOP_UP_LINE ? `${TOP_UP_LINE}. ` : ''}Cancel any time.</p>
          <div className="hp-tiers">
            {tiers.map((t) => (
              <div key={t.key} className={`hp-tier${t.popular ? ' hp-tier-pop' : ''}`}>
                {t.popular && <span className="hp-tier-badge">Recommended</span>}
                <b>{t.name}</b>
                <span className="hp-price">{t.price}{t.per && <small>{t.per}</small>}</span>
                <span className="hp-tier-videos">{t.videos}</span>
                <Link href="/signup" className={`hp-btn ${t.popular ? 'hp-btn-blue' : 'hp-btn-line'}`}>{t.cta}</Link>
              </div>
            ))}
          </div>
          <p className="hp-more"><Link href="/pricing" className="hp-textlink">Compare every plan in detail →</Link></p>
        </section>

        {/* ───── Questions ───── */}
        <section id="faq" className="hp-sec hp-wrap hp-faq" aria-labelledby="hp-faq-title">
          <h2 id="hp-faq-title" className="hp-h2">Questions</h2>
          <div className="hp-faq-list">
            {FAQ.map((f) => (
              <div key={f.q} className="hp-faq-item">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───── Final CTA ───── */}
        <section className="hp-final-wrap" aria-labelledby="hp-final-title">
          <div className="hp-final">
            <div>
              <h2 id="hp-final-title" className="hp-h2 hp-on-dark">Send something they’ll actually watch.</h2>
              <p>{FREE_PLAN.monthlyCredits.toLocaleString('en-US')} free credits, about {FREE_PLAN.approxStandardVideos} videos, on us.</p>
            </div>
            <Link href="/signup" className="hp-btn hp-btn-white hp-btn-lg">Start free</Link>
          </div>
        </section>
      </main>

      {/* ───── Footer ───── */}
      <footer className="hp-footer">
        <div className="hp-footer-in">
          <div className="hp-footer-brand">
            <Link href="/" className="hp-brand" aria-label="Docs2Video home"><Mark /><span>Docs2Video</span></Link>
            <p>Turn the document your client should read into a short video they will watch.</p>
            <a href="mailto:support@docs2video.com">support@docs2video.com</a>
          </div>
          <div className="hp-footer-col">
            <h2>Product</h2>
            <ul>
              <li><a href="#how">How it works</a></li>
              <li><a href="#share">The client page</a></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/signup">Start free</Link></li>
              <li><Link href="/login">Log in</Link></li>
            </ul>
          </div>
          <div className="hp-footer-col">
            <h2>Industries</h2>
            <ul>
              {FOOTER_INDUSTRIES.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
            </ul>
          </div>
          <div className="hp-footer-col">
            <h2>Company</h2>
            <ul>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/cookies">Cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="hp-footer-bottom">© {new Date().getFullYear()} Docs2Video. All rights reserved.</div>
      </footer>
    </div>
  )
}
