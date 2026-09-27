import type { Metadata } from 'next'
import Link from 'next/link'
import { getBrand } from './_lib/brand-server'

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

  return (
    <main
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '64px 16px', background: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 520, width: '100%', textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: 10, padding: '40px 28px', boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 10 }}>
          404
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px' }}>
          We couldn&apos;t find that <em style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400 }}>page</em>
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '0 0 28px' }}>
          The link may be old, mistyped, or the item may have been removed. If someone sent you
          this link, ask them for a fresh one.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href={brand.home} className="btn btn-primary">Go to my {brand.id === 'text2art' ? 'designs' : 'dashboard'}</Link>
          <Link href="/" className="btn btn-soft">{brand.name} home</Link>
        </div>
      </div>
    </main>
  )
}
