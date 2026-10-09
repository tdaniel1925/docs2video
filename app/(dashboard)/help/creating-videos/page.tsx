'use client'

import Link from 'next/link'
import { NAMES } from '../../../_lib/names'
// Credit costs come from the table the charge uses, so this page can't quote an old price.
import { CREDIT_COSTS } from '../../../_lib/credits'

const n = (x: number) => x.toLocaleString('en-US')

// Walks through the create flow exactly as the screens show it — the three
// steps at the top of the screen: Your content → The story → The look, then
// what happens after Make it. Rewritten for the 3-step flow 2026-10-09 (the
// owner-approved sketch: one wide column, one bottom bar per step).

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 'var(--fs-body)', flexShrink: 0,
}

const CARD: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '28px 32px', marginBottom: 20,
}
const BODY: React.CSSProperties = { fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }
const INK: React.CSSProperties = { color: 'var(--ink)' }
const LINK: React.CSSProperties = { color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }
const P: React.CSSProperties = { marginBottom: 10 }

function Step({ n, title, children }: { n: number | string; title: string; children: React.ReactNode }) {
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', marginBottom: 16 }}>
        <div style={STEP_CIRCLE}>{n}</div>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{title}</h2>
      </div>
      <div style={BODY}>{children}</div>
    </div>
  )
}

export default function CreatingVideosPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={LINK}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Creating explainer videos</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Creating explainer videos</h1>
          <p>
            Three steps, from your document to a video you can send: <strong>Your content</strong>, <strong>The story</strong> and{' '}
            <strong>The look</strong>. The steps are shown at the top of the screen (just the numbers on a phone) — press a step you&rsquo;ve
            done to go back to it. Each step ends in one bar at the bottom of the screen: the price on the left, the one button that moves
            you on, on the right. Your work is saved as you go, and nothing is charged until you press <strong>Make it</strong> on step 3.
          </p>
        </div>
      </div>

      <Step n={1} title="Your content">
        <p style={P}>
          Click <strong style={INK}>{NAMES.newButton}</strong> in the top bar — or one of the tiles under Create on Home (<strong style={INK}>From a document</strong>, <strong style={INK}>From a website</strong>,{' '}
          <strong style={INK}>From an idea</strong> or <strong style={INK}>Paste your text</strong>). The screen opens on that choice: for a document it
          says <strong style={INK}>Add your document.</strong> with a big box to drop your file in (or click it to choose one).
        </p>
        <p style={P}>
          <strong style={INK}>A document</strong> — up to 5 files: PDF, Word (DOCX), PowerPoint (PPTX), text (TXT), CSV or Excel (XLSX). Each file
          shows in a row under the box; press × to take one off. With more than one file we read them all and compare them (each extra file
          adds to the price, which you see on step 3 before anything is charged).
        </p>
        <p style={P}>
          To use something else, press <strong style={INK}>Use a website</strong> (type the address — just <em>yourcompany.com</em> is fine, no need
          for https://), <strong style={INK}>Paste text</strong> (notes, an email or an article — at least 50 characters) or{' '}
          <strong style={INK}>Describe an idea</strong> (a sentence about what you want; the AI writes the content).
        </p>
        <p style={P}>
          Two answers are optional. <strong style={INK}>For</strong> — press one of your recent clients, <strong style={INK}>+ New</strong> to add a client,
          or <strong style={INK}>Find</strong> to search the rest (press a picked client again to make it general). A client&rsquo;s name appears on the
          video cover and on the share page (&ldquo;Prepared for [Client]&rdquo;). <strong style={INK}>Goal</strong> — what it should get them to do,
          for example &ldquo;Book a review call&rdquo;.
        </p>
        <p>
          The bar at the bottom says <strong style={INK}>Free</strong> — nothing is charged yet. Press <strong style={INK}>Read it &rarr;</strong>. If
          something is still missing, the button can&rsquo;t be pressed and the line under it says what — click <strong style={INK}>Show me</strong> to jump
          straight to it. While it reads you see each real stage (uploading, reading, saving, finding the one point) get a tick as it finishes,
          then step 2 opens.
        </p>
      </Step>

      <Step n={2} title="The story (free)">
        <p style={P}>
          The screen says <strong style={INK}>Here&rsquo;s the story.</strong> The big card at the top is <strong style={INK}>The one point</strong> — the main
          message the AI took from your content. Under it, the numbers it will use sit in big tiles, exactly as they&rsquo;ll be said. Click into
          the point or a number to fix it, or press × on a tile to remove that number. <strong style={INK}>What it covers</strong> shows a short
          summary and the full list. If you change the point or a number after the story is written, it offers{' '}
          <strong style={INK}>Rewrite the story with it</strong> (free) or <strong style={INK}>Undo my changes</strong>.
        </p>
        <p style={P}>
          If the AI is unsure about something, it asks <strong style={INK}>A couple of quick questions first</strong>. Answer them and click{' '}
          <strong style={INK}>Use my answers and write the story</strong>, or click <strong style={INK}>Skip — just write it</strong>.
          Writing the story takes about a minute.
        </p>
        <p style={P}>
          The scenes show as cards in two columns — &ldquo;6 scenes · about 3 minutes&rdquo; — starting with the <strong style={INK}>Opening</strong> and ending
          with the <strong style={INK}>Closing</strong>. Press <strong style={INK}>Edit</strong> on a scene to change its title or the words the voice says;
          inside it, <strong style={INK}>More — words on screen, ask AI, preview</strong> changes the numbers and points on the slide, offers{' '}
          <strong style={INK}>✨ Edit with AI</strong> for that one scene, and a <strong style={INK}>Preview slide</strong>. Drag a card to move a scene (the
          opening and closing stay put).
        </p>
        <p style={P}>
          <strong style={INK}>Length</strong> — beside the scene count: <strong style={INK}>Short</strong> (under 1 minute), <strong style={INK}>Standard</strong> (2–5 minutes)
          or <strong style={INK}>Detailed</strong> (5–15 minutes). A longer video costs more credits ({n(CREDIT_COSTS.videoQuick)}, {n(CREDIT_COSTS.videoStandard)} or {n(CREDIT_COSTS.videoDetailed)}); you see the exact
          price on step 3. Pick a length before the story is written and it is written at that length. If the story is already written,
          picking a new length shows <strong style={INK}>Rewrite at this length</strong> (free — your story is rewritten as the new length)
          and <strong style={INK}>Keep</strong> (nothing changes). You can&rsquo;t go on to step 3 until you choose one of the two.
        </p>
        <p style={P}>
          For bigger changes, type under <strong style={INK}>Ask for a change</strong> (for example &ldquo;add a scene about pricing&rdquo; or
          &ldquo;make it shorter&rdquo;) and press <strong style={INK}>Change</strong>. It rewrites the whole story; <strong style={INK}>Undo that change</strong> puts it
          back. <strong style={INK}>Write it again from the start</strong> writes a brand-new story.
        </p>
        <p style={P}>
          <strong style={INK}>Your draft is saved as you go.</strong> Once it has a story, an unfinished draft is kept for <strong style={INK}>14 days</strong>{' '}
          after your last change (a draft without a story is kept for 24 hours). Pick it up again from Home.
        </p>
        <p>
          When it reads right, press <strong style={INK}>Pick a look &rarr;</strong> in the bar at the bottom.
        </p>
      </Step>

      <Step n={3} title="The look">
        <p style={P}>
          The screen says <strong style={INK}>Pick a look.</strong> For a video the looks are <strong style={INK}>Slide Deck</strong> (marked{' '}
          <strong style={INK}>BEST</strong>, and picked for you), <strong style={INK}>Aurora</strong>, <strong style={INK}>Cinematic</strong>,{' '}
          <strong style={INK}>Editorial</strong>, <strong style={INK}>Explainer</strong>, <strong style={INK}>Infographic</strong> and{' '}
          <strong style={INK}>Drawn slides</strong> (marked <strong style={INK}>NEW</strong>). Press a card to pick it;{' '}
          <strong style={INK}>See examples</strong> shows more of it. Presentations have their own color sets.
        </p>
        <p style={P}>
          <strong style={INK}>Drawn slides</strong> — the AI draws every slide as one finished picture, with the headline, a few short points and your
          numbers drawn right in. When you pick it, a <strong style={INK}>Drawing style</strong> line appears under the cards with three choices, each with a
          small sample: <strong style={INK}>3D infographic</strong> (glossy 3D objects and cards — picked for you), <strong style={INK}>Illustrated</strong>{' '}
          (friendly flat drawings) and <strong style={INK}>Classic</strong> (a clean business slide). The voice and music play over the slides as a video.
          Each slide keeps its words short so they are drawn correctly, money shows with a $ and commas, and no logos or company or product names are
          drawn (your contact details go on the last slide as plain text). It costs the same as any other look and takes about 4–6 minutes.
          <strong style={INK}> Free preview</strong> draws your first scene in the style you picked.
        </p>
        <p style={P}>
          One line under the looks sums up the rest, for example &ldquo;Sarah · music off · standard&rdquo;. Press <strong style={INK}>Change</strong> (or open{' '}
          <strong style={INK}>More options</strong>) for:
        </p>
        <p style={P}>
          <strong style={INK}>Voice</strong> — press ▶ to hear a sample, then click a voice. The first one, <strong style={INK}>Sarah</strong>, a warm
          female voice, is chosen for you. <strong style={INK}>Music</strong> — soft background music for a video (same price).{' '}
          <strong style={INK}>Make</strong> — a <strong style={INK}>Video</strong> or an interactive <strong style={INK}>Presentation</strong> (they click through
          at their own pace, with narration); each shows its price. Docs2Video no longer makes silent slide decks; a presentation&rsquo;s slides
          still download as PDF or PowerPoint. <strong style={INK}>Length</strong> — the length your story was written at;{' '}
          <strong style={INK}>Change the length</strong> takes you straight to the length choice on step 2. <strong style={INK}>Photos</strong> — the
          Slide Deck look can <strong style={INK}>Add photo backgrounds</strong> (same price, a few minutes longer). <strong style={INK}>For your client</strong> —{' '}
          <strong style={INK}>A note to your client</strong> (shown on the share page, up to 400 characters) and, if your source was a PDF,{' '}
          <strong style={INK}>Let them download the original PDF</strong>. <strong style={INK}>Price</strong> — the lines that make up the price.
        </p>
        <p style={P}>
          <strong style={INK}>Your brand</strong> — the brand line says which brand is used (&ldquo;Using [name]&rsquo;s logo and colors&rdquo;). Click{' '}
          <strong style={INK}>Change</strong> to open the brand step, where you can pick a saved brand, set up a person or company, or click{' '}
          <strong style={INK}>Skip — no brand on this one</strong>. See the{' '}
          <Link href="/help/brands" style={LINK}>Brands</Link> guide. <strong style={INK}>No brand yet?</strong> On your first project{' '}
          <strong style={INK}>Add your brand</strong> opens right there on the page (any other time, click <strong style={INK}>Add your brand</strong> on the
          brand line). Type your name or company, and either click <strong style={INK}>Fill in from it</strong> next to your website — it reads your
          colours and the logo on your site — or click <strong style={INK}>Upload your logo</strong> and pick your two colours. Click{' '}
          <strong style={INK}>Save my brand</strong>: this project uses it, and so does every new one. Only your real logo is used — we never draw
          one; with no logo your name shows as text. <strong style={INK}>Not now</strong> closes it; <strong style={INK}>More brand options</strong> adds a
          photo and contact details.
        </p>
        <p style={P}>
          <strong style={INK}>See it before you pay</strong> — press <strong style={INK}>Free preview</strong> in the bar at the bottom. You see the first scene in
          the look you picked and hear a few seconds of the voice. It is free, you get a few a day, and it needs no card.
        </p>
        <p>
          The bar shows the price and how many credits you&rsquo;ll have left. Press <strong style={INK}>Make it</strong>. If the price changed since
          the page loaded, it tells you and waits for you to press again. If you haven&rsquo;t added a card yet, the bar says so: Make it opens{' '}
          <strong style={INK}>Add your payment method</strong>, and once your card is saved you come straight back here.
        </p>
      </Step>

      <Step n="✓" title="After you press Make it">
        <p style={P}>
          A progress screen lists the real stages — writing the script, recording the voice, drawing the scenes, putting it together — with a
          tick as each one finishes and what is happening right now (for example &ldquo;Drawing scene 3 of 6&rdquo;). Most videos take{' '}
          <strong style={INK}>3–5 minutes</strong>; the Slide Deck look takes about <strong style={INK}>10 minutes</strong>.{' '}
          <strong style={INK}>You can close the page</strong> — it keeps going, we email you when it&rsquo;s ready, the finished one appears in
          your <strong style={INK}>{NAMES.library}</strong>, and Home lists it under <strong style={INK}>Finished while you were away</strong>.
        </p>
        <p style={P}>
          When it&rsquo;s done, its page opens with <strong style={INK}>Ready to send</strong>: a picture of what your client will see, who it goes to,
          a short note and the Send button. See the{' '}
          <Link href="/help/sharing-videos" style={LINK}>Sharing Videos</Link> guide.
        </p>
        <p style={P}>
          Below it, <strong style={INK}>Ask for a change</strong> changes one scene or the whole thing — it opens the right editor and
          shows the price first (see <Link href="/help/making-changes" style={LINK}>Changing a finished project</Link>).{' '}
          <strong style={INK}>Who watched</strong> shows how far each person got. At the top, <strong style={INK}>Download</strong> has the files it has
          (<strong style={INK}>MP4</strong>, <strong style={INK}>PDF</strong>, <strong style={INK}>PowerPoint</strong>, <strong style={INK}>Script</strong>) and{' '}
          <strong style={INK}>More</strong> has Rename, <strong style={INK}>Duplicate</strong>, <strong style={INK}>Social posts</strong> and{' '}
          <strong style={INK}>Delete</strong>. Click the title to rename it.
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
