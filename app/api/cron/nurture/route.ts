import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { recordCronRun } from '../../../_lib/cron-heartbeat'
import { sendWithResend } from '../../../_lib/client-email'
import { unsubscribeUrl } from '../../../_lib/unsubscribe-token'
import { PLANS, SELLABLE_PLAN_TIERS } from '../../../_lib/pricing'

// Prices and credits in these emails come from pricing.ts so they can't drift.
// WELCOME50 is a live 50%-off-first-month code.
const usd = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
const FREE_PLAN = PLANS.find((p) => p.tier === 'free')!
const PRO_PLAN = PLANS.find((p) => p.tier === 'pro')!
const UPGRADE_PLAN_LINES = PLANS
  .filter((p) => (SELLABLE_PLAN_TIERS as readonly string[]).includes(p.tier))
  .map((p) => `  <li><strong>${p.label}</strong> &mdash; <s>${usd(p.monthlyPrice)}</s> <strong>${usd(p.monthlyPrice / 2)}</strong> first month, then ${usd(p.monthlyPrice)}/mo &mdash; ${p.monthlyCredits.toLocaleString('en-US')} credits</li>`)
  .join('\n')

export const runtime = 'nodejs'
export const maxDuration = 300

function nurtureMail(subject: string, heading: string, body: string, ctaText: string, ctaUrl: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;margin-top:20px;margin-bottom:20px;">
  <tr><td style="background:#1B3A5C;padding:24px 32px;">
    <h1 style="margin:0;font-size:20px;font-weight:800;color:white;">Docs2Video</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a1a;">${heading}</h2>
    <div style="font-size:15px;line-height:1.7;color:#444;">${body}</div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${ctaUrl}" style="display:inline-block;background:#3BB5C8;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
        ${ctaText}
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#fafafa;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#aaa;">
      Docs2Video &mdash; Turn any document into a professional video.<br/>
      <a href="https://docs2video.com/privacy" style="color:#aaa;">Privacy Policy</a> &bull;
      <a href="${unsubUrl}" style="color:#aaa;">Unsubscribe</a> &bull;
      <a href="https://docs2video.com" style="color:#aaa;">docs2video.com</a>
    </p>
  </td></tr>
</table>
</body>
</html>`
}

interface NurtureProfile {
  id: string
  email: string
  full_name: string | null
  is_admin: boolean
  subscription_status: string | null
  free_videos_remaining: number
  created_at: string
  nurture_sent: Record<string, string> | null
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Heartbeat: the health cron emails Trent if this stops running (audit 2026-10-09).
  await recordCronRun('nurture')

  const admin = createAdminClient()
  const now = new Date()
  let sentCount = 0
  const errors: string[] = []

  try {
    // Fetch all non-admin profiles
    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, email, full_name, is_admin, subscription_status, free_videos_remaining, created_at, nurture_sent')

    if (profilesErr || !profiles) {
      console.error('[cron/nurture] Failed to load profiles:', profilesErr)
      return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 })
    }

    // Filter out admins
    const eligible = (profiles as NurtureProfile[]).filter(p => !p.is_admin && p.email)

    // Fetch all videos grouped by user
    const { data: allVideos } = await admin
      .from('videos')
      .select('id, user_id, status, created_at, video_url')

    const videosByUser: Record<string, NonNullable<typeof allVideos>> = {}
    for (const v of (allVideos ?? [])) {
      if (!videosByUser[v.user_id]) videosByUser[v.user_id] = []
      videosByUser[v.user_id]!.push(v)
    }

    // Fetch sent_emails to check for shared videos
    const { data: sentEmails } = await admin
      .from('sent_emails')
      .select('user_id, video_id')

    const usersWhoShared = new Set((sentEmails ?? []).map(e => e.user_id))

    const PAID_STATUSES = ['active', 'pro', 'professional', 'starter', 'business', 'enterprise', 'enterprise-plus', 'enterprise_plus', 'agency']

    // First-run backlog protection: drip the queue, don't blast it.
    // A sudden burst from this domain would hurt sender reputation.
    const MAX_SENDS_PER_RUN = 50

    for (const profile of eligible) {
      if (sentCount >= MAX_SENDS_PER_RUN) break
      const nurtureSent: Record<string, string> = profile.nurture_sent ?? {}
      if (nurtureSent.unsubscribed) continue
      const userVideos = videosByUser[profile.id] ?? []
      const completedVideos = userVideos.filter(v => v.status === 'completed')
      const firstName = profile.full_name?.split(' ')[0] ?? ''
      const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
      const hoursSinceSignup = (now.getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60)
      const isPaid = PAID_STATUSES.includes((profile.subscription_status ?? '').toLowerCase())

      let emailKey: string | null = null
      let subject = ''
      let heading = ''
      let body = ''
      let ctaText = ''
      let ctaUrl = ''

      // (a) Signed up 48+ hours ago, never created a video
      if (
        hoursSinceSignup >= 48 &&
        userVideos.length === 0 &&
        !nurtureSent['getting_started']
      ) {
        emailKey = 'getting_started'
        subject = 'Your first video is just a click away'
        heading = 'Create your first video'
        body = `<p>${greeting}</p>
<p>Welcome to Docs2Video! You signed up but haven't created a video yet. It takes just a few steps:</p>
<ol style="color:#444;line-height:2;">
  <li>Paste a URL or upload a document</li>
  <li>Pick a visual style</li>
  <li>We generate your video automatically</li>
</ol>
<p>Your free credits cover your first videos.</p>`
        ctaText = 'Create Your First Video'
        ctaUrl = 'https://docs2video.com/create'
      }

      // (b) Created first video 24+ hours ago, never shared it
      else if (
        completedVideos.length > 0 &&
        !usersWhoShared.has(profile.id) &&
        !nurtureSent['how_to_share']
      ) {
        const firstCompleted = completedVideos.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        const hoursSinceFirst = (now.getTime() - new Date(firstCompleted.created_at).getTime()) / (1000 * 60 * 60)
        if (hoursSinceFirst >= 24) {
          emailKey = 'how_to_share'
          subject = 'Share your video with clients'
          heading = 'Your video is ready to share'
          body = `<p>${greeting}</p>
<p>You've created a great video &mdash; now let's get it in front of your clients! Here's how:</p>
<ul style="color:#444;line-height:2;">
  <li><strong>Copy the share link</strong> from your video page</li>
  <li><strong>Email it directly</strong> using our built-in email tools</li>
  <li><strong>Track views</strong> &mdash; you'll get notified when someone watches</li>
</ul>
<p>Every view is tracked so you know exactly when a client engages.</p>`
          ctaText = 'Go to Your Videos'
          ctaUrl = 'https://docs2video.com/videos'
        }
      }

      // (c) Free videos used up, no subscription
      else if (
        !isPaid &&
        profile.free_videos_remaining <= 0 &&
        completedVideos.length > 0 &&
        !nurtureSent['upgrade']
      ) {
        emailKey = 'upgrade'
        subject = `You've made ${completedVideos.length} video${completedVideos.length > 1 ? 's' : ''} — 50% off your first month`
        heading = 'Ready for more? Here’s 50% off month one.'
        body = `<p>${greeting}</p>
<p>You've created <strong>${completedVideos.length} video${completedVideos.length > 1 ? 's' : ''}</strong> on the free plan and used all your free credits. As a thank-you, take <strong>50% off your first month</strong> on any plan with code <strong>WELCOME50</strong>. Use the button below and pick a plan — if the discount doesn't show at checkout, type WELCOME50 into the promo code box:</p>
<ul style="color:#444;line-height:2;">
${UPGRADE_PLAN_LINES}
</ul>
<p>Every plan includes branded client share pages. Cancel anytime.</p>`
        ctaText = 'Claim 50% off — upgrade now'
        ctaUrl = 'https://docs2video.com/pricing?promo=WELCOME50'
      }

      // (d) Subscriber, no video created in 14+ days
      else if (
        isPaid &&
        !nurtureSent['re_engagement']
      ) {
        const latestVideo = userVideos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        const daysSinceLastVideo = latestVideo
          ? (now.getTime() - new Date(latestVideo.created_at).getTime()) / (1000 * 60 * 60 * 24)
          : 999
        if (daysSinceLastVideo >= 14) {
          emailKey = 're_engagement'
          subject = 'We miss you! New features inside'
          heading = 'Time to create your next video'
          body = `<p>${greeting}</p>
<p>It's been a while since your last video. Here are some ideas to get started again:</p>
<ul style="color:#444;line-height:2;">
  <li>Turn a client proposal into a video explainer</li>
  <li>Create a branded intro video from your website URL</li>
  <li>Build a presentation from any PDF or document</li>
</ul>
<p>Your subscription is active &mdash; make the most of it!</p>`
          ctaText = 'Create a New Video'
          ctaUrl = 'https://docs2video.com/create'
        }
      }

      // Send the email if one was selected
      if (emailKey) {
        try {
          const unsub = unsubscribeUrl({ k: 'user', id: profile.id })
          if (!unsub) throw new Error('No unsubscribe signing secret configured — not sending')
          const html = nurtureMail(subject, heading, body, ctaText, ctaUrl, unsub)
          // Resend reports failure as a returned value, not a throw — check it,
          // or a failed send gets marked "sent" and never retried.
          const res = await sendWithResend({
            from: 'Docs2Video <support@docs2video.com>',
            to: profile.email,
            subject,
            html,
          })
          if (!res.ok) throw new Error(res.error)

          // Mark as sent
          const updatedNurture = { ...nurtureSent, [emailKey]: now.toISOString() }
          await admin
            .from('profiles')
            .update({ nurture_sent: updatedNurture })
            .eq('id', profile.id)

          sentCount++
          console.log(`[cron/nurture] Sent "${emailKey}" to ${profile.email}`)
        } catch (sendErr) {
          const msg = sendErr instanceof Error ? sendErr.message : 'Unknown'
          errors.push(`${profile.email}: ${msg}`)
          console.error(`[cron/nurture] Failed to send "${emailKey}" to ${profile.email}:`, sendErr)
        }
      }
    }
  } catch (err) {
    console.error('[cron/nurture] Fatal error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // ── Lead nurture: people who ran a landing-page DEMO (gave an email in
  // demo_videos) but never created an account. Offer 50% off the first month to
  // sign up. Idempotent via demo_videos.nurture_sent; skip anyone who has since
  // registered (converted, or whose email already matches a profile).
  const LEAD_MAX_SENDS_PER_RUN = 50
  let leadsSent = 0
  try {
    const { data: leads } = await admin
      .from('demo_videos')
      .select('id, email, domain, created_at, nurture_sent, converted_at')
      .not('email', 'is', null)
      .is('converted_at', null)

    // Emails that already belong to a real account → never nurture as a "lead".
    const { data: allProfiles } = await admin.from('profiles').select('email')
    const knownEmails = new Set(
      (allProfiles ?? []).map((p: { email: string | null }) => (p.email || '').toLowerCase()).filter(Boolean)
    )
    // De-dupe leads by email (a person may have tried multiple demos). If ANY
    // of a person's demo rows says unsubscribed or already-emailed, that
    // person is done — not just the one row we happen to see first.
    const seenLead = new Set<string>()
    const doneEmails = new Set<string>()
    for (const l of (leads ?? [])) {
      const s: Record<string, string> = l.nurture_sent ?? {}
      if (s.unsubscribed || s.lead_signup) doneEmails.add((l.email || '').toLowerCase())
    }

    for (const lead of (leads ?? [])) {
      if (leadsSent >= LEAD_MAX_SENDS_PER_RUN) break
      const email = (lead.email || '').toLowerCase()
      if (!email || seenLead.has(email)) continue
      seenLead.add(email)
      if (knownEmails.has(email)) continue  // already has an account
      if (doneEmails.has(email)) continue
      const sent: Record<string, string> = lead.nurture_sent ?? {}

      // Wait ~24h after the demo so it doesn't feel instant/spammy.
      const hoursSince = (now.getTime() - new Date(lead.created_at).getTime()) / 3.6e6
      if (hoursSince < 24) continue

      const company = lead.domain ? lead.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : ''
      const subject = 'Your demo + 50% off your first month'
      const heading = 'Liked your demo? Make it yours.'
      const body = `<p>Hi there,</p>
<p>Thanks for trying Docs2Video${company ? ` for ${company}` : ''}! Create a free account and you can turn any document into a narrated video in a few minutes.</p>
<p>As a welcome, take <strong>50% off your first month</strong> on any plan with code <strong>WELCOME50</strong>. Once your account is set up, open <strong>Pricing</strong>, choose a plan, and enter WELCOME50 in the promo code box at checkout.</p>
<ul style="color:#444;line-height:2;">
  <li>Free account &mdash; ${FREE_PLAN.monthlyCredits.toLocaleString('en-US')} credits to start. You add a card to unlock them; nothing is charged until they run out.</li>
  <li><strong>${PRO_PLAN.label}</strong> &mdash; <s>${usd(PRO_PLAN.monthlyPrice)}</s> <strong>${usd(PRO_PLAN.monthlyPrice / 2)}</strong> first month, ${PRO_PLAN.monthlyCredits.toLocaleString('en-US')} credits</li>
</ul>`
      const ctaText = 'Create your account'
      const ctaUrl = 'https://docs2video.com/signup?promo=WELCOME50'

      try {
        const unsub = unsubscribeUrl({ k: 'lead', id: lead.id })
        if (!unsub) throw new Error('No unsubscribe signing secret configured — not sending')
        const html = nurtureMail(subject, heading, body, ctaText, ctaUrl, unsub)
        const res = await sendWithResend({ from: 'Docs2Video <support@docs2video.com>', to: email, subject, html })
        if (!res.ok) throw new Error(res.error)
        await admin.from('demo_videos').update({ nurture_sent: { ...sent, lead_signup: now.toISOString() } }).eq('id', lead.id)
        leadsSent++
        console.log(`[cron/nurture] Sent "lead_signup" to ${email}`)
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : 'Unknown'
        errors.push(`lead ${email}: ${msg}`)
        console.error(`[cron/nurture] Failed lead_signup to ${email}:`, sendErr)
      }
    }
  } catch (err) {
    console.error('[cron/nurture] Lead nurture pass failed (non-fatal):', err)
  }

  return NextResponse.json({
    message: 'Nurture cron complete',
    sent: sentCount,
    leadsSent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
