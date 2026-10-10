'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

// THE LOOK SCREEN (look wizard) — how to make videos look like your brand or
// like something you like. Written from the screen's own words
// (app/_components/look/LookWizard.tsx). Update with the screen.

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '28px 32px', marginBottom: 20 }
const h2: React.CSSProperties = { fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const body: React.CSSProperties = { fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }
const B = ({ children }: { children: ReactNode }) => <strong style={{ color: 'var(--ink)' }}>{children}</strong>

export default function VideoLookHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Help Center</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Your video look</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Your video look</h1>
          <p>Make your videos look like your brand — or like a picture, PDF or website you like. One screen: pick a starting point and everything is set for you. Change any part if you want to. It costs nothing.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Where to find it</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}><B>While making a video</B> — on the <B>The look</B> step, press the card <B>Create your own look</B>. Once you have a look, a <B>Your look</B> card comes first, already picked.</p>
          <p style={{ marginBottom: 10 }}><B>From your brands</B> — open <B>Brands</B> in the top bar and press <B>Video look</B> on a brand (on its card, or at the top of its page).</p>
          <p><B>After your first free preview</B> — a line asks <B>Make it match your brand?</B> Press <B>Make it match</B>.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Making a look, step by step</h2>
        <ol style={{ ...body, paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 10 }}>Under <B>Make it look like…</B> pick one of three cards: <B>My brand</B> (your brand’s colours and logo), <B>Something I like</B> (a picture, PDF or website) or <B>A ready style</B> (Navy and gold, Calm paper, Bold and bright, Forest). The preview on the right changes straight away.</li>
          <li style={{ marginBottom: 10 }}>The box <B>We picked this from …</B> shows what was chosen: four colour squares (background, second colour, accent, words), the <B>Headline</B> font, the <B>Feel</B> (Calm, Premium or Energetic) and the <B>Logo</B> (Auto, On a white card, or Name as text). Press any square to pick a different colour.</li>
          <li style={{ marginBottom: 10 }}>Not quite right? Press <B>More premium</B>, <B>Warmer</B>, <B>Bolder</B> or <B>Calmer</B> for a small change. <B>Undo</B> goes back one step at a time.</li>
          <li style={{ marginBottom: 10 }}>Want more control? Open <B>Fine-tune (optional)</B> for the background (gradient, soft glow, solid or paper), the corners, the music and the look’s name.</li>
          <li>Press <B>Use this look</B> (on a brand: <B>Save look</B>). The bar at the bottom says where it is saved — <B>Saved to</B> your brand, so your next videos start from it.</li>
        </ol>
      </div>

      <div style={card}>
        <h2 style={h2}>Using something you like</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>Press <B>Something I like</B>, then drop a picture or a PDF onto the dashed box (or press <B>Choose a file</B>). For a website, paste its address and press <B>Read it</B>. A PDF uses its first page.</p>
          <p style={{ marginBottom: 10 }}>It takes a few seconds. You will see <B>Read in … seconds ✓</B>, and the look fills in. <B>Try other colours from it</B> swaps in other colours from the same picture.</p>
          <p style={{ marginBottom: 10 }}><B>Only colours, a font style and a feel are taken.</B> Words, logos and photos in what you upload are never used in your video.</p>
          <p style={{ marginBottom: 10 }}>Fonts: many company fonts are paid or private, so we use the closest free font and label it <B>closest match</B>.</p>
          <p style={{ marginBottom: 10 }}>A video you like? We can’t read videos. Pause it on a frame you like, take a screenshot, and drop the picture.</p>
          <p>Couldn’t read it (a broken file, a site that blocks us)? We start from your brand instead and tell you. You can read up to 20 new things a day; reading the same file again is instant and doesn’t count.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>The preview</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>The picture on the right is the real video engine, playing <B>your own scenes</B> from step 2 (on the Brands page it plays a short sample). Press a scene name to jump to it, or <B>Play 10 seconds</B> to watch it move. It is silent; press <B>Hear it</B> to hear the music quietly.</p>
          <p>Want to see one frame drawn exactly as the finished video will be? Press <B>Free preview</B> in the bottom bar. Nothing is made, and nothing is charged, until you press <B>Make it</B> on the look step.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Always readable</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>If a colour would make words hard to read, we fix it and tell you in a yellow line — for example “We darkened the text so it stays readable on this background.” Press <B>Why?</B> to see why.</p>
          <p style={{ marginBottom: 10 }}>Money is always written with a $ and commas, words never run off the screen, and the music always sits under the voice.</p>
          <p><B>Logo:</B> <B>Auto (best version)</B> uses the light or dark version of your logo so it shows on your background; if we can’t tell, it sits on a white card. Only your real uploaded logo is ever used — we never draw one.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>Will this change videos I already made?</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}>No. Each video keeps a copy of the look it was made with. Changing your look only changes videos you make after that.</p>
          <p><B>Drawn slides</B> use your look too: its colours and feel go into the drawing instructions.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Link href="/help/creating-videos" className="btn btn-soft">Creating videos</Link>
        <Link href="/help/brands" className="btn btn-soft">Brands &amp; personalization</Link>
      </div>
    </div>
  )
}
