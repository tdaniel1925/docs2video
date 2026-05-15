'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    description: 'Create your account, add a payment card, understand your free videos, and navigate the dashboard.',
    icon: '🚀',
  },
  {
    href: '/help/creating-videos',
    title: 'Creating Explainer Videos',
    description: 'Step-by-step walkthrough of uploading content, editing scripts, choosing options, and generating your video.',
    icon: '🎬',
  },
  {
    href: '/help/sharing-videos',
    title: 'Sharing Videos with Clients',
    description: 'Share pages, copy links, download options, and how clients interact with your videos.',
    icon: '🔗',
  },
  {
    href: '/help/insurance',
    title: 'Insurance Illustrations',
    description: 'How compliance works: automatic disclaimers, carrier redaction, and the 8 layers of protection.',
    icon: '🛡️',
  },
  {
    href: '/help/pricing',
    title: 'Pricing & Plans',
    description: 'Free trial, Pay Per Project, Pro, Business, and Agency plans explained.',
    icon: '💰',
  },
  {
    href: '/help/faq',
    title: 'FAQ & Troubleshooting',
    description: 'Common questions, troubleshooting tips for stuck videos, missing audio, and more.',
    icon: '❓',
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
      'When you first sign up, the Setup Wizard will guide you through 4 steps:',
      '**Step 1 — Profile:** Enter your name, company, phone, and role. This info appears on your share pages and video slides.',
      '**Step 2 — Photos:** Upload a headshot (used on title slides), mid-level photo, and standing photo (used on closing slides). Only the headshot is required.',
      '**Step 3 — Style:** Choose a default slide template. This is pre-selected when you create new videos, but you can always change it per project.',
      'You can re-run the setup wizard anytime from **Settings > Re-run Setup Wizard**.',
    ],
  },
  {
    id: 'dashboard',
    title: 'Understanding Your Dashboard',
    category: 'getting-started',
    icon: '📊',
    content: [
      'Your dashboard shows everything at a glance:',
      '**Plan** — Shows "Pro Member" (40% off everything) or "Free Account" (pay per project at full price).',
      '**Total Creations** — All items you\'ve ever created (videos, infographics, flyers, cards, logos).',
      '**Quick Create** — One-click shortcuts to each creator. The price is shown below each item.',
      '**Recent Creations** — Your latest 8 items with type badges. Click any item to open it. Click "View all" to go to your full library.',
    ],
  },

  // Creators
  {
    id: 'explainer-video',
    title: 'Creating an Explainer Video',
    category: 'creators',
    icon: '🎬',
    content: [
      'Explainer videos cost **$29** and take about 2-3 minutes to generate.',
      '**Step 1 — Content Input.** Choose how to provide your content:',
      '• **Upload PDF** — Drop a PDF document. AI extracts the key data automatically.',
      '• **Type or Paste** — Paste text, meeting notes, or bullet points directly.',
      '• **From URL** — Enter a webpage URL. AI scrapes and structures the content.',
      '• **AI Research** — Enter any topic. AI researches it with real data and statistics, then structures the findings for your video.',
      '• **Start from Idea** — Describe a topic, audience, and tone. AI generates the content from scratch.',
      '• **AI Proposal** (Pro/Agency only) — Chat with AI to build a complete proposal through an interview process.',
      '**Step 2 — Review.** Check the extracted data. Edit anything that\'s wrong before proceeding.',
      '**Step 3 — Style.** Pick a visual template. You can also use custom templates you\'ve created.',
      '**Step 4 — Preview.** AI generates all slides. Review each one — click "Redo" on any slide you don\'t like to regenerate just that slide.',
      '**Step 5 — Voice & Music.** Choose a narration voice (click to preview). Optionally select background music. Choose Standard (2-3 min) or Detailed (5-7 min) length.',
      '**Step 6 — Generate.** Click "Create my video." You can leave the page — your video will continue generating in the background.',
      'Once complete, you can download as MP4, PDF, or PPTX, share with clients, or refine with the AI editor.',
    ],
  },
  {
    id: 'course-builder',
    title: 'Course Builder (Multi-Episode Series)',
    category: 'creators',
    icon: '🎓',
    content: [
      'The Course Builder creates an entire multi-episode video series from a single topic. Find it under **Create > Course Builder** in the nav.',
      '**Step 1 — Describe Your Course.** Enter the course topic (e.g., "Complete Guide to Life Insurance Sales"), target audience, tone, and number of episodes (3-20).',
      '**Step 2 — Review Curriculum.** AI generates a full curriculum with episode titles, descriptions, and key points for each. You can:',
      '• Edit episode titles by clicking on them',
      '• Reorder episodes with the up/down arrows',
      '• Remove episodes with the X button',
      '• Regenerate the entire outline if you want a fresh take',
      '**Step 3 — Generate.** Click "Generate X Videos" to start batch creation. A full course is $249. Videos generate sequentially — you can leave the page and come back later.',
      'All episodes appear in your Library. Each is a standalone video you can share individually or as part of a series.',
    ],
  },
  {
    id: 'infographic',
    title: 'Creating an Infographic',
    category: 'creators',
    icon: '📊',
    content: [
      'Infographics cost **$19**.',
      '**Step 1 — Content.** Enter a title, paste content or key data points.',
      '**Step 2 — Dimensions.** Choose from presets: Standard (1080x1920), Square (1080x1080), Landscape (1920x1080), A4 Portrait, Letter, or enter custom dimensions (200-5000px).',
      '**Step 3 — Style.** Select a visual style.',
      'Click "Generate" and your infographic is created. Download as PNG.',
    ],
  },
  {
    id: 'flyer',
    title: 'Creating a Flyer',
    category: 'creators',
    icon: '📋',
    content: [
      'Flyers cost **$15** per size.',
      '**Step 1 — Content.** Enter your headline, body text, event date/time, and call-to-action.',
      '**Step 2 — Sizes.** Select one or more size presets: US Letter, A4, Square, Half Page, Instagram, or enter custom dimensions.',
      '**Step 3 — Style.** Choose a visual style.',
      'Click "Generate" to create your flyer. Download individual sizes or all at once.',
    ],
  },
  {
    id: 'business-card',
    title: 'Creating a Business Card',
    category: 'creators',
    icon: '💳',
    content: [
      'Business cards cost **$19** for a front + back pair.',
      '**Step 1 — Info.** Enter your name (required), job title, company, phone, email, website, address, and tagline.',
      '**Step 2 — Style & Print Options.** Choose a visual style. Select print size:',
      '• **Standard** — 3.5 x 2 inches (no bleeds)',
      '• **With Bleeds** — 3.625 x 2.125 inches (includes 1/16" bleed for professional printing)',
      'All cards are generated at **300 DPI** for high-quality printing.',
      '**Step 3 — Results.** Download front and back individually, or both together.',
    ],
  },
  {
    id: 'logo',
    title: 'Designing a Logo',
    category: 'creators',
    icon: '🎨',
    content: [
      'Logo design costs **$49** for 4 concepts. Refinements are **included**.',
      'The logo creator is a chat-based experience with Marcus, your AI logo designer.',
      '**The Process:**',
      '1. Marcus asks for your company name',
      '2. He asks about your industry and audience',
      '3. He asks about your brand personality',
      '4. He shares his creative direction and generates 4 concepts',
      '**Tips for best results:**',
      '• Paste reference images directly into the chat (Ctrl+V) or drag-and-drop them',
      '• Describe the vibe you want: "modern and minimal" or "bold and energetic"',
      '• Marcus chooses fonts, colors, and layout — trust his expertise',
      '• After generation, click any concept to select it, then describe changes to refine',
      '• Download your selected logo when satisfied',
    ],
  },
  {
    id: 'templates',
    title: 'Custom Templates',
    category: 'creators',
    icon: '🎯',
    content: [
      'Custom templates are a **$5 upgrade** when creating a video.',
      'Templates define the visual style for your video slides. Once created, they appear in the style picker when making videos.',
      '**Creating a Template:**',
      '1. Go to Create > Custom Template',
      '2. Describe the style you want (e.g., "modern corporate with large data callouts")',
      '3. Optionally upload a reference image for visual inspiration',
      '4. AI generates a preview slide in your style',
      '5. Refine if needed, then save',
      'Your custom templates appear at the top of the style picker in the video creation flow.',
    ],
  },

  // Management
  {
    id: 'library',
    title: 'Your Library',
    category: 'management',
    icon: '📁',
    content: [
      'The Library shows all your creations across all types (videos, infographics, flyers, cards, logos).',
      'Each item shows a thumbnail, title, type badge, and date created.',
      '• **Videos** link to the video detail page with player, editor, and share options',
      '• **Other types** (flyers, infographics, etc.) open the file directly',
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
      'Each project has a fixed price. Pro members get 40% off everything:',
      '• **Video Explainer** — $29',
      '• **Video (Detailed)** — $39',
      '• **Logo Design** (4 concepts) — $49',
      '• **Logo Refinement** — included',
      '• **Custom Template** — $5 upgrade',
      '• **Infographic** — $19',
      '• **Business Card** (front + back) — $19',
      '• **Flyer** — $15',
      '• **Social Media Kit** — $39',
      '• **Course** (up to 10 episodes) — $249',
      '• **Brand Kit** — $149',
      '• **AI Headshot** — $19',
      '• **Email Signature** — $9',
      '• **Image Remix** — $5',
      '**Pro Membership** — $25/month gives you 40% off all projects.',
    ],
  },
  {
    id: 'plans',
    title: 'Plans & Membership',
    category: 'billing',
    icon: '💰',
    content: [
      '**Free Account** — Pay per project at full price. No monthly fee.',
      '**Pro Membership ($25/mo)** — 40% off all projects. Cancel anytime.',
      'Manage your membership from **Settings > Subscription**.',
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
    id: 'share-video',
    title: 'Sharing Videos with Clients',
    category: 'sharing',
    icon: '🔗',
    content: [
      'Every completed video gets a public share page at docs2video.com/watch/[id].',
      '**Share Page Features:**',
      '• Video player with slide thumbnails',
      '• AI chatbot that knows the video content AND your company (from your website)',
      '• Quote section with accept & pay (if you\'ve attached a quote)',
      '• Calendly booking embed (if configured in Settings)',
      '• Download links (video, slides, PDF)',
      '**How to Share:**',
      '1. Open a completed video from your Library',
      '2. Click "Share with Client" to send via email',
      '3. Or click "Copy Link" to share the URL directly',
      'The share page includes your contact info and professional styling.',
    ],
  },
  {
    id: 'social-sharing',
    title: 'Sharing to Social Media',
    category: 'sharing',
    icon: '📱',
    content: [
      'Share your creations to social media directly from the platform.',
      '**How it works:**',
      '1. On any creation, click the "Share" button',
      '2. Choose a platform: Twitter, Facebook, LinkedIn, or Instagram',
      '3. We post on your behalf via AyrShare',
      'Your post includes a link back to Docs2Video and a brief message about your creation.',
    ],
  },
  {
    id: 'affiliates',
    title: 'Affiliate Program',
    category: 'sharing',
    icon: '🤝',
    content: [
      'Earn money and credits by referring others to Docs2Video.',
      '**How to Join:**',
      '1. Go to Settings > Subscription > Affiliate Program, or visit /affiliates',
      '2. Click "Join Affiliate Program"',
      '3. Copy your unique referral link',
      '**What You Earn:**',
      '• **20% commission** on their payments',
      '• Payouts processed monthly for balances over $50',
      'Track your clicks, signups, conversions, and earnings on the Affiliate Dashboard.',
    ],
  },
]

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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
          <p>Everything you need to know about Docs2Video.</p>
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
          {GUIDES.map(guide => (
            <Link
              key={guide.href}
              href={guide.href}
              style={{
                display: 'block',
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: 12,
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
        marginTop: 32, padding: '24px 28px', borderRadius: 12,
        background: 'rgba(168,240,212,0.1)', border: '1px solid var(--mint)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Still need help?</div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          Click the help button in the bottom-right corner to chat with our AI assistant. It knows everything about Docs2Video.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a href="mailto:support@docs2video.com" className="btn btn-soft">Email Support</a>
          <Link href="/settings" className="btn btn-soft">Settings</Link>
        </div>
      </div>
    </div>
  )
}
