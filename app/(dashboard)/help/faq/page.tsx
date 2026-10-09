'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PLANS, isSellablePlan } from '../../../_lib/pricing'
import { CREDIT_COSTS, TIER_CREDITS, TIER_APPROX_VIDEOS } from '../../../_lib/credits'
import { SMALLEST_PACK, packPrice, packsSentence } from '../../../_lib/credit-packs'
import { NAMES } from '../../../_lib/names'

// Prices, credit amounts and pack sizes below are read from pricing.ts,
// credits.ts and credit-packs.ts, so an answer can't quote an old price.
const n = (x: number) => x.toLocaleString('en-US')
const PAID_PLANS = PLANS.filter(p => isSellablePlan(p.tier))
  .map(p => `**${p.label}** $${Math.round(p.monthlyPrice / 100)}/mo (${n(p.monthlyCredits)} credits)`)
  .join(', ')

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
      'Yes. Open it from your Library and use **Ask for a change** under Ready to send. Pick **This scene** or the whole thing, say what you want, and it opens the right editor for that project — with the price shown before anything is rebuilt. Each change is listed with **Undo**.',
      'Presentations and slide decks open the slide editor; **Slide Deck** look videos open **Fix a scene** (one scene, without redoing the rest); other looks with slide pictures open the **Scene editor**. A few looks can’t be changed in place — the bar offers **Make a changed copy** instead. See **Changing a finished project** in the Help Center.',
    ],
  },
  {
    question: 'What file formats can I upload?',
    answer: [
      'You can upload up to 5 files at once: **PDF**, **Word (DOCX)**, **PowerPoint (PPTX)**, **text (TXT)**, **CSV** and **Excel (XLSX)**.',
      'On step 1, under **Where should the content come from?**, you can also choose **Website URL**, **Paste text**, or **AI writes it** — none of those need a file.',
    ],
  },
  {
    question: 'Is there a limit on video length?',
    answer: [
      `On step 2, **The story**, you pick the **Length**: **Short** (under 1 minute), **Standard** (2–5 minutes) or **Detailed** (5–15 minutes). The final length also depends on how much content you give it. Longer videos cost more credits (${n(CREDIT_COSTS.videoQuick)} / ${n(CREDIT_COSTS.videoStandard)} / ${n(CREDIT_COSTS.videoDetailed)}); step 3 shows the exact price.`,
      'Changing the length after the story is written offers **Rewrite at this length** — free. **Change the length** on step 3 takes you straight back to it.',
    ],
  },
  {
    question: 'Can I use my own voice for narration?',
    answer: [
      'Not at the moment. Videos use AI voices. On step 3, **The look**, press **▶** next to a voice to hear it and pick the tone you like.',
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
      `All your videos stay in your Library and their share links keep working. Your monthly credits stop, but any top-up credits you bought stay in your account, and you can buy more anytime with **+ Top Up** (packs start at ${packPrice(SMALLEST_PACK)} for ${n(SMALLEST_PACK.credits)} credits).`,
    ],
  },
  {
    question: 'Can I create videos for multiple brands or clients?',
    answer: [
      `Yes. Click **${NAMES.brands}** in the top bar to create a brand for each company or person. You can also set one up while making a video: on step 3, click **Change** next to the brand.`,
      'When making a video, pick the right one on the brand step (**Your brand**) and the video uses that logo, colors and contact info. There is no limit on the number of brands.',
    ],
  },
  {
    question: 'How do I add a booking link to my share pages?',
    answer: [
      'Open the account menu (top-right), click **Settings**, then **Email & sending** in the menu on the left. Choose Calendly, Cal.com or Google Calendar, paste your booking link, and press **Save**. A **Book a Call** button then appears on your share pages.',
      'For **Google Calendar**, there is no direct connection — paste a link instead. In Google Calendar, create a booking page (an "Appointment schedule"), copy its link (it starts with https://calendar.app.google/) and paste that. You don’t have to type https:// — it is added for you — but the link must be a secure (https) one, or the button will not show.',
    ],
  },
  {
    question: 'Can I download my video as a PowerPoint file?',
    answer: [
      'Yes, when the video’s look keeps slide pictures (presentations always can). On its page, press **Download** and choose **PowerPoint** — or **MP4** or **PDF**. The PPTX opens in Microsoft PowerPoint or Google Slides. (These downloads are for you — your client\'s share page only offers your original PDF, and only if you turned that on.)',
    ],
  },
  {
    question: 'I forgot my password. How do I reset it?',
    answer: [
      'On the sign-in page, click **Forgot password?**, type your email and click **Send Reset Link**. Open the email (on any device) and click the link. On the **Set a new password** page, type a new password of at least 8 characters twice and click **Save new password**.',
      'If the page says the link has expired, click **Send a new reset link** and use the newest email. Bought through Apex? Use the **Set up my account** button in your welcome email — it opens the same page.',
    ],
  },
  {
    question: 'How long are unfinished drafts kept?',
    answer: [
      'A draft you have started but not generated is kept for **24 hours** after you last changed it. Once it has a story (step 2, **The story**), it is kept for **14 days** after your last change, so a script you wrote is not lost over a weekend.',
      'After that the draft and any file you uploaded for it are deleted. Finished videos are never deleted this way.',
    ],
  },
  {
    question: 'Will my client get automatic reminder emails?',
    answer: [
      'Only if you turn them on. Automatic follow-ups are **off** for every quote until you tick **Automatic follow-ups** under that quote on the video page. Then up to two short reminders go out (about day 3 and day 7) from your connected email, and they stop as soon as you mark the deal paid, accepted or declined, or the client unsubscribes.',
    ],
  },
  {
    question: 'Do I need a card to try it?',
    answer: [
      'No. Sign up with your name, email and a password and you land on **Home**. Make your first project, add your brand on step 3, and press **Free preview** to see the first scene and hear the voice — free, a few a day.',
      'You add a card only when you press **Make it** on a real video or presentation. The card page opens and brings you back afterwards. Saving the card starts your free credits; nothing is charged until they run out.',
    ],
  },
  {
    question: 'How much does it cost?',
    answer: [
      `Everything uses credits. New accounts get **${n(TIER_CREDITS.free)} free credits** once, when a card is saved (about ${TIER_APPROX_VIDEOS.free.standard} standard videos). Plans: ${PAID_PLANS}.`,
      `Anyone can buy top-up packs that never expire: ${packsSentence()}. See **Pricing & plans** for details.`,
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
      '3. After about 5 minutes the progress screen shows **Restart Generation**. Clicking it stops the stuck run, gives back the credits it took, and starts again — so you are only charged once.',
      '4. If it has not finished after 30 minutes, email support@docs2video.com with the video title and roughly when you started it.',
    ],
  },
  {
    question: 'My video has no audio / narration is missing.',
    answer: [
      'This can happen if the voice failed on one or more scenes. Try these steps:',
      '1. Make sure your device volume and the video player volume are turned up.',
      '2. Open the video and use **Ask for a change**. For a **Slide Deck** look video, pick the silent scene and press **The voice glitched** — re-recording is free.',
      '3. For other looks, the bar opens the **Scene editor**: check each scene has narration text, then press **Save & Regenerate**.',
    ],
  },
  {
    question: 'The AI misunderstood my document.',
    answer: [
      'On step 2, **The one point** at the top shows what the AI understood. If it is off, type what to change under **Ask for a change** (for example "focus on the retirement income numbers") — it rewrites the story — before you press **Looks right — pick the look**.',
      'If it is badly wrong, try a cleaner file (a text-based PDF rather than a scan), or paste the text in directly with **Paste text**.',
    ],
  },
  {
    question: 'My brand colors look different in the video than on my website.',
    answer: [
      `Click **${NAMES.brands}** in the top bar and edit that brand. Set the brand color to your exact color code.`,
      'Colors picked up automatically from a website are a best guess and can grab a button or background color instead of your main brand color.',
    ],
  },
  {
    question: 'I cannot find the downloads for my video.',
    answer: [
      'The **Download** menu (top-right of the video page) appears once the video has finished. If it is still processing, wait for it to complete.',
      'It only lists the files that video has: **PDF** and **PowerPoint** need slide pictures, which some looks don’t keep.',
    ],
  },
  {
    question: 'The share page link is not working.',
    answer: [
      'Check that the video has finished. Share pages only work for completed videos.',
      'If it is complete but the link shows an error, copy it again with **or copy the link** in the send panel on the video page, and make sure the whole address was pasted.',
    ],
  },
]

export default function FaqPage() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  const renderFaqList = (items: FaqItem[], prefix: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {items.map((item, index) => {
        const id = `${prefix}-${index}`
        const isExpanded = expandedFaq === id
        return (
          <div
            key={id}
            style={{
              background: 'var(--bg-card)',
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
                gap: 'var(--space-3)',
                textAlign: 'left',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--ink)' }}>{item.question}</div>
              </div>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2"
                style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isExpanded && (
              <div style={{ padding: '0 20px 20px 20px', fontSize: 'var(--fs-ui)', lineHeight: 1.7, color: 'var(--ink-soft)' }}>
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
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>FAQ & troubleshooting</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>FAQ & troubleshooting</h1>
          <p>Common questions and solutions to frequently encountered issues.</p>
        </div>
      </div>

      {/* Common Questions */}
      <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
        Common Questions
      </h2>
      {renderFaqList(FAQ_ITEMS, 'faq')}

      {/* Troubleshooting */}
      <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginTop: 36, marginBottom: 16, color: 'var(--ink)' }}>
        Troubleshooting
      </h2>
      {renderFaqList(TROUBLESHOOTING, 'ts')}

      {/* Still need help */}
      <div style={{
        marginTop: 32, padding: '24px 28px', borderRadius: 10,
        background: 'var(--accent-soft)', border: '1px solid var(--accent)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: 6 }}>Still need help?</div>
        <p style={{ fontSize: 'var(--fs-ui)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          Click the help button in the bottom-right corner to chat with our AI assistant, or contact support directly.
        </p>
        <a href="mailto:support@docs2video.com" className="btn btn-soft">Email support</a>
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
