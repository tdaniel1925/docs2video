import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How Insurance Agents Are Using Video to Close 40% Faster | Docs2Video Blog',
  description: 'Insurance agents are replacing confusing IUL and whole life illustrations with short video explainers — and seeing dramatically faster close rates.',
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
          <span style={{ padding: '2px 10px', borderRadius: 6, background: 'rgba(59,181,200,0.1)', color: 'var(--mint)', fontWeight: 600 }}>Use Cases</span>
          <span style={{ color: 'var(--ink-light)' }}>May 21, 2026</span>
          <span style={{ color: 'var(--ink-light)' }}>6 min read</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 24 }}>
          How Insurance Agents Are Using Video to Close 40% Faster
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
            The typical client meeting follows a predictable pattern: the agent spends 30-45 minutes explaining what the numbers mean, the client leaves feeling overwhelmed, and then they need to explain the same thing to their spouse at home — without the agent there to help. That second conversation, the one happening at the kitchen table without you, is where most sales die.
          </p>
          <p style={pStyle}>
            LIMRA research shows that 60% of life insurance purchase decisions involve a spouse or partner who wasn&apos;t present at the original meeting. If that person can&apos;t understand the value proposition from the materials left behind, the deal stalls.
          </p>

          <h2 style={h2Style}>Video Changes the Kitchen Table Conversation</h2>
          <p style={pStyle}>
            Forward-thinking agents have started converting their illustrations into short narrated video explainers — typically 3 to 5 minutes — that walk through the key concepts visually. Instead of sending a client home with a stack of paper, they send a link to a video that both spouses can watch together.
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

          <h2 style={h2Style}>The Results Agents Are Seeing</h2>
          <p style={pStyle}>
            Agents who&apos;ve adopted video-based illustration delivery report consistent improvements across their pipeline:
          </p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Faster decisions.</strong> The average time from presentation to signed application drops from 3-4 weeks to under 2 weeks. When both decision-makers can watch the video together and actually understand the product, there&apos;s less back-and-forth.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Fewer follow-up meetings.</strong> Instead of scheduling a second meeting to re-explain concepts, agents send the video. Clients rewatch the parts they didn&apos;t fully grasp the first time — something impossible with an in-person presentation.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Higher close rates.</strong> Agents using video report close rate improvements of 30-40% on the same products they were already selling. The product didn&apos;t change. The presentation did.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>More referrals.</strong> Clients who understand what they bought are more confident recommending their agent. Several agents report that clients forward the video to friends and family members who &quot;need to see this.&quot;</li>
          </ul>

          <h2 style={h2Style}>A Practical Workflow</h2>
          <p style={pStyle}>
            Here&apos;s how agents are integrating video into their existing process:
          </p>
          <ol style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Run the illustration as usual</strong> using your carrier&apos;s software.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Export the PDF</strong> — the same document you&apos;d normally email to the client.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Upload it to Docs2Video.</strong> The AI reads the document, identifies the key data points, and generates a narrated video walkthrough with professional visuals.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Review and customize.</strong> Adjust the script if needed, choose your preferred voice, and add your branding.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: 'var(--ink)' }}>Send both.</strong> Email the client the video link as the primary deliverable, with the PDF illustration attached as a reference document.</li>
          </ol>
          <p style={pStyle}>
            The entire process adds about 10 minutes to your workflow. The return on that time investment — in faster closes, fewer stalled deals, and more referrals — is difficult to overstate.
          </p>

          <h2 style={h2Style}>The Compliance Question</h2>
          <p style={pStyle}>
            Agents understandably worry about compliance. The key distinction is that the video is a supplemental educational tool, not a replacement for the official illustration. The carrier-generated illustration remains the document of record. The video simply helps the client understand what&apos;s in it.
          </p>
          <p style={pStyle}>
            That said, always follow your broker-dealer or IMO&apos;s guidelines on client-facing materials. Most compliance teams welcome tools that improve client understanding — confused clients are a bigger compliance risk than informed ones.
          </p>

          <h2 style={h2Style}>The Competitive Advantage Won&apos;t Last Forever</h2>
          <p style={pStyle}>
            Right now, agents using video stand out because almost nobody else does. Your competitors are still emailing PDFs. But that window is closing. The agents who adopt video-first delivery now will build the habits, refine their workflows, and capture the market share before video becomes table stakes.
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
