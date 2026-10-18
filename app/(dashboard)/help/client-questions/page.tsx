'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

// CLIENT QUESTIONS — the AI-drafted answers the agent approves. Written from
// the screens' own words (watch page "Ask a question", /questions/[id]).
// Update with those screens.

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, padding: '28px 32px', marginBottom: 20 }
const h2: React.CSSProperties = { fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }
const body: React.CSSProperties = { fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }
const B = ({ children }: { children: ReactNode }) => <strong style={{ color: 'var(--ink)' }}>{children}</strong>

export default function ClientQuestionsHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Help Center</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Client questions</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Client questions</h1>
          <p>When a client asks a question under your video, we write a draft answer from their own document. You check it and decide. Nothing reaches your client until you press Approve.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>What your client sees</h2>
        <ol style={{ ...body, paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 10 }}>On their page they press <B>Reply to</B> you (or <B>Ask a question</B> at the end of a presentation), type the question, and can add their email and name.</li>
          <li style={{ marginBottom: 10 }}>They see <B>Your agent will reply shortly</B>. That’s all — no AI answer is shown to them.</li>
          <li>Once you approve an answer, it shows under the video in <B>Your questions, answered</B>, with which part of their document it came from. If they left an email, we email it to them too. Who asked is never shown on the page.</li>
        </ol>
      </div>

      <div style={card}>
        <h2 style={h2}>Answering, step by step</h2>
        <ol style={{ ...body, paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 10 }}>You get an email (<B>Check the answer →</B>), a note in the bell, and a card under <B>Today’s clients</B> on Home. All questions are under <B>Client questions</B>, and each video’s own questions are on its page.</li>
          <li style={{ marginBottom: 10 }}>Open the question. You see what they asked, the <B>Draft answer · not sent</B>, and <B>Where the draft came from</B> — the exact words from their document it used.</li>
          <li style={{ marginBottom: 10 }}>Press <B>Approve</B> to use it as is, or <B>Edit</B> to change it and then <B>Approve my answer</B>. Untick <B>Show it on their page, under the video</B> if you only want it emailed.</li>
          <li style={{ marginBottom: 10 }}>Prefer to talk? <B>Call instead</B> (it dials their number if you have it). Busy? <B>Not now</B> keeps it in your list.</li>
          <li>Changed your mind later? <B>Take it off their page</B>.</li>
        </ol>
      </div>

      <div style={card}>
        <h2 style={h2}>The safety rules</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}><B>You approve everything.</B> The AI never answers your client on its own.</p>
          <p style={{ marginBottom: 10 }}><B>Only their document.</B> The draft uses only the document the video was made from and the video’s own words, and quotes where each fact came from. If a quote can’t be found word for word in the document, the draft is thrown away.</p>
          <p style={{ marginBottom: 10 }}><B>No promises, no advice.</B> It never says they are covered or that something will be paid, never tells them to buy, cancel or switch anything, never gives tax or legal advice, and never names an insurance company or product.</p>
          <p style={{ marginBottom: 10 }}><B>When it isn’t sure, it says so.</B> You’ll see <B>Needs your answer</B> and the line “I’ll ask your agent to answer this one personally.” Write your own answer or call.</p>
          <p><B>Everything is kept.</B> Every question, draft, edit and approval is saved with the time, under <B>What happened</B>, and that list can’t be changed.</p>
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>What it costs</h2>
        <div style={body}>
          <p style={{ marginBottom: 10 }}><B>Free.</B> Draft answers don’t use credits, and your clients never pay anything.</p>
          <p>There’s a fair-use limit: 10 drafts a day for one video and 40 a day for your account. Past that, questions still reach you — just without a draft. The form on your page is protected from spam robots and limits how many questions one person can send.</p>
        </div>
      </div>
    </div>
  )
}
