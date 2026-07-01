import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { requireAdmin } from '../../../../_lib/admin'
export const maxDuration = 300

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://docs2video.com'

function buildNurtureEmail(stage: number, contact: { id: string; name: string; email: string }, campaign: { discount_code: string; discount_pct: number; discount_months: number }): { subject: string; html: string } {
  const watchUrl = `${BASE_URL}/m/${contact.id}`
  const unsubscribeUrl = `${BASE_URL}/unsubscribe/${contact.id}`
  const signupUrl = `${BASE_URL}/signup?email=${encodeURIComponent(contact.email)}&ref=${encodeURIComponent(campaign.discount_code)}`

  if (stage === 1) {
    return {
      subject: `Did you get a chance to watch your video, ${contact.name}?`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #1a1a1a; margin: 0 0 16px;">Quick follow-up</h1>
          <p style="font-size: 15px; line-height: 1.6; color: #444;">
            Hi ${contact.name}, just checking in -- we sent you a personalized video a few days ago showing how Docs2Video could help your business.
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #444;">
            It's only 60 seconds long. Here's the link if you missed it:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${watchUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Watch Your Video
            </a>
          </div>
          <p style="font-size: 13px; color: #888; line-height: 1.6;">
            Your exclusive ${campaign.discount_pct}% discount with code <strong>${campaign.discount_code}</strong> is still available.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="font-size: 11px; color: #999; text-align: center;">
            Docs2Video<br/>
            <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a> |
            <a href="https://docs2video.com/privacy" style="color: #999;">Privacy</a>
          </p>
        </div>
      `,
    }
  }

  // Stage 2
  return {
    subject: `Your ${campaign.discount_pct}% discount is waiting, ${contact.name}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 20px; font-weight: 800; color: #1a1a1a; margin: 0 0 16px;">Your discount is still active</h1>
        <p style="font-size: 15px; line-height: 1.6; color: #444;">
          Hi ${contact.name}, this is a final reminder that your exclusive ${campaign.discount_pct}% discount for Docs2Video is still available.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <p style="font-size: 18px; font-weight: 800; color: #1a1a1a; margin: 0 0 8px;">${campaign.discount_pct}% off for ${campaign.discount_months} months</p>
          <div style="display: inline-block; background: #fff; border: 2px dashed #4ade80; border-radius: 8px; padding: 8px 20px;">
            <span style="font-size: 20px; font-weight: 800; letter-spacing: 2px;">${campaign.discount_code}</span>
          </div>
        </div>
        <p style="font-size: 15px; line-height: 1.6; color: #444;">
          Your first 2 videos are completely free -- cancel anytime. See what Docs2Video can do for your business.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${signupUrl}" style="display: inline-block; background: #C7E8A8; color: #1a1a1a; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
            Start Free
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="font-size: 11px; color: #999; text-align: center;">
          Docs2Video<br/>
          <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a> |
          <a href="https://docs2video.com/privacy" style="color: #999;">Privacy</a>
        </p>
      </div>
    `,
  }
}

export async function POST() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const now = new Date()

  // Find contacts due for nurture
  const { data: contacts } = await admin
    .from('campaign_contacts')
    .select('*, campaign:campaigns(*)')
    .lte('next_nurture_at', now.toISOString())
    .is('signed_up_at', null)
    .eq('unsubscribed', false)
    .lt('nurture_stage', 3)

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ message: 'No contacts due for nurture', processed: 0 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)
  let processed = 0

  for (const contact of contacts) {
    const campaign = contact.campaign as any
    if (!campaign) continue

    const stage = contact.nurture_stage
    if (stage >= 3) continue

    try {
      const { subject, html } = buildNurtureEmail(stage, contact, campaign)

      await resend.emails.send({
        from: 'Docs2Video <notifications@docs2video.com>',
        to: contact.email,
        subject,
        html,
      })

      const nextStage = stage + 1
      const nextNurture = nextStage < 3
        ? new Date(now.getTime() + (nextStage === 2 ? 2 : 0) * 24 * 60 * 60 * 1000) // Stage 2 sends 2 days later
        : null

      await admin.from('campaign_contacts').update({
        nurture_stage: nextStage,
        next_nurture_at: nextNurture?.toISOString() ?? null,
      }).eq('id', contact.id)

      processed++
    } catch (err) {
      console.error(`[nurture] Error for ${contact.email}:`, err)
    }
  }

  return NextResponse.json({ processed })
}
