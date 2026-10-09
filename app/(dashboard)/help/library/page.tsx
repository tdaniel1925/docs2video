import Link from 'next/link'
import type { ReactNode } from 'react'
import { KIND_NAMES, NAMES } from '../../../_lib/names'

/*
 * HELP: THE LIBRARY (round A, 2026-10). The Library became picture cards
 * with search, an order, a cards/list switch and a "…" menu for Delete.
 * Every word in bold here is a word on that screen — change the screen,
 * change this page in the same commit.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="kit-card" style={{ padding: '24px 28px', marginBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 12px', color: 'var(--ink)' }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-soft)', display: 'grid', gap: 10 }}>{children}</div>
    </section>
  )
}

const tabs = [KIND_NAMES.video.many, KIND_NAMES.presentation.many, KIND_NAMES.deck.many, KIND_NAMES.graphic.many].join(', ')

export default function LibraryHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--link)', textDecoration: 'none', fontWeight: 600 }}>Help Center</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>{NAMES.library}</span>
      </div>

      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <h1>{NAMES.library}</h1>
          <p>Everything you’ve made, as picture cards. Press <strong>{NAMES.library}</strong> in the top bar to open it.</p>
        </div>
      </div>

      <Section title="What a card shows">
        <p>Each card has a picture of the project (its first slide or cover). If there is no picture yet you see a plain panel with an icon and what it is — a video, a presentation, a slide deck or a graphic.</p>
        <p>Under the picture: the name, then a coloured line that says where it is:</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong>Ready to send</strong> (green) — finished. Videos show their length, like “Ready to send · 1:30”.</li>
          <li><strong>Making…</strong> (amber) — still being made, with how far along it is.</li>
          <li><strong>Didn’t finish</strong> (red) — something went wrong. Open it to see what happened. Failed projects give their credits back.</li>
          <li><strong>Draft — not made yet</strong> — you started it but haven’t pressed Make it. Pressing the card picks it up where you left off.</li>
        </ul>
        <p>The last line is the date it was made and who it’s for.</p>
      </Section>

      <Section title="Open, send, delete">
        <p><strong>Press a card</strong> to open it. Videos and presentations open their page with the player, sending and downloads. Graphics open the picture in a new tab.</p>
        <p>A ready video has a <strong>Send</strong> button on its picture. It takes you straight to the <strong>Ready to send</strong> panel on that video’s page, where you pick who gets it and press Send.</p>
        <p>To delete one, press the <strong>…</strong> button beside its name and choose <strong>Delete…</strong>. A box asks “Delete this for good?” — nothing is removed until you press <strong>Delete</strong> there. Deleting can’t be undone, and any link you sent stops working.</p>
      </Section>

      <Section title="Find something">
        <p><strong>Tabs</strong> show one kind: {tabs}, or All. The tab stays chosen when you refresh.</p>
        <p>Type in <strong>Search by name or client</strong> to find one by its name, the client it’s for, or its kind.</p>
        <p>The order box sorts by <strong>Newest first</strong>, <strong>Oldest first</strong> or <strong>Name A–Z</strong>.</p>
        <p>The two small buttons on the right switch between <strong>Cards</strong> and <strong>List</strong>. The list is a table with the type, the client, the status, the credits used and the date. Your choice is remembered on this computer.</p>
        <p>Older work is on the next pages. Change <strong>Per page:</strong> (24, 48 or 96) or press <strong>Next</strong>.</p>
      </Section>

      <Section title="On a phone">
        <p>Cards stack one per row, and each still shows its status and the Send button. In the list, the extra columns fold away so you see the name, the status and the buttons.</p>
      </Section>
    </div>
  )
}
