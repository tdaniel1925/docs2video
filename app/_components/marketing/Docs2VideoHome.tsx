import Image from 'next/image'
import Link from 'next/link'
import { SiteFrame, SITE_NAV } from './SiteChrome'
import FieldTabs, { type Field } from './FieldTabs'
import { PLANS, SELLABLE_PLAN_TIERS } from '../../_lib/pricing'

/*
 * The Docs2Video public front page (redesign approved 2026-10-18, in the
 * One Dollar Decks house style: dark navy, the logo's blue, big condensed
 * capitals). Its header, footer and frame are the public site's one shell
 * (./SiteChrome, fonts in ./site-fonts); everything is scoped under .hp
 * (./home.css, ./site.css), so the app's own fonts and colours are untouched.
 *
 * TRUTH RULES for this page — every line must be true of the product today:
 *   - Prices come from PLANS (pricing.ts); nothing typed in.
 *   - Every field tab has its own /for/* page.
 *   - The six scenes are real frames the explainer engine drew for a made-up
 *     family (the Moraleses); the photos are made-up people. No real carrier,
 *     firm or client anywhere.
 *   - No popularity claims: the Pro card says "Recommended".
 */


// The front page's section links are the shell's (SiteChrome): one nav for the whole public site.
export const HOME_NAV = SITE_NAV

const HERO_FIELDS = [
  { label: 'Insurance', href: '/for/insurance' },
  { label: 'Financial advice', href: '/for/financial-services' },
  { label: 'Real estate', href: '/for/real-estate' },
  { label: 'Mortgage', href: '/for/mortgage' },
  { label: 'Healthcare', href: '/for/healthcare' },
  { label: 'HR & benefits', href: '/for/human-resources' },
  { label: 'Legal', href: '/for/legal' },
  { label: 'Education', href: '/for/education' },
]
// The /for/* pages not in the hero row: coaching, consulting, fitness,
// medical, non-profit, property management.
const MORE_FIELDS = 6

const SOURCES = ['A report or policy', 'A PDF or scan', 'A website', 'Word or PowerPoint', 'Just the topic']

const SCENES = [
  { src: '/home/still-01.jpg', alt: 'Scene 1: the cover, prepared for the Morales family' },
  { src: '/home/still-02.jpg', alt: 'Scene 2: the new monthly premium, said big' },
  { src: '/home/still-03.jpg', alt: 'Scene 3: last year and this year side by side' },
  { src: '/home/still-04.jpg', alt: 'Scene 4: what the policy covers' },
  { src: '/home/still-05.jpg', alt: 'Scene 5: why it matters to the family' },
  { src: '/home/still-06.jpg', alt: 'Scene 6: what happens next, in three steps' },
]

const MADE_FOR = [
  { src: '/home/still-02.jpg', alt: 'A scene with the new monthly premium said big', t: 'The number that matters', d: 'Said big, said simply' },
  { src: '/home/still-03.jpg', alt: 'A scene comparing last year and this year', t: 'Last year and this year', d: 'Charts drawn from the document' },
  { src: '/home/still-06.jpg', alt: 'A scene listing what happens next', t: 'A clear next step', d: 'Every video ends with an ask' },
]

const PROMISES = [
  { icon: '⬚', t: 'From any document', d: 'Illustrations, policies, statements, a website, or just the topic' },
  { icon: '✦', t: 'In your brand', d: 'Your real logo and colours on every scene, never an AI-drawn logo' },
  { icon: '◎', t: 'Their name on it', d: '“Prepared for the Morales family”, personal from the first second' },
  { icon: '↗', t: 'One link, tracked', d: 'Know when they open it and how far they watch' },
]

const STEPS = [
  { t: 'Drop in the document', d: 'A report, a policy, a plan, a lease: up to five files. Or a website, or just the topic.' },
  { t: 'Check the story', d: 'Read it like a script. Fix a number, leave out a private detail, change anything in plain words.' },
  { t: 'Pick a look and a voice', d: 'Your brand, a picture you like, or one of ours. Your logo and your client’s name on the cover.' },
  { t: 'Send it, then follow up', d: 'One link by email or text. Hear when they open it, answer their questions, let them book a call.' },
]

const PAGE_ACTIONS = [
  { t: 'Book a call', d: 'Your booking link, one tap' },
  { t: 'Ask a question', d: 'It comes straight to you' },
  { t: 'Pay your quote', d: 'A Pay button, when you add one' },
  { t: 'The original PDF', d: 'If you let them download it' },
]

const FIELDS: Field[] = [
  { name: 'INSURANCE', kicker: 'Life insurance & annuities', title: 'Send the illustration as a video they will watch', doc: 'a policy illustration', reader: 'client', problem: 'Pages of tables and footnotes. Clients flip to the premium and skip the rest, then call you with the questions it already answered.', does: ['The premium, the cover and the riders, said simply', 'Your name, photo and booking link on it', 'The right fine print, added for you'], img: '/home/table.jpg', alt: 'An older couple watching their coverage video at the kitchen table', caption: 'ANNUITY STATEMENT · 3 MIN', href: '/for/insurance' },
  { name: 'FINANCIAL ADVICE', kicker: 'Financial advisors', title: 'Your clients deserve to understand their money', doc: 'a portfolio report', reader: 'client', problem: 'Quarterly reports get filed unread, so the review meeting starts from zero.', does: ['Performance and allocation as clear charts', 'What changed and why, in plain words', 'Book the review from the same page'], img: '/home/finance.jpg', alt: 'An advisor and a couple watching a short video with growth charts', caption: 'QUARTERLY REVIEW · 2 MIN', href: '/for/financial-services' },
  { name: 'REAL ESTATE', kicker: 'Real estate agents', title: 'Your market analysis deserves better than a spreadsheet', doc: 'a market analysis', reader: 'seller', problem: 'Sellers skim the numbers and fixate on one comparable. Your pricing story gets lost.', does: ['Comparables, pricing and timing told as one story', 'Your listing photos and your brand', 'Easy to share with everyone deciding'], img: '/home/realestate.jpg', alt: 'A couple in an empty sunlit house watching a short video on a phone', caption: 'LISTING PRESENTATION · 2 MIN', href: '/for/real-estate' },
  { name: 'MORTGAGE', kicker: 'Mortgage & lending', title: 'Help borrowers understand their loan before they sign', doc: 'a loan estimate', reader: 'borrower', problem: 'Loan estimates confuse first-time buyers, and every question becomes a phone call.', does: ['Rate, payment and closing costs explained', 'Every step to closing, in order', 'Fewer “quick question” calls'], img: '/home/mortgage.jpg', alt: 'A buyer at a cafe watching a short video beside a loan estimate', caption: 'LOAN ESTIMATE · 2 MIN', href: '/for/mortgage' },
  { name: 'HEALTHCARE', kicker: 'Healthcare & medical', title: 'Patients leave with questions you already answered', doc: 'care instructions', reader: 'patient', problem: 'Printed instructions get lost or misread once the patient is home.', does: ['Care steps in clear, calm language', 'Something to rewatch at home', 'Easy to share with a caregiver'], img: '/home/healthcare.jpg', alt: 'A nurse showing a patient a short video on a tablet', caption: 'AFTER-VISIT CARE · 2 MIN', href: '/for/healthcare' },
  { name: 'HR & BENEFITS', kicker: 'Human resources', title: 'Your benefits guide is long. Your people are busy.', doc: 'a benefits guide', reader: 'employee', problem: 'Open enrollment questions flood the inbox, and new hires miss the deadlines.', does: ['Plans compared side by side', 'Deadlines and next steps that stick', 'Ready for every new hire'], img: '/home/hr.jpg', alt: 'A new employee watching a benefits welcome video at her desk', caption: 'OPEN ENROLLMENT · 4 MIN', href: '/for/human-resources' },
  { name: 'LEGAL', kicker: 'Law firms', title: 'Your clients sign documents they don’t understand', doc: 'an agreement', reader: 'client', problem: 'The important clauses are the ones nobody reads before signing.', does: ['Key terms explained without the jargon', 'Nothing claimed beyond what the document says', 'Something they can rewatch before signing'], img: '/home/legal.jpg', alt: 'A lawyer handing a client a tablet playing a short video', caption: 'ENGAGEMENT LETTER · 3 MIN', href: '/for/legal' },
  { name: 'EDUCATION', kicker: 'Education & coaching', title: 'Your material is valuable. Make it easy to take in.', doc: 'course material', reader: 'student', problem: 'Long handouts lose learners halfway through.', does: ['Lessons turned into short videos', 'In your brand', 'Easy to share with a whole class'], img: '/home/education.jpg', alt: 'A learner taking notes while watching a short course video', caption: 'MODULE 1 · 5 MIN', href: '/for/education' },
]

const PRICE_NOTES = [
  { t: 'You see the price first', d: 'The exact price is on the Make button, worked out from your story, before anything is charged.' },
  { t: 'Failed means free', d: 'If a video can’t be made, every credit comes back.' },
  { t: 'The story is free', d: 'Reading your document and writing the story cost nothing. Change it as often as you like.' },
  { t: 'Teams and agencies', d: 'Plans for whole offices.', link: { href: '/contact', label: 'Talk to us →' } },
]

const FAQ = [
  { q: 'Is it only for insurance agents?', a: 'No. Anyone with a document to explain can use it: advisors, lenders, real estate agents, clinics, HR teams, lawyers, coaches and more. It adjusts its words for your field.' },
  { q: 'Do I need to record anything?', a: 'No. A natural AI voice narrates the video. You never have to be on camera.' },
  { q: 'Will it get my numbers right?', a: 'It uses the figures in your document as written, and you read the story and change it before anything is made.' },
  { q: 'Can I put my own branding on it?', a: 'Yes. Your real logo, your colours, and your client’s name on the cover.' },
  { q: 'What does my client need?', a: 'Just the link. It plays in any browser, on any phone.' },
]

// ── Pricing (from pricing.ts) ───────────────────────────────────────────────
const FREE_PLAN = PLANS.find((p) => p.tier === 'free')!

function pricingCards() {
  const free = FREE_PLAN
  const paid = PLANS.filter((p) => (SELLABLE_PLAN_TIERS as readonly string[]).includes(p.tier))
  return [
    // One name for the free plan everywhere: pricing.ts's label (audit 2026-10-09).
    { key: 'free', name: free.label, price: '$0', per: '', pop: false, line: `About ${free.approxStandardVideos} videos to try` },
    ...paid.map((p) => ({
      key: p.tier, name: p.label, price: `$${p.monthlyPrice / 100}`, per: '/mo', pop: p.tier === 'pro',
      line: `About ${p.approxStandardVideos} videos a month`,
    })),
  ]
}

function jsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Docs2Video',
      url: 'https://docs2video.com',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Turn a policy, report, plan or any long document into a short narrated video in your brand, sent on a page where your client can book a call, ask a question and pay.',
      offers: pricingCards().map((c) => ({ '@type': 'Offer', name: c.name, price: c.price.replace('$', ''), priceCurrency: 'USD' })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]
}

export default function Docs2VideoHome() {
  const tiers = pricingCards()

  return (
    <SiteFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
        <main id="main">
          {/* ───── Hero ───── */}
          <section className="hp-hero" aria-labelledby="hp-hero-title">
            <Image
              src="/home/hero.jpg"
              alt="A couple on their sofa at dusk, watching their coverage video together on a tablet"
              fill priority sizes="(max-width: 1312px) 100vw, 1280px"
              className="hp-hero-img"
            />
            <div className="hp-hero-shade" aria-hidden="true" />
            <div className="hp-hero-top">
              <span className="hp-hero-for">
                <span className="hp-flag" aria-hidden="true" /><span className="hp-flag hp-flag-amber" aria-hidden="true" />
                <span>For anyone who explains documents<br /><span className="hp-soft">Agents · advisors · clinics · HR · lenders</span></span>
              </span>
              <span className="hp-hero-list">✦ Narrated &amp; animated<br />Your brand, your client’s name<br />One link, tracked</span>
            </div>
            <h1 id="hp-hero-title" className="hp-h1"><span>Documents in.</span><span className="hp-blue">Videos out.</span></h1>
            <div className="hp-hero-chips">
              {HERO_FIELDS.map((c) => <Link key={c.href} href={c.href} className="hp-pill">{c.label}</Link>)}
              <a href="#industries" className="hp-pill hp-pill-on">+ {MORE_FIELDS} more</a>
            </div>
            <div className="hp-hero-foot">
              <a href="#how" className="hp-watch">
                <span className="hp-watch-ring" aria-hidden="true">▶</span>
                <span>See how it works<br /><span className="hp-soft">Document to sent video</span></span>
              </a>
              <div className="hp-sent">
                <span className="hp-kicker">Sent today</span>
                <div className="hp-sent-pic">
                  <Image src="/home/still-01.jpg" alt="The opening scene of a coverage review video" width={960} height={540} sizes="276px" />
                  <span>1:13</span>
                </div>
                <b>The Morales family · coverage review</b>
                <span className="hp-sent-status"><span className="hp-live" aria-hidden="true" />Opened 2 minutes ago · watched it all</span>
                <Link href="/share-demo" className="hp-btn hp-btn-blue hp-btn-block">See a client page</Link>
              </div>
            </div>
          </section>

          <div className="hp-body">
            {/* ───── Make it from ───── */}
            <div className="hp-from">
              <span className="hp-kicker">Make it<br />from</span>
              {SOURCES.map((s, i) => <Link key={s} href="/signup" className={i === 0 ? 'hp-from-on' : undefined}>{s}</Link>)}
              <Link href="/signup" aria-label="Start" className="hp-round">→</Link>
            </div>

            {/* ───── Made for your client ───── */}
            <div className="hp-made">
              <div className="hp-made-copy">
                <span className="hp-kicker">✦ Made for your client</span>
                <b className="hp-made-title">A video they’ll watch, not a PDF they won’t</b>
                <p>Drop in a 38-page report, policy or plan. Get back a few minutes they actually watch: every scene in your brand, their name on the cover, the numbers that matter said big.</p>
                <a href="#how" className="hp-btn hp-btn-blue hp-btn-sm">How it works</a>
              </div>
              <div className="hp-made-grid">
                {MADE_FOR.map((m) => (
                  <div key={m.t} className="hp-tile">
                    <Image src={m.src} alt={m.alt} width={960} height={540} sizes="(max-width: 700px) calc(100vw - 32px), 260px" />
                    <div><span className="hp-caps">{m.t}</span><br /><span className="hp-caps hp-dim">{m.d}</span></div>
                  </div>
                ))}
              </div>
              <div className="hp-free">
                <span><span className="hp-kicker">Reading it</span><br /><b>Free</b></span>
                <span><span className="hp-kicker">Checking the story</span><br /><b>Free</b></span>
                <span><span className="hp-kicker">Changing it</span><br /><b>Free</b></span>
              </div>
            </div>

            {/* ───── Four promises ───── */}
            <div className="hp-promises">
              {PROMISES.map((p) => (
                <div key={p.t}>
                  <span className="hp-icon" aria-hidden="true">{p.icon}</span>
                  <span><b className="hp-caps">{p.t}</b><br /><span className="hp-small">{p.d}</span></span>
                </div>
              ))}
            </div>

            {/* ───── How it works ───── */}
            <section id="how" className="hp-sec" aria-labelledby="hp-how-title">
              <span className="hp-kicker">✦ Document to sent video</span>
              <h2 id="hp-how-title" className="hp-h2">How it <span className="hp-blue">works</span></h2>
              <div className="hp-how">
                <ol className="hp-steps">
                  {STEPS.map((s, i) => (
                    <li key={s.t}>
                      <b className="hp-step-num">{String(i + 1).padStart(2, '0')}</b>
                      <span><b className="hp-caps">{s.t}</b><br /><span className="hp-soft">{s.d}</span></span>
                    </li>
                  ))}
                </ol>
                <div className="hp-browser">
                  <div className="hp-browser-bar" aria-hidden="true"><i /><i /><i /><span>docs2video.com/watch/morales</span></div>
                  <Link href="/share-demo" className="hp-browser-pic" aria-label="See an example client page">
                    <Image src="/home/still-01.jpg" alt="The coverage review video, ready to play" width={960} height={540} sizes="(max-width: 1000px) calc(100vw - 32px), 640px" />
                    <span className="hp-play" aria-hidden="true">▶</span>
                    <span className="hp-browser-tag">See the client page</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* ───── The client page ───── */}
            <section id="share" className="hp-sec hp-client" aria-labelledby="hp-share-title">
              <div className="hp-client-art">
                <Image src="/home/agent.jpg" alt="An agent smiling at her phone as a client opens their video" fill sizes="(max-width: 1000px) calc(100vw - 32px), 620px" />
                <div className="hp-client-alert">
                  <span className="hp-live" aria-hidden="true" />
                  <span><b>The Riveras opened your video.</b><br /><span className="hp-soft">Watched to the end · good time to call.</span></span>
                </div>
              </div>
              <div className="hp-client-copy">
                <span className="hp-kicker">✦ The client page</span>
                <h2 id="hp-share-title" className="hp-h2 hp-h2-md">Not just a video. <span className="hp-blue">A page that closes.</span></h2>
                <p className="hp-soft">Every video lives on its own page in your brand, with your note on top and everything your client needs to say yes underneath.</p>
                <div className="hp-actions">
                  {PAGE_ACTIONS.map((a) => (
                    <span key={a.t} className="hp-card"><b className="hp-caps">{a.t}</b><br /><span className="hp-small">{a.d}</span></span>
                  ))}
                </div>
              </div>
            </section>

            {/* ───── A real video, scene by scene ───── */}
            <section id="videos" className="hp-sec" aria-labelledby="hp-videos-title">
              <span className="hp-kicker">✦ Real output, not mockups</span>
              <h2 id="hp-videos-title" className="hp-h2">A video it <span className="hp-blue">made</span></h2>
              <p className="hp-soft hp-measure">One coverage review, scene by scene: each one designed for what it says, in the agency’s colours, then animated with the narrator’s voice.</p>
              <div className="hp-scenes-head"><span>The Morales family · coverage review</span><span>From a 12-page renewal summary · 1:13</span></div>
              <div className="hp-scenes">
                {SCENES.map((s) => <Image key={s.src} src={s.src} alt={s.alt} width={960} height={540} sizes="(max-width: 700px) calc(100vw - 32px), 400px" />)}
              </div>
            </section>

            {/* ───── Who it's for: one tab per field ───── */}
            <section id="industries" className="hp-sec" aria-labelledby="hp-ind-title">
              <span className="hp-kicker">✦ Built for your field</span>
              <h2 id="hp-ind-title" className="hp-h2">Speaks your field. <span className="hp-blue">Minds the fine print.</span></h2>
              <FieldTabs fields={FIELDS} />
            </section>

            {/* ───── Price ───── */}
            <section id="pricing" className="hp-sec" aria-labelledby="hp-pricing-title">
              <span className="hp-kicker">✦ The short version</span>
              <h2 id="hp-pricing-title" className="hp-h2">Start free. <span className="hp-blue">Grow when it works.</span></h2>
              <div className="hp-tiers">
                {tiers.map((t) => (
                  <div key={t.key} className={t.pop ? 'hp-tier hp-tier-pop' : 'hp-tier'}>
                    <span className="hp-kicker">{t.name}{t.pop ? ' · Recommended' : ''}</span>
                    <b className="hp-price">{t.price}{t.per && <small>{t.per}</small>}</b>
                    <span className="hp-small">{t.line}</span>
                    <Link href="/signup" className={`hp-btn ${t.pop ? 'hp-btn-blue' : 'hp-btn-line'} hp-btn-sm`}>{t.key === 'free' ? 'Start free' : `Choose ${t.name}`}</Link>
                  </div>
                ))}
              </div>
              <div className="hp-notes">
                {PRICE_NOTES.map((n) => (
                  <span key={n.t}>
                    <b className="hp-caps hp-white">✓ {n.t}</b><br />{n.d}
                    {n.link && <> <Link href={n.link.href}>{n.link.label}</Link></>}
                  </span>
                ))}
              </div>
              <p><Link href="/pricing" className="hp-textlink">Compare every plan in detail →</Link></p>
            </section>

            {/* ───── Questions ───── */}
            <section id="faq" className="hp-sec hp-faq" aria-labelledby="hp-faq-title">
              <h2 id="hp-faq-title" className="hp-h2 hp-h2-md">Questions</h2>
              <div className="hp-faq-list">
                {FAQ.map((f) => (
                  <div key={f.q} className="hp-faq-item"><h3>{f.q}</h3><p>{f.a}</p></div>
                ))}
              </div>
            </section>

            {/* ───── Final CTA ───── */}
            <section className="hp-final" aria-labelledby="hp-final-title">
              <h2 id="hp-final-title" className="hp-h2 hp-h2-xl">Send something<br /><span className="hp-blue">they’ll watch.</span></h2>
              <span className="hp-soft">Bring a document. See the story free.</span>
              <Link href="/signup" className="hp-btn hp-btn-blue hp-btn-lg">Make your first video</Link>
            </section>
          </div>
        </main>
    </SiteFrame>
  )
}
