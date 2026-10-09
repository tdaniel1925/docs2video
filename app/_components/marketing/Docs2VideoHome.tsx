import Image from 'next/image'
import Link from 'next/link'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import IndustrySwitcher, { type IndustryCard } from './IndustrySwitcher'
import { PLANS, SELLABLE_PLAN_TIERS } from '../../_lib/pricing'
import { CREDIT_COSTS } from '../../_lib/credits'
import { INDUSTRIES, type IndustryId } from '../../_lib/industries'
import { VIDEO_LOOKS, PRES_LOOKS } from '../../(dashboard)/create/_components/make/looks'

/*
 * The Docs2Video marketing home page (light, cream + mint).
 *
 * TRUTH RULES for this page — every line must be true of the product today:
 *   - Prices, credits and "about N videos" come from PLANS (pricing.ts).
 *     Starter is retired, so only Free + SELLABLE_PLAN_TIERS are shown.
 *   - Industry wording, disclaimers and closing asks come from INDUSTRIES.
 *   - The style names come from the Make step's own look lists.
 *   - Pictures are real sample frames from /public/style-samples, chosen
 *     because they carry only fictional names (ACME, EPOCH). Never use a
 *     frame showing a real carrier, product or company.
 */

// ── Industries shown in the switcher (the rest are listed by name) ──────────
const SWITCHER: { id: IndustryId; name: string; sample: string; href: string }[] = [
  { id: 'insurance', name: 'Insurance', sample: 'Your coverage, explained', href: '/for/insurance' },
  { id: 'financial', name: 'Financial', sample: 'Where your portfolio stands', href: '/for/financial-services' },
  { id: 'real_estate', name: 'Real Estate', sample: 'Inside 14 Maple Court', href: '/for/real-estate' },
  { id: 'mortgage', name: 'Mortgage', sample: 'Your loan estimate, line by line', href: '/for/mortgage' },
  { id: 'healthcare', name: 'Healthcare', sample: 'Your care plan, step by step', href: '/for/healthcare' },
  { id: 'legal', name: 'Legal', sample: 'Your agreement in plain English', href: '/for/legal' },
]

const INDUSTRY_COUNT = (Object.keys(INDUSTRIES) as IndustryId[]).filter((id) => id !== 'general').length

function industryCards(): IndustryCard[] {
  return SWITCHER.map((s) => {
    const c = INDUSTRIES[s.id]
    return {
      id: s.id,
      name: s.name,
      terms: c.terminology.use.slice(0, 6),
      fine: c.disclaimerRequired && c.disclaimerText ? c.disclaimerText : null,
      ask: c.ctaText,
      sample: s.sample,
      href: s.href,
    }
  })
}

function moreIndustries(): string[] {
  const shown = new Set<string>(SWITCHER.map((s) => s.id))
  return (Object.keys(INDUSTRIES) as IndustryId[])
    .filter((id) => id !== 'general' && !shown.has(id))
    .map((id) => INDUSTRIES[id].label)
}

// ── Style gallery: real sample frames of the video looks ────────────────────
// Only frames with fictional names. The "slides" look's samples show a real
// product, and some cover/closing frames show real people or policy names,
// so those are left out on purpose.
const GALLERY: { look: string; kind: 'cover' | 'data' | 'closing' }[] = [
  { look: 'editorial', kind: 'cover' }, { look: 'infographic', kind: 'cover' }, { look: 'explainer', kind: 'cover' }, { look: 'cinematic', kind: 'data' },
  { look: 'editorial', kind: 'data' }, { look: 'infographic', kind: 'data' }, { look: 'explainer', kind: 'data' }, { look: 'aurora', kind: 'data' },
]
const lookName = (id: string) => VIDEO_LOOKS.find((l) => l.id === id)?.name ?? id

// ── Pricing (from pricing.ts) ───────────────────────────────────────────────
function pricingCards() {
  const free = PLANS.find((p) => p.tier === 'free')!
  const paid = PLANS.filter((p) => (SELLABLE_PLAN_TIERS as readonly string[]).includes(p.tier))
  return [
    {
      key: 'free', name: 'Free', price: '$0', per: '', popular: false,
      credits: `${free.monthlyCredits.toLocaleString('en-US')} credits to start`,
      videos: `About ${free.approxStandardVideos} videos to try`,
      cta: 'Start free',
    },
    ...paid.map((p) => ({
      key: p.tier, name: p.label, price: `$${p.monthlyPrice / 100}`, per: '/mo', popular: p.tier === 'pro',
      credits: `${p.monthlyCredits.toLocaleString('en-US')} credits a month`,
      videos: `About ${p.approxStandardVideos} videos a month`,
      cta: `Choose ${p.label}`,
    })),
  ]
}
const FREE_PLAN = PLANS.find((p) => p.tier === 'free')!
const TOP_UP_LINE = PLANS.find((p) => p.tier === 'free')?.features.find((f) => f.startsWith('Top up')) ?? ''

// ── Copy ────────────────────────────────────────────────────────────────────
const STEPS = [
  { n: '1', t: 'Drop in the document', d: 'A PDF, Word file, PowerPoint or website — or describe the topic. It reads the whole thing and finds the points that matter.' },
  { n: '2', t: 'Pick a style and a voice', d: 'Choose a look and a narrator. Add your logo and your client’s name for a personal cover and greeting.' },
  { n: '3', t: 'Send it and follow up', d: 'Share one link. Hear when they open it, and let them book a call or pay your quote from the same page.' },
]

const SHARE_FEATURES = [
  { t: 'The video', d: 'Plays in any browser, on any phone or laptop. No app and no login for your client.' },
  { t: 'A booking button', d: 'Add your Calendly, Cal.com or Google Calendar link and they get a big “Book a call” button.' },
  { t: 'Quotes & payments', d: 'Attach a line-item quote and your own payment link. They see the total and a Pay button.' },
  { t: 'Know when they watch', d: 'Get an alert when your video is opened, and follow up while it’s fresh.' },
]

const COMPARE = [
  { need: 'Starts from your document', a: 'No — you present it', b: 'Needs a script', us: 'Yes' },
  { need: 'You don’t have to be on camera', a: 'You are', b: 'An avatar is', us: 'Narrated slides' },
  { need: 'Knows your industry’s wording', a: 'Only what you say', b: 'Generic', us: `Yes, ${INDUSTRY_COUNT} industries` },
  { need: 'Booking and payment beside it', a: 'Not built in', b: 'Not built in', us: 'Yes' },
  { need: 'Slides and a PDF from the same work', a: 'Not built in', b: 'Not built in', us: 'Yes' },
]

const FAQ = [
  { q: 'Do I need to record anything?', a: 'No. A natural AI voice narrates the video. You never have to be on camera.' },
  { q: 'Will it get my numbers right?', a: 'It uses the figures in your document as written, and you can read the script and change it before anything is made.' },
  { q: 'Can I put my own branding on it?', a: 'Yes — your real logo (never an AI-drawn one), your colors, and your client’s name on the cover.' },
  { q: 'What does my client need?', a: 'Just the link. It plays in any browser, on any phone.' },
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

function Serif({ children }: { children: React.ReactNode }) {
  return <em className="mk-serif">{children}</em>
}

export default function Docs2VideoHome() {
  const tiers = pricingCards()
  const heritage = PRES_LOOKS[0]

  return (
    <div className="mk">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      <a href="#main" className="mk-skip">Skip to content</a>
      <SiteHeader />

      <main id="main">
        {/* ───── Hero: long document in, short video out ───── */}
        <section className="mk-hero" aria-labelledby="mk-hero-title">
          <div className="mk-chip">Proposals &middot; policies &middot; reports &middot; plans</div>
          <h1 id="mk-hero-title" className="mk-h1">Long document in. <Serif>Short video out.</Serif></h1>
          <p className="mk-lede">The thing your client should read, turned into the thing they will actually watch — narrated, branded, and sent on a page where they can book a call and say yes.</p>
          <div className="mk-cta-row">
            <Link href="/signup" className="mk-btn mk-btn-navy mk-btn-lg">Start free — about {FREE_PLAN.approxStandardVideos} videos on us</Link>
            <a href="#share" className="mk-btn mk-btn-ghost mk-btn-lg">See the share page</a>
          </div>
          <div className="mk-small">PDF &middot; Word &middot; PowerPoint &middot; a website &middot; or just the topic</div>

          <div className="mk-hero-visual">
            <div className="mk-doc" aria-hidden="true">
              <div className="mk-doc-name">Your-document.pdf</div>
              <div className="mk-doc-page">page 1 of 38</div>
              <span style={{ width: '92%' }} /><span style={{ width: '86%' }} /><span style={{ width: '95%' }} /><span style={{ width: '70%' }} />
              <div className="mk-doc-boxes"><i /><i /><i /></div>
              <span style={{ width: '88%' }} /><span style={{ width: '93%' }} /><span style={{ width: '60%' }} />
            </div>
            <div className="mk-hero-arrow" aria-hidden="true">
              <svg width="64" height="24" viewBox="0 0 64 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h58M50 3l10 9-10 9" /></svg>
              <span>Docs2Video</span>
            </div>
            <figure className="mk-frame">
              <Image
                src="/style-samples/cinematic-data.png"
                alt="A frame from a sample explainer video: a narrated slide listing a policy's key numbers"
                width={1920} height={1080} preload sizes="(max-width: 768px) 100vw, 640px"
              />
              <div className="mk-frame-bar" aria-hidden="true"><div style={{ width: '45%' }} /></div>
            </figure>
          </div>
        </section>

        {/* ───── One document in, three ways out ───── */}
        <section className="mk-wrap" aria-labelledby="mk-outputs-title">
          <div className="mk-outputs">
            <div className="mk-outputs-head">
              <div className="mk-eyebrow">One document in</div>
              <h2 id="mk-outputs-title" className="mk-h3big">Three ways <Serif>out</Serif></h2>
            </div>
            <div className="mk-output">
              <Image src="/style-samples/aurora-data.png" alt="A frame from a narrated video in the Aurora look" width={1920} height={1080} sizes="(max-width: 768px) 100vw, 300px" />
              <h3>A narrated video</h3>
              <p>A natural voice walks your client through it — branded, with your logo, a few minutes long.</p>
            </div>
            <div className="mk-output">
              <div className="mk-output-pic mk-clickthrough">
                <Image src="/style-samples/explainer-data.png" alt="A slide from an interactive presentation" width={1920} height={1080} sizes="(max-width: 768px) 100vw, 300px" />
                <span className="mk-clickthrough-nav" aria-hidden="true"><b>&lsaquo;</b> 3 / 9 <b>&rsaquo;</b></span>
              </div>
              <h3>An interactive presentation</h3>
              <p>They click through at their own pace, with narration.</p>
            </div>
            <div className="mk-output">
              <div
                className="mk-output-pic mk-deck"
                role="img"
                aria-label={`A presentation slide in the ${heritage.name} color set`}
                style={{ '--d-bg': heritage.swatch[0], '--d-ink': heritage.swatch[1], '--d-acc': heritage.swatch[2] } as React.CSSProperties}
              >
                <span className="mk-deck-eyebrow">Summary</span>
                <span className="mk-deck-title">What this plan does for you</span>
                <span className="mk-deck-rule" />
                <span className="mk-deck-cols"><i /><i /><i /></span>
              </div>
              <h3>Its slides, for the meeting</h3>
              <p>Download a presentation&rsquo;s slides as a PDF or PowerPoint to take into the room.</p>
            </div>
          </div>
        </section>

        {/* ───── How it works ───── */}
        <section id="how" className="mk-section mk-wrap" aria-labelledby="mk-how-title">
          <div className="mk-center-head">
            <h2 id="mk-how-title" className="mk-h2">Upload. Pick a style. <Serif>Send.</Serif></h2>
            <p className="mk-sub">No design skills, no recording, no editing timeline.</p>
          </div>
          <ol className="mk-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="mk-card mk-step">
                <span className="mk-step-n" aria-hidden="true">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ───── Industries (interactive) ───── */}
        <section id="industries" className="mk-section mk-wrap" aria-labelledby="mk-ind-title">
          <div className="mk-left-head">
            <div className="mk-eyebrow">It knows your field</div>
            <h2 id="mk-ind-title" className="mk-h2">Speaks your industry. <Serif>Minds your compliance.</Serif></h2>
          </div>
          <IndustrySwitcher items={industryCards()} more={moreIndustries()} />
        </section>

        {/* ───── The share page ───── */}
        <section id="share" className="mk-wrap mk-section-tight" aria-labelledby="mk-share-title">
          <div className="mk-share">
            <div className="mk-share-head">
              <h2 id="mk-share-title" className="mk-h2 mk-on-navy">Not just a video. <Serif>A page that closes.</Serif></h2>
              <Link href="/signup" className="mk-btn mk-btn-mint">Make your first one free</Link>
            </div>
            <div className="mk-share-grid">
              <div className="mk-share-mock-wrap">
                <div className="mk-browser" role="img" aria-label="Example client share page: a personal greeting, the video, and buttons to book a call, review a quote and download the original document">
                  <div className="mk-browser-bar" aria-hidden="true">
                    <i /><i /><i />
                    <span>docs2video.com/watch/&hellip;</span>
                  </div>
                  <div className="mk-browser-body" aria-hidden="true">
                    <div className="mk-sp-from">
                      <span className="mk-avatar">JH</span>
                      <div>
                        <div className="mk-sp-title">Prepared for the Chen family</div>
                        <div className="mk-sp-meta">From Jordan Hayes &middot; your coverage, explained in 3 minutes</div>
                      </div>
                    </div>
                    <div className="mk-sp-video">
                      <Image src="/style-samples/editorial-cover.png" alt="" width={1920} height={1080} sizes="(max-width: 768px) 90vw, 600px" />
                      <span className="mk-play"><svg width="22" height="22" viewBox="0 0 24 24" fill="var(--ink)"><path d="M7 5l12 7-12 7z" /></svg></span>
                      <span className="mk-frame-bar"><span style={{ width: '38%' }} /></span>
                    </div>
                    <div className="mk-sp-actions">
                      <div><b>Book a call</b><span>Your booking link</span></div>
                      <div><b>Review the quote</b><span>Total and a Pay button</span></div>
                      <div><b>Your document</b><span>The original, to keep</span></div>
                    </div>
                  </div>
                </div>
                <div className="mk-toast" aria-hidden="true">
                  <span className="mk-dot" />
                  <div><b>The Chens opened your video</b><span>You get an alert the moment they do</span></div>
                </div>
              </div>
              <ul className="mk-share-features">
                {SHARE_FEATURES.map((f) => (
                  <li key={f.t}>
                    <h3>{f.t}</h3>
                    <p>{f.d}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ───── Styles ───── */}
        <section id="styles" className="mk-section mk-wrap" aria-labelledby="mk-styles-title">
          <div className="mk-split-head">
            <h2 id="mk-styles-title" className="mk-h2">Pick a style. <Serif>Or match your brand.</Serif></h2>
            <p className="mk-small">{VIDEO_LOOKS.length} video looks and {PRES_LOOKS.length} presentation color sets. Your real logo, never an AI-drawn one.</p>
          </div>
          <ul className="mk-gallery">
            {GALLERY.map((g) => (
              <li key={`${g.look}-${g.kind}`}>
                <Image
                  src={`/style-samples/${g.look}-${g.kind}.png`}
                  alt={`${lookName(g.look)} look, ${g.kind === 'data' ? 'a numbers' : `a ${g.kind}`} slide`}
                  width={1920} height={1080}
                  sizes="(max-width: 600px) 50vw, (max-width: 1024px) 33vw, 300px"
                />
                <span>{lookName(g.look)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ───── Pricing ───── */}
        <section id="pricing" className="mk-section mk-wrap" aria-labelledby="mk-pricing-title">
          <div className="mk-center-head">
            <h2 id="mk-pricing-title" className="mk-h2">Start free. <Serif>Grow when it works.</Serif></h2>
            <p className="mk-sub">Every plan runs on credits — a standard video uses about {CREDIT_COSTS.video.toLocaleString('en-US')}. {TOP_UP_LINE}. Cancel anytime.</p>
          </div>
          <div className="mk-tiers">
            {tiers.map((t) => (
              <div key={t.key} className={`mk-card mk-tier${t.popular ? ' mk-tier-pop' : ''}`}>
                {t.popular && <span className="mk-tier-badge">Recommended</span>}
                <h3>{t.name}</h3>
                <div className="mk-tier-price"><span>{t.price}</span>{t.per && <small>{t.per}</small>}</div>
                <div className="mk-tier-videos">{t.videos}</div>
                <div className="mk-tier-credits">{t.credits}</div>
                <Link href="/signup" className={`mk-btn ${t.popular ? 'mk-btn-navy' : 'mk-btn-soft'}`}>{t.cta}</Link>
              </div>
            ))}
          </div>
          <p className="mk-center mk-small"><Link href="/pricing" className="mk-textlink">Compare every plan in detail &rarr;</Link></p>
        </section>

        {/* ───── Compare ───── */}
        <section id="compare" className="mk-section mk-wrap" aria-labelledby="mk-compare-title">
          <h2 id="mk-compare-title" className="mk-h2 mk-center">Docs2Video vs. <Serif>the usual way</Serif></h2>
          <div className="mk-table-wrap">
            <table className="mk-table">
              <thead>
                <tr>
                  <td />
                  <th scope="col">Record it yourself<small>screen and webcam tools</small></th>
                  <th scope="col">AI avatar video<small>script to presenter</small></th>
                  <th scope="col" className="mk-us">Docs2Video</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.need}>
                    <th scope="row">{r.need}</th>
                    <td data-label="Record it yourself">{r.a}</td>
                    <td data-label="AI avatar video">{r.b}</td>
                    <td data-label="Docs2Video" className="mk-us">{r.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ───── FAQ ───── */}
        <section id="faq" className="mk-section mk-faq" aria-labelledby="mk-faq-title">
          <h2 id="mk-faq-title" className="mk-h2 mk-center">Questions</h2>
          {FAQ.map((f) => (
            <div key={f.q} className="mk-card mk-faq-item">
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>

        {/* ───── Final CTA ───── */}
        <section className="mk-wrap" aria-labelledby="mk-final-title">
          <div className="mk-final">
            <div>
              <h2 id="mk-final-title" className="mk-h2">Send something they’ll <Serif>actually watch.</Serif></h2>
              <p>{FREE_PLAN.monthlyCredits.toLocaleString('en-US')} free credits — about {FREE_PLAN.approxStandardVideos} videos — on us.</p>
            </div>
            <Link href="/signup" className="mk-btn mk-btn-navy mk-btn-lg">Start free</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
