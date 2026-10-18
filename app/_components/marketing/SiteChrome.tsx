import Link from 'next/link'
import HomeMenu from './HomeMenu'
import { siteFonts } from './site-fonts'
import { getBrand } from '../../_lib/brand-server'
import './home.css'
import './site.css'

/*
 * THE PUBLIC SITE'S ONE SHELL (redesign 2026-10-18): the front page and every
 * page it links to — the field pages, plans, the blog, contact, the legal
 * pages, sign-in — share this header, this footer and the dark navy frame in
 * the logo's blue. Colours are the fixed --d2v-* names in app/globals.css.
 *
 * Section links are written "/#how" so they work from any page, and scroll
 * in place on the front page itself.
 */

export const SITE_NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#videos', label: 'Real videos' },
  { href: '/#share', label: 'The client page' },
  { href: '/pricing', label: 'Price' },
  { href: '/#industries', label: 'Who it’s for' },
] as const

export const FOOTER_FIELDS = [
  { href: '/for/insurance', label: 'Insurance' },
  { href: '/for/financial-services', label: 'Financial advice' },
  { href: '/for/real-estate', label: 'Real estate' },
  { href: '/for/mortgage', label: 'Mortgage' },
  { href: '/for/healthcare', label: 'Healthcare' },
  { href: '/for/human-resources', label: 'HR & benefits' },
  { href: '/for/legal', label: 'Legal' },
  { href: '/for/education', label: 'Education' },
]

/** The section links: in-page anchors as plain links (they scroll), pages through Next. */
function NavLink({ href, label }: { href: string; label: string }) {
  return href.includes('#') ? <a href={href}>{label}</a> : <Link href={href}>{label}</Link>
}

export function SiteHeader() {
  return (
    <header className="hp-header">
      <Link href="/" className="hp-brand" aria-label="Docs2Video home"><img src="/logo-nav.png" alt="Docs2Video" className="hp-logo" /></Link>
      <nav className="hp-nav" aria-label="Main">
        {SITE_NAV.map((l) => <NavLink key={l.href} {...l} />)}
      </nav>
      <span className="hp-header-btns">
        <Link href="/login" className="hp-btn hp-btn-line hp-login">Sign in</Link>
        <Link href="/signup" className="hp-btn hp-btn-blue">Make a video</Link>
        <HomeMenu links={SITE_NAV.map((l) => ({ href: l.href, label: l.label }))} />
      </span>
    </header>
  )
}

export function SiteFooter() {
  return (
    <>
      <div className="hp-plays">
        <span>Plays on</span>
        <span className="hp-plays-list"><span>Phones</span><span>Tablets</span><span>Laptops</span><span>Smart TVs</span></span>
      </div>
      <footer className="hp-footer">
        <div className="hp-footer-brand">
          <img src="/logo-nav.png" alt="Docs2Video" className="hp-logo hp-logo-foot" />
          <p className="hp-soft">Your documents, explained in a video your clients actually watch.</p>
          <a href="mailto:support@docs2video.com">support@docs2video.com</a>
          <span className="hp-dim">© {new Date().getFullYear()} Docs2Video. All rights reserved.</span>
        </div>
        <div className="hp-footer-cols">
          <div>
            <h2 className="hp-kicker">Docs2Video</h2>
            <Link href="/signup">Make a video</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/blog">Blog</Link>
          </div>
          <div>
            <h2 className="hp-kicker">Who it’s for</h2>
            {FOOTER_FIELDS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </div>
          <div>
            <h2 className="hp-kicker">Company</h2>
            <Link href="/contact">Contact</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
          </div>
        </div>
      </footer>
    </>
  )
}

/** The dark frame around any public page: skip link, header, the page, footer. */
export function SiteFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`hp ${siteFonts} ${className}`.trim()}>
      <a href="#main" className="hp-skip">Skip to content</a>
      <div className="hp-frame">
        <SiteHeader />
        {children}
        <SiteFooter />
      </div>
    </div>
  )
}

/**
 * A public page inside the shell — its own <main>. On Text2Art's domain the
 * page shows plainly, as it always did there: this shell is Docs2Video's.
 */
export default async function SitePage({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const brand = await getBrand()
  if (brand.id === 'text2art') return <div className="t2a-plain">{children}</div>
  return (
    <SiteFrame className={className}>
      <main id="main" className="hp-sub">{children}</main>
    </SiteFrame>
  )
}

export { PageHead } from './PageHead'
