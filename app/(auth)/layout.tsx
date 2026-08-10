import Link from 'next/link'
import { getBrand } from '../_lib/brand-server'
import { CREDIT_COSTS, TIER_CREDITS } from '../_lib/credits'
import { thumbUrl } from '../_lib/flyer-engine'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Same login form, different sign over the door. Docs2Video's panel is
  // untouched; Text2Art gets its own words and a real sample design.
  const brand = await getBrand()

  if (brand.id === 'text2art') {
    const freeDesigns = Math.floor(TIER_CREDITS.free / CREDIT_COSTS.flyer)
    return (
      <div className="auth-split">
        <div className="auth-side">
          <Link href="/" className="logo" style={{ textDecoration: 'none', color: '#fff', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em' }}>
            Text<span style={{ color: 'var(--mint)' }}>2</span>Art
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

  return (
    <div className="auth-split">
      <div className="auth-side">
        <Link href="/" className="logo"><img src="/logo.png" alt="Docs2Video" style={{height:72}} /></Link>
        <div className="auth-side-content">
          <h2>Turn documents into <em>polished</em> visual summaries.</h2>
          <p>Join thousands of professionals who&apos;ve replaced their slideware with Docs2Video.</p>
        </div>
        <div className="auth-side-mock">
          <div style={{ background: 'var(--mint)', borderRadius: 10, padding: 18, color: 'var(--ink)' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>Henderson Financial</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14 }}>Q4 Report Summary</div>
            <div style={{ background: 'white', borderRadius: 10, padding: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-light)', fontWeight: 700 }}>Total Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>$1,500,000</div>
            </div>
            <div style={{ background: 'white', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-light)', fontWeight: 700 }}>Year-over-Year Growth</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>+18.4%</div>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          {children}
        </div>
      </div>
    </div>
  )
}
