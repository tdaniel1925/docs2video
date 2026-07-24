'use client'

import { useRouter } from 'next/navigation'

/**
 * Step 1 of the create wizard: "What do you want to create?"
 * Output type is chosen FIRST, then the flow branches:
 *  - Interactive Presentation → /create/client → content → brand → voice → script → template
 *    (HTML-first: narrated click-through presentation on a share page; an MP4
 *     video can be EXPORTED from it after editing — video is not its own path)
 *  - Slide Deck → /create?type=deck&for=general (skip recipient + voice) → content → brand → script → template
 *    (silent, private — PDF + PowerPoint downloads; no share page)
 *  - Video Explainer / Commercial — legacy paths, slated for removal at flip.
 */
export default function CreateStartPage() {
  const router = useRouter()

  return (
    <div style={styles.wrap}>
      <h1 style={styles.h1}>What do you want to create?</h1>
      <p style={styles.sub}>Pick a format — we&rsquo;ll guide you from there.</p>

      <div style={styles.cardGrid}>
        <button style={{ ...styles.card, ...styles.cardHot }} onClick={() => router.push('/create/client?type=interactive')}>
          <div style={styles.badge}>NEW · RECOMMENDED</div>
          <div style={styles.cardIcon}>🖱️</div>
          <div style={styles.cardTitle}>Interactive Presentation</div>
          <div style={styles.cardDesc}>A narrated, click-through presentation your client explores at their own pace — with a share page, instant edits, and an MP4 video export when you want one.</div>
        </button>

        <button style={styles.card} onClick={() => router.push('/create?type=deck&for=general')}>
          <div style={styles.cardIcon}>📑</div>
          <div style={styles.cardTitle}>Slide Deck</div>
          <div style={styles.cardDesc}>A polished deck from your content — preview and edit live, then download as PDF or PowerPoint. Private, no share page.</div>
        </button>

        <button style={styles.card} onClick={() => router.push('/create/client')}>
          <div style={styles.cardIcon}>🎬</div>
          <div style={styles.cardTitle}>Video Explainer</div>
          <div style={styles.cardDesc}>Narrated video with slides, voice, and music — plus a shareable page you can send to a client.</div>
        </button>

        <button style={styles.card} onClick={() => router.push('/create/commercial')}>
          <div style={styles.cardIcon}>🎥</div>
          <div style={styles.cardTitle}>Commercial</div>
          <div style={styles.cardDesc}>Paste your website — we produce a fully-directed, brand-matched commercial with voiceover, visuals, and music.</div>
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 640, margin: '0 auto', padding: '24px 32px' },
  h1: { fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 },
  sub: { fontSize: 15, color: 'var(--ink-soft)', marginBottom: 28 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 },
  card: { position: 'relative', textAlign: 'left', padding: '24px 22px', borderRadius: 10, border: '1.5px solid var(--border-light)', background: 'white', cursor: 'pointer' },
  cardHot: { border: '2px solid var(--accent, #6da33f)', boxShadow: '0 8px 24px rgba(109,163,63,.15)' },
  badge: { position: 'absolute', top: -11, left: 18, background: 'var(--accent, #6da33f)', color: 'white', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', padding: '4px 10px', borderRadius: 6 },
  cardIcon: { fontSize: 28, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 },
}
