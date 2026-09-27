import Link from 'next/link'
import { BrandMark } from './SiteHeader'

// Industry landing pages (app/(public)/for/*). Linked here so search engines
// and visitors can reach them from every marketing page.
const INDUSTRY_LINKS = [
  { href: '/for/insurance', label: 'Insurance' },
  { href: '/for/financial-services', label: 'Financial services' },
  { href: '/for/real-estate', label: 'Real estate' },
  { href: '/for/mortgage', label: 'Mortgage' },
  { href: '/for/healthcare', label: 'Healthcare' },
  { href: '/for/legal', label: 'Legal' },
  { href: '/for/consulting', label: 'Consulting' },
  { href: '/for/education', label: 'Education' },
]

export default function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mk-footer">
      <div className="mk-footer-inner">
        <div className="mk-footer-brand">
          <Link href="/" className="mk-brand" aria-label="Docs2Video home">
            <BrandMark />
            <span className="mk-brand-word">Docs2Video</span>
          </Link>
          <p>Turn the document your client should read into a short narrated video they will actually watch.</p>
          <a href="mailto:support@docs2video.com">support@docs2video.com</a>
        </div>
        <div className="mk-footer-col">
          <h2>Product</h2>
          <ul>
            <li><a href="/#how">How it works</a></li>
            <li><a href="/#share">Share page</a></li>
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/signup">Start free</Link></li>
            <li><Link href="/login">Log in</Link></li>
          </ul>
        </div>
        <div className="mk-footer-col">
          <h2>Industries</h2>
          <ul>
            {INDUSTRY_LINKS.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
          </ul>
        </div>
        <div className="mk-footer-col">
          <h2>Company</h2>
          <ul>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/contact">Contact</Link></li>
            <li><Link href="/terms">Terms</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/cookies">Cookies</Link></li>
          </ul>
        </div>
      </div>
      <div className="mk-footer-bottom">
        <span>&copy; {year} Docs2Video. All rights reserved.</span>
      </div>
    </footer>
  )
}
