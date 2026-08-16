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

const GUIDES: HelpGuide[] = [
  {
    href: '/help/getting-started',
    title: 'Getting Started',
    description: 'Create your account, add a payment card, understand your credits, and navigate the dashboard.',
    icon: '🚀',
  },
  {
    href: '/help/creating-videos',
    title: 'Creating Explainer Videos',
    description: 'Pick a format, add your content, choose who it\'s for, review the AI script and brief, pick a style and voice, then generate.',
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
    description: 'Describe the job in plain English and get finished print-ready designs — artwork and words together — in every size you tick, including business cards.',
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
    description: 'The branded share page: personalized welcome banner, a note to your client, download options, source-PDF download, booking and payment.',
    icon: '🔗',
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
    description: 'Credit-based plans: Free (2,000), Starter $29, Pro $79, Business $199, Enterprise $499. Buy top-up packs anytime.',
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
    description: 'MP4 video, PDF slides, PPTX presentations, and the original source document explained.',
    icon: '📥',
  },
  {
    href: '/help/account',
    title: 'Account & Settings',
    description: 'Manage your profile, notifications, billing, and subscription settings.',
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
      'When you first sign up, the Setup Wizard guides you through 5 quick steps:',
      '**1 — Profile:** Your name, company, phone, and role. This is your identity on the share page ("prepared by").',
      '**2 — Photos:** Upload a headshot (used on the cover) and optional closing photo. Only the headshot is needed.',
      '**3 — Brand:** Your logo, brand colors, and contact info (phone/email/website) — used across every video and the share page.',
      '**4 — Voice:** Pick a default narration voice.',
      '**5 — Style:** Choose a default look for your videos. You can always change it per project.',
      'You can re-run the setup wizard anytime from **Settings**, and edit any of it later under **Settings** and **Brands**.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Understanding Your Dashboard',
    category: 'getting-started',
    icon: '📊',
    content: [
      'Your dashboard shows everything at a glance:',
      '**Credits** — Your current balance is in the top bar. Every creation spends credits from your plan (see Pricing).',
      '**Create** — Start any new project from the **+ Create** button — one place for videos, slides, and commercials.',
      '**Recent Creations** — Your latest items with type badges. Click any item to open it, or "View all" for your full Library.',
    ],
  },

  // Creators
  {
    id: 'explainer-video',
    title: 'Creating an Explainer Video',
    category: 'creators',
    icon: '🎬',
    content: [
      'Start from **+ Create** (top nav) or the dashboard. Everything runs through one guided flow — you can leave at any point and your progress is saved.',
      '**1 — Pick a format.** Choose **Video Explainer**, **Commercial**, or **Custom Graphics** (flyers, ads, banners and business cards).',
      '**2 — Who\'s this for?** Pick an existing client, add a new one, or skip for a general video. When you name a client, their name appears on the video cover and share page ("Prepared for [Client]").',
      '**3 — Add your content.** Upload a PDF/Word/PowerPoint, paste text, enter a website URL, or describe an idea. AI reads it and extracts the key points.',
      '**4 — Review the brief.** AI shows what it understood — the angle, the key points it\'ll cover, and the figures it\'ll feature. Edit or tell it what to change. **This brief now steers the final video on every style**, so what you approve is what you get.',
      '**5 — Brand & voice.** Choose the brand/presenter profile, then a narration voice (click any voice to preview). Default is **Sarah**, a warm female voice.',
      '**6 — Style.** Pick the look (see "Video styles explained"). Optionally add a client note and let the client download your source PDF.',
      '**7 — Generate.** Click generate and leave the page — it finishes in the background and lands in your Library.',
      'When it\'s done you can rename it, download it (MP4 / PDF / PPTX), share it, or refine a scene with the AI editor.',
    ],
  },
  {
    id: 'video-styles',
    title: 'Video styles explained',
    category: 'creators',
    icon: '🎨',
    content: [
      'On the Style step you choose how your explainer looks. All styles use the same narration and personalization — only the visuals differ:',
      '• **Slide Deck** (recommended) — an animated explainer deck: topic headings with bullets, data cards, charts, and icons that reveal in sync with the voice. Reads the whole document.',
      '• **Aurora** — modern motion graphics: one flowing branded backdrop, kinetic type, no stock imagery. Clean and premium.',
      '• **Cinematic** — film-style imagery with kinetic text and motion. Best for story-led, emotive videos.',
      '• **Editorial** — a clean, warm magazine layout with refined serif typography on your brand color.',
      '• **Explainer** — a friendly modern deck with navy + color accents and big rounded cards. Great for how-it-works.',
      'If your chosen style is temporarily unavailable at render time, we still produce your video in an alternate style and show a note on the video page so you can regenerate in your original style.',
    ],
  },
  {
    id: 'templates',
    title: 'Custom Templates',
    category: 'creators',
    icon: '🎯',
    content: [
      'Most videos use the built-in styles (Slide Deck, Aurora, Cinematic, Editorial, Explainer) — see "Video styles explained." Custom templates let you define your own look.',
      '**Creating a Template:**',
      '1. Describe the style you want (e.g., "modern corporate with large data callouts").',
      '2. Optionally upload a reference image for visual inspiration.',
      '3. AI generates a preview slide in your style.',
      '4. Refine if needed, then save.',
      'Your saved templates appear in the style picker when you create a video. Generating a style preview uses a small number of credits.',
    ],
  },

  // Management
  {
    id: 'library',
    title: 'Your Library',
    category: 'management',
    icon: '📁',
    content: [
      'The Library shows all your creations (videos and slide decks).',
      'Each item shows a thumbnail, title, type badge, and date created.',
      '• **Videos** link to the video detail page with player, editor, and share options',
      '• **Slide decks** open the downloadable PPTX directly',
      'The library is paginated at 20 items per page. Use Previous/Next to navigate.',
    ],
  },
  // Billing & Credits
  {
    id: 'pricing',
    title: 'Pricing',
    category: 'billing',
    icon: '🪙',
    content: [
      'Videos and slide decks are paid for with credits from your plan:',
      '• **Video Explainer** — Quick 500 · Standard 1,000 · Detailed 1,500 credits (podcast narration adds 400)',
      '• **Slide Deck** — 600 credits · **PowerPoint (PPTX)** — 800 · **PDF** — 600',
      '• **Infographic** — 300 credits',
      'Subscription plans include a monthly credit allowance (see Plans). You can buy more credits anytime from Settings.',
    ],
  },
  {
    id: 'plans',
    title: 'Plans & Membership',
    category: 'billing',
    icon: '💰',
    content: [
      'Plans give you a monthly credit allowance (credits are spent per creation — a standard video is 1,000 credits):',
      '**Free** — 2,000 credits to try. Card required to start.',
      '**Starter ($29/mo)** — 5,000 credits/mo.',
      '**Pro ($79/mo)** — 25,000 credits/mo, priority generation, unlimited brands.',
      '**Business ($199/mo)** — 75,000 credits/mo, white-label share pages.',
      '**Enterprise ($499/mo)** — 200,000 credits/mo, API access, dedicated support.',
      'Need more mid-cycle? Buy top-up packs (never expire): Starter 2,500 ($10), Power 7,500 ($25), Studio 18,000 ($50).',
      'Manage your plan from **Settings > Subscription**.',
    ],
  },
  {
    id: 'earn-credits',
    title: 'Affiliate Program',
    category: 'billing',
    icon: '🎁',
    content: [
      '**Affiliate Program** — Refer new users and earn **20% commission** on their payments. Go to **Settings > Subscription > Affiliate Program** to get your referral link.',
    ],
  },

  // Sharing
  {
    id: 'translate-video',
    title: 'Translating a Presentation',
    category: 'creators',
    icon: '🌐',
    content: [
      'You can translate any completed video into another language with one click. The translated version is a new video with translated narration and slides.',
      '**How to translate:**',
      '1. Open a completed video from your Library',
      '2. Click the **Translate** button in the action bar below the video',
      '3. A modal appears with 10 supported languages: Spanish, French, Portuguese, German, Korean, Japanese, Chinese (Simplified), Arabic, Hindi, and Italian',
      '4. Click a language to select it, then click **Translate to [Language]**',
      '5. AI translates all narration and slide text naturally (not word-for-word)',
      '6. A new video is created and you are redirected to its detail page, where generation begins automatically',
      '**What gets translated:**',
      '• All narration text (the voiceover)',
      '• Slide text and descriptions',
      '• Numbers, currency amounts, and proper names are kept as-is',
      '**Good to know:**',
      '• Each translation uses 1 additional credit',
      '• The translated video appears in your Library with a language badge (e.g., "Spanish")',
      '• The AI voice automatically speaks in the target language — no voice change needed',
      '• You can translate a video into multiple languages to reach different audiences',
    ],
  },
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
      '• The video player with clickable slide thumbnails and chapter markers.',
      '• **Download Video**, and — if you enabled it — **Download Original PDF** (the source document you used).',
      '• Booking (your Calendly) and payment buttons, when configured.',
      '**How to share:**',
      '1. Open a completed video from your Library.',
      '2. Click **Share with Client** to send by email, or **Copy Link** to paste the URL anywhere.',
      'The page is styled with your brand and contact details. Business/Enterprise plans remove all Docs2Video branding (white-label).',
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
      'You can add a short personal message that appears above the video on the share page — a warm touch that makes the video feel one-to-one.',
      '1. On the **Style** step, under **Client options**, type your message in **"Note to your client."**',
      '2. Generate the video.',
      'The note shows as "A note from [You]" on the share page. Leave it blank to skip it.',
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics — who watched and how far',
    category: 'management',
    icon: '📈',
    content: [
      'Open **Analytics** from the nav to see how your videos are performing. Everything is tracked automatically when clients open your share pages.',
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
      'Click **Create Video** from the dashboard or navigation. On the content input screen, select **Upload PDF** and drag your file onto the upload zone, or click to browse.',
      'You can also paste text directly using **Type or Paste**, enter a webpage with **From URL**, or let AI generate content with **AI Research** or **Start from Idea**.',
      '**Supported file types:** PDF, DOCX, PPTX, TXT, and CSV.',
    ],
  },
  {
    id: 'video-creation-time',
    title: 'How long does video creation take?',
    category: 'creators',
    icon: '⏱️',
    content: [
      'Most videos are generated in **2-4 minutes**. The process includes generating slides, recording narration, and compositing everything into a final MP4.',
      'You do not need to stay on the page. Video generation continues in the background. When it finishes, your video appears in your Library.',
    ],
  },
  {
    id: 'edit-script',
    title: 'Can I edit the script?',
    category: 'creators',
    icon: '✏️',
    content: [
      'Yes. After the AI generates your script, you see each scene as an editable card. You can edit the narration text, scene titles, and slide notes for every scene.',
      'You can also reorder scenes by dragging, delete scenes you do not want, or add new scenes with the "Add Scene" button.',
      'Take your time — the more accurate the script, the better the final video.',
    ],
  },
  {
    id: 'change-voice',
    title: 'How do I change the voice?',
    category: 'creators',
    icon: '🎙️',
    content: [
      'During video creation, you will see a voice selection section. Browse the available voices and **click any voice to hear a preview**.',
      'Voices range from professional and authoritative to warm and conversational. The default voice is **Sarah (nova)**, a natural-sounding female voice.',
      'Select your preferred voice before clicking "Create my video." The voice cannot be changed after generation without recreating the video.',
    ],
  },
  {
    id: 'add-logo',
    title: 'How do I add my logo?',
    category: 'creators',
    icon: '🏷️',
    content: [
      'Your logo is managed through **Brands**. Go to **Brands** in the navigation, then create or edit a brand.',
      'Upload a PNG or SVG logo file. The logo appears on your video title slide, closing slide, and share page.',
      'When creating a video, select the brand with your logo from the brand dropdown. See the **Brands & Customization** guide for full details.',
    ],
  },
  {
    id: 'file-types',
    title: 'What file types are supported?',
    category: 'getting-started',
    icon: '📁',
    content: [
      'Docs2Video supports the following file types for upload:',
      '• **PDF** — Reports, proposals, whitepapers, illustrations',
      '• **DOCX** — Word documents',
      '• **PPTX** — PowerPoint presentations',
      '• **TXT** — Plain text files',
      '• **CSV** — Spreadsheet data',
      'You can also paste text directly, enter a URL to scrape, or let AI research and generate content from scratch.',
    ],
  },
  {
    id: 'share-with-client',
    title: 'How do I share with a client?',
    category: 'sharing',
    icon: '📤',
    content: [
      'Open a completed video from your Library. You have two options:',
      '• **Share with Client** — Click this button to send the video by email. Enter the client\'s email and an optional message.',
      '• **Copy Link** — Copies the share page URL to your clipboard. Paste it into any email, chat, or message.',
      'The share page is fully branded with your logo, colors, and contact details. It includes a video player, AI chatbot, and optional calendar booking.',
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
      'You\'re notified by email (and SMS, if you added a phone) on the first view. Full breakdowns live on the **Analytics** page — see "Analytics — who watched and how far."',
    ],
  },
  {
    id: 'referrals',
    title: 'How do referrals work?',
    category: 'billing',
    icon: '🤝',
    content: [
      'Go to **Settings > Subscription > Affiliate Program** to join and get your unique referral link.',
      'Share your link with others. When someone signs up and makes a purchase, you earn **20% commission** on their payments.',
      'Payouts are processed monthly for balances over $50. Track your clicks, signups, and earnings on the Affiliate Dashboard.',
    ],
  },
  {
    id: 'upgrade-plan',
    title: 'How do I upgrade my plan?',
    category: 'billing',
    icon: '⬆️',
    content: [
      'Go to **Settings > Subscription**. Your current plan is displayed along with upgrade options.',
      'Click **Upgrade** next to the plan you want. Upgrades take effect immediately and you are prorated for the remaining billing period.',
      'Available plans (credits/month): **Free** (2,000 to start), **Starter** ($29 — 5,000), **Pro** ($79 — 25,000), **Business** ($199 — 75,000), **Enterprise** ($499 — 200,000). Buy top-up packs anytime; they never expire.',
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
      'Review it and edit anything — change the angle, add must-cover points, or tell it what to avoid. Whatever you approve here now steers the final video on **every** style, so the finished video matches what you signed off on.',
      'If it misread your content, this is the place to correct course before generating.',
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
