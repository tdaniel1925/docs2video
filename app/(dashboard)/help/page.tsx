'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBrand } from '../../_components/BrandProvider'
import { PLANS, type PlanTier } from '../../_lib/pricing'
import { CREDIT_COSTS, TIER_CREDITS } from '../../_lib/credits'
import { CREDIT_PACKS, packPrice, SMALLEST_PACK } from '../../_lib/credit-packs'
import { NAMES, KIND_NAMES } from '../../_lib/names'

// Prices and names are READ from the tables, never typed: this page typed its
// own plan prices and pack names, and called the $10 pack "Starter" after the
// Starter plan was retired. tests/screen-prices.test.ts keeps it that way.
const n = (x: number) => x.toLocaleString('en-US')
const planPrice = (tier: PlanTier) => `$${Math.round((PLANS.find(p => p.tier === tier)?.monthlyPrice ?? 0) / 100)}`
const PACK_LIST = CREDIT_PACKS.map(p => `${p.name} ${n(p.credits)} (${packPrice(p)})`).join(', ')
const LIBRARY_TABS = ['All', ...(['video', 'presentation', 'deck', 'graphic'] as const).map(k => KIND_NAMES[k].many)]
  .map(t => `**${t}**`).join(', ')

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

// Audited against the live UI on 2026-09-26 (top bar + Home: 2026-10, overhaul step 4). When a screen changes, change the
// matching entry here (and the guide page it links to) in the same commit.
const GUIDES: HelpGuide[] = [
  {
    href: '/help/getting-started',
    title: 'Getting started',
    description: 'Sign up without a card, make a first project with a free preview, add your brand on the way, and add a card when you make the real thing.',
    icon: '🚀',
  },
  {
    href: '/help/creating-videos',
    title: 'Creating explainer videos',
    description: 'Pick a format, say who it\'s for, add your content, approve the brief, choose a presenter and voice, check the script, pick a style, then generate.',
    icon: '🎬',
  },
  {
    href: '/help/commercials',
    title: 'Creating commercials',
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
    title: 'Sharing & the client page',
    description: 'The branded share page: personalized welcome banner, a note to your client, source-PDF download, booking and payment.',
    icon: '🔗',
  },
  {
    href: '/help/making-changes',
    title: 'Changing a finished project',
    description: 'One "Ask for a change" bar for every project: this scene or the whole thing, the right editor for it, the price first, and Undo.',
    icon: '🛠️',
  },
  {
    href: '/help/social-sharing',
    title: 'Social posts & AI Social',
    description: 'Write ready-to-post captions for any finished video, or add AI Social to connect your accounts and post on a schedule.',
    icon: '📣',
  },
  {
    href: '/help/insurance',
    title: 'Insurance illustrations',
    description: 'How compliance works: carrier/product names automatically removed, dollar figures kept, agent-attributed — with a generic-explainer safety net.',
    icon: '🛡️',
  },
  {
    href: '/help/pricing',
    title: 'Pricing & plans',
    description: 'Credit-based plans: Free (2,000 to start), Pro $79, Business $199, Enterprise $499. Top-up packs from $10, anytime.',
    icon: '💰',
  },
  {
    href: '/help/faq',
    title: 'FAQ & troubleshooting',
    description: 'Common questions, troubleshooting tips for stuck videos, missing audio, and more.',
    icon: '❓',
  },
  {
    href: '/help/brands',
    title: 'Brands & personalization',
    description: 'Person or Company brands — your name, role, photo, and intro line, or your logo, colors, and contact info — used across every video.',
    icon: '🎨',
  },
  {
    href: '/help/library',
    title: NAMES.library,
    description: 'Picture cards for everything you’ve made: what “Ready to send”, “Making…” and “Didn’t finish” mean, the Send button, search, cards or list, and deleting safely.',
    icon: '📁',
  },
  {
    href: '/help/downloads',
    title: 'Downloads & formats',
    description: 'The Download menu: MP4 video, PDF slides, PowerPoint and the script — and why a video only lists the ones its look can make.',
    icon: '📥',
  },
  {
    href: '/help/account',
    title: 'Account & settings',
    description: 'Your account area: profile, billing & credits, brand kit, email & sending (booking and payment links), analytics and affiliate — and resetting a forgotten password.',
    icon: '⚙️',
  },
]

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting started', icon: '🚀' },
  { id: 'creators', label: 'Creators', icon: '🎨' },
  { id: 'management', label: 'Management', icon: '📁' },
  { id: 'billing', label: 'Billing & pricing', icon: '💳' },
  { id: 'sharing', label: 'Sharing & collaboration', icon: '🔗' },
]

const ARTICLES: HelpArticle[] = [
  // Getting started
  {
    id: 'onboarding',
    title: 'Setting up your account',
    category: 'getting-started',
    icon: '👤',
    content: [
      'Signing up asks for your name, email and a password — **no card**. You land on **Home** with a note: **Try it before you add a card.**',
      'Make your first project straight away. On step 3 (**Make it yours**) press **See a free preview** to see the first scene and hear the voice (free, a few a day), and fill in **Add your brand** — your name, logo and colours, or **Fill in from it** to read them from your website.',
      'You add a card only when you press **Make it** on a real video, presentation or slide deck: **Add your payment method** opens, then brings you back. Saving the card starts your free credits; nothing is charged until they run out.',
      'The optional Setup Wizard has 5 quick steps (you can press **Skip for now** on any of them):',
      '**1 — Profile:** Your name, company, phone, and role. This is your identity on the share page ("prepared by").',
      '**2 — Photo:** Upload a headshot (used on the cover). Mid-level and standing photos are optional.',
      '**3 — Brand:** Your logo, brand colors, and contact info (phone/email/website) — used across every video and the share page.',
      '**4 — Voice:** Pick a default narration voice.',
      '**5 — Style:** Pick a default image style for your slides. You choose the video look for each project on the Style step.',
      `You can run the wizard again anytime with **Run the setup again** in **Settings → Profile**. To edit saved brands later, click **${NAMES.brands}** in the top bar.`,
    ],
  },
  {
    id: 'dashboard',
    title: 'Home and the top bar',
    category: 'getting-started',
    icon: '📊',
    content: [
      `The top bar has four words: **${NAMES.newButton}**, **${NAMES.library}**, **${NAMES.clients}** and **${NAMES.brands}**. The logo takes you Home. On the right are **${NAMES.howToUse}**, your credits and your initial, which opens the account menu: your plan and shortcuts to Settings, Billing & credits, Analytics, AI Social, Affiliate, the Help Center and Sign out.`,
      `**While you make something** — the top bar steps aside for a quieter one: **Home** on the left (your draft is saved as you go and waits on Home), the four step numbers in the middle, and **${NAMES.howToUse}** and your credits on the right. On a phone, the **?** button holds ${NAMES.howToUse} and the help assistant.`,
      `**Credits** — Your balance is the gold box in the top bar. It turns amber when fewer than ${n(CREDIT_COSTS.videoStandard)} are left (one standard video). Every creation spends credits (see Pricing). Click it (**+ Top Up**) to buy more.`,
      '**Create** — Home opens with six small tiles: **From a document**, **From a website**, **From an idea**, **Paste your text**, **A commercial** and **Your brand**. Each one opens the first step with that choice already made.',
      `**${NAMES.newButton}** — Starts any new project too: a narrated video, an interactive presentation or a slide deck. Commercials and custom graphics also start from the links under the first step.`,
      '**Today’s clients** — Who clicked to book a call, who watched, and who hasn’t opened what you sent, each with the next thing to do.',
      `**Recent** — Your latest work and where each one stands. Click **Continue** on a draft or **Open** on the rest, or go to **${NAMES.library}** for everything.`,
    ],
  },
  {
    id: 'how-to-use',
    title: 'The "How to use" button',
    category: 'getting-started',
    icon: '🧭',
    content: [
      `Every screen has a **${NAMES.howToUse}** button in the top bar. On a phone, open the ☰ menu and choose **${NAMES.howToUse} this screen**.`,
      'The round **help** button (bottom right) opens the **Help Assistant**. It knows which screen you are on: it says “On this screen: …” and starts with questions people ask there — tap one to ask it, or type your own. On a phone it is in the ☰ menu as **Ask the help assistant**.',
      'It opens a short, numbered list of steps for the screen you are on: Home, each step of making a project, your Library, a finished project, Brands, Clients and Settings. Other screens show how to get around.',
      'Press **Esc**, the **×**, or click outside it to close it. **More in the Help Center** at the bottom opens the full guide for that screen.',
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
    title: 'Interactive presentations',
    category: 'creators',
    icon: '🖱️',
    content: [
      'An interactive presentation is a narrated, click-through presentation your client explores at their own pace, on its own share page.',
      `**1.** Click **${NAMES.newButton}**, say who it\'s for and what it should get them to do, and add your content.`,
      '**2.** Check the story — the same as a video — then press **Looks right — pick the look**.',
      '**3.** Under **What do you want to send?** choose **Interactive presentation**, then pick one of six looks: Heritage, Warm Editorial, Corporate Bold, Midnight, Fresh Mint or Certificate.',
      `**4.** Press **Make it**. When it\'s ready, open it from your ${NAMES.library} to send it, or change it with **Ask for a change**.`,
      `It costs ${n(CREDIT_COSTS.interactive)} credits. Want a video file too? On the finished presentation\'s page, press **Download** and choose **Export video** (${n(CREDIT_COSTS.videoExport)} credits).`,
    ],
  },
  {
    id: 'explainer-video',
    title: 'Creating an explainer video',
    category: 'creators',
    icon: '🎬',
    content: [
      `Start from **${NAMES.newButton}** (top bar). There are four steps, and the bar on the left shows which one you\'re on. Nothing is charged until you press **Make it** on step 3.`,
      '**1 — What\'s this about?** Pick a client (or **No client — general**), say what it should get them to do, and choose where the content comes from: **Website URL**, **Upload file** (up to 5: PDF, Word, PowerPoint, text, CSV or Excel), **Paste text**, or **AI writes it**. When you name a client, their name appears on the cover and share page ("Prepared for [Client]").',
      '**2 — Check the story.** Read the one point and the scenes. Choose the **Length** (Short, Standard or Detailed), edit any scene, or type a change under **Change it by asking**. This step is free.',
      `**3 — Make it yours.** Check **${NAMES.brand}**, choose **Narrated video**, pick the look (see "Video styles explained") and the voice (**Sarah** by default; press play to hear any voice), and add background music if you like. Optionally add a note to your client, then press **Make it**.`,
      `**4 — Send it.** It finishes in the background and lands in your ${NAMES.library}. Its page opens with **Ready to send**: what\'s left, a picture of their page, and Send. Below that are **Ask for a change** and **Who watched**; at the top, **Download** and **More**.`,
    ],
  },
  {
    id: 'video-styles',
    title: 'Video styles explained',
    category: 'creators',
    icon: '🎨',
    content: [
      'On the **Make it yours** step you choose how your explainer looks. Every look — Slide Deck included — uses the voice and background music you picked and your story exactly as you edited it. Only the visuals differ:',
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
      '• Once it **has a story** (you reached the story step), it is kept for **14 days** after your last change.',
      'After that the draft, and any file you uploaded for it, is deleted. Finished videos are never removed this way.',
    ],
  },
  {
    id: 'library',
    title: NAMES.library,
    category: 'management',
    icon: '📁',
    content: [
      `The **${NAMES.library}** (top bar) shows everything you\'ve made as picture cards: a picture, the name, a coloured status line (**Ready to send**, **Making…**, **Didn’t finish** or **Draft**), the date and who it’s for.`,
      `Use the tabs to show ${LIBRARY_TABS}. The tab you pick stays chosen when you refresh.`,
      '• **Press a card** to open it. Videos and presentations open their page, with the player, sending and downloads. **Graphics** open the image in a new tab.',
      '• A ready video has a **Send** button that goes straight to sending it.',
      '• **Search by name or client**, change the order, or switch between **Cards** and **List** (the list is a table; your choice is remembered on this computer).',
      '• To delete, press **…** on the card, then **Delete…** — it asks first.',
      `It shows 24 items per page (you can switch to 48 or 96). Use **Previous** / **Next** to move between pages. The full guide is "${NAMES.library}" in the guides above.`,
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
      `• **Narrated video** — Short ${n(CREDIT_COSTS.videoQuick)} · Standard ${n(CREDIT_COSTS.videoStandard)} · Detailed ${n(CREDIT_COSTS.videoDetailed)} credits`,
      `• **Interactive presentation** — ${n(CREDIT_COSTS.interactive)} credits (MP4 export ${n(CREDIT_COSTS.videoExport)}) · **Slide deck** — ${n(CREDIT_COSTS.deck)} · **Commercial** — ${n(CREDIT_COSTS.commercial)}`,
      `• **Custom Graphics** — ${n(CREDIT_COSTS.flyer)} credits per design`,
      'Plans include a monthly credit allowance (see Plans). You can buy more credits anytime with **+ Top Up** next to your balance.',
    ],
  },
  {
    id: 'plans',
    title: 'Plans & membership',
    category: 'billing',
    icon: '💰',
    content: [
      `Plans give you a monthly credit allowance (credits are spent per creation — a standard video is ${n(CREDIT_COSTS.videoStandard)} credits):`,
      `**Free** — ${n(TIER_CREDITS.free)} credits to try (one time). Card required to start.`,
      `**Pro (${planPrice('pro')}/mo)** — ${n(TIER_CREDITS.pro)} credits/mo, unlimited brands.`,
      `**Business (${planPrice('business')}/mo)** — ${n(TIER_CREDITS.business)} credits/mo, white-label share pages.`,
      `**Enterprise (${planPrice('enterprise')}/mo)** — ${n(TIER_CREDITS.enterprise)} credits/mo, white-label share pages, dedicated support.`,
      `Need more mid-cycle? Buy top-up packs (never expire): ${PACK_LIST}. Anyone can buy them, including Free accounts.`,
      'Manage your plan from **Settings > Billing & credits**.',
    ],
  },
  {
    id: 'earn-credits',
    title: 'Affiliate program',
    category: 'billing',
    icon: '🎁',
    content: [
      '**Affiliate** — Refer new users and earn **20% commission** on their payments. Open the account menu (top-right) and choose **Affiliate** to get your referral link.',
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
      '• **Book a Call** (your booking link) and **Make a Payment**, when set up in Settings > Email & sending. Links must start with https://. For Google Calendar, paste the link of a Google booking page (an "Appointment schedule") — there is no direct connection.',
      '**How to share:**',
      '1. Open a completed video from your Library.',
      '2. At the top, under **Ready to send**, fix anything **What\'s left** lists, write **A short note**, and press **Send to** your client — or **or copy the link** to paste the address anywhere.',
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
    id: 'ask-for-a-change',
    title: 'Changing a finished video or presentation',
    category: 'management',
    icon: '🛠️',
    content: [
      'Open it from your Library and use **Ask for a change** (under Ready to send). Pick **This scene** or the whole thing, type what you want or press a suggestion, then press the button.',
      'It opens the editor that project uses: the slide editor for presentations and slide decks, **Fix a scene** for Slide Deck look videos, the **Scene editor** for other looks with slide pictures. A few looks can\'t be changed in place — the bar offers **Make a changed copy**.',
      `The first line of the bar says what a change costs. Changing spoken words costs ${n(CREDIT_COSTS['slide-scene-fix'])} credits per scene or slide on presentations and Slide Deck videos; fixing a voice glitch or a mispronounced word is free.`,
      'Your changes are listed under the bar with **Undo**. See **Changing a finished project** for more.',
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
      '1. Open the video, scroll to **Quote / invoice**, and add a quote with your client\'s email.',
      '2. Tick **Automatic follow-ups** under the quote. You\'ll see a message confirming reminders are on.',
      '3. Up to two short reminders go out — about 3 and 7 days after the quote — from your connected email, each with an unsubscribe link.',
      'They stop as soon as you mark the deal **paid**, **accepted** or **declined**, or the client unsubscribes. Untick the box to turn them off. You need a connected email account (Settings > Email & sending).',
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
    title: 'Affiliate program',
    category: 'sharing',
    icon: '🤝',
    content: [
      'Earn recurring commission by referring others to Docs2Video.',
      '**How to Join:**',
      '1. Open the account menu (top-right) and click "Affiliate".',
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
      `Click **${NAMES.newButton}**. On the first step, under **Where should the content come from?**, choose **Upload file** and drag your files onto the upload area, or click to browse. You can add up to 5 files.`,
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
      `You do not need to stay on the page. Video generation continues in the background. When it finishes, your video appears in your ${NAMES.library}.`,
    ],
  },
  {
    id: 'edit-script',
    title: 'Can I edit the script?',
    category: 'creators',
    icon: '✏️',
    content: [
      'Yes. On step 2, **Check the story**, every scene is editable: change the words directly, or open **More — words on screen, ask AI, preview** for the slide headline, stats, an AI edit and **Preview slide**.',
      'Drag scenes to reorder them (the opening and closing stay in place).',
      'To make a big change — like "add a slide about pricing" — type it under **Change it by asking** on the right. You can **Undo that change**.',
      'After it is made, use **Ask for a change** on its page — see **Changing a finished project**.',
    ],
  },
  {
    id: 'change-voice',
    title: 'How do I change the voice?',
    category: 'creators',
    icon: '🎙️',
    content: [
      'On step 3, **Make it yours**, press play next to any voice under **The voice** to hear it, then click the voice to choose it.',
      'The default is **Sarah**, a warm female voice. Voices range from warm and conversational to professional and authoritative.',
      'Pick your voice before you generate. To change it afterwards, the video has to be made again.',
    ],
  },
  {
    id: 'add-logo',
    title: 'How do I add my logo?',
    category: 'creators',
    icon: '🏷️',
    content: [
      `Your logo lives in a **Company brand**. Click **${NAMES.brands}** in the top bar, then create or edit a brand and upload a PNG or SVG logo.`,
      'You can also add your brand right on the **Make it yours** step while making a video: **Add your brand** opens on the page (on your first project it opens by itself). Upload your logo, or press **Fill in from it** to take the logo and colours from your website, then **Save my brand**. Only your real logo is ever used — we never draw one; with no logo your name shows as text.',
      'When making a video, the brand shows at the top of **Make it yours** — press **Change** to pick another. The logo appears on the cover, the closing slide and the share page. See the **Brands & personalization** guide for details.',
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
      'Open a completed video from your Library. The top of its page is **Ready to send** — one panel for everything:',
      '• **What\'s left** — chips for anything missing from their page (their email, a note, your booking link, photo or name, a payment link). Press one to fix it.',
      '• **Send to [client]** — emails it, from your own connected email if you have one. Type an email if the app doesn\'t have one yet, or press **Send to someone else**.',
      '• **or copy the link** copies the share page address; **Copy the email** copies the whole email to paste into your own inbox. Copying sends nothing.',
      'The share page shows your logo, colors, and contact details, plus your booking and payment buttons if you set them up.',
    ],
  },
  {
    id: 'social-posts',
    title: 'Social posts and AI Social',
    category: 'sharing',
    icon: '📣',
    content: [
      '**Social Posts (free):** on any finished video, open **More** (top-right) and choose **Social posts**. It writes a LinkedIn, X/Twitter and Facebook post at once, each with a **Copy** button and your share link.',
      '**AI Social ($50/month add-on):** connect your social accounts, let AI write captions and make branded images, and post on a schedule. Open it from the account menu (top-right) > **AI Social**.',
      'AI Social uses your normal credits: 25 per caption set, and 25 per platform each time you post (posting to 3 platforms = 75). See the **Social posts & AI Social** guide.',
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
      'On the video\'s own page, **Who watched** shows each person you emailed it to — whether they opened the email and how far into the video they got — plus anyone else who opened the link, by device.',
      'You\'re notified by email (and SMS, if you added a phone). Full breakdowns live on the **Analytics** page — see "Analytics — who watched and how far."',
    ],
  },
  {
    id: 'referrals',
    title: 'How do referrals work?',
    category: 'billing',
    icon: '🤝',
    content: [
      'Open the account menu (top-right) and choose **Affiliate** to join and get your unique referral link.',
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
      'Go to **Settings > Billing & credits**. Three boxes at the top show your plan, your credits and what you used this period, with the plans and credit packs below.',
      'Click **Subscribe to [Plan]** (or **Switch to [Plan]** if you already have one). To see invoices, update your card, or cancel, click **Manage billing & invoices**.',
      `Available plans (credits/month): **Free** (${n(TIER_CREDITS.free)} to start), **Pro** (${planPrice('pro')} — ${n(TIER_CREDITS.pro)}), **Business** (${planPrice('business')} — ${n(TIER_CREDITS.business)}), **Enterprise** (${planPrice('enterprise')} — ${n(TIER_CREDITS.enterprise)}). Buy top-up packs anytime (from ${packPrice(SMALLEST_PACK)} for ${n(SMALLEST_PACK.credits)} credits); they never expire.`,
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
      'This runs across every style, so the same safeguards apply no matter which look you pick. Always review the video before you send it. See the **Insurance illustrations** guide for the full picture.',
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
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
          User Guides
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {guides.map(guide => (
            <Link
              key={guide.href}
              href={guide.href}
              style={{
                display: 'block',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
                padding: '20px 22px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-ink)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'
                ;(e.currentTarget as HTMLElement).style.transform = 'none'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 'var(--fs-h2)', marginBottom: 10 }}>{guide.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--ink)', marginBottom: 6 }}>
                {guide.title}
              </div>
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {guide.description}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '32px 0' }} />

      {/* Quick Reference — existing accordion */}
      <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, marginBottom: 16, color: 'var(--ink)' }}>
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
          style={{ fontSize: 'var(--fs-body)' }}
        />
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 24, flexWrap: 'wrap' }}>
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
          <p style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>No articles found</p>
          <p style={{ fontSize: 'var(--fs-ui)' }}>Try a different search term or category.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {filteredArticles.map(article => {
            const isExpanded = expandedArticle === article.id
            return (
              <div
                key={article.id}
                style={{
                  background: 'var(--bg-card)',
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
                    gap: 'var(--space-3)',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-h3)', flexShrink: 0 }}>{article.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--ink)' }}>{article.title}</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-light)', marginTop: 2 }}>
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
                  <div style={{ padding: '0 20px 20px 52px', fontSize: 'var(--fs-ui)', lineHeight: 1.7, color: 'var(--ink-soft)' }}>
                    {article.content.map((paragraph, i) => (
                      <p key={i} style={{ margin: '8px 0' }} dangerouslySetInnerHTML={{
                        __html: paragraph
                          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--ink)">$1</strong>')
                          .replace(/^• /gm, '<span style="color:var(--mint-darker)">&#8226;</span> ')
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
        background: 'var(--accent-soft)', border: '1px solid var(--accent)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, marginBottom: 6 }}>Still need help?</div>
        <p style={{ fontSize: 'var(--fs-ui)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          Click the help button in the bottom-right corner to chat with our AI assistant. It knows everything about the app.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
          <a href="mailto:support@docs2video.com" className="btn btn-soft">Email support</a>
          <Link href="/settings" className="btn btn-soft">Settings</Link>
        </div>
      </div>
    </div>
  )
}
