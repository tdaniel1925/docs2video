// =============================================================================
// The public front door for text2art.app.
//
// Everything claimed on this page is checked against the code that actually
// runs it — app/_lib/flyer-engine/index.ts for the sizes, styles, photo roles
// and the proofread caveat, app/_lib/credits.ts for the price. The sample
// images are the REAL pre-generated style thumbnails in public/flyer-templates,
// not stock photography, so what a visitor sees is what the tool produces.
//
// Nothing here mentions video, presentations or client share pages: those are
// Docs2Video's product and are not sold on this domain.
// =============================================================================
import Link from 'next/link'
import { FLYER_TEMPLATES, FLYER_SIZES, PHOTO_ROLES, thumbUrl } from '../_lib/flyer-engine'

/** The nine groups, in the order the app itself shows them. */
const STYLE_GROUPS = [
  { id: 'business', label: 'Business' },
  { id: 'sale', label: 'Sales & offers' },
  { id: 'food', label: 'Food & drink' },
  { id: 'services', label: 'Local services' },
  { id: 'realestate', label: 'Real estate' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'community', label: 'Community' },
  { id: 'music', label: 'Live music' },
  { id: 'nightlife', label: 'Nightlife' },
]
import { CREDIT_COSTS, TIER_CREDITS } from '../_lib/credits'

const COST = CREDIT_COSTS.flyer

const SIZE_GROUPS: { id: 'print' | 'social' | 'banner' | 'card'; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'social', label: 'Social posts' },
  { id: 'banner', label: 'Banners & headers' },
  { id: 'card', label: 'Business cards' },
]

const PLAN_ROWS: { label: string; price: string; credits: number }[] = [
  { label: 'Free', price: '$0', credits: TIER_CREDITS.free },
  { label: 'Starter', price: '$29/mo', credits: TIER_CREDITS.starter },
  { label: 'Pro', price: '$79/mo', credits: TIER_CREDITS.pro },
  { label: 'Business', price: '$199/mo', credits: TIER_CREDITS.business },
  { label: 'Enterprise', price: '$499/mo', credits: TIER_CREDITS.enterprise },
]

// The two thumbnails that read best small, used as the hero until the app
// screenshot exists.
const HERO_IDS = ['rnb', 'editorial']

/**
 * Is public/text2art-app.png in place yet?
 *
 * The hero should show the PRODUCT — two finished flyers proved the output was
 * good and left the obvious question unanswered: what is it actually like to
 * use? But this page is live, and pointing at an image that is not there yet
 * would put a broken picture in front of every visitor. So the designs stay
 * until the screenshot lands, and this flips to true when it does.
 */
const HAS_APP_SHOT = false

export default function Text2ArtLanding() {
  return (
    <>
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 1000,
          background: 'var(--mint)', textAlign: 'center',
          padding: '10px 16px', fontSize: 14, fontWeight: 600, color: 'var(--ink)',
        }}
      >
        <Link href="/signup" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
          Start free — {TIER_CREDITS.free.toLocaleString()} credits included, enough for{' '}
          {Math.floor(TIER_CREDITS.free / COST)} designs
        </Link>
      </div>

      <div id="top" className="container">
        {/* ───── Nav ───── */}
        <nav className="top-nav">
          <div className="top-nav-inner">
            {/* THE LOGO, not a re-lettering of it. The wordmark was set in the
                site's own font with a coloured "2" — close to the artwork but
                not it, which is the one thing a brand cannot afford on the page
                that introduces it. */}
            <Link href="/" className="logo" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/text2art-logo.png" alt="Text2Art" height={40}
                style={{ height: 40, width: 'auto', display: 'block' }} />
            </Link>
            <div className="top-nav-links">
              <a href="#how-it-works">How it works</a>
              <a href="#styles">Styles</a>
              <a href="#sizes">Sizes</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="top-nav-right">
              <Link
                href="/login"
                style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}
              >
                Login
              </Link>
              <Link href="/signup" className="btn btn-mint">Get started</Link>
            </div>
          </div>
        </nav>

        {/* ───── Hero ───── */}
        <section className="hero hero-split">
          <div className="hero-left">
            <div className="hero-eyebrow"><span className="star">&#10022;</span>Flyers, ads, social posts, banners &amp; business cards</div>
            <h1 className="hero-title">Describe it. Get the <em>finished design</em>.</h1>
            <p className="hero-sub">
              Type what it needs to say — &ldquo;Saturday club night at The Foundry, doors 9pm,
              $20 cover&rdquo;. Pick a look and the sizes you need. The artwork and the
              lettering are both generated, so what comes back is a complete design, not a
              template you still have to lay out.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 28, flexWrap: 'wrap' }}>
              <Link href="/signup" className="btn btn-primary btn-lg">
                Start free — {Math.floor(TIER_CREDITS.free / COST)} designs included &rarr;
              </Link>
              <a href="#styles" className="btn btn-outlined">See real examples</a>
            </div>
            {/* Signup really does ask for a card (app/(auth)/setup-payment) —
                the free credits unlock when it is on file. Saying "no card
                needed" here would be a lie the signup flow immediately exposes. */}
            <div className="hero-trust" style={{ marginTop: 20, fontSize: 13, color: 'var(--ink-soft)' }}>
              Card on file to unlock your credits &middot; Nothing charged today &middot; Cancel anytime
            </div>
          </div>
          <div className="hero-right">
            {HAS_APP_SHOT ? (
              /* THE PRODUCT, NOT A GALLERY. A screenshot of the conversation
                 answers "what is this like to use?" in the half second somebody
                 spends deciding whether to read on. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/text2art-app.png"
                alt="The Text2Art chat, with a finished design in it"
                style={{
                  width: '100%', display: 'block', borderRadius: 12,
                  border: '1px solid var(--border)',
                  boxShadow: '0 28px 70px rgba(22,33,92,0.20)',
                }}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {HERO_IDS.map((id, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={id} src={thumbUrl(id)}
                    alt={FLYER_TEMPLATES.find((t) => t.id === id)?.name ?? 'Example design'}
                    style={{
                      width: '100%', display: 'block', borderRadius: 10,
                      border: '1px solid var(--border)',
                      boxShadow: '0 20px 60px rgba(22,33,92,0.18)',
                      transform: i % 2 ? 'translateY(14px)' : 'none',
                    }} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ───── How it works ───── */}
        <section className="section" id="how-it-works">
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">Say it. Pick a look. <em>Download.</em></h2>
            <p className="section-sub" style={{ maxWidth: 540, margin: '12px auto 0' }}>
              It works like a chat. You describe the job in plain words and the page tells you
              what it caught before it spends anything.
            </p>
          </div>
          <div className="steps-row">
            <div className="step-card">
              <div className="step-num-circle">1</div>
              <h3>Type what it says</h3>
              <p>
                The headline, the date and time, the venue, the price, a phone number — however
                you would say it out loud. Every word you give is set exactly as written.
              </p>
            </div>
            <div className="step-connector">
              <svg width="40" height="2"><line x1="0" y1="1" x2="40" y2="1" stroke="var(--border)" strokeWidth="2" strokeDasharray="6,4" /></svg>
            </div>
            <div className="step-card">
              <div className="step-num-circle">2</div>
              <h3>Pick a look and your sizes</h3>
              <p>
                {FLYER_TEMPLATES.length} styles and {FLYER_SIZES.length} sizes. Tick as many
                sizes as you need and they are all made in one go, each drawn for its own shape
                rather than cropped down from one picture.
              </p>
            </div>
            <div className="step-connector">
              <svg width="40" height="2"><line x1="0" y1="1" x2="40" y2="1" stroke="var(--border)" strokeWidth="2" strokeDasharray="6,4" /></svg>
            </div>
            <div className="step-card">
              <div className="step-num-circle">3</div>
              <h3>Download the file</h3>
              <p>
                A PNG you can post straight away or send to a printer. Not happy? Say what to
                change and make another — the whole conversation stays on the page.
              </p>
            </div>
          </div>
        </section>

        {/* ───── Styles gallery — the real thumbnails ───── */}
        <section className="section" id="styles">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="section-eyebrow">{FLYER_TEMPLATES.length} styles</div>
            <h2 className="section-title">These are <em>actual output</em>.</h2>
            <p className="section-sub" style={{ maxWidth: 560, margin: '12px auto 0' }}>
              Every image below came out of the tool. Nothing here is stock photography or a
              mockup. A style sets both the scene and the lettering, which is why they look so
              different from one another.
            </p>
          </div>
          {/* AN ACCORDION, NOT 225 TILES.
              Every style rendered at once made a page you scrolled past rather
              than read — and it buried the range, which is the actual selling
              point. Nine headings show the SPREAD at a glance; one click opens
              any of them.

              Built on <details>, so it works before JavaScript loads, keyboard
              users get it for free, and browser find-in-page can still reach a
              style name inside a closed section. */}
          {STYLE_GROUPS.map((g, gi) => {
            const inGroup = FLYER_TEMPLATES.filter((t) => t.category === g.id)
            if (!inGroup.length) return null
            return (
              <details key={g.id} open={gi === 0} style={{
                border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--bg-card)', marginBottom: 10, overflow: 'hidden',
              }}>
                <summary style={{
                  cursor: 'pointer', padding: '14px 18px', fontWeight: 700, fontSize: 15,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  listStyle: 'none',
                }}>
                  <span>{g.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-light)' }}>
                    {inGroup.length} styles
                  </span>
                </summary>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: 14, padding: '4px 18px 18px',
                }}>
                  {inGroup.map((t) => (
                    <div key={t.id} style={{ borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbUrl(t.id)} alt={`${t.name} example design`} loading="lazy"
                        style={{ width: '100%', display: 'block', aspectRatio: '17 / 22', objectFit: 'cover' }} />
                      <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, background: 'var(--bg-card)' }}>
                        {t.name}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </section>

        {/* ───── Sizes ───── */}
        <section className="section" id="sizes">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="section-eyebrow">{FLYER_SIZES.length} sizes</div>
            <h2 className="section-title">One description, <em>every size you need</em>.</h2>
            <p className="section-sub" style={{ maxWidth: 560, margin: '12px auto 0' }}>
              Tick several and they are all produced together. Each one is drawn at its own
              shape, so a wide banner is composed as a wide banner instead of a poster with the
              top and bottom cut off.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {SIZE_GROUPS.map((g) => (
              <div
                key={g.id}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--mint-darker)', marginBottom: 12,
                  }}
                >
                  {g.label}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {FLYER_SIZES.filter(s => s.group === g.id).map((s) => (
                    <li
                      key={s.id}
                      style={{ fontSize: 14, color: 'var(--ink-soft)', padding: '5px 0' }}
                    >
                      {s.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ───── Your own photos ───── */}
        <section className="section">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="section-eyebrow">Your own pictures</div>
            <h2 className="section-title">Put <em>real</em> people and places in it.</h2>
            <p className="section-sub" style={{ maxWidth: 560, margin: '12px auto 0' }}>
              Attach a photo and say what it is. That matters — a face and a house need opposite
              treatment, and telling it which is which is what stops your agent&apos;s headshot
              becoming a stranger.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {PHOTO_ROLES.map((r) => (
              <div key={r.id} className="feature-card" style={{ padding: '28px 24px' }}>
                <h3 style={{ marginTop: 0 }}>{r.label}</h3>
                <p style={{ marginBottom: 0 }}>{r.hint}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', marginTop: 24, maxWidth: 620, margin: '24px auto 0' }}>
            A logo is placed as-is and never redrawn, restyled or recoloured.
          </p>
        </section>

        {/* ───── Honest caveat ───── */}
        <section className="section">
          <div
            style={{
              maxWidth: 720, margin: '0 auto', background: 'var(--warning-bg)',
              border: '1px solid var(--border)', borderRadius: 10, padding: '28px 32px',
            }}
          >
            <div
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 10,
              }}
            >
              One thing to know before you print
            </div>
            <p style={{ fontSize: 15, color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>
              The lettering is generated along with the artwork, and it is very good at it — but
              it is not typesetting, it is drawing. Read the finished design before you send a
              batch to a printer, especially an unusual venue name or a phone number. The app
              says the same thing on every design it makes.
            </p>
          </div>
        </section>

        {/* ───── Pricing ───── */}
        <section className="section" id="pricing">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="section-eyebrow">Pricing</div>
            <h2 className="section-title">{COST} credits <em>per design</em>.</h2>
            <p className="section-sub" style={{ maxWidth: 560, margin: '12px auto 0' }}>
              Credits are the only unit. Each finished design costs {COST}, whatever size or
              style it is, and every size you tick is its own design. Your plan tops your
              credits up each month, and you can buy more at any time.
            </p>
          </div>
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            <div
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden',
              }}
            >
              {PLAN_ROWS.map((p, i) => (
                <div
                  key={p.label}
                  style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    gap: 16, padding: '16px 24px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-light)',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', minWidth: 110 }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 15, color: 'var(--ink-soft)', minWidth: 90 }}>{p.price}</div>
                  <div style={{ fontSize: 14, color: 'var(--ink-light)', textAlign: 'right' }}>
                    {p.credits.toLocaleString()} credits &mdash;{' '}
                    <strong style={{ color: 'var(--ink)' }}>
                      {Math.floor(p.credits / COST).toLocaleString()} designs
                    </strong>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', marginTop: 16 }}>
              The Free plan&apos;s {TIER_CREDITS.free.toLocaleString()} credits are yours to try
              with. You put a card on file to unlock them and nothing is charged until they run
              out — then the plan you picked begins. One account, one balance.
            </p>
          </div>
        </section>

        {/* ───── Final CTA ───── */}
        <section className="section">
          <div className="final-cta" style={{ textAlign: 'center' }}>
            <h2 className="section-title" style={{ marginBottom: 12 }}>
              Make your first design <em>free</em>.
            </h2>
            <p className="section-sub" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
              {TIER_CREDITS.free.toLocaleString()} credits to start — that is{' '}
              {Math.floor(TIER_CREDITS.free / COST)} finished designs before you are charged
              anything.
            </p>
            <Link href="/signup" className="btn btn-primary btn-lg">Get started &rarr;</Link>
          </div>
        </section>

        {/* ───── Footer ───── */}
        <footer className="footer">
          <div
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 20,
              alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 14, color: 'var(--ink-light)' }}>
              &copy; {new Date().getFullYear()} Text2Art
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <Link href="/terms" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none' }}>Terms</Link>
              <Link href="/privacy" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none' }}>Privacy</Link>
              <Link href="/cookies" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none' }}>Cookies</Link>
              <Link href="/contact" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none' }}>Contact</Link>
              <Link href="/login" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none' }}>Login</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
