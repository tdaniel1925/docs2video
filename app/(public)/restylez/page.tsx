import Link from 'next/link'
import type { Metadata } from 'next'

/**
 * RESTYLEZ — the public front door.
 *
 * The pitch in one breath: bought a template you can't face editing? Upload a
 * picture of it and we remake it with YOUR words, photos and logo — same
 * design, your content. Also takes a whole deck.
 *
 * Own BRAND, shared machine: this page is the only Restylez-branded surface;
 * the CTA drops into the existing /remake entry (auth) and the proven wizard.
 * The ownership framing ("templates you bought or designs you own") is the
 * product's legal spine — never water it down to "copy any design".
 */
export const metadata: Metadata = {
  title: 'Restylez — Any template, remade as yours',
  description:
    'Bought a template you can’t edit? Upload a picture of it and Restylez remakes it exactly — with your words, your photos, your logo. Decks too.',
}

const INK = '#23201C'
const SOFT = '#6b645a'
const CREAM = '#F4F1EC'
const MINT = '#C7E8A8'
const LINE = '#e3ddd2'

export default function RestylezLanding() {
  return (
    <div style={{ minHeight: '100vh', background: CREAM, color: INK, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      {/* HERO */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '72px 24px 40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', fontSize: 13, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: SOFT, marginBottom: 18 }}>
          Restylez
        </div>
        <h1 style={{ fontSize: 'clamp(34px, 6vw, 56px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, margin: '0 0 18px' }}>
          Bought a template you can’t edit?<br />
          <span style={{ background: MINT, borderRadius: 10, padding: '0 12px' }}>Upload it. We remake it as yours.</span>
        </h1>
        <p style={{ fontSize: 18, color: SOFT, lineHeight: 1.6, maxWidth: 620, margin: '0 auto 30px' }}>
          No Canva wrestling. No font hunting. Send us a picture of the template you bought — or any
          design you own — and Restylez rebuilds it exactly: same layout, same style, with <strong style={{ color: INK }}>your</strong> words,
          photos and logo. Whole slide decks too.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/remake" style={{
            display: 'inline-block', padding: '15px 30px', borderRadius: 10, background: INK, color: '#fff',
            fontSize: 16, fontWeight: 700, textDecoration: 'none',
          }}>
            Remake my template →
          </Link>
          <Link href="/remake?deck=1" style={{
            display: 'inline-block', padding: '15px 30px', borderRadius: 10, background: '#fff', color: INK,
            border: `1px solid ${LINE}`, fontSize: 16, fontWeight: 700, textDecoration: 'none',
          }}>
            Restyle a whole deck
          </Link>
        </div>
        <p style={{ fontSize: 12.5, color: SOFT, marginTop: 14 }}>
          For templates you’ve bought and designs you own. Your first remake takes about a minute to set up.
        </p>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 24px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { n: '1', t: 'Upload the design', d: 'A screenshot or photo of the template you bought — a flyer, a post, a card, or a whole deck (PowerPoint or PDF).' },
            { n: '2', t: 'Tell us your details', d: 'Type your words, or paste them, or upload a document — and drop in your logo and photos. That’s all we need.' },
            { n: '3', t: 'Get it back, remade', d: 'Same layout, same artwork, same lettering — with your content in place. Download it, print it, or grab the deck as a PDF.' },
          ].map((s) => (
            <div key={s.n} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '22px 20px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: 12 }}>{s.n}</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{s.t}</div>
              <div style={{ fontSize: 13.5, color: SOFT, lineHeight: 1.55 }}>{s.d}</div>
            </div>
          ))}
        </div>

        {/* THE PROMISE + THE RULE */}
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '22px 24px', marginTop: 16, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Yours means yours.</div>
            <div style={{ fontSize: 13.5, color: SOFT, lineHeight: 1.55 }}>
              Restylez remakes designs you own — templates you’ve purchased, or work you made. You’ll confirm
              that before every remake. We never help copy someone else’s work.
            </div>
          </div>
          <Link href="/remake" style={{
            display: 'inline-block', padding: '12px 22px', borderRadius: 10, background: INK, color: '#fff',
            fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            Start a remake →
          </Link>
        </div>
      </div>
    </div>
  )
}
