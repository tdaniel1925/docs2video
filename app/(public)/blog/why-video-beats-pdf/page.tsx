import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Why Video Beats PDF for Getting Documents Understood | Docs2Video Blog',
  description: 'Why a short narrated video is often easier for clients to take in than a long PDF — and when a PDF still makes sense.',
}

const h2Style = { fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 32, marginBottom: 12 } as const
const pStyle = { marginBottom: 16 } as const

export default function WhyVideoBeatsPdfPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/blog" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
          &larr; Back to Blog
        </Link>

        <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
          <span style={{ padding: '2px 10px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 600 }}>Insights</span>
          <span style={{ color: 'var(--ink-light)' }}>May 23, 2026</span>
          <span style={{ color: 'var(--ink-light)' }}>5 min read</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 24 }}>
          Why Video Beats PDF for Getting Documents Understood
        </h1>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={pStyle}>
            You spent hours preparing a detailed proposal, report, or policy document. You exported a polished PDF, sent it to your client, and then... nothing. No response. No questions. When you follow up a week later, they admit they haven&apos;t read it yet.
          </p>
          <p style={pStyle}>
            This happens all the time, in every industry. And the problem isn&apos;t your content — it&apos;s the format.
          </p>

          <h2 style={h2Style}>Why Long Documents Go Unread</h2>
          <p style={pStyle}>
            Most people are busy. A long PDF asks for quiet time and attention, so it gets saved for later — and later often never comes. When people do open it, many skim the first page, glance at a chart or some bold text, and move on.
          </p>
          <p style={pStyle}>
            A short video asks for much less. It plays on a phone, it moves at its own pace, and it tells the viewer what matters first. For many people, pressing play is simply easier than sitting down to read.
          </p>

          <h2 style={h2Style}>Why Narration Helps</h2>
          <p style={pStyle}>
            Hearing an explanation while seeing the key numbers on screen gives people two ways to follow along at once. A voice can point to what matters — &ldquo;this is the number to watch&rdquo; — in a way a page of text can&apos;t. That is a big part of why a walkthrough is often easier to understand than the document on its own.
          </p>

          <h2 style={h2Style}>What It Can Mean for Your Business</h2>
          <p style={pStyle}>
            When the people you send documents to actually take them in, a few good things tend to follow:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Fewer stalled conversations.</strong> A prospect who understood your proposal has something to say yes or no to.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Fewer repeat questions.</strong> A clear walkthrough answers the common questions before they are asked.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Better-prepared meetings.</strong> People arrive having seen the main points, so the time goes to their real questions.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>You know it was opened.</strong> Unlike a PDF attachment, a video link can tell you when someone watched, so you know when to follow up.</li>
          </ul>

          <h2 style={h2Style}>When PDFs Still Make Sense</h2>
          <p style={pStyle}>
            Video doesn&apos;t replace PDFs entirely. Reference documents that people search through — like technical specs, contracts, or compliance manuals — still benefit from a text format. The key distinction is purpose: if your document needs to be <em>consumed and understood</em>, video wins. If it needs to be <em>searched and referenced</em>, text wins.
          </p>
          <p style={pStyle}>
            The smartest approach is to pair them. Send the video as the primary experience — the thing you want your client, prospect, or team member to actually engage with — and include the PDF as a downloadable reference. You get the engagement benefits of video with the archival benefits of text.
          </p>

          <h2 style={h2Style}>The Barrier Has Disappeared</h2>
          <p style={pStyle}>
            The traditional argument against video was cost and time. Producing a professional explainer video used to mean a script, voiceover talent, motion graphics, and a lot of production time and money.
          </p>
          <p style={pStyle}>
            That barrier is much lower now. AI tools can take your existing document — the same PDF, proposal, or report you were going to send anyway — and turn it into a narrated video without a film crew or an editing timeline. The content is already written. The data is already organized. The only thing that changes is the delivery format.
          </p>
          <p style={pStyle}>
            So the question is simple: why keep sending documents that don&apos;t get read?
          </p>
        </div>

        <div style={{ marginTop: 48, padding: '28px 32px', borderRadius: 10, background: 'var(--surface)', border: '2px solid var(--accent-ink)', textAlign: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Ready to try it?</h3>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 16 }}>Turn your next document into a narrated video your client will actually watch.</p>
          <Link href="/signup" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 8, background: 'var(--ink)', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Start free &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
