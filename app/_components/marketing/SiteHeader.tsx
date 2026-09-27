import Link from 'next/link'
import MarketingMenu from './MarketingMenu'

// The Docs2Video marketing header: shared by the home page and the /for/*
// industry pages so the two never drift apart. Section links point at the
// home page ("/#how"), so they work from any page they appear on.
export const MARKETING_NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#share', label: 'Share page' },
  { href: '/#industries', label: 'Industries' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#compare', label: 'Compare' },
  { href: '/blog', label: 'Blog' },
] as const

export default function SiteHeader() {
  return (
    <header className="mk-header">
      <div className="mk-header-inner">
        <Link href="/" className="mk-brand" aria-label="Docs2Video home">
          <img src="/logo-big.png" alt="Docs2Video" width={895} height={340} className="mk-logo-img" />
        </Link>
        <nav className="mk-nav" aria-label="Main">
          {MARKETING_NAV.map((l) =>
            l.href.startsWith('/#')
              ? <a key={l.href} href={l.href}>{l.label}</a>
              : <Link key={l.href} href={l.href}>{l.label}</Link>
          )}
        </nav>
        <div className="mk-header-right">
          <Link href="/login" className="mk-login">Log in</Link>
          <Link href="/signup" className="mk-btn mk-btn-navy mk-btn-sm">Start free</Link>
          <MarketingMenu links={MARKETING_NAV.map((l) => ({ href: l.href, label: l.label }))} />
        </div>
      </div>
    </header>
  )
}
