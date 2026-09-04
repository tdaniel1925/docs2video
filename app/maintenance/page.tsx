import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Docs2Video — upgrading our systems', robots: { index: false } }

/**
 * MAINTENANCE PAGE — shown for every request while MAINTENANCE_MODE=1 (see
 * proxy.ts). Plain, calm, on-brand; says when we're back and how to reach us.
 */
export default function Maintenance() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F4F1EC', color: '#1B3A5C', padding: 24, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: 10, padding: '40px 36px', boxShadow: '0 20px 60px rgba(27,58,92,.12)', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="Docs2Video" style={{ width: 64, height: 64, borderRadius: 10, margin: '0 auto 18px', display: 'block' }} />
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#2A9AAD', marginBottom: 10 }}>System upgrade</div>
        <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: '0 0 12px', fontWeight: 800, letterSpacing: '-.02em' }}>We’re upgrading our systems.</h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, margin: '0 0 22px', color: '#3D5A7A' }}>Docs2Video and Text2Art are getting a major upgrade and will be back very soon. Your account, videos, artwork and credits are safe — nothing is lost during the upgrade.</p>
        <p style={{ fontSize: 14, color: '#3D5A7A', margin: 0 }}>Need something in the meantime? Email <a href="mailto:support@docs2video.com" style={{ color: '#2A9AAD', fontWeight: 700 }}>support@docs2video.com</a> and we’ll take care of it.</p>
      </div>
    </main>
  )
}
