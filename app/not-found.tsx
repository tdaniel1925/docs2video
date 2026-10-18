import type { Metadata } from 'next'
import Link from 'next/link'
import { getBrand } from './_lib/brand-server'
import { SiteFrame } from './_components/marketing/SiteChrome'

// Branded 404. Before this existed, a mistyped or retired link (an old
// /billing, a deleted video) showed Next.js's bare default page. This one
// renders inside the root layout, so it gets the site's fonts, colours and
// storefront (Docs2Video or Text2Art) for free.
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand()
  return {
    title: `Page not found | ${brand.name}`,
    robots: { index: false, follow: false },
  }
}

export default async function NotFound() {
  const brand = await getBrand()
  const body = (
    <>
      <span className="hp-kicker">404</span>
      <h1 className="hp-h2">We couldn&apos;t find <span className="hp-blue">that page</span></h1>
      <p className="hp-soft hp-measure">
        The link may be old, mistyped, or the item may have been removed. If someone sent you
        this link, ask them for a fresh one.
      </p>
      <div className="hp-row">
        <Link href={brand.home} className="btn btn-primary">Go to my {brand.id === 'text2art' ? 'designs' : 'dashboard'}</Link>
        <Link href="/" className="btn btn-soft">{brand.name} home</Link>
      </div>
    </>
  )
  // Text2Art keeps its plain card; Docs2Video's is the public site's shell.
  if (brand.id === 'text2art') {
    return (
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '40px 28px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>{body}</div>
      </main>
    )
  }
  return (
    <SiteFrame>
      <main id="main" className="hp-sub"><section className="hp-lone">{body}</section></main>
    </SiteFrame>
  )
}
