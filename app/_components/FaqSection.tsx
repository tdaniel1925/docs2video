'use client'

import { useState } from 'react'

const FAQ_ITEMS = [
  {
    question: 'What types of documents can I upload?',
    answer:
      'You can upload PDFs, paste text, or simply describe an idea. We handle financial reports, insurance illustrations, legal contracts, proposals, audit reports, benefits summaries, and any other document type. If it has information, we can turn it into a video.',
  },
  {
    question: 'How long does it take to create a video?',
    answer:
      'Most videos are ready in under 5 minutes. Upload your document, choose a style, and our AI handles everything — extracting data, writing the narration script, generating visuals, and producing the voiceover.',
  },
  {
    question: 'Can I customize the look and feel?',
    answer:
      'Yes! Choose from 16+ professionally designed styles, or create a completely custom style with AI. You can also set up brand profiles with your logo, colors, and fonts so every video matches your brand automatically.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'Start free with 5 videos included. After that, pay $10 per video with no subscription, or subscribe for discounts — Pro at $25/mo gets you 40% off ($6/video), and Business at $99/mo includes 50 videos with no per-project fees.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Security is our top priority. All documents are encrypted in transit (TLS 1.3) and at rest (AES-256). We are SOC 2 Type II compliant and undergo annual third-party audits. Your uploaded files are processed in isolated environments and permanently deleted after generation.',
  },
  {
    question: 'Do my clients need an account to view?',
    answer:
      'No. Every video gets a clean, shareable link. Your clients can view it instantly on any device — no login, no app download, no signup required. You can also password-protect links for extra privacy.',
  },
  {
    question: 'Can I collect payments through the share page?',
    answer:
      'Yes! Connect your Stripe account and attach quotes or payment links to any share page. Your clients can watch the video, understand the proposal, and pay — all from a single link without needing separate invoices.',
  },
]

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function toggle(i: number) {
    setOpenIndex(openIndex === i ? null : i)
  }

  return (
    <section className="section" id="faq">
      <div className="faq-section">
        <div>
          <div className="section-eyebrow">Questions</div>
          <h2 className="section-title">
            Got questions? <em>We&apos;ve got answers.</em>
          </h2>
          <p className="section-sub">
            Quick answers to the things people ask us most. Still curious? Reach out.
          </p>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div key={i} className={`faq-item${isOpen ? ' open' : ''}`}>
                <button
                  className="faq-item-head"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  style={{
                    cursor: 'pointer',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div className="faq-q">{item.question}</div>
                  <div
                    className="faq-toggle"
                    style={{
                      transition: 'transform 0.3s ease',
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                    }}
                  >
                    +
                  </div>
                </button>
                <div
                  className="faq-a"
                  style={{
                    maxHeight: isOpen ? 300 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.35s ease',
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  {item.answer}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
