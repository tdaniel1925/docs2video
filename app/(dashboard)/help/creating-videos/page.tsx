'use client'

import Link from 'next/link'
import { NAMES } from '../../../_lib/names'
// Credit costs come from the table the charge uses, so this page can't quote an old price.
import { CREDIT_COSTS } from '../../../_lib/credits'

const n = (x: number) => x.toLocaleString('en-US')

// Walks through the create flow exactly as the screens show it — the four
// steps on the step bar: What it's about → Check the story → Make it yours →
// Send it. Rewritten for the 4-step flow 2026-10-06 (the old 9-step guide
// described screens that no longer exist).

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
const LINK: React.CSSProperties = { color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }
const P: React.CSSProperties = { marginBottom: 10 }

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
        <Link href="/help" style={LINK}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Creating Explainer Videos</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Creating Explainer Videos</h1>
          <p>
            Four steps, from your document to a link you can send. The step bar (on the left, or at the top on a phone)
            shows which step you are on. Your work is saved as you go, and nothing is charged until you press{' '}
            <strong>Make it</strong> on step 3.
          </p>
        </div>
      </div>

      <Step n={1} title="What it’s about">
        <p style={P}>
          Click <strong style={INK}>{NAMES.newButton}</strong> in the top bar. The screen asks <strong style={INK}>What&rsquo;s this about?</strong> — three questions.
        </p>
        <p style={P}>
          <strong style={INK}>Who is it for?</strong> — Search your clients and pick one, click <strong style={INK}>+ New client</strong> to add one,
          or choose <strong style={INK}>No client — general</strong>. A client&rsquo;s name appears on the video cover and on the share page
          (&ldquo;Prepared for [Client]&rdquo;).
        </p>
        <p style={P}>
          <strong style={INK}>What should it get them to do?</strong> — Type the goal in your own words, for example &ldquo;Explain our services to potential clients&rdquo;.
        </p>
        <p style={P}>
          <strong style={INK}>Where should the content come from?</strong> — Pick one:
        </p>
        <p style={P}>
          <strong style={INK}>Website URL</strong> — type a web address and the AI reads the page.{' '}
          <strong style={INK}>Upload file</strong> — up to 5 files: PDF, Word (DOCX), PowerPoint (PPTX), text (TXT), CSV or Excel (XLSX).{' '}
          <strong style={INK}>Paste text</strong> — notes, an email or an article (at least 50 characters).{' '}
          <strong style={INK}>AI writes it</strong> — the AI writes the content from your goal.
        </p>
        <p>
          Click <strong style={INK}>Read it and plan the story &rarr;</strong>. A progress bar shows while it reads.
        </p>
      </Step>

      <Step n={2} title="Check the story (free)">
        <p style={P}>
          The screen says <strong style={INK}>Here&rsquo;s the story.</strong> At the top is <strong style={INK}>The one point</strong> — the main
          message the AI took from your source — with the numbers it will show. Click <strong style={INK}>What it covers</strong> to see the full list.
        </p>
        <p style={P}>
          If the AI is unsure about something, it asks <strong style={INK}>A couple of quick questions first</strong>. Answer them and click{' '}
          <strong style={INK}>Use my answers and write the story</strong>, or click <strong style={INK}>Skip — just write it</strong>.
          Writing the story takes about a minute.
        </p>
        <p style={P}>
          <strong style={INK}>Length</strong> — pick <strong style={INK}>Short</strong> (under 1 minute), <strong style={INK}>Standard</strong> (2–5 minutes)
          or <strong style={INK}>Detailed</strong> (5–15 minutes). A longer video costs more credits ({n(CREDIT_COSTS.videoQuick)}, {n(CREDIT_COSTS.videoStandard)} or {n(CREDIT_COSTS.videoDetailed)}); you see the exact
          price on step 3. Pick a length before the story is written and it is written at that length. If the story is already written,
          picking a new length shows <strong style={INK}>Rewrite at this length</strong> (free — your story is rewritten as the new length)
          and <strong style={INK}>Keep</strong> (nothing changes). You can&rsquo;t go on to step 3 until you choose one of the two.
        </p>
        <p style={P}>
          The story appears as scenes: an <strong style={INK}>Opening</strong>, the main scenes and a <strong style={INK}>Closing</strong>. Change any
          scene&rsquo;s title or the words the voice says, and drag scenes to reorder them (the opening and closing stay put). Click{' '}
          <strong style={INK}>More — words on screen, ask AI, preview</strong> to change the numbers and points on the slide, use{' '}
          <strong style={INK}>✨ Edit with AI</strong> on that one scene, or see a <strong style={INK}>Preview slide</strong>.
        </p>
        <p style={P}>
          For bigger changes, use <strong style={INK}>Change it by asking</strong> on the right: type what you want (for example
          &ldquo;add a scene about pricing&rdquo;) or tap <strong style={INK}>Make it shorter</strong> or <strong style={INK}>Simpler words</strong>.
          It rewrites the whole story; <strong style={INK}>Undo that change</strong> puts it back. <strong style={INK}>Write it again from the start</strong>{' '}
          writes a brand-new story.
        </p>
        <p style={P}>
          <strong style={INK}>Your draft is saved as you go.</strong> Once it has a story, an unfinished draft is kept for <strong style={INK}>14 days</strong>{' '}
          after your last change (a draft without a story is kept for 24 hours). Pick it up again from Home.
        </p>
        <p>
          When it reads right, click <strong style={INK}>Looks right — pick the look &rarr;</strong>.
        </p>
      </Step>

      <Step n={3} title="Make it yours">
        <p style={P}>
          <strong style={INK}>Your brand</strong> — the top line says which brand is used (&ldquo;Using [name]&rsquo;s logo and colors&rdquo;). Click{' '}
          <strong style={INK}>Change</strong> (or <strong style={INK}>Add your brand</strong>) to open the brand step. A brand can be a person — your name,
          photo and a friendly intro — or a company, with its logo and colors. Pick a saved brand, set up a new one there, or click{' '}
          <strong style={INK}>Skip — no brand on this one</strong>. See the{' '}
          <Link href="/help/brands" style={LINK}>Brands</Link> guide.
        </p>
        <p style={P}>
          <strong style={INK}>What do you want to send?</strong> — a <strong style={INK}>Narrated video</strong>, an{' '}
          <strong style={INK}>Interactive presentation</strong> (they click through at their own pace, with narration) or a{' '}
          <strong style={INK}>Slide deck</strong> (silent slides, download as PDF or PowerPoint). Each shows its price.
        </p>
        <p style={P}>
          <strong style={INK}>The look</strong> — for a video: <strong style={INK}>Slide Deck</strong> (recommended), <strong style={INK}>Aurora</strong>,{' '}
          <strong style={INK}>Cinematic</strong>, <strong style={INK}>Editorial</strong>, <strong style={INK}>Explainer</strong> or{' '}
          <strong style={INK}>Infographic</strong>, each with sample pictures. Slide Deck can also <strong style={INK}>Add photo backgrounds</strong>{' '}
          (same price, a few minutes longer). Presentations have their own color sets.
        </p>
        <p style={P}>
          <strong style={INK}>The voice</strong> — press ▶ to hear a sample, then click a voice. The first one, <strong style={INK}>Sarah</strong>, a warm
          female voice, is chosen for you. For a video you can turn on <strong style={INK}>Background music</strong> (same price).
        </p>
        <p style={P}>
          <strong style={INK}>Length</strong> — shows the length your story was written at. To change it, click{' '}
          <strong style={INK}>Change the length</strong>; it takes you straight to the length choice on step 2.
        </p>
        <p style={P}>
          <strong style={INK}>For your client</strong> (optional) — write <strong style={INK}>A note to your client</strong> (shown on the share page,
          up to 400 characters) and, if your source was a PDF, turn on <strong style={INK}>Let them download the original PDF</strong>.
        </p>
        <p>
          <strong style={INK}>The price</strong> panel shows the total and your credit balance. Click <strong style={INK}>Make it — [credits]</strong>.
          If the price changed since the page loaded, it tells you and waits for you to press again.
        </p>
      </Step>

      <Step n={4} title="Send it">
        <p style={P}>
          A progress screen shows how it&rsquo;s going. Most videos take <strong style={INK}>3–5 minutes</strong>; the Slide Deck look takes about{' '}
          <strong style={INK}>10 minutes</strong>. <strong style={INK}>You can leave the page</strong> — it keeps going, and the finished one appears in
          your <strong style={INK}>{NAMES.library}</strong>.
        </p>
        <p style={P}>
          When it&rsquo;s done, its page opens with <strong style={INK}>Ready to send</strong>: a picture of what your client will see, who it goes to,
          a short note and the Send button. See the{' '}
          <Link href="/help/sharing-videos" style={LINK}>Sharing Videos</Link> guide.
        </p>
        <p style={P}>
          Further down you can download it (<strong style={INK}>MP4</strong>, <strong style={INK}>PDF</strong>, <strong style={INK}>PPTX</strong>,{' '}
          <strong style={INK}>Script</strong>), make <strong style={INK}>Social Posts</strong>, <strong style={INK}>Delete</strong> it, or use{' '}
          <strong style={INK}>Edit Video</strong> to change or remove scenes and <strong style={INK}>Save &amp; Regenerate</strong>. For Slide Deck
          videos, <strong style={INK}>Fix a scene</strong> redoes one scene without starting over. Click the title to rename it.
        </p>
        <p>
          <strong style={INK}>Duplicate</strong> makes a new project from this one — the same client, goal, source, story, length, look, voice and
          brand — and opens it on step 2 with a note saying it&rsquo;s a copy. Change what you like; nothing is charged until you press{' '}
          <strong style={INK}>Make it</strong> again. The finished video, its share-page note and download setting, quotes and views are not copied.
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
