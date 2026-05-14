import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '../../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../../_lib/supabase/admin'
import { isAdmin } from '../../../../../_lib/admin'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://docs2video.com'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) return null
  return user
}

function buildCampaignEmail(contact: { id: string; name: string; email: string }, campaign: { discount_code: string; discount_pct: number; discount_months: number }, thumbnailUrl: string | null): string {
  const watchUrl = `${BASE_URL}/m/${contact.id}`
  const unsubscribeUrl = `${BASE_URL}/unsubscribe/${contact.id}`
  const signupUrl = `${BASE_URL}/signup?email=${encodeURIComponent(contact.email)}&ref=${encodeURIComponent(campaign.discount_code)}`

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #ffffff;">
      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 24px; font-weight: 800; color: #1a1a1a; margin: 0;">Docs2Video</h1>
        <p style="font-size: 13px; color: #888; margin: 4px 0 0;">Turn documents into videos</p>
      </div>

      <!-- Greeting -->
      <h2 style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px;">Hi ${contact.name}, we made something for you</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 24px;">
        We created a personalized video showing how Docs2Video can help your business. It only takes 60 seconds to watch.
      </p>

      <!-- Video Thumbnail -->
      ${thumbnailUrl ? `
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${watchUrl}" style="display: block; position: relative; border-radius: 12px; overflow: hidden; border: 1px solid #e2e2e2;">
          <img src="${thumbnailUrl}" alt="Your personalized video" style="width: 100%; display: block;" />
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <div style="width: 0; height: 0; border-top: 12px solid transparent; border-bottom: 12px solid transparent; border-left: 20px solid #fff; margin-left: 4px;"></div>
          </div>
        </a>
      </div>
      ` : ''}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${watchUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px;">
          Watch Your Video
        </a>
      </div>

      <!-- Discount Code -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
        <p style="font-size: 13px; color: #166534; margin: 0 0 8px; font-weight: 600;">EXCLUSIVE OFFER</p>
        <p style="font-size: 20px; font-weight: 800; color: #1a1a1a; margin: 0 0 4px;">${campaign.discount_pct}% off for ${campaign.discount_months} months</p>
        <p style="font-size: 14px; color: #666; margin: 0 0 12px;">Use code:</p>
        <div style="display: inline-block; background: #fff; border: 2px dashed #4ade80; border-radius: 8px; padding: 10px 24px;">
          <span style="font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #1a1a1a;">${campaign.discount_code}</span>
        </div>
      </div>

      <!-- Sign Up Link -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="${signupUrl}" style="display: inline-block; background: #C7E8A8; color: #1a1a1a; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
          Start Free
        </a>
      </div>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
      <p style="font-size: 11px; color: #999; text-align: center;">
        Docs2Video &mdash; Turn any document into a professional video explainer.<br/>
        27675 Nelson Way, 225, Katy, TX 77494<br/>
        <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe from this campaign</a> |
        <a href="https://docs2video.com/privacy" style="color: #999;">Privacy Policy</a>
      </p>
    </div>
  `
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch campaign
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Fetch approved contacts that haven't been sent yet
  const { data: contacts } = await admin
    .from('campaign_contacts')
    .select('*, video:videos(thumbnail_url, slide_urls)')
    .eq('campaign_id', id)
    .eq('video_status', 'approved')
    .is('email_sent_at', null)

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No approved contacts ready to send' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const results: { contactId: string; status: string; error?: string }[] = []
  const now = new Date()
  const threedays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  for (const contact of contacts) {
    try {
      if (contact.unsubscribed) {
        results.push({ contactId: contact.id, status: 'skipped_unsubscribed' })
        continue
      }

      // Get thumbnail from video
      const video = contact.video as any
      const thumbnailUrl = video?.thumbnail_url || (video?.slide_urls?.[0]) || null

      const html = buildCampaignEmail(
        { id: contact.id, name: contact.name, email: contact.email },
        campaign,
        thumbnailUrl
      )

      await resend.emails.send({
        from: 'Docs2Video <notifications@docs2video.com>',
        to: contact.email,
        subject: `${contact.name}, we made a video just for you`,
        html,
      })

      // Update contact
      await admin.from('campaign_contacts').update({
        video_status: 'sent',
        email_sent_at: now.toISOString(),
        nurture_stage: 1,
        next_nurture_at: threedays.toISOString(),
      }).eq('id', contact.id)

      results.push({ contactId: contact.id, status: 'sent' })
    } catch (err) {
      console.error(`[campaign-send] Error sending to ${contact.email}:`, err)
      results.push({ contactId: contact.id, status: 'error', error: err instanceof Error ? err.message : 'Send failed' })
    }
  }

  // Mark campaign as active if it was draft
  if (campaign.status === 'draft') {
    await admin.from('campaigns').update({ status: 'active' }).eq('id', id)
  }

  return NextResponse.json({ sent: results.filter(r => r.status === 'sent').length, results })
}
