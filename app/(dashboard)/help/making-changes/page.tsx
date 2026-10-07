'use client'

import Link from 'next/link'
import { CREDIT_COSTS } from '../../../_lib/credits'

// The "Ask for a change" bar on a finished project's page (overhaul phase 4).
// Written against app/(dashboard)/videos/[id]/change/change-route.ts — that
// file decides which editor a change goes to; prices come from credits.ts.

const CARD: React.CSSProperties = {
  background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '28px 32px', marginBottom: 20,
}
const H2: React.CSSProperties = { fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const BODY: React.CSSProperties = { fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }
const STEP_NUM: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
}
const INK: React.CSSProperties = { color: 'var(--ink)' }
const n = (x: number) => x.toLocaleString('en-US')

function Step({ num, children, last }: { num: number; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: last ? 0 : 16 }}>
      <div style={STEP_NUM}>{num}</div>
      <div>{children}</div>
    </div>
  )
}

export default function MakingChangesPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Changing a Finished Project</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Changing a Finished Project</h1>
          <p>One bar for every change — what it does for each kind of project, what it costs, and how to undo.</p>
        </div>
      </div>

      <div style={CARD}>
        <h2 style={H2}>Ask for a Change</h2>
        <div style={BODY}>
          <Step num={1}>
            <strong style={INK}>Open the project</strong> from your Library. Under <strong style={INK}>Ready to send</strong> is a box called <strong style={INK}>Ask for a change</strong>. Its first line says what a change costs for this project.
          </Step>
          <Step num={2}>
            <strong style={INK}>Pick what to change.</strong> Press <strong style={INK}>This scene</strong> (<strong style={INK}>This slide</strong> on a presentation) or the whole thing. With This scene, a row of scenes appears — press one to choose it. On a video the player above jumps to that scene, and while it plays, the scene playing is the one chosen. The ⤢ button on a picture shows it large.
          </Step>
          <Step num={3}>
            <strong style={INK}>Say what you want.</strong> Type it in the box, or press a suggestion. Then press the button under it. It opens the editor this kind of project uses (below), with your request filled in.
          </Step>
          <Step num={4} last>
            <strong style={INK}>Undo.</strong> Your changes are listed under <strong style={INK}>Your changes</strong>, newest first. Press <strong style={INK}>Undo</strong> and the same editor opens with the words as they were before that change; putting them back costs what any change of words costs (shown on its button). A re-recorded voice or a fixed pronunciation changes no words, so there is nothing to undo — the list says so. The list is kept on this computer only.
          </Step>
        </div>
      </div>

      <div style={CARD}>
        <h2 style={H2}>Where Each Change Goes</h2>
        <div style={BODY}>
          <p style={{ marginBottom: 12 }}>
            <strong style={INK}>Presentations and slide decks</strong> — the slide editor opens and tries your request straight away. Trying is free: you see the new slides before anything is rebuilt. Each AI change is listed with its own <strong style={INK}>Undo</strong>. When you&rsquo;re happy, the rebuild button shows the price first: free when only what the slides show changes, {n(CREDIT_COSTS['slide-scene-fix'])} credits for each slide whose spoken words change.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={INK}>Videos in the Slide Deck look</strong> — <strong style={INK}>Fix a scene</strong> opens on the scene you chose. The suggestions pick the fix: <strong style={INK}>The voice glitched</strong> (free re-record), <strong style={INK}>A word is said wrong</strong> (free), or <strong style={INK}>Change what it says</strong> ({n(CREDIT_COSTS['slide-scene-fix'])} credits). You can hear the new voice for free before you apply it. With the whole video picked, describe the problem and it finds the scene.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={INK}>Other video looks that keep slide pictures</strong> — the <strong style={INK}>Scene editor</strong> opens below the bar (it is the older &ldquo;Edit Video&rdquo; window). Change the words, the order or remove scenes, then press <strong style={INK}>Save &amp; Regenerate</strong>. It is free. It rebuilds the video from its slide pictures with the new voice, so moving parts of the look may become still slides. To change a slide picture itself, press <strong style={INK}>Edit</strong> on that slide, type what to change and press <strong style={INK}>Apply</strong> — the button shows the price, {n(CREDIT_COSTS['scene-edit'])} credits for each picture change. If the change fails, your credits are given back. The new picture shows in the editor straight away and goes into the video when you press Save &amp; Regenerate.
          </p>
          <p>
            <strong style={INK}>Looks that can&rsquo;t be changed in place</strong> — some looks keep neither a scene plan nor slide pictures. The bar says so and offers <strong style={INK}>Make a changed copy</strong>: a copy opens in the create steps, you change it on step 2, and make it again. That is a new video, from {n(CREDIT_COSTS.videoQuick)} credits — step 3 shows the exact price.
          </p>
        </div>
      </div>

      <div style={CARD}>
        <h2 style={H2}>While It&rsquo;s Being Changed</h2>
        <div style={BODY}>
          <p>
            A scene fix or a rebuild remakes the video, so the page shows its progress until it&rsquo;s done — usually a few minutes. You can leave the page. Your client&rsquo;s link stays the same and shows the new version when it&rsquo;s ready.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/help" className="btn btn-soft">
          Back to Help Center
        </Link>
      </div>
    </div>
  )
}
