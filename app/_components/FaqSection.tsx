'use client'

import { useState } from 'react'

const FAQ_ITEMS = [
  {
    question: 'Which document types do you support?',
    answer:
      'We support PDFs of all kinds — financial reports, insurance illustrations, legal contracts, medical records, proposals, audit reports, closing disclosures, benefits summaries, and dozens more. If it has data, we can extract it. If we encounter a document type we don\'t yet handle, send it to us and we\'ll add support within 48 hours.',
  },
  {
    question: 'How accurate is the AI extraction?',
    answer:
      'Our AI achieves 99%+ accuracy on structured documents. Every extraction goes through a human-review step before generation — you see exactly what was pulled and can edit any value before the infographic or video is created. Nothing ships without your approval.',
  },
  {
    question: 'Can I customize the colors and logo?',
    answer:
      'Absolutely. You can create unlimited brand profiles, each with your own logo, color palette, fonts, and tone of voice. Every output is automatically styled to match whichever brand profile you select — no manual design work required.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes! Every new account gets 10 free infographics and 2 free video explainers — no credit card required. You can explore the full platform, set up your brand profile, and generate real outputs before deciding on a paid plan.',
  },
  {
    question: 'Do viewers need to sign up to watch a video?',
    answer:
      'No. Every video and infographic gets a clean, public share link. Your clients can view it instantly on any device — no login, no app download, no signup. You can also password-protect links if you need an extra layer of privacy.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Security is our top priority. All documents are encrypted in transit (TLS 1.3) and at rest (AES-256). We are SOC 2 Type II compliant and undergo annual third-party audits. Your uploaded files are processed in isolated environments and permanently deleted after generation — we never store your source documents.',
  },
  {
    question: 'Can I connect my email?',
    answer:
      'Yes. Docs2Video supports Microsoft 365 (Outlook) natively and Gmail integration is coming soon. You can also connect any email provider via SMTP. Emails are sent from your real address — not a generic "noreply" — and you get open-tracking so you know exactly when a client views your presentation.',
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
