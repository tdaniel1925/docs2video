'use client'

import { useState } from 'react'
import Link from 'next/link'

interface AdminHelpSection {
  id: string
  title: string
  icon: string
  content: { heading: string; body: string[] }[]
}

const SECTIONS: AdminHelpSection[] = [
  {
    id: 'dashboard',
    title: 'Admin Dashboard',
    icon: '📊',
    content: [
      {
        heading: 'Understanding the Stats Cards',
        body: [
          'The admin dashboard shows key business metrics at the top of the page:',
          '**MRR (Monthly Recurring Revenue)** — Total monthly revenue from active subscriptions. This is pulled from Stripe and updates in real time.',
          '**Total Users** — Number of registered accounts. Includes free and paid users.',
          '**Total Videos** — All videos ever created across all users.',
          '**VPS Status** — Shows whether the Hetzner video assembly server is online and responding. Green means healthy, red means the server is down or unreachable.',
        ],
      },
      {
        heading: 'Daily Usage Trends',
        body: [
          'Below the stats cards, a chart shows daily activity over the past 30 days:',
          '**Videos created per day** — Helps identify usage patterns and growth trends.',
          '**New signups per day** — Track acquisition velocity.',
          'Use these trends to spot anomalies (sudden drops may indicate bugs) and validate the impact of marketing efforts.',
        ],
      },
      {
        heading: 'Revenue Tracking',
        body: [
          'Revenue data comes directly from Stripe. The dashboard shows:',
          '**Current MRR** — Sum of all active subscription amounts.',
          '**Revenue this month** — Total charges processed in the current calendar month, including one-time project charges and subscription fees.',
          'For detailed revenue breakdowns, invoices, and refund management, use the Stripe dashboard directly.',
        ],
      },
    ],
  },
  {
    id: 'users',
    title: 'User Management',
    icon: '👥',
    content: [
      {
        heading: 'Viewing User Details',
        body: [
          'Go to **Admin > Users** to see the full user list. Each row shows the user name, email, plan, number of videos created, and signup date.',
          'Click any user row to open their detail panel. From here you can see their full profile, subscription history, video list, and account flags.',
        ],
      },
      {
        heading: 'Changing Subscription Plans',
        body: [
          'From the user detail panel, find the **Subscription** section. You can:',
          '**Upgrade or downgrade** — Select a new plan from the dropdown and click Apply. The change takes effect immediately in the system and on their Stripe subscription.',
          '**Apply a coupon or discount** — Enter a percentage or fixed discount. This modifies their Stripe subscription price.',
          'Plan changes made here sync automatically with Stripe. The user sees the change on their next login.',
        ],
      },
      {
        heading: 'Adding or Resetting Credits',
        body: [
          'In the user detail panel, find the **Credits** section. You can:',
          '**Add credits** — Enter a number and click Add. Credits are added immediately to the user account. Useful for promotions, refunds-as-credits, or partner arrangements.',
          '**Reset credits** — Set credits to a specific number. This overwrites the current balance.',
          'Credit changes are logged in the audit trail with your admin username and a timestamp.',
        ],
      },
      {
        heading: 'Banning Users',
        body: [
          'To ban a user, click the **Ban** button in the user detail panel. You must enter a reason for the ban.',
          'Banned users cannot log in or access the platform. Their videos and data are preserved but inaccessible.',
          'To unban, click **Unban** on the same panel. The user regains immediate access.',
        ],
      },
      {
        heading: 'Toggling Admin and Beta Access',
        body: [
          'In the user detail panel, toggle switches control:',
          '**Admin Access** — Grants access to the /admin section. Use sparingly.',
          '**Beta Access** — Enables experimental features for this user. Useful for testing new functionality with select users before a full rollout.',
        ],
      },
    ],
  },
  {
    id: 'videos',
    title: 'Video Management',
    icon: '🎬',
    content: [
      {
        heading: 'Retrying Failed Videos',
        body: [
          'Videos can fail during generation due to AI service outages, VPS issues, or timeout errors.',
          'On the admin dashboard or in the user detail panel, failed videos show a red status badge. Click **Retry** to restart the generation process from scratch.',
          'If a video fails repeatedly, check the VPS status indicator and the server logs for errors.',
        ],
      },
      {
        heading: 'Per-Video Analytics',
        body: [
          'Each video tracks engagement metrics:',
          '**Views** — How many times the share page was loaded.',
          '**Plays** — How many times the video player was started.',
          '**Watch duration** — Average percentage of the video watched.',
          'These metrics are visible on the video detail page for both the user and the admin.',
        ],
      },
      {
        heading: 'Content Moderation',
        body: [
          'Admins can moderate video content:',
          '**Flag** — Mark a video for review. Flagged videos show a warning badge. Flagging does not remove the video but marks it for your attention.',
          '**Unflag** — Remove the flag after review.',
          '**Delete** — Permanently remove a video and all associated files (slides, audio, MP4). This cannot be undone. The user is not automatically notified.',
        ],
      },
    ],
  },
  {
    id: 'prospects',
    title: 'Prospects & Marketing',
    icon: '📈',
    content: [
      {
        heading: 'Auto-Demo Generator',
        body: [
          'The auto-demo tool creates demo videos for prospective clients without them needing to sign up.',
          '**How to use:** Go to Admin, paste one or more website URLs (one per line), and click Generate. The system scrapes each site, creates a branded demo video using the prospect company\'s colors, and prepares it for outreach.',
          'Each generated demo can be sent to the prospect via email with a personalized message and share page link.',
        ],
      },
      {
        heading: 'Nurture Email System',
        body: [
          'The nurture system sends automated emails to users based on behavior triggers. There are 4 trigger types:',
          '**Welcome** — Sent when a user signs up. Introduces the platform and encourages first video creation.',
          '**First Video** — Sent after a user creates their first video. Highlights sharing and download features.',
          '**Inactive** — Sent when a user has not created a video in 7+ days. Encourages return with tips.',
          '**Upgrade** — Sent when a free user hits their video limit. Presents plan options.',
          'Nurture emails are processed by a daily cron job that checks all users against trigger conditions.',
        ],
      },
      {
        heading: 'Weekly Report Emails',
        body: [
          'A weekly summary email is sent to the admin showing:',
          '**New signups** for the week, **videos created**, **revenue collected**, and **top-performing videos** by view count.',
          'This runs automatically every Monday morning.',
        ],
      },
      {
        heading: 'Referral Automation',
        body: [
          'The affiliate/referral system tracks signups from referral links. When a referred user makes a purchase, the referrer earns 20% commission.',
          'As an admin, you can view all referrers and their earnings, adjust commission rates, and process payouts from the admin panel.',
        ],
      },
      {
        heading: 'Lead Capture from Share Pages',
        body: [
          'When a non-user views a share page, they may interact with the AI chatbot or click contact buttons. These interactions are captured as leads.',
          'Leads appear in the admin panel with the viewer\'s engagement data: which video they watched, how long they watched, and whether they interacted with the chatbot.',
        ],
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Stripe',
    icon: '💳',
    content: [
      {
        heading: 'Stripe Integration',
        body: [
          'All payments flow through Stripe. The integration handles:',
          '**Subscriptions** — Monthly plans (Starter, Pro, Business, Enterprise) are managed as Stripe subscriptions with automatic renewal.',
          '**One-time charges** — Pay-per-video and additional video charges are processed as individual Stripe charges.',
          '**Webhooks** — Stripe webhooks update user plan status, handle failed payments, and sync subscription changes automatically.',
        ],
      },
      {
        heading: 'Viewing Revenue Data',
        body: [
          'The admin dashboard shows current MRR and monthly revenue. For deeper analysis:',
          '**Stripe Dashboard** — Use the Stripe dashboard for detailed revenue charts, cohort analysis, churn metrics, and invoice management.',
          '**User-level revenue** — In the user detail panel, see total lifetime revenue from each user and their payment history.',
        ],
      },
      {
        heading: 'Subscription Management',
        body: [
          'You can manage any user\'s subscription from the admin panel:',
          '**Change plan** — Upgrade or downgrade a user\'s plan. Changes sync to Stripe immediately.',
          '**Cancel** — Cancel a user\'s subscription. They keep access until the end of their billing period.',
          '**Comp a plan** — Grant a free subscription to a user (for partners, influencers, or support cases). The user gets full plan features without being charged.',
        ],
      },
    ],
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    icon: '📧',
    content: [
      {
        heading: 'Creating a Campaign',
        body: [
          'Go to **Admin > Campaigns** and click **New Campaign**.',
          'Enter a campaign name, subject line, and email body. The email editor supports rich text, images, and merge tags (like {first_name}).',
          'Save the campaign as a draft to edit later, or proceed to send immediately.',
        ],
      },
      {
        heading: 'Managing Contacts',
        body: [
          'Each campaign targets a contact list. You can:',
          '**Import contacts** — Upload a CSV with email, name, and optional custom fields.',
          '**Use existing users** — Filter your user base by plan, signup date, or activity level and add them to a campaign.',
          '**Manual add** — Add individual email addresses one at a time.',
        ],
      },
      {
        heading: 'Sending Campaign Emails',
        body: [
          'When your campaign is ready, click **Send**. Emails are sent in batches to avoid rate limits.',
          'You can schedule a send for a future date and time instead of sending immediately.',
          'During sending, the campaign status updates in real time showing how many emails have been delivered.',
        ],
      },
      {
        heading: 'Tracking Engagement',
        body: [
          'After sending, the campaign detail page shows:',
          '**Delivered** — Number of emails successfully delivered.',
          '**Opened** — How many recipients opened the email (tracked via pixel).',
          '**Clicked** — How many clicked a link in the email.',
          '**Bounced** — Emails that failed to deliver.',
          'Click on any metric to see the list of individual recipients in that category.',
        ],
      },
    ],
  },
  {
    id: 'audit',
    title: 'Audit Log',
    icon: '📋',
    content: [
      {
        heading: 'What Actions Are Logged',
        body: [
          'The audit log records all significant actions across the platform:',
          '**User actions** — Signups, logins, plan changes, video creation, video deletion.',
          '**Admin actions** — Plan changes, credit adjustments, user bans/unbans, video moderation (flag/unflag/delete).',
          '**System events** — Failed video generations, webhook errors, cron job completions.',
          'Each log entry includes a timestamp, the actor (user or admin), the action type, and details.',
        ],
      },
      {
        heading: 'Filtering and Searching',
        body: [
          'The audit log page provides filters to narrow down entries:',
          '**Date range** — Select a start and end date to view logs within a specific period.',
          '**Search** — Type a keyword to filter by action type, user email, or details. For example, search "ban" to find all ban actions.',
          '**Action type** — Filter by category (user actions, admin actions, system events).',
          'Filters can be combined. For example, filter by date range AND search for a specific user email.',
        ],
      },
      {
        heading: 'Exporting CSV',
        body: [
          'Click **Export CSV** to download the current filtered view as a CSV file.',
          'The export includes all columns: timestamp, actor, action type, target, and details.',
          'Useful for compliance reporting, quarterly reviews, or sharing audit data with stakeholders.',
        ],
      },
    ],
  },
]

export default function AdminHelpPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>Admin Help</h1>
          <p>Everything you need to manage the Docs2Video platform.</p>
        </div>
      </div>

      {/* Section cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SECTIONS.map(section => {
          const isExpanded = expandedSection === section.id
          return (
            <div
              key={section.id}
              style={{
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
            >
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                style={{
                  width: '100%',
                  padding: '20px 24px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{section.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>
                    {section.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {section.content.length} {section.content.length === 1 ? 'topic' : 'topics'}
                  </div>
                </div>
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2"
                  style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isExpanded && (
                <div style={{ padding: '0 24px 24px' }}>
                  {section.content.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'var(--bg-soft, #FAFAF8)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 10,
                        padding: '20px 24px',
                        marginTop: i === 0 ? 0 : 12,
                      }}
                    >
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
                        {item.heading}
                      </h3>
                      <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
                        {item.body.map((paragraph, j) => (
                          <p key={j} style={{ margin: '6px 0' }} dangerouslySetInnerHTML={{
                            __html: paragraph
                              .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--ink)">$1</strong>')
                              .replace(/^• /gm, '<span style="color:var(--mint-darker,#2d7a4f)">&#8226;</span> ')
                          }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Link to user help */}
      <div style={{
        marginTop: 32, padding: '24px 28px', borderRadius: 10,
        background: 'rgba(168,240,212,0.1)', border: '1px solid var(--mint)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Looking for user-facing help?</div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 12px' }}>
          The Help Center covers creating videos, sharing, downloads, brands, and account management.
        </p>
        <Link href="/help" className="btn btn-soft">
          Go to Help Center
        </Link>
      </div>
    </div>
  )
}
