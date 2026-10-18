import Link from 'next/link'
import type { Metadata } from 'next'
import { PageHead } from '../../_components/marketing/SiteChrome'
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
      key: 'free', name: free.label, price: '$0', perMonth: false, popular: false,
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
    <>
      <PageHead
        kicker="Pricing"
        title="Start free."
        blue="Grow when it works."
        sub="One pool of credits for videos, presentations and commercials. A standard video is 1,000 credits. Cancel anytime; credits reset each cycle. Top up whenever you need more."
      />

      {promo && (
        <p className="hp-note-band" role="status">Create your account, then choose a plan — use code <strong>{promo}</strong> at checkout.</p>
      )}

      <div className="hp-plans">
        {cards.map(c => (
          <div key={c.key} className={c.popular ? 'hp-plan hp-plan-pop' : 'hp-plan'}>
            <span className="hp-kicker">{c.name}{c.popular ? ' · Recommended' : ''}</span>
            <b className="hp-price">{c.price}{c.perMonth && <small>/mo</small>}</b>
            <span className="hp-caps hp-blue">{c.creditLine}</span>
            <span className="hp-small">{c.subLine}</span>
            <ul>
              {c.features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <Link href="/signup" className={c.popular ? 'hp-btn hp-btn-blue' : 'hp-btn hp-btn-line'}>{c.cta}</Link>
          </div>
        ))}
      </div>

      <p className="hp-small">
        All plans cancel anytime · billed monthly · credits reset each cycle · extra credits available on paid plans.
        <br />
        Already have an account? <Link href="/login">Sign in</Link> to change your plan.
      </p>
    </>
  )
}
