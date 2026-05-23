import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '5 Steps to Turn Any Business Proposal Into a Video That Wins | Docs2Video Blog',
  description: 'A step-by-step guide to converting business proposals into short, compelling video presentations that get watched and win deals.',
}

const h2Style = { fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 32, marginBottom: 12 } as const
const h3Style = { fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 24, marginBottom: 8 } as const
const pStyle = { marginBottom: 16 } as const

export default function TurnProposalIntoVideoPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/blog" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
          &larr; Back to Blog
        </Link>

        <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
          <span style={{ padding: '2px 10px', borderRadius: 6, background: 'rgba(59,181,200,0.1)', color: 'var(--mint)', fontWeight: 600 }}>Guides</span>
          <span style={{ color: 'var(--ink-light)' }}>May 16, 2026</span>
          <span style={{ color: 'var(--ink-light)' }}>5 min read</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 24 }}>
          5 Steps to Turn Any Business Proposal Into a Video That Wins
        </h1>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={pStyle}>
            A business proposal is a sales tool. Its only job is to convince someone to say yes. But most proposals fail at this job — not because the offer is wrong, but because the format works against them. Dense paragraphs, long appendices, and boilerplate language create friction between your solution and their decision.
          </p>
          <p style={pStyle}>
            A short video version of your proposal removes that friction. It&apos;s easier to consume, harder to ignore, and far more likely to be shared with other decision-makers. Here&apos;s how to create one that actually wins business.
          </p>

          <h2 style={h2Style}>Step 1: Identify the Core Narrative</h2>
          <p style={pStyle}>
            Your written proposal probably has 10-20 pages. Your video should be 2-4 minutes. That means you need to ruthlessly cut — and cutting requires knowing what actually matters.
          </p>
          <p style={pStyle}>
            Every effective proposal video answers exactly four questions:
          </p>
          <ol style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}>What problem does the client have?</li>
            <li style={{ marginBottom: 8 }}>What are you proposing to do about it?</li>
            <li style={{ marginBottom: 8 }}>What will the outcome look like?</li>
            <li style={{ marginBottom: 8 }}>What does it cost and what happens next?</li>
          </ol>
          <p style={pStyle}>
            Everything else — your company history, detailed methodology, team bios, terms and conditions — belongs in the written proposal that you attach alongside the video. The video is the hook. The document is the reference.
          </p>

          <h2 style={h2Style}>Step 2: Lead With Their Problem, Not Your Solution</h2>
          <p style={pStyle}>
            The most common mistake in proposal videos is starting with your company. &quot;We are XYZ Corp, founded in 2015, with offices in...&quot; — your prospect doesn&apos;t care. Not yet.
          </p>
          <p style={pStyle}>
            Start with their pain. Name the specific challenge they&apos;re facing. Use the language they used when they described it to you. This immediately signals that you listened, you understand, and this video is about <em>them</em>.
          </p>
          <p style={pStyle}>
            A strong opening sounds like: &quot;Your sales team is spending 6 hours per week manually building reports that are outdated by the time they&apos;re finished. Here&apos;s how we fix that.&quot;
          </p>
          <p style={pStyle}>
            In 15 seconds, you&apos;ve demonstrated understanding, created urgency, and earned their attention for the rest of the video.
          </p>

          <h2 style={h2Style}>Step 3: Show the Outcome, Then Explain the Path</h2>
          <p style={pStyle}>
            People buy outcomes, not processes. Before you explain <em>how</em> you&apos;ll solve their problem, show them <em>what life looks like after</em> you&apos;ve solved it. Paint a concrete picture:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}>&quot;Your team gets those reports automatically every Monday morning.&quot;</li>
            <li style={{ marginBottom: 8 }}>&quot;Your clients see a branded portal instead of email attachments.&quot;</li>
            <li style={{ marginBottom: 8 }}>&quot;Your onboarding time drops from 3 weeks to 3 days.&quot;</li>
          </ul>
          <p style={pStyle}>
            Once they want the outcome, they&apos;ll pay attention to your methodology. Keep the process explanation brief — 3 to 5 key phases or deliverables, described in one sentence each. Save the granular detail for the written proposal.
          </p>

          <h2 style={h2Style}>Step 4: Make the Investment Crystal Clear</h2>
          <p style={pStyle}>
            Don&apos;t bury pricing. Your prospect will scrub through the video looking for the number anyway — make it easy to find. Present it confidently, in context.
          </p>
          <h3 style={h3Style}>What &quot;in context&quot; means:</h3>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Anchor against the cost of inaction.</strong> &quot;The manual reporting process costs your team roughly $4,200 per month in labor. Our solution is $800 per month.&quot;</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Break it down.</strong> A $24,000 annual contract sounds large. $2,000/month sounds manageable. $66/day sounds trivial. Use the framing that makes sense for your offer.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Include what they get.</strong> Pair the price with a brief summary of deliverables so the value is immediately obvious.</li>
          </ul>

          <h2 style={h2Style}>Step 5: End With One Clear Next Step</h2>
          <p style={pStyle}>
            The end of your video is the most important moment. Your prospect just watched your pitch. They&apos;re at peak interest. Don&apos;t waste it with a generic &quot;we look forward to hearing from you.&quot;
          </p>
          <p style={pStyle}>
            Give them exactly one action to take:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}>&quot;Click the link below to book a 15-minute call this week.&quot;</li>
            <li style={{ marginBottom: 8 }}>&quot;Reply to this email with your preferred start date.&quot;</li>
            <li style={{ marginBottom: 8 }}>&quot;Sign the attached agreement to lock in this pricing through June.&quot;</li>
          </ul>
          <p style={pStyle}>
            One CTA. Not three options. Not a vague invitation. One specific thing they can do right now to move forward.
          </p>

          <h2 style={h2Style}>How Long Should It Be?</h2>
          <p style={pStyle}>
            Two to four minutes is the sweet spot for proposal videos. Under two minutes feels rushed and insubstantial for a significant business decision. Over five minutes and you&apos;re losing viewers — Vidyard data shows completion rates drop sharply after the 4-minute mark for business content.
          </p>
          <p style={pStyle}>
            A good rule of thumb: one minute per major section. Problem (30-45 seconds), outcome and approach (60-90 seconds), investment (30-45 seconds), next step (15-30 seconds). That gets you to roughly 3 minutes — long enough to be substantive, short enough to hold attention.
          </p>

          <h2 style={h2Style}>The Compound Effect</h2>
          <p style={pStyle}>
            The real power of video proposals isn&apos;t any single deal — it&apos;s what happens when you make this your standard process. Every proposal you send becomes more engaging. Your close rate creeps up. Your sales cycle shortens. And you build a reputation as the company that&apos;s easier to work with than your competitors, because you make things simple to understand.
          </p>
          <p style={pStyle}>
            That reputation compounds. And it starts with turning your next proposal into a video.
          </p>
        </div>

        <div style={{ marginTop: 48, padding: '28px 32px', borderRadius: 10, background: 'var(--surface)', border: '2px solid var(--mint)', textAlign: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Ready to try it?</h3>
          <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 16 }}>Turn your next document into a professional video in minutes.</p>
          <Link href="/signup" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 8, background: 'var(--ink)', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Start free &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
