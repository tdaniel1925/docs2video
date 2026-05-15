'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FaqItem {
  question: string
  answer: string[]
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'How long does it take to generate a video?',
    answer: [
      'Most videos are generated in 2-3 minutes. Detailed (longer) videos may take up to 5 minutes. You can leave the page while the video generates — it will continue in the background and appear in your Library when complete.',
    ],
  },
  {
    question: 'Can I edit a video after it has been generated?',
    answer: [
      'Yes. Open the video from your Library and use the AI editor to make changes. You can update narration text, regenerate individual slides, or adjust specific scenes without recreating the entire video.',
    ],
  },
  {
    question: 'What file formats can I upload?',
    answer: [
      'You can upload PDF documents. You can also paste text directly, enter a webpage URL for the AI to scrape, or use the AI Research and Start from Idea options that do not require any file upload.',
    ],
  },
  {
    question: 'Is there a limit on video length?',
    answer: [
      'Standard videos are 2-3 minutes. Detailed videos are 5-7 minutes. The length is determined by the amount of content and the option you select during creation. There is no hard limit on the number of scenes.',
    ],
  },
  {
    question: 'Can I use my own voice for narration?',
    answer: [
      'Currently, videos use AI-generated voices. You can choose from a variety of voices with different tones and styles. Custom voice cloning is not available at this time.',
    ],
  },
  {
    question: 'Do my clients need an account to watch my videos?',
    answer: [
      'No. The share page is fully public. Anyone with the link can watch the video, use the AI chat, book a meeting (if you have Calendly connected), and download files. No login or account is required.',
    ],
  },
  {
    question: 'Can I remove the Docs2Video branding from my videos?',
    answer: [
      'Videos are branded with your logo, colors, and contact information. Docs2Video branding is minimal and appears only on the share page footer. Your brand is the primary identity shown throughout the video and share page.',
    ],
  },
  {
    question: 'What happens to my videos if I cancel my subscription?',
    answer: [
      'All your videos remain accessible. You can still view, share, and download them. You simply cannot create new videos at the subscription rate. You can always create new videos at the pay-per-project price.',
    ],
  },
  {
    question: 'Can I create videos for multiple brands or clients?',
    answer: [
      'Yes. Create a brand for each client in the Brands section. When making a video, select the appropriate brand and the output will use that brand\'s logo, colors, and contact info. There is no limit on the number of brands.',
    ],
  },
  {
    question: 'How do I connect Calendly for meeting booking on share pages?',
    answer: [
      'Go to Settings and look for the Calendly section. Enter your Calendly URL (e.g., https://calendly.com/yourname). Once saved, a booking widget will appear on all your video share pages so clients can schedule a meeting with you.',
    ],
  },
  {
    question: 'Can I download my video as a PowerPoint file?',
    answer: [
      'Yes. Every video can be downloaded in three formats: MP4 (video), PDF (slides), and PPTX (editable PowerPoint). The PPTX file can be opened in Microsoft PowerPoint or Google Slides for further customization.',
    ],
  },
  {
    question: 'What is the AI chat on the share page?',
    answer: [
      'The AI chat assistant appears on every share page. It has full knowledge of the video content and your company information (from your website URL in brand settings). Clients can ask questions about anything in the video and get instant, relevant answers.',
    ],
  },
]

const TROUBLESHOOTING: FaqItem[] = [
  {
    question: 'My video is stuck on "Generating" and has not completed.',
    answer: [
      'Videos typically complete within 2-5 minutes. If your video has been generating for more than 10 minutes:',
      '1. Refresh the page and check your Library — the video may have completed but the status did not update on screen.',
      '2. If it still shows as generating, wait a few more minutes. Server load can occasionally cause delays.',
      '3. If the video has not completed after 30 minutes, contact support at support@docs2video.com with the video title and approximate time you started generation.',
    ],
  },
  {
    question: 'My video has no audio / narration is missing.',
    answer: [
      'This can happen if voice generation encountered an error on one or more scenes. Try these steps:',
      '1. Open the video and check if the narration text is present in each scene. If a scene has empty narration, the voice will be silent for that section.',
      '2. Try regenerating the video. Open the AI editor, and re-generate the narration for the affected scenes.',
      '3. Make sure your browser volume is not muted and that the video player volume slider is up.',
    ],
  },
  {
    question: 'The AI extracted the wrong data from my document.',
    answer: [
      'After uploading, always review the extracted data on Step 2 of the creation flow. You can edit any field before proceeding.',
      'If the extraction is significantly off, try uploading a cleaner version of the document (higher resolution PDF, or text-based rather than scanned images). You can also paste the content directly instead of uploading.',
    ],
  },
  {
    question: 'My brand colors look different in the video than on my website.',
    answer: [
      'Go to Brands and edit the brand in question. Check that the hex color codes match your official brand guidelines. Auto-scraped colors from a website URL are a best guess — the system reads CSS, which may include hover states, gradients, or background colors that differ from your primary brand palette.',
      'Click "Advanced" to manually set all 5 color slots to your exact brand hex codes.',
    ],
  },
  {
    question: 'I cannot see the download buttons on my video.',
    answer: [
      'Download buttons appear only after the video has fully completed generation. If the video is still processing, wait for it to finish.',
      'On mobile devices, you may need to scroll down below the video player to see the download options.',
    ],
  },
  {
    question: 'The share page link is not working.',
    answer: [
      'Check that the video has completed generation. Share pages are only active for fully generated videos.',
      'If the video is complete but the link returns an error, try copying the link again from the video detail page. Make sure the full URL is included when pasting.',
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
        marginTop: 32, padding: '24px 28px', borderRadius: 12,
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
