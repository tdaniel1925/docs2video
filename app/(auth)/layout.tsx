import Image from 'next/image'
import Link from 'next/link'
import { SiteFrame } from '../_components/marketing/SiteChrome'
import { getBrand } from '../_lib/brand-server'
import { CREDIT_COSTS, TIER_CREDITS } from '../_lib/credits'
import { thumbUrl } from '../_lib/flyer-engine'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Same login form, different sign over the door. Docs2Video's is the
  // public site's shell (below); Text2Art gets its own words and a real sample design.
  const brand = await getBrand()

  if (brand.id === 'text2art') {
    const freeDesigns = Math.floor(TIER_CREDITS.free / CREDIT_COSTS.flyer)
    return (
      <div className="auth-split">
        <div className="auth-side">
          <Link href="/" className="logo" style={{ textDecoration: 'none', color: '#fff', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em' }}>
            Text<span style={{ color: 'var(--accent)' }}>2</span>Art
          </Link>
          <div className="auth-side-content">
            <h2>Describe it. Get the <em>finished design</em>.</h2>
            <p>Flyers, ads, social posts, banners and business cards — {freeDesigns} free to start.</p>
          </div>
          <div className="auth-side-mock">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl('editorial')} alt="Example design made with Text2Art" style={{ width: '100%', display: 'block', borderRadius: 10 }} />
          </div>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-form">{children}</div>
        </div>
      </div>
    )
  }

  // Docs2Video: the public site's shell (marketing/SiteChrome) — the same
  // header, footer and dark frame as the front page, the form on a card and
  // the front page's picture beside it. The forms themselves are unchanged.
  return (
    <SiteFrame>
      <main id="main" className="hp-sub">
        <div className="hp-auth">
          <div className="hp-auth-card"><div className="auth-form">{children}</div></div>
          <div className="hp-auth-art">
            <Image src="/home/hero.jpg" alt="A couple on their sofa at dusk, watching their coverage video together on a tablet" fill sizes="(max-width: 900px) 0px, 600px" />
            <div className="hp-auth-art-shade" aria-hidden="true" />
            <div className="hp-auth-art-copy">
              <span className="hp-kicker">✦ For anyone who explains documents</span>
              <h2 className="hp-h2">Documents in. <span className="hp-blue">Videos out.</span></h2>
              <p className="hp-soft">The thing your client should read, turned into a short narrated video they will actually watch.</p>
            </div>
          </div>
        </div>
      </main>
    </SiteFrame>
  )
}
