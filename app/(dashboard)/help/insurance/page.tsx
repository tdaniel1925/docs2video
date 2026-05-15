'use client'

import Link from 'next/link'

export default function InsuranceHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Insurance Illustrations</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Insurance Illustrations</h1>
          <p>How Docs2Video handles insurance documents with automatic compliance, disclaimers, and carrier protection.</p>
        </div>
      </div>

      {/* Detection */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How the System Detects Insurance Documents
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            When you upload a PDF or paste content, the AI automatically analyzes the text to determine if it is an insurance-related document. It looks for signals such as:
          </p>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Policy terms like "death benefit," "cash value," "premium," "surrender charge," and "illustration"
          </p>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Insurance carrier names and product identifiers
          </p>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Tabular data with policy year projections, guaranteed vs. non-guaranteed values
          </p>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> Regulatory language and state-mandated disclosures
          </p>
          <p>
            Detection is fully automatic. You do not need to toggle a setting or label the document. If the AI identifies insurance content, all compliance protections activate immediately.
          </p>
        </div>
      </div>

      {/* Automatic Disclaimers */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Automatic Disclaimer Handling
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Once an insurance document is detected, disclaimers are inserted automatically in several locations:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>In the Video</strong> — A disclaimer slide appears near the beginning and/or end of the video. The narration includes spoken disclaimer language so viewers hear it as well as see it.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>On the Share Page</strong> — A clearly visible disclaimer banner appears above the video player. This ensures anyone who views the share page sees the compliance notice before watching.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>In Downloaded Files</strong> — PDF and PPTX exports include the disclaimer on a dedicated page/slide.
          </p>
          <p>
            Disclaimers cannot be removed or edited. They are a fixed part of the output to protect both you and your clients.
          </p>
        </div>
      </div>

      {/* Carrier Redaction */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Carrier Name Redaction
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--ink)' }}>Why carrier names are redacted:</strong> Most insurance carriers have strict advertising and marketing compliance rules. Showing their name, logo, or product names in a video could violate their guidelines and put your license at risk. To protect you, Docs2Video automatically removes carrier-specific identifiers.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--ink)' }}>How it works:</strong> The AI identifies carrier names, product names, and proprietary terms in your content and replaces them with generic alternatives. For example, a specific product name might become "the policy" or "this illustration." The data and numbers remain accurate; only the identifying names are removed.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>What to tell your client:</strong> When sharing the video, you can verbally mention the carrier name in conversation. The video itself stays compliant by not displaying carrier branding, while you maintain the flexibility to discuss specifics in person or on a call.
          </p>
        </div>
      </div>

      {/* 8 Layers */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          The 8 Layers of Compliance Protection
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 16 }}>
            Docs2Video uses a multi-layered approach to ensure insurance content stays compliant:
          </p>

          {[
            { num: 1, title: 'Automatic Document Detection', desc: 'AI identifies insurance content the moment it is uploaded, without any manual tagging.' },
            { num: 2, title: 'Carrier Name Redaction', desc: 'Insurance company names, product names, and proprietary terms are automatically replaced with generic language.' },
            { num: 3, title: 'Guaranteed vs. Non-Guaranteed Clarity', desc: 'The script clearly distinguishes between guaranteed and non-guaranteed (illustrated) values so viewers are not misled.' },
            { num: 4, title: 'Visual Disclaimer Slides', desc: 'Dedicated disclaimer slides are inserted into the video with clear, readable compliance language.' },
            { num: 5, title: 'Spoken Disclaimers', desc: 'The voiceover narration includes spoken disclaimer language so the message is delivered both visually and audibly.' },
            { num: 6, title: 'Share Page Banner', desc: 'A persistent disclaimer banner appears on the public share page above the video player.' },
            { num: 7, title: 'Export Disclaimers', desc: 'PDF and PPTX downloads include the disclaimer on a dedicated page or slide that cannot be removed.' },
            { num: 8, title: 'No Financial Advice Language', desc: 'The AI is instructed to never provide financial advice, make guarantees, or use language that could be construed as a recommendation to buy or sell a product.' },
          ].map(layer => (
            <div key={layer.num} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>{layer.num}</div>
              <div>
                <strong style={{ color: 'var(--ink)' }}>{layer.title}</strong> — {layer.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What Disclaimers Say */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          What Disclaimers Are Shown and Where
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Disclaimer content varies slightly depending on the type of insurance document, but generally includes:
          </p>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> <strong style={{ color: 'var(--ink)' }}>Educational Purpose</strong> — "This video is for educational and informational purposes only and does not constitute financial, tax, or legal advice."
          </p>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> <strong style={{ color: 'var(--ink)' }}>Illustration Notice</strong> — "Values shown are based on current assumptions and are not guaranteed. Actual results may vary."
          </p>
          <p style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> <strong style={{ color: 'var(--ink)' }}>Consult Professional</strong> — "Please consult with a licensed professional before making any financial decisions."
          </p>
          <p>
            <span style={{ color: 'var(--mint-darker)' }}>&#8226;</span> <strong style={{ color: 'var(--ink)' }}>Policy Reference</strong> — "For complete details, refer to the official policy illustration and contract documents."
          </p>
        </div>
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/help" className="btn btn-soft">
          Back to Help Center
        </Link>
      </div>
    </div>
  )
}
