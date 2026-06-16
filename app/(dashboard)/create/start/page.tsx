'use client'

import { useRouter } from 'next/navigation'

/**
 * Step 1 of the create wizard: "What do you want to create?"
 * Output type is chosen FIRST, then the flow branches:
 *  - Video  → /create/client (Who's this for?) → content → brand → voice → script
 *  - Slides → /create?type=slides&for=general (skip recipient + voice) → content → brand → script
 * "Slides" maps internally to the existing pptx pipeline; the result page offers
 * both PDF and PowerPoint downloads.
 */
export default function CreateStartPage() {
  const router = useRouter()

  return (
    <div style={styles.wrap}>
      <h1 style={styles.h1}>What do you want to create?</h1>
      <p style={styles.sub}>Pick a format — we&rsquo;ll guide you from there.</p>

      <div style={styles.cardGrid}>
        <button style={styles.card} onClick={() => router.push('/create/client')}>
          <div style={styles.cardIcon}>🎬</div>
          <div style={styles.cardTitle}>Video Explainer</div>
          <div style={styles.cardDesc}>Narrated video with slides, voice, and music — plus a shareable page you can send to a client.</div>
        </button>

        <button style={styles.card} onClick={() => router.push('/create?type=slides&for=general')}>
          <div style={styles.cardIcon}>📊</div>
          <div style={styles.cardTitle}>Slides</div>
          <div style={styles.cardDesc}>A polished presentation from your content. Download as PDF or PowerPoint when it&rsquo;s ready.</div>
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
  card: { textAlign: 'left', padding: '24px 22px', borderRadius: 10, border: '1.5px solid var(--border-light)', background: 'white', cursor: 'pointer' },
  cardIcon: { fontSize: 28, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 },
}
