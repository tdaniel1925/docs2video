'use client'

import Link from 'next/link'

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 15, flexShrink: 0,
}

const step: React.CSSProperties = { display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-start' }
const body: React.CSSProperties = { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }

export default function CommercialsHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Creating Commercials</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Creating Commercials</h1>
          <p>Turn a website, a document, your own text, or just an idea into a fully-directed, brand-matched commercial — with a written script, professional voiceover, custom visuals, and music.</p>
        </div>
      </div>

      {/* Step 1 */}
      <div style={step}>
        <div style={STEP_CIRCLE}>1</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Start a commercial</h3>
          <p style={body}>
            From your dashboard, click <strong>Create</strong>, then choose the <strong>🎥 Commercial</strong> card.
            You&rsquo;ll land on a single page where you set everything up.
          </p>
        </div>
      </div>

      {/* Step 2 */}
      <div style={step}>
        <div style={STEP_CIRCLE}>2</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Pick how you&rsquo;ll provide the content</h3>
          <p style={body}>
            There are four ways to tell us what the commercial is about. Choose the tab that fits you:
          </p>
          <ul style={{ ...body, marginTop: 10, paddingLeft: 20 }}>
            <li><strong>🔗 Website</strong> — paste your site URL and we read it to build the commercial.</li>
            <li><strong>📝 Paste text</strong> — paste your own copy, product description, or brief.</li>
            <li><strong>📄 PDF</strong> — upload a document (brochure, one-pager) and we extract the text.</li>
            <li><strong>✨ AI writes it</strong> — just describe the commercial in a sentence or two and the AI writes the whole script from your idea.</li>
          </ul>
        </div>
      </div>

      {/* Step 3 */}
      <div style={step}>
        <div style={STEP_CIRCLE}>3</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Add optional details</h3>
          <p style={body}>
            You can guide the result — all optional:
          </p>
          <ul style={{ ...body, marginTop: 10, paddingLeft: 20 }}>
            <li><strong>Goal</strong> — a plain-English brief of what the video should accomplish (e.g. &ldquo;get agents to sign up, not just sell the product&rdquo;). The director follows this.</li>
            <li><strong>Brand name</strong> — leave blank and we detect it automatically.</li>
            <li><strong>Logo</strong> — upload your real logo (JPG, PNG, WebP, or SVG) and we use it in the intro and corner. If you don&rsquo;t, we use your name as text.</li>
            <li><strong>Music</strong> — on by default; we generate a custom track. Turn it off for a silent version.</li>
            <li><strong>Style</strong> — we auto-pick the best style for your brand. Open <strong>Advanced</strong> to choose one of the built-in styles yourself.</li>
          </ul>
        </div>
      </div>

      {/* Step 4 */}
      <div style={step}>
        <div style={STEP_CIRCLE}>4</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Generate</h3>
          <p style={body}>
            Each commercial costs <strong>600 credits</strong> and takes about <strong>2&ndash;3 minutes</strong> to produce.
            Click <strong>Generate Commercial</strong>. You&rsquo;ll see a live progress screen — you can safely leave the page and
            we&rsquo;ll notify you when it&rsquo;s ready. If anything goes wrong, your credits are automatically refunded.
          </p>
        </div>
      </div>

      {/* Step 5 */}
      <div style={step}>
        <div style={STEP_CIRCLE}>5</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Watch, download, and share</h3>
          <p style={body}>
            When it&rsquo;s done you land on the video page, where you can play it, download the MP4, and share a link —
            just like any other video in your account.
          </p>
        </div>
      </div>

      {/* Note */}
      <div style={{ marginTop: 8, padding: '16px 20px', borderRadius: 10, background: 'rgba(199, 232, 168, 0.14)', border: '1.5px solid var(--mint)' }}>
        <p style={{ ...body, margin: 0 }}>
          <strong>Tip:</strong> For regulated industries (like insurance and financial services), the director automatically
          applies compliance safeguards — it avoids guarantees and keeps the messaging generic. See{' '}
          <Link href="/help/insurance" style={{ color: 'var(--mint-darker)', fontWeight: 600, textDecoration: 'none' }}>Insurance Illustrations</Link>{' '}
          for how compliance works.
        </p>
      </div>
    </div>
  )
}
