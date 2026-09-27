'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBrand } from '../../_components/BrandProvider'

interface HelpArticle {
  id: string
  title: string
  category: string
  icon: string
  content: string[]
}

interface HelpGuide {
  href: string
  title: string
  description: string
  icon: string
}

// Audited against the live UI on 2026-09-26. When a screen changes, change the
// matching entry here (and the guide page it links to) in the same commit.
const GUIDES: HelpGuide[] = [
  {
    href: '/help/getting-started',
    title: 'Getting Started',
    description: 'Create your account, add a payment card, understand your credits, and find your way around.',
    icon: '🚀',
  },
  {
    href: '/help/creating-videos',
    title: 'Creating Explainer Videos',
    description: 'Pick a format, say who it\'s for, add your content, approve the brief, choose a presenter and voice, check the script, pick a style, then generate.',
    icon: '🎬',
  },
  {
    href: '/help/commercials',
    title: 'Creating Commercials',
    description: 'Turn a website, PDF, your own text, or just an idea into a fully-directed, brand-matched commercial with voiceover, visuals, and music.',
    icon: '🎥',
  },
  {
    href: '/help/flyers',
    title: 'Custom Graphics',
    description: 'Flyers, posters, social posts, banners, business cards and slide decks in five steps: What, Content, Style, Sizes, Review.',
    icon: '📄',
  },
  {
    href: '/help/restyle-deck',
    title: 'Restyle a Deck',
    description: 'Upload a PowerPoint or PDF and get the whole deck back, slide for slide, in a brand-new look — plus a single PDF. Picture-only slides are flagged and skipped.',
    icon: '📊',
  },
  {
    href: '/help/sharing-videos',
    title: 'Sharing & the Client Page',
    description: 'The branded share page: personalized welcome banner, a note to your client, source-PDF download, booking and payment.',
    icon: '🔗',
  },
  {
    href: '/help/social-sharing',
    title: 'Social Posts & AI Social',
    description: 'Write ready-to-post captions for any finished video, or add AI Social to connect your accounts and post on a schedule.',
    icon: '📣',
  },
  {
    href: '/help/insurance',
    title: 'Insurance Illustrations',
    description: 'How compliance works: carrier/product names automatically removed, dollar figures kept, agent-attributed — with a generic-explainer safety net.',
    icon: '🛡️',
  },
  {
    href: '/help/pricing',
    title: 'Pricing & Plans',
    description: 'Credit-based plans: Free (2,000 to start), Pro $79, Business $199, Enterprise $499. Top-up packs from $10, anytime.',
    icon: '💰',
  },
  {
    href: '/help/faq',
    title: 'FAQ & Troubleshooting',
    description: 'Common questions, troubleshooting tips for stuck videos, missing audio, and more.',
    icon: '❓',
  },
  {
    href: '/help/brands',
    title: 'Profiles & Personalization',
    description: 'Person or Company profiles — your name, role, photo, and intro line, or your logo, colors, and contact info — used across every video.',
    icon: '🎨',
  },
  {
    href: '/help/downloads',
    title: 'Downloads & Formats',
    description: 'MP4 video, PDF slides, PPTX presentations, and the script explained.',
    icon: '📥',
  },
  {
    href: '/help/account',
    title: 'Account & Settings',
    description: 'Manage your profile, integrations (booking and payment links), billing and subscription — and reset a forgotten password.',
    icon: '⚙️',
  },
]

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
  { id: 'creators', label: 'Creators', icon: '🎨' },
  { id: 'management', label: 'Management', icon: '📁' },
  { id: 'billing', label: 'Billing & Pricing', icon: '💳' },
  { id: 'sharing', label: 'Sharing & Collaboration', icon: '🔗' },
]

const ARTICLES: HelpArticle[] = [
  // Getting Started
  {
    id: 'onboarding',
    title: 'Setting Up Your Account',
    category: 'getting-started',
    icon: '👤',
    content: [
      'When you first sign up, the Setup Wizard walks you through 5 quick steps (you can press **Skip for now** on any of them):',
      '**1 — Profile:** Your name, company, phone, and role. This is your identity on the share page ("prepared by").',
      '**2 — Photo:** Upload a headshot (used on the cover). Mid-level and standing photos are optional.',
      '**3 — Brand:** Your logo, brand colors, and contact info (phone/email/website) — used across every video and the share page.',
      '**4 — Voice:** Pick a default narration voice.',
      '**5 — Style:** Pick a default image style for your slides. You choose the video look for each project on the Style step.',
      'You can re-run the wizard anytime with **Re-run Setup Wizard** at the top of **Settings**. To edit saved profiles later, open the account menu (top-right) and choose **Brand profiles**.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Understanding Your Dashboard',
    category: 'getting-started',
    icon: '📊',
    content: [
      'The top bar has **Dashboard**, **+ Create**, **Library** and **Clients**. Your name (top-right) opens the account menu: credits and **Top Up**, Analytics, AI Social, Brand profiles, Settings, Affiliate Program and Help Center.',
      '**Credits** — Your balance is in the top bar. Every creation spends credits (see Pricing). Click **+ Top Up** to buy more.',
      '**Create** — Start any new project from **+ Create** — one place for interactive presentations, videos, commercials and custom graphics.',
      '**Recent creations** — Your latest items. Click any item to open it, or go to **Library** for everything.',
    ],
  },

  {
    id: 'reset-password',
    title: 'Forgot your password? Setting a new one',
    category: 'getting-started',
    icon: '🔑',
    content: [
      '**1.** On the sign-in page, click **Forgot password?**, type your email and click **Send Reset Link**. You will see "Check Your Email".',
      '**2.** Open the email — on any device, your phone is fine — and click the link. It works once and expires after a while.',
      '**3.** You land on **Set a new password**. Type a password of at least 8 characters, type it again, and click **Save new password**.',
      '**4.** You will see "Password updated". Click **Continue** to go to your dashboard.',
      'If the page says **This link has expired**, click **Send a new reset link** and use the newest email.',
      '**Bought through Apex?** Your account is made for you — click **Set up my account** in the welcome email to choose your password on the same page.',
    ],
  },

  // Creators
  {
    id: 'interactive-presentation',
    title: 'Interactive Presentations',
    category: 'creators',
    icon: '🖱️',
    content: [
      'An interactive presentation is a narrated, click-through presentation your client explores at their own pace, on its own share page. It\'s the recommended format on **+ Create**.',
      '**1.** Click **+ Create**, then **Interactive Presentation**.',
      '**2.** Say who it\'s for, add your content, and approve the brief — the same as a video.',
      '**3.** Go through the remaining steps (there is no voice step to set up here), then on the Style step pick one of six presentation looks: Heritage, Warm Editorial, Corporate Bold, Midnight, Fresh Mint or Certificate.',
      '**4.** Generate. When it\'s ready, open it from your Library to share the link or **Edit slides**.',
      'It costs 700 credits. Want a video file too? Export an MP4 from the finished presentation\'s page (400 credits).',
    ],
  },
  {
    id: 'explainer-video',
    title: 'Creating an Explainer Video',
    category: 'creators',
    icon: '🎬',
    content: [
      'Start from **+ Create** (top bar). Everything runs through one guided flow, and the bar at the top shows which step you\'re on.',
      '**1 — Pick a format.** Choose **Video Explainer**. (The other cards are Interactive Presentation, Custom Graphics and Commercial.)',
      '**2 — Who\'s this for?** Pick an existing client, add a new one, or skip. When you name a client, their name appears on the video cover and share page ("Prepared for [Client]").',
      '**3 — Content.** Choose **Website URL**, **Upload file** (up to 5 files: PDF, Word, PowerPoint, text, CSV or Excel), **Paste text**, or **AI writes it**.',
      '**4 — Brief.** AI shows what it understood — the angle, key points and figures. Tell it what to change in the chat, then press **Looks good — continue**.',
      '**5 — Presenter.** Pick a saved Person or Company profile, create one, or skip.',
      '**6 — Voice & Length.** Pick a voice (press **▶ Listen** to hear it; the default is a warm female voice), a length (Short, Medium or Long) and whether to add background music.',
      '**7 — Script.** Read the script. Press **✎ Edit script** to change it.',
      '**8 — Style.** Pick the look (see "Video styles explained"). Optionally add a client note and let the client download your source PDF, then press **Generate with [Style]**.',
      'It finishes in the background and lands in your Library. From there you can rename it, download it (MP4 / PDF / PPTX / Script), send it to a client, or change it with **Edit Video**.',
    ],
  },
  {
    id: 'video-styles',
    title: 'Video styles explained',
    category: 'creators',
    icon: '🎨',
    content: [
      'On the Style step you choose how your explainer looks. Every style — Slide Deck included — uses the voice and background music you picked and your script exactly as you edited it. Only the visuals differ:',
      '• **Slide Deck** (recommended) — an animated explainer deck: topic headings with bullets, data cards, charts, and icons that reveal in sync with the voice. Speaks your edited script. Takes about 10 minutes.',
      '• **Aurora** — modern motion graphics: one flowing branded backdrop, kinetic type, no stock imagery.',
      '• **Cinematic** — film-style imagery with kinetic text and motion. Best for story-led, emotive videos.',
      '• **Editorial** — a clean, warm magazine layout with refined serif typography on your brand color.',
      '• **Explainer** — a friendly modern deck with big rounded cards and charts. Great for how-it-works.',
      '• **Infographic** — big numbers, KPI cards, timelines and charts. Best for number-heavy reports.',
      'If your chosen style is temporarily unavailable at render time, we still produce your video in an alternate style and show a note on the video page so you can regenerate in your original style.',
    ],
  },

  // Management
  {
    id: 'drafts',
    title: 'Unfinished drafts: how long they are kept',
    category: 'management',
    icon: '🗂️',
    content: [
      'Your project is saved as a draft while you go through the steps.',
      '• A draft **without a script** is kept for **24 hours** after your last change.',
      '• Once it **has a script** (you reached the Script step), it is kept for **14 days** after your last change.',
      'After that the draft, and any file you uploaded for it, is deleted. Finished videos are never removed this way.',
    ],
  },
  {
    id: 'library',
    title: 'Your Library',
    category: 'management',
    icon: '📁',
    content: [
      'The **Library** (top bar) lists everything you\'ve made in a table: title, type, recipient, status, credits and date.',
      'Use the tabs to show **All**, **Videos**, or **Custom Graphics**.',
      '• **Videos and presentations** open their detail page, with the player, downloads and sharing.',
      '• **Graphics** open the image file in a new tab.',
      'It shows 25 items per page (you can switch to 50 or 100). Use **Previous** / **Next** to move between pages.',
    ],
  },
  // Billing & Credits
  {
    id: 'pricing',
    title: 'Pricing',
    category: 'billing',
    icon: '🪙',
    content: [
      'Everything is paid for with credits:',
      '• **Video Explainer** — Short 500 · Medium 1,000 · Long 1,500 credits',
      '• **Interactive Presentation** — 700 credits (MP4 export 400) · **Commercial** — 600',
      '• **Custom Graphics** — 200 credits per design',
      'Plans include a monthly credit allowance (see Plans). You can buy more credits anytime with **+ Top Up** next to your balance.',
    ],
  },
  {
    id: 'plans',
    title: 'Plans & Membership',
    category: 'billing',
    icon: '💰',
    content: [
      'Plans give you a monthly credit allowance (credits are spent per creation — a standard video is 1,000 credits):',
      '**Free** — 2,000 credits to try (one time, about 2 standard videos). Card required to start.',
      '**Pro ($79/mo)** — 25,000 credits/mo, unlimited brand profiles.',
      '**Business ($199/mo)** — 75,000 credits/mo, white-label share pages.',
      '**Enterprise ($499/mo)** — 200,000 credits/mo, white-label share pages, dedicated support.',
      'Need more mid-cycle? Buy top-up packs (never expire): Starter 2,500 ($10), Power 7,500 ($25), Studio 18,000 ($50). Anyone can buy them, including Free accounts.',
      'Manage your plan from **Settings > Subscription**.',
    ],
  },
  {
    id: 'earn-credits',
    title: 'Affiliate Program',
    category: 'billing',
    icon: '🎁',
    content: [
      '**Affiliate Program** — Refer new users and earn **20% commission** on their payments. Open the account menu (top-right) and choose **Affiliate Program** to get your referral link.',
    ],
  },

  // Sharing
  {
    id: 'share-video',
    title: 'The client share page',
    category: 'sharing',
    icon: '🔗',
    content: [
      'Every completed video gets a branded public share page at docs2video.com/watch/[id].',
      '**What your client sees:**',
      '• A **personalized welcome banner** — "Hi [Client] — prepared for you by [You]" — when you named a client.',
      '• An optional **note from you**, shown above the video (you write it on the Style step or leave it blank).',
      '• The video player, plus your contact details.',
      '• **Download Original PDF** — only if you turned it on (the source document you used).',
      '• **Book a Call** (your booking link) and **Make a Payment**, when set up in Settings > Integrations. Links must start with https://. For Google Calendar, paste the link of a Google booking page (an "Appointment schedule") — there is no direct connection.',
      '**How to share:**',
      '1. Open a completed video from your Library.',
      '2. Click **Send to Client** to email it, or **Copy Link** to paste the address anywhere.',
      'The page shows your brand and contact details. Business and Enterprise plans remove the Docs2Video branding (white-label).',
    ],
  },
  {
    id: 'edit-title',
    title: 'Renaming a video (and the share-page title)',
    category: 'management',
    icon: '✏️',
    content: [
      'The video\'s title is what your client sees at the top of the share page and in link previews.',
      'Open the video from your Library, then **click the title** (it shows a small pencil). Type a new title and press Enter (or Save).',
      'The change is instant and updates the public share page too.',
    ],
  },
  {
    id: 'source-pdf-download',
    title: 'Letting clients download your source PDF',
    category: 'sharing',
    icon: '📄',
    content: [
      'When you make a video from a PDF, you can optionally let your client download that original document from the share page.',
      '1. On the **Style** step (the last step before generating), find **Client options**.',
      '2. Turn on **"Let the client download the original PDF."** (It only appears when your source was a PDF.)',
      '3. Generate the video. A **Download Original PDF** button appears on the share page.',
      'It\'s **off by default** — the source is only offered when you choose to share it. The file is served through a secure, expiring link, so it stays private otherwise.',
    ],
  },
  {
    id: 'client-note',
    title: 'Adding a personal note to your client',
    category: 'sharing',
    icon: '💬',
    content: [
      'You can add a short personal message (up to 400 characters) that appears above the video on the share page.',
      '1. On the **Style** step, under **Client options**, type your message in **"Note to your client."**',
      '2. Generate the video.',
      'The note shows as "A note from [You]" on the share page. Leave it blank to skip it.',
    ],
  },
  {
    id: 'auto-follow-ups',
    title: 'Automatic follow-up emails (off until you turn them on)',
    category: 'sharing',
    icon: '📬',
    content: [
      'Nothing is emailed to your client automatically unless you ask for it, one quote at a time.',
      '1. Open the video, scroll to **Quote / Invoice**, and add a quote with your client\'s email.',
      '2. Tick **Automatic follow-ups** under the quote. You\'ll see a message confirming reminders are on.',
      '3. Up to two short reminders go out — about 3 and 7 days after the quote — from your connected email, each with an unsubscribe link.',
      'They stop as soon as you mark the deal **paid**, **accepted** or **declined**, or the client unsubscribes. Untick the box to turn them off. You need a connected email account (Settings > Integrations).',
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics — who watched and how far',
    category: 'management',
    icon: '📈',
    content: [
      'Open **Analytics** from the account menu (top-right) to see how your videos are performing. Everything is tracked automatically when clients open your share pages.',
      '**Watch-through funnel** — how far viewers get: opened → 25% → 50% → 75% → finished. A big drop-off tells you where interest fades.',
      '**Engagement funnel** — the path to action: viewed → played → downloaded → booked → paid.',
      '**Client engagement** — named clients who opened a video you sent them, how many times, how far they watched, and whether they converted.',
      '**Per-video detail** — click any video in "Top Videos" to see that video\'s funnels plus a device and traffic-source breakdown.',
      'You\'re also emailed (and optionally texted) when someone views a video, with their device, location, and whether they\'re a returning viewer.',
    ],
  },
  {
    id: 'affiliates',
    title: 'Affiliate Program',
    category: 'sharing',
    icon: '🤝',
    content: [
      'Earn recurring commission by referring others to Docs2Video.',
      '**How to Join:**',
      '1. Open the account menu (top-right) and click "Affiliate Program".',
      '2. Click "Become an affiliate" — you instantly get a unique referral link and promo code.',
      '3. Share your link, your promo code, or one of the ready-made banners and email templates.',
      '**What You Earn:**',
      '• **20% recurring commission** on every payment your referrals make — for as long as they stay subscribed (lifetime).',
      '• Your referrals get **15% off** when they use your code, so it is easier to sell.',
      '**Getting Paid:**',
      '• Commissions appear as "pending" and are approved after a 30-day refund hold.',
      '• Payouts are sent manually each cycle to your payout email — no minimum.',
      'Track your clicks, signups, paying customers, and earnings on the Affiliate Dashboard.',
    ],
  },

  // Quick Answers
  {
    id: 'upload-document',
    title: 'How do I upload a document?',
    category: 'getting-started',
    icon: '📄',
    content: [
      'Click **+ Create**, pick a format (for example **Video Explainer**), and say who it\'s for. On the Content step, choose **Upload file** and drag your files onto the upload area, or click to browse. You can add up to 5 files.',
      'You can also use **Website URL**, **Paste text**, or **AI writes it**.',
      '**Supported file types:** PDF, DOCX, PPTX, TXT, CSV and XLSX.',
    ],
  },
  {
    id: 'video-creation-time',
    title: 'How long does video creation take?',
    category: 'creators',
    icon: '⏱️',
    content: [
      'Most videos take **3–5 minutes**. The **Slide Deck** style takes about **10 minutes**.',
      'You do not need to stay on the page. Video generation continues in the background. When it finishes, your video appears in your Library.',
    ],
  },
  {
    id: 'edit-script',
    title: 'Can I edit the script?',
    category: 'creators',
    icon: '✏️',
    content: [
      'Yes. On the **Script** step, press **✎ Edit script**. For each scene you can change the title, the narration, the slide headline, the stats and the bullet points.',
      'Drag scenes to reorder them (the cover and closing slides stay in place). Each scene has its own AI chat and a **Preview slide** button.',
      'To make a big change — like "add a slide about pricing" — type it into the AI bar and press **Apply to whole script**. You can **Undo** it.',
      'After the video is made, use **Edit Video** on the video page to change scenes and regenerate.',
    ],
  },
  {
    id: 'change-voice',
    title: 'How do I change the voice?',
    category: 'creators',
    icon: '🎙️',
    content: [
      'On the **Voice & Length** step, press **▶ Listen** next to any voice to hear it, then click the voice to choose it.',
      'The default is **Nova**, a warm female voice. Voices range from warm and conversational to professional and authoritative.',
      'Pick your voice before you generate. To change it afterwards, the video has to be made again.',
    ],
  },
  {
    id: 'add-logo',
    title: 'How do I add my logo?',
    category: 'creators',
    icon: '🏷️',
    content: [
      'Your logo lives in a **Company profile**. Open the account menu (top-right) and choose **Brand profiles**, then create or edit a profile and upload a PNG or SVG logo.',
      'You can also create a Company profile on the **Presenter** step while making a video, or add your logo during Setup.',
      'When making a video, pick that profile on the **Presenter** step. The logo appears on the cover, the closing slide and the share page. See the **Profiles & Personalization** guide for details.',
    ],
  },
  {
    id: 'file-types',
    title: 'What file types are supported?',
    category: 'getting-started',
    icon: '📁',
    content: [
      'You can upload up to 5 files at once:',
      '• **PDF** — Reports, proposals, whitepapers, illustrations',
      '• **DOCX** — Word documents',
      '• **PPTX** — PowerPoint presentations',
      '• **TXT** — Plain text files',
      '• **CSV** and **XLSX** — Spreadsheet data',
      'You can also paste text, enter a website address, or let **AI write it** from a short description.',
    ],
  },
  {
    id: 'share-with-client',
    title: 'How do I share with a client?',
    category: 'sharing',
    icon: '📤',
    content: [
      'Open a completed video from your Library. You have two options:',
      '• **Send to Client** — sends the video by email. Enter the client\'s email and an optional message.',
      '• **Copy Link** — copies the share page address. Paste it into any email, chat, or message.',
      'The share page shows your logo, colors, and contact details, plus your booking and payment buttons if you set them up.',
    ],
  },
  {
    id: 'social-posts',
    title: 'Social posts and AI Social',
    category: 'sharing',
    icon: '📣',
    content: [
      '**Social Posts (free):** on any finished video, click **Social Posts**. It writes a LinkedIn, X/Twitter and Facebook post at once, each with a **Copy** button and your share link.',
      '**AI Social ($50/month add-on):** connect your social accounts, let AI write captions and make branded images, and post on a schedule. Open it from the account menu (top-right) > **AI Social**.',
      'AI Social uses your normal credits: 25 per caption set, and 25 per platform each time you post (posting to 3 platforms = 75). See the **Social Posts & AI Social** guide.',
    ],
  },
  {
    id: 'viewer-tracking',
    title: 'What happens when someone watches my video?',
    category: 'sharing',
    icon: '👁️',
    content: [
      'When a client opens your share page, Docs2Video tracks their engagement automatically:',
      '• **Opens & plays** — how many times the page was opened and the video played.',
      '• **Watch-through** — how far they got (25 / 50 / 75 / 100%).',
      '• **Actions** — downloads, booking clicks, and payment clicks.',
      '• **Context** — device, browser, and approximate location.',
      'You\'re notified by email (and SMS, if you added a phone). Full breakdowns live on the **Analytics** page — see "Analytics — who watched and how far."',
    ],
  },
  {
    id: 'referrals',
    title: 'How do referrals work?',
    category: 'billing',
    icon: '🤝',
    content: [
      'Open the account menu (top-right) and choose **Affiliate Program** to join and get your unique referral link.',
      'Share your link with others. When someone signs up and makes a purchase, you earn **20% commission** on their payments.',
      'Commissions are approved after a 30-day refund hold and paid manually each cycle — there is no minimum. Track your clicks, signups, and earnings on the Affiliate Dashboard.',
    ],
  },
  {
    id: 'upgrade-plan',
    title: 'How do I change my plan?',
    category: 'billing',
    icon: '⬆️',
    content: [
      'Go to **Settings > Subscription**. Your current plan and credits are shown at the top, with the plans below.',
      'Click **Subscribe to [Plan]** (or **Switch to [Plan]** if you already have one). To see invoices, update your card, or cancel, click **Manage billing & invoices**.',
      'Available plans (credits/month): **Free** (2,000 to start), **Pro** ($79 — 25,000), **Business** ($199 — 75,000), **Enterprise** ($499 — 200,000). Buy top-up packs anytime (from $10 for 2,500 credits); they never expire.',
    ],
  },
  {
    id: 'style-changed',
    title: 'Why does my video look different from the style I picked?',
    category: 'creators',
    icon: '🔄',
    content: [
      'Occasionally the exact style you chose is briefly unavailable when your video renders. Rather than make you wait or fail, we produce your video in an alternate style so you still get a result.',
      'When that happens, the video page shows a note explaining which style was used and why.',
      'To get your original style, just open the video and **regenerate** — it will try your chosen style again.',
    ],
  },
  {
    id: 'insurance-figures',
    title: 'Insurance videos: what\'s kept vs. removed',
    category: 'creators',
    icon: '🛡️',
    content: [
      'For insurance illustrations, videos are automatically built as a **generic, agent-attributed explainer** — this is a compliance safeguard.',
      '**Removed automatically:** the carrier name and the branded product name (anywhere on screen or in the voiceover).',
      '**Kept:** the dollar figures, values, and percentages from the illustration — your client needs the real numbers to understand their coverage.',
      '**Framing:** the video points the client to the actual illustration for specifics and is attributed to you, the agent — not the carrier.',
      'This runs across every style, so an insurance video is compliant no matter which look you pick. See the **Insurance Illustrations** guide for the full picture.',
    ],
  },
  {
    id: 'brief-review',
    title: 'The brief step — making the video cover what you want',
    category: 'creators',
    icon: '📝',
    content: [
      'After you add your content, AI shows a **brief**: the angle it will take, the key points it plans to cover, and the figures it will feature.',
      'To change it, tell it in the chat box — for example "focus on the death benefit, keep it reassuring". If it asks you a few questions, answer them and press **Update brief with my answers**.',
      'When it looks right, press **Looks good — continue**. What you approve here steers the final video on **every** style.',
    ],
  },
]


export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const brand = useBrand()

  // On a storefront that does not sell video, the help centre must not be a
  // list of video guides. Only what that customer can actually use.
  const guides = brand.showVideoFeatures
    ? GUIDES
    : GUIDES.filter((g) => ['/help/flyers', '/help/restyle-deck', '/help/pricing', '/help/account', '/help/faq'].includes(g.href))

  const filteredArticles = ARTICLES.filter(a => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return a.title.toLowerCase().includes(q) || a.content.some(c => c.toLowerCase().includes(q))
    }
    if (activeCategory) return a.category === activeCategory
    return true
  })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Help Center</h1>
          <p>Everything you need to know about {brand.name}.</p>
        </div>
      </div>

      {/* User Guides — card grid */}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
          User Guides
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {guides.map(guide => (
            <Link
              key={guide.href}
              href={guide.href}
              style={{
                display: 'block',
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
                padding: '20px 22px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--mint)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{guide.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
                {guide.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {guide.description}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '32px 0' }} />

      {/* Quick Reference — existing accordion */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
        Quick Reference
      </h2>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          className="input"
          placeholder="Search help articles..."
          value={search}
          onChange={e => { setSearch(e.target.value); if (e.target.value) setActiveCategory(null) }}
          style={{ fontSize: 15 }}
        />
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => { setActiveCategory(null); setSearch('') }}
          className={`btn btn-sm ${!activeCategory && !search ? 'btn-primary' : 'btn-soft'}`}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setSearch('') }}
            className={`btn btn-sm ${activeCategory === cat.id ? 'btn-primary' : 'btn-soft'}`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Articles */}
      {filteredArticles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-soft)' }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No articles found</p>
          <p style={{ fontSize: 14 }}>Try a different search term or category.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredArticles.map(article => {
            const isExpanded = expandedArticle === article.id
            return (
              <div
                key={article.id}
                style={{
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                <button
                  onClick={() => setExpandedArticle(isExpanded ? null : article.id)}
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
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{article.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{article.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>
                      {CATEGORIES.find(c => c.id === article.category)?.label}
                    </div>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2"
                    style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 20px 20px 52px', fontSize: 14, lineHeight: 1.7, color: 'var(--ink-soft)' }}>
                    {article.content.map((paragraph, i) => (
                      <p key={i} style={{ margin: '8px 0' }} dangerouslySetInnerHTML={{
                        __html: paragraph
                          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--ink)">$1</strong>')
                          .replace(/^• /gm, '<span style="color:var(--mint-darker,#2d7a4f)">&#8226;</span> ')
                      }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Still need help? */}
      <div style={{
        marginTop: 32, padding: '24px 28px', borderRadius: 10,
        background: 'rgba(168,240,212,0.1)', border: '1px solid var(--mint)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Still need help?</div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          Click the help button in the bottom-right corner to chat with our AI assistant. It knows everything about the app.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a href="mailto:support@docs2video.com" className="btn btn-soft">Email Support</a>
          <Link href="/settings" className="btn btn-soft">Settings</Link>
        </div>
      </div>
    </div>
  )
}
