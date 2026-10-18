import type { Metadata } from 'next'
import { siteFonts } from '../_components/marketing/site-fonts'
import '../_components/marketing/home.css'
import '../_components/marketing/site.css'

export const metadata: Metadata = { title: 'Docs2Video — upgrading our systems', robots: { index: false } }

/**
 * MAINTENANCE PAGE — shown for every request while MAINTENANCE_MODE=1 (see
 * proxy.ts). Plain, calm, on-brand; says when we're back and how to reach us.
 * The public site's dark frame (marketing/site.css), with no menu: every link
 * would land back here while the site is down.
 */
export default function Maintenance() {
  return (
    <div className={`hp ${siteFonts}`}>
      <div className="hp-frame">
        <main className="hp-sub">
          <section className="hp-lone">
            <img src="/logo-nav.png" alt="Docs2Video" className="hp-logo" />
            <span className="hp-kicker">System upgrade</span>
            <h1 className="hp-h2">We’re upgrading <span className="hp-blue">our systems.</span></h1>
            {/* A DAY, NOT "SOON". "Very soon" tells a waiting customer nothing and
                reads as indefinite; a named day lets them plan around it. */}
            <p className="hp-soft hp-measure">Docs2Video and Text2Art are getting a major upgrade and will be back <strong>on Monday</strong>. Your account, videos, artwork and credits are safe — nothing is lost during the upgrade.</p>
            <p className="hp-small">Need something in the meantime? Email <a href="mailto:support@docs2video.com">support@docs2video.com</a> and we’ll take care of it.</p>
          </section>
        </main>
      </div>
    </div>
  )
}
