import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How Insurance Agents Are Using Video to Explain Policies | Docs2Video Blog',
  description: 'Insurance agents are pairing confusing IUL and whole life illustrations with short video explainers that help clients understand what they are looking at.',
}

const h2Style = { fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 32, marginBottom: 12 } as const
const pStyle = { marginBottom: 16 } as const

export default function InsuranceAgentsVideoPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/blog" style={{ fontSize: 14, color: 'var(--ink-light)', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
          &larr; Back to Blog
        </Link>

        <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
          <span style={{ padding: '2px 10px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 600 }}>Use Cases</span>
          <span style={{ color: 'var(--ink-light)' }}>May 21, 2026</span>
          <span style={{ color: 'var(--ink-light)' }}>6 min read</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 24 }}>
          How Insurance Agents Are Using Video to Explain Policies
        </h1>

        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={pStyle}>
            Every insurance agent knows the moment. You&apos;re sitting across from a client — or more likely, sharing your screen on Zoom — walking them through a 15-page Indexed Universal Life illustration. Their eyes glaze over by page 3. The columns of projected values, surrender charges, and cap rates blur together. They nod politely, say they&apos;ll &quot;think about it,&quot; and you never hear from them again.
          </p>
          <p style={pStyle}>
            The illustration isn&apos;t wrong. The product might be perfect for them. But the delivery format is killing the sale.
          </p>

          <h2 style={h2Style}>The Illustration Problem</h2>
          <p style={pStyle}>
            Life insurance illustrations — whether for IUL, whole life, or annuity products — are designed for compliance, not comprehension. They&apos;re dense, table-heavy documents filled with actuarial language that even experienced agents sometimes struggle to explain clearly.
          </p>
          <p style={pStyle}>
            The typical client meeting follows a predictable pattern: the agent spends a long time explaining what the numbers mean, the client leaves feeling overwhelmed, and then they need to explain the same thing to their spouse at home — without the agent there to help. That second conversation, the one happening at the kitchen table without you, is where many sales stall.
          </p>
          <p style={pStyle}>
            Life insurance decisions often involve a spouse or partner who wasn&apos;t at the original meeting. If that person can&apos;t understand the value proposition from the materials left behind, the deal stalls.
          </p>

          <h2 style={h2Style}>Video Changes the Kitchen Table Conversation</h2>
          <p style={pStyle}>
            Some agents have started turning their illustrations into short narrated video explainers — a few minutes long — that walk through the key concepts visually. Instead of sending a client home with a stack of paper, they send a link to a video that both spouses can watch together.
          </p>
          <p style={pStyle}>
            The video doesn&apos;t replace the illustration. It translates it. A well-structured video covers:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>The problem being solved</strong> — retirement income gap, estate planning need, or legacy goal</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>How the product works</strong> — explained in plain language with visual aids, not actuarial tables</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>The projected outcome</strong> — showing the key numbers (death benefit, cash value at retirement, income stream) without drowning in year-by-year projections</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>The cost and commitment</strong> — monthly premium in context of the client&apos;s budget</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Next steps</strong> — a clear call to action</li>
          </ul>

          <h2 style={h2Style}>What a Video Can Help With</h2>
          <p style={pStyle}>
            A video won&apos;t sell a policy on its own, but it can remove some of the friction around one:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Both decision-makers see the same explanation.</strong> The spouse who missed the meeting hears the same walkthrough you gave, instead of a secondhand summary.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Clients can rewatch.</strong> They can replay the parts they didn&apos;t fully follow the first time — something they can&apos;t do with an in-person presentation.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Fewer &ldquo;can you explain that again?&rdquo; meetings.</strong> Common questions are answered before the next conversation.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Something easy to pass along.</strong> A link is simple to share with family members who want to understand the plan too.</li>
          </ul>

          <h2 style={h2Style}>A Practical Workflow</h2>
          <p style={pStyle}>
            Here&apos;s how agents are integrating video into their existing process:
          </p>
          <ol style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Run the illustration as usual</strong> using your carrier&apos;s software.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Export the PDF</strong> — the same document you&apos;d normally email to the client.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Upload it to Docs2Video.</strong> The AI reads the document, picks out the key figures, and writes a narrated video walkthrough.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Review and customize.</strong> Adjust the script if needed, choose your preferred voice, and add your branding.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Send both.</strong> Email the client the video link as the primary deliverable, with the PDF illustration attached as a reference document.</li>
          </ol>
          <p style={pStyle}>
            It adds a small step to your process, and gives your client something they can actually follow at home.
          </p>

          <h2 style={h2Style}>The Compliance Question</h2>
          <p style={pStyle}>
            Agents understandably worry about compliance. The key distinction is that the video is a supplemental educational tool, not a replacement for the official illustration. The carrier-generated illustration remains the document of record. The video simply helps the client understand what&apos;s in it.
          </p>
          <p style={pStyle}>
            That said, always follow your broker-dealer or IMO&apos;s guidelines on client-facing materials. When in doubt, ask them before you send anything new to a client.
          </p>

          <h2 style={h2Style}>A Simple Way to Stand Out</h2>
          <p style={pStyle}>
            Many agents still send only the PDF. A short, clear video is an easy way to stand out — and to make sure the work you put into the illustration actually reaches your client.
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
