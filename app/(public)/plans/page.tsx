import Link from 'next/link'
import type { Metadata } from 'next'
import { PLANS } from '../../_lib/pricing'

// Public pricing. proxy.ts shows this page to LOGGED-OUT visitors of /pricing
// (the sitemap, the homepage and promo emails all link there). Signed-in users
// keep the in-app /pricing page, which starts checkout for their account.
// Numbers come from the same PLANS list, so the two pages never disagree.

export const metadata: Metadata = {
  title: 'Pricing | Docs2Video',
  description: 'Simple, credit-based pricing for turning documents into narrated client videos, interactive presentations and commercials.',
}

export default async function PublicPricingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const rawPromo = typeof sp.promo === 'string' ? sp.promo : ''
  // Only a plain code is echoed back onto the page.
  const promo = /^[A-Za-z0-9_-]{2,40}$/.test(rawPromo) ? rawPromo.toUpperCase() : null

  // Starter ($29) is retired — hidden here exactly as on the in-app page.
  const paidPlans = PLANS.filter(p => p.tier !== 'free' && p.tier !== 'starter')
  const free = PLANS.find(p => p.tier === 'free')

  const cards = [
    ...(free ? [{
      key: 'free', name: 'Pay As You Go', price: '$0', perMonth: false, popular: false,
      creditLine: `${free.monthlyCredits.toLocaleString()} free credits`,
      subLine: `~${free.approxStandardVideos} videos to try · then top up`,
      features: ['Full quality, no watermark', 'Branded client share pages', 'Download MP4, PDF, PPTX', 'No subscription required'],
      cta: 'Start free',
    }] : []),
    ...paidPlans.map(plan => ({
      key: plan.tier, name: plan.label, price: `$${plan.monthlyPrice / 100}`, perMonth: true, popular: plan.tier === 'pro',
      creditLine: `${plan.monthlyCredits.toLocaleString()} credits / mo`,
      subLine: `~${plan.approxStandardVideos} standard videos`,
      features: plan.features,
      cta: 'Get started',
    })),
  ]

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-big.png" alt="Docs2Video" style={{ height: 56, marginBottom: 24 }} />
          </Link>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10, color: 'var(--ink)' }}>
            Simple, credit-based pricing
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 620, margin: '0 auto' }}>
            One pool of credits for videos, presentations and commercials. A standard video is 1,000 credits.
            Cancel anytime; credits reset each cycle. Top up whenever you need more.
          </p>
        </div>

        {promo && (
          <div style={{ maxWidth: 520, margin: '0 auto 28px', padding: '12px 16px', borderRadius: 10, background: 'var(--accent)', color: 'var(--ink)', fontSize: 14, textAlign: 'center', fontWeight: 600 }}>
            Create your account, then choose a plan — use code <strong>{promo}</strong> at checkout.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16, alignItems: 'stretch' }}>
          {cards.map(c => (
            <div key={c.key} style={{ position: 'relative', padding: '26px 22px', borderRadius: 10, background: 'white', border: c.popular ? '2px solid var(--ink)' : '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
              {c.popular && (
                <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', padding: '3px 14px', borderRadius: 6, background: 'var(--ink)', color: 'white', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  Recommended
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>{c.name}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>
                {c.price}{c.perMonth && <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-light)' }}>/mo</span>}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--mint-darker)', marginBottom: 2 }}>{c.creditLine}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 16 }}>{c.subLine}</div>
              <div style={{ flex: 1, marginBottom: 16 }}>
                {c.features.map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 7, lineHeight: 1.4, display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--mint-darker)', fontWeight: 800 }}>✓</span><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/signup" className={c.popular ? 'btn btn-primary btn-full' : 'btn btn-outlined btn-full'} style={{ textAlign: 'center' }}>
                {c.cta}
              </Link>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', marginTop: 28, lineHeight: 1.6 }}>
          All plans cancel anytime · billed monthly · credits reset each cycle · extra credits available on paid plans.
          <br />
          Already have an account? <Link href="/login" style={{ color: 'var(--ink)', fontWeight: 600 }}>Sign in</Link> to change your plan.
        </p>
      </div>
    </div>
  )
}
