'use client'

import Link from 'next/link'

// Walks through the video create flow exactly as the screens show it:
// format → Who's this for → Content → Brief → Presenter → Voice & Length →
// Script → Style → generate. Audited against the live UI 2026-09-26.

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 15, flexShrink: 0,
}

const CARD: React.CSSProperties = {
  background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '28px 32px', marginBottom: 20,
}
const BODY: React.CSSProperties = { fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }
const INK: React.CSSProperties = { color: 'var(--ink)' }

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <div style={STEP_CIRCLE}>{n}</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{title}</h2>
      </div>
      <div style={BODY}>{children}</div>
    </div>
  )
}

export default function CreatingVideosPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Creating Explainer Videos</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Creating Explainer Videos</h1>
          <p>A step-by-step guide from adding your content to sharing the finished video. A bar at the top of each screen shows which step you are on.</p>
        </div>
      </div>

      <Step n={1} title="Pick a format">
        <p style={{ marginBottom: 10 }}>
          Click <strong style={INK}>+ Create</strong> in the top bar. You will see four cards: <strong style={INK}>Interactive Presentation</strong>,{' '}
          <strong style={INK}>Custom Graphics</strong>, <strong style={INK}>Video Explainer</strong> and <strong style={INK}>Commercial</strong>.
        </p>
        <p>Click <strong style={INK}>Video Explainer</strong>.</p>
      </Step>

      <Step n={2} title="Who's this for?">
        <p style={{ marginBottom: 10 }}>
          Pick an <strong style={INK}>Existing client</strong>, add a <strong style={INK}>New client</strong>, or <strong style={INK}>Skip</strong> for a general video.
        </p>
        <p>When you name a client, their name appears on the video cover and on the share page (&ldquo;Prepared for [Client]&rdquo;).</p>
      </Step>

      <Step n={3} title="Add your content">
        <p style={{ marginBottom: 12 }}>
          Under <strong style={INK}>Where should the content come from?</strong> choose one of four options:
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Website URL</strong> — Type a web address. The AI reads the page and uses it as your source.
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Upload file</strong> — Drag files onto the upload area or click to browse. You can add up to 5 files: PDF, Word (DOCX), PowerPoint (PPTX), text (TXT), CSV or Excel (XLSX).
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Paste text</strong> — Paste notes, an email or an article into the box (at least 50 characters).
        </p>
        <p style={{ marginBottom: 12 }}>
          <strong style={INK}>AI writes it</strong> — Describe the topic and the AI writes the content for you.
        </p>
        <p>You can also say what the video should do in the <strong style={INK}>What should this video do?</strong> box. Then click <strong style={INK}>Next</strong>.</p>
      </Step>

      <Step n={4} title="Approve the brief">
        <p style={{ marginBottom: 10 }}>
          The AI shows what it understood: the kind of document, the angle it will take, the <strong style={INK}>Key points</strong> it will cover and the <strong style={INK}>Figures it will show</strong>.
        </p>
        <p style={{ marginBottom: 10 }}>
          Want changes? Type them into the chat under <strong style={INK}>Want changes? Tell me</strong> — for example &ldquo;focus on the death benefit, keep it reassuring&rdquo;. If it asks a few questions, answer them and click <strong style={INK}>Update brief with my answers</strong>.
        </p>
        <p>When it looks right, click <strong style={INK}>Looks good — continue &rarr;</strong>.</p>
      </Step>

      <Step n={5} title="Choose the presenter">
        <p style={{ marginBottom: 10 }}>
          Pick a saved <strong style={INK}>Person</strong> profile (your name, role, photo) or <strong style={INK}>Company</strong> profile (logo, colors, contact details), or create a new one right here.
        </p>
        <p>
          The profile is used on the cover, the closing slide and the share page. Don&rsquo;t want any? Click <strong style={INK}>Skip — no presenter or branding</strong>. See{' '}
          <Link href="/help/brands" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Profiles &amp; Personalization</Link>.
        </p>
      </Step>

      <Step n={6} title="Voice & Length">
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Voice</strong> — Click <strong style={INK}>▶ Listen</strong> next to any voice to hear it, then click the voice to choose it. The default is <strong style={INK}>Nova</strong>, a warm female voice.
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Length</strong> — <strong style={INK}>Short</strong> (30–60 seconds), <strong style={INK}>Medium</strong> (2–3 minutes) or <strong style={INK}>Long</strong> (5+ minutes). A length you can&rsquo;t afford with your current credits is locked.
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Background music</strong> — Turn it on to add soft AI-made music under the voice. It is off unless you turn it on.
        </p>
        <p>The credit cost is shown before you click <strong style={INK}>Next</strong>.</p>
      </Step>

      <Step n={7} title="Check the script">
        <p style={{ marginBottom: 10 }}>
          The script appears scene by scene. Read it through. To change it, click <strong style={INK}>✎ Edit script</strong>.
        </p>
        <p style={{ marginBottom: 10 }}>
          In edit mode you can change each scene&rsquo;s title, narration (the words the voice speaks), slide headline, stats and bullet points. Drag scenes to reorder them (the cover and closing slides stay put). Each scene has its own AI chat and a <strong style={INK}>Preview slide</strong> button.
        </p>
        <p>
          For bigger changes — like &ldquo;add a slide about pricing&rdquo; — type into the AI bar and click <strong style={INK}>Apply to whole script</strong>. You can <strong style={INK}>Undo</strong> it. Then continue to the Style step.
        </p>
        <p style={{ marginTop: 10 }}>
          <strong style={INK}>Your draft is saved as you go.</strong> Once your project has a script, the unfinished draft is kept for <strong style={INK}>14 days</strong> after your last change (a draft without a script is kept for 24 hours). Come back to it from your Library.
        </p>
      </Step>

      <Step n={8} title="Pick a style and generate">
        <p style={{ marginBottom: 10 }}>
          Choose one of six looks: <strong style={INK}>Slide Deck</strong> (recommended), <strong style={INK}>Aurora</strong>, <strong style={INK}>Cinematic</strong>,{' '}
          <strong style={INK}>Editorial</strong>, <strong style={INK}>Explainer</strong> or <strong style={INK}>Infographic</strong>. Each shows sample pictures.
        </p>
        <p style={{ marginBottom: 10 }}>
          Every look — <strong style={INK}>Slide Deck</strong> included — uses the voice and background music you chose on the Voice &amp; Length step, and the script exactly as you left it on the script step, edits and all.
        </p>
        <p style={{ marginBottom: 10 }}>
          Under <strong style={INK}>Client options</strong> you can write a <strong style={INK}>Note to your client</strong> (shown on the share page) and, if your source was a PDF, turn on <strong style={INK}>Let the client download the original PDF</strong>.
        </p>
        <p style={{ marginBottom: 10 }}>
          Click <strong style={INK}>Generate with [Style] &rarr;</strong>. A progress screen shows each stage: starting up, writing the script, recording voices, designing slides and assembling the video.
        </p>
        <p>
          Most videos take <strong style={INK}>3–5 minutes</strong>; the Slide Deck style takes about <strong style={INK}>10 minutes</strong>. <strong style={INK}>You can leave the page</strong> — it keeps going in the background and the finished video appears in your Library.
        </p>
      </Step>

      <Step n={9} title="View and share your video">
        <p style={{ marginBottom: 12 }}>
          Open the video from your Library. Below the player you will find these buttons:
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Send to Client</strong> and <strong style={INK}>Copy Link</strong> — email the share page to a client, or copy its address to send yourself. See the{' '}
          <Link href="/help/sharing-videos" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Sharing Videos</Link> guide.
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>MP4</strong>, <strong style={INK}>PDF</strong>, <strong style={INK}>PPTX</strong> and <strong style={INK}>Script</strong> — download the video, the slides, an editable PowerPoint, or the script as text.
        </p>
        <p style={{ marginBottom: 10 }}>
          <strong style={INK}>Duplicate</strong>, <strong style={INK}>Social Posts</strong> (ready-made captions for LinkedIn, X and Facebook) and <strong style={INK}>Delete</strong>.
        </p>
        <p>
          <strong style={INK}>Edit Video</strong> — change or remove scenes and click <strong style={INK}>Save &amp; Regenerate</strong>. For Slide Deck videos there is also <strong style={INK}>Fix a scene</strong>, to redo one scene (a glitch, wording or pronunciation) without starting over. Click the title to rename the video.
        </p>
      </Step>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/help" className="btn btn-soft">
          Back to Help Center
        </Link>
      </div>
    </div>
  )
}
