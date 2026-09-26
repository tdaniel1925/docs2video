'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FaqItem {
  question: string
  answer: string[]
}

// Audited against the live UI on 2026-09-26.
const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How long does it take to generate a video?',
    answer: [
      'Most videos take 3–5 minutes. The **Slide Deck** style takes about 10 minutes. You can leave the page while the video generates — it keeps going in the background and appears in your Library when complete.',
    ],
  },
  {
    question: 'Can I edit a video after it has been generated?',
    answer: [
      'Yes. Open the video from your Library and click **Edit Video**. You can change the wording of each scene or remove scenes, then press **Save & Regenerate** to make a new version.',
      'For **Slide Deck** videos there is also **Fix a scene** — use it to correct one scene (a glitch, the wording, or how a word is pronounced) without redoing the rest.',
    ],
  },
  {
    question: 'What file formats can I upload?',
    answer: [
      'You can upload up to 5 files at once: **PDF**, **Word (DOCX)**, **PowerPoint (PPTX)**, **text (TXT)**, **CSV** and **Excel (XLSX)**.',
      'On the Content step you can also choose **Website URL**, **Paste text**, or **AI writes it** — none of those need a file.',
    ],
  },
  {
    question: 'Is there a limit on video length?',
    answer: [
      'On the **Voice & Length** step you pick **Short** (30–60 seconds), **Medium** (2–3 minutes) or **Long** (5+ minutes). The final length also depends on how much content you give it. Longer videos cost more credits (500 / 1,000 / 1,500).',
    ],
  },
  {
    question: 'Can I use my own voice for narration?',
    answer: [
      'Not at the moment. Videos use AI voices. On the **Voice & Length** step you can press **▶ Listen** to hear each one and pick the tone you like.',
    ],
  },
  {
    question: 'Do my clients need an account to watch my videos?',
    answer: [
      'No. The share page is public. Anyone with the link can watch the video, see your contact details, book a call or make a payment (if you set those up), and download your original PDF (only if you turned that on). No login is needed.',
    ],
  },
  {
    question: 'Can I remove the Docs2Video branding?',
    answer: [
      'Your own logo, colors and contact details are shown throughout. A small "Powered by Docs2Video" line appears at the top and bottom of the share page unless you are on **Business** or **Enterprise**, which remove it completely (white-label).',
    ],
  },
  {
    question: 'What happens to my videos if I cancel my subscription?',
    answer: [
      'All your videos stay in your Library and their share links keep working. Your monthly credits stop, but any top-up credits you bought stay in your account, and you can buy more anytime with **+ Top Up** (packs start at $10 for 2,500 credits).',
    ],
  },
  {
    question: 'Can I create videos for multiple brands or clients?',
    answer: [
      'Yes. Open the account menu (top-right) and choose **Brand profiles** to create a profile for each company or person. You can also create one on the **Presenter** step while making a video.',
      'When making a video, pick the right profile on the **Presenter** step and the video uses that logo, colors and contact info. There is no limit on the number of profiles.',
    ],
  },
  {
    question: 'How do I add a booking link to my share pages?',
    answer: [
      'Open the account menu (top-right), click **Settings**, then the **Integrations** tab. Choose Calendly, Cal.com or Google Calendar, paste your booking link, and press **Save**. A **Book a Call** button then appears on your share pages.',
    ],
  },
  {
    question: 'Can I download my video as a PowerPoint file?',
    answer: [
      'Yes. On the video page, the **MP4**, **PDF** and **PPTX** buttons download the video, the slides as a PDF, and an editable PowerPoint. The PPTX opens in Microsoft PowerPoint or Google Slides. (These downloads are for you — your client\'s share page only offers your original PDF, and only if you turned that on.)',
    ],
  },
  {
    question: 'How much does it cost?',
    answer: [
      'Everything uses credits. New accounts get **2,000 free credits** once (about 2 standard videos). Plans: **Pro** $79/mo (25,000 credits), **Business** $199/mo (75,000), **Enterprise** $499/mo (200,000).',
      'Anyone can buy top-up packs that never expire: 2,500 credits for $10, 7,500 for $25, or 18,000 for $50. See **Pricing & Plans** for details.',
    ],
  },
]

const TROUBLESHOOTING: FaqItem[] = [
  {
    question: 'My video is stuck on "Generating" and has not completed.',
    answer: [
      'Most videos finish in 3–5 minutes (Slide Deck about 10). If yours has been generating much longer than that:',
      '1. Refresh the page and check your Library — the video may have finished but the screen did not update.',
      '2. If it still shows as generating, wait a few more minutes. Busy times can cause delays.',
      '3. If it has not finished after 30 minutes, email support@docs2video.com with the video title and roughly when you started it.',
    ],
  },
  {
    question: 'My video has no audio / narration is missing.',
    answer: [
      'This can happen if the voice failed on one or more scenes. Try these steps:',
      '1. Make sure your device volume and the video player volume are turned up.',
      '2. Open the video and click **Edit Video**. Check each scene has narration text, then press **Save & Regenerate**.',
      '3. For a **Slide Deck** video, use **Fix a scene** on the silent scene instead — re-recording is free.',
    ],
  },
  {
    question: 'The AI misunderstood my document.',
    answer: [
      'After you add your content, the **Brief** step shows what the AI understood. If it is off, type what to change in the chat (for example "focus on the retirement income numbers") before you press **Looks good — continue**.',
      'If it is badly wrong, try a cleaner file (a text-based PDF rather than a scan), or paste the text in directly with **Paste text**.',
    ],
  },
  {
    question: 'My brand colors look different in the video than on my website.',
    answer: [
      'Open the account menu (top-right), choose **Brand profiles**, and edit that profile. Set the brand color to your exact color code.',
      'Colors picked up automatically from a website are a best guess and can grab a button or background color instead of your main brand color.',
    ],
  },
  {
    question: 'I cannot see the download buttons on my video.',
    answer: [
      'The **MP4**, **PDF** and **PPTX** buttons appear only after the video has finished. If it is still processing, wait for it to complete.',
      'On a phone, scroll down below the video player to see them.',
    ],
  },
  {
    question: 'The share page link is not working.',
    answer: [
      'Check that the video has finished. Share pages only work for completed videos.',
      'If it is complete but the link shows an error, copy it again with **Copy Link** on the video page, and make sure the whole address was pasted.',
    ],
  },
]

export default function FaqPage() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  const renderFaqList = (items: FaqItem[], prefix: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, index) => {
        const id = `${prefix}-${index}`
        const isExpanded = expandedFaq === id
        return (
          <div
            key={id}
            style={{
              background: 'white',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
          >
            <button
              onClick={() => setExpandedFaq(isExpanded ? null : id)}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{item.question}</div>
              </div>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2"
                style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isExpanded && (
              <div style={{ padding: '0 20px 20px 20px', fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
                {item.answer.map((paragraph, i) => (
                  <p key={i} style={{ margin: '8px 0' }} dangerouslySetInnerHTML={{
                    __html: paragraph
                      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--ink)">$1</strong>')
                      .replace(/^(\d+)\. /gm, '<strong style="color:var(--ink)">$1.</strong> ')
                  }} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>FAQ & Troubleshooting</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>FAQ & Troubleshooting</h1>
          <p>Common questions and solutions to frequently encountered issues.</p>
        </div>
      </div>

      {/* Common Questions */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
        Common Questions
      </h2>
      {renderFaqList(FAQ_ITEMS, 'faq')}

      {/* Troubleshooting */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 36, marginBottom: 16, color: 'var(--ink)' }}>
        Troubleshooting
      </h2>
      {renderFaqList(TROUBLESHOOTING, 'ts')}

      {/* Still need help */}
      <div style={{
        marginTop: 32, padding: '24px 28px', borderRadius: 10,
        background: 'rgba(168,240,212,0.1)', border: '1px solid var(--mint)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Still need help?</div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          Click the help button in the bottom-right corner to chat with our AI assistant, or contact support directly.
        </p>
        <a href="mailto:support@docs2video.com" className="btn btn-soft">Email Support</a>
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Link href="/help" className="btn btn-soft">
          Back to Help Center
        </Link>
      </div>
    </div>
  )
}
