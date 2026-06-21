import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/_lib/supabase/admin'
import { createClient } from '@/app/_lib/supabase/server'
import { isAdmin , isAdminRequest } from '@/app/_lib/admin'
import { logAdminAction } from '@/app/_lib/audit'
import { INDUSTRIES, type IndustryId } from '@/app/_lib/industries'
import { Resend } from 'resend'
import OpenAI from 'openai'

export const maxDuration = 300

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
  }
  return result
}

function buildEmailHtml(body: string, ctaUrl: string, ctaText: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F1EC;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <tr><td>
      <div style="background:white;border-radius:10px;padding:32px 28px;border:1px solid #e5e2dc;">
        <div style="font-size:15px;line-height:1.7;color:#333;margin-bottom:24px;white-space:pre-line;">${body}</div>
        <div style="text-align:center;margin-top:24px;">
          <a href="${ctaUrl}" style="display:inline-block;background:#1a1a1a;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            ${ctaText} &rarr;
          </a>
        </div>
      </div>
      <div style="text-align:center;padding:24px 0 0;font-size:12px;color:#999;">
        <a href="https://docs2video.com" style="color:#999;text-decoration:none;">Docs2Video</a> — Turn documents into videos, automatically.
      </div>
    </td></tr>
  </table>
</body>
</html>`
}

async function checkAdmin(req?: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) return null
  return user
}

// GET: List campaigns with stats
export async function GET() {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('*')
    .eq('campaign_type', 'email')
    .order('created_at', { ascending: false })
    .limit(50)

  // Get contact counts per campaign
  const enriched = await Promise.all((campaigns ?? []).map(async (c) => {
    const { count: pending } = await admin.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id).eq('send_status', 'pending')
    const { count: sent } = await admin.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id).eq('send_status', 'sent')
    const { count: failed } = await admin.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id).eq('send_status', 'failed')
    return { ...c, stats: { pending: pending ?? 0, sent: sent ?? 0, failed: failed ?? 0 } }
  }))

  return NextResponse.json({ campaigns: enriched })
}

// POST: Create campaign, generate copy, send, pause, resume, stop
export async function POST(req: NextRequest) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json()
  const { action } = body as { action: string }
  const admin = createAdminClient()

  // Generate AI email copy
  if (action === 'generate') {
    const { industry, subIndustry } = body as { industry: IndustryId; subIndustry?: string }
    const industryConfig = INDUSTRIES[industry]
    if (!industryConfig) return NextResponse.json({ error: 'Invalid industry' }, { status: 400 })

    const openai = getOpenAI()
    const verticalLabel = subIndustry || industryConfig.label

    const prompt = `You are a B2B SaaS email copywriter. Write a cold outreach email for Docs2Video — a platform that turns documents (PDFs, illustrations, reports) into professional narrated video explainers in under 2 minutes.

TARGET AUDIENCE: ${verticalLabel} professionals
INDUSTRY CONTEXT: ${industryConfig.tone}
TERMINOLOGY THEY USE: ${industryConfig.terminology.use.join(', ')}

The email should:
1. Open with a pain point specific to ${verticalLabel} professionals (they spend too much time explaining complex documents to clients)
2. Position Docs2Video as the solution (upload any document → AI creates a branded video explainer)
3. Mention the free trial (2 free videos, 2 free short videos included)
4. Be concise (under 150 words for the body)
5. Sound human, not salesy — like a founder reaching out personally
6. Use {{name}} for their first name and {{company}} for their company name

Return ONLY valid JSON (no markdown fences):
{
  "subject": "email subject line (under 60 chars, use {{company}} if natural)",
  "body": "the email body text with {{name}} and {{company}} placeholders",
  "ctaText": "button text (5 words max)"
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    try {
      const generated = JSON.parse(cleaned)
      return NextResponse.json({
        subject: generated.subject || `Turn your ${verticalLabel} documents into videos`,
        body: generated.body || `Hi {{name}},\n\nWe built Docs2Video to help ${verticalLabel} professionals turn complex documents into clear, branded video explainers — in under 2 minutes.\n\nWant to try it? 2 free videos, 2 free short videos included.\n\nBest,\nTrent`,
        ctaText: generated.ctaText || 'Try It Free',
      })
    } catch {
      return NextResponse.json({
        subject: `Turn your ${verticalLabel} documents into videos`,
        body: `Hi {{name}},\n\nWe built Docs2Video to help ${verticalLabel} professionals turn complex documents into clear, branded video explainers — in under 2 minutes.\n\nWant to try it? 2 free videos, 2 free short videos included.\n\nBest,\nTrent`,
        ctaText: 'Try It Free',
      })
    }
  }

  // Create a campaign (save to DB with contacts)
  if (action === 'create') {
    const { name, industry, subIndustry, subject, emailBody, ctaText, ctaUrl, contacts } = body as {
      name: string; industry: string; subIndustry?: string
      subject: string; emailBody: string; ctaText?: string; ctaUrl?: string
      contacts: { email: string; name?: string; company?: string }[]
    }

    if (!contacts?.length || !subject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Deduplicate contacts by email
    const seen = new Set<string>()
    const uniqueContacts = contacts.filter(c => {
      const e = c.email.toLowerCase()
      if (seen.has(e) || !e.includes('@')) return false
      seen.add(e)
      return true
    })

    const { data: campaign, error: createErr } = await admin.from('campaigns').insert({
      user_id: user.id,
      name: name || `${industry} Campaign — ${new Date().toLocaleDateString()}`,
      campaign_type: 'email',
      industry,
      sub_industry: subIndustry || null,
      subject_template: subject,
      body_template: emailBody,
      cta_text: ctaText || 'Try It Free',
      cta_url: ctaUrl || null,
      status: 'draft',
      total_contacts: uniqueContacts.length,
      discount_code: `campaign-${Date.now()}`,
    }).select('id').single()

    if (createErr || !campaign) {
      return NextResponse.json({ error: createErr?.message || 'Failed to create campaign' }, { status: 500 })
    }

    // Insert contacts in batches
    const batchSize = 100
    for (let i = 0; i < uniqueContacts.length; i += batchSize) {
      const batch = uniqueContacts.slice(i, i + batchSize).map(c => ({
        campaign_id: campaign.id,
        email: c.email.toLowerCase(),
        name: c.name || '',
        company: c.company || '',
        send_status: 'pending',
      }))
      await admin.from('campaign_contacts').insert(batch)
    }

    return NextResponse.json({ campaignId: campaign.id, totalContacts: uniqueContacts.length })
  }

  // Start or resume sending
  if (action === 'send' || action === 'resume') {
    const { campaignId } = body as { campaignId: string }
    if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 })

    // Get campaign
    const { data: campaign } = await admin.from('campaigns').select('*').eq('id', campaignId).single()
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      return NextResponse.json({ error: `Campaign is ${campaign.status}` }, { status: 400 })
    }

    // Mark as sending
    await admin.from('campaigns').update({
      status: 'sending',
      started_at: campaign.started_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId)

    // Get pending contacts
    const { data: pendingContacts } = await admin
      .from('campaign_contacts')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('send_status', 'pending')
      .order('created_at')
      .limit(500)

    if (!pendingContacts?.length) {
      await admin.from('campaigns').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', campaignId)
      return NextResponse.json({ message: 'No pending contacts — campaign complete', sent: 0, failed: 0 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY!)
    const landingPage = campaign.cta_url || `https://docs2video.com/industries/${campaign.industry === 'general' ? '' : campaign.industry}`
    let sent = 0
    let failed = 0

    for (const contact of pendingContacts) {
      // Check if paused/cancelled mid-send
      const { data: freshCampaign } = await admin.from('campaigns').select('status').eq('id', campaignId).single()
      if (freshCampaign?.status === 'paused' || freshCampaign?.status === 'cancelled') {
        break
      }

      try {
        const vars = { name: contact.name || 'there', company: contact.company || 'your company' }
        const personalizedSubject = replacePlaceholders(campaign.subject_template, vars)
        const personalizedBody = replacePlaceholders(campaign.body_template, vars)

        const trackingUrl = new URL(landingPage)
        trackingUrl.searchParams.set('ref', 'campaign')
        trackingUrl.searchParams.set('cid', campaignId)
        trackingUrl.searchParams.set('industry', campaign.industry || '')
        if (contact.email) trackingUrl.searchParams.set('email', contact.email)

        const html = buildEmailHtml(personalizedBody, trackingUrl.toString(), campaign.cta_text || 'Try It Free')

        const { error: sendError } = await resend.emails.send({
          from: 'Trent from Docs2Video <trent@docs2video.com>',
          to: contact.email,
          subject: personalizedSubject,
          html,
        })

        if (sendError) {
          failed++
          await admin.from('campaign_contacts').update({
            send_status: 'failed',
            error_message: sendError.message,
          }).eq('id', contact.id)
        } else {
          sent++
          await admin.from('campaign_contacts').update({
            send_status: 'sent',
            email_sent_at: new Date().toISOString(),
          }).eq('id', contact.id)
        }

        // Update campaign running totals
        await admin.from('campaigns').update({
          sent_count: (campaign.sent_count || 0) + sent,
          failed_count: (campaign.failed_count || 0) + failed,
          updated_at: new Date().toISOString(),
        }).eq('id', campaignId)

        // Rate limit
        await new Promise(r => setTimeout(r, 200))
      } catch (err: any) {
        failed++
        await admin.from('campaign_contacts').update({
          send_status: 'failed',
          error_message: err?.message || 'Unknown error',
        }).eq('id', contact.id)
      }
    }

    // Check if all done
    const { count: remaining } = await admin.from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('send_status', 'pending')

    const finalStatus = (remaining ?? 0) === 0 ? 'completed' : 'paused'
    await admin.from('campaigns').update({
      status: finalStatus,
      sent_count: (campaign.sent_count || 0) + sent,
      failed_count: (campaign.failed_count || 0) + failed,
      completed_at: finalStatus === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId)

    // Audit log — use logAdminAction so it lands in admin_audit_log (the table
    // the Audit Log tab reads). Was writing to a stray 'audit_log' table.
    try {
      await logAdminAction(user.id, 'campaign_send', undefined, {
        campaignId, industry: campaign.industry, sent, failed, remaining: remaining ?? 0,
      })
    } catch {}

    return NextResponse.json({ sent, failed, remaining: remaining ?? 0, status: finalStatus })
  }

  // Pause campaign
  if (action === 'pause') {
    const { campaignId } = body as { campaignId: string }
    await admin.from('campaigns').update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId)
    return NextResponse.json({ success: true, status: 'paused' })
  }

  // Cancel campaign (skip all remaining)
  if (action === 'cancel') {
    const { campaignId } = body as { campaignId: string }
    await admin.from('campaign_contacts').update({ send_status: 'skipped' })
      .eq('campaign_id', campaignId).eq('send_status', 'pending')
    await admin.from('campaigns').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId)
    return NextResponse.json({ success: true, status: 'cancelled' })
  }

  // Get campaign details with contacts
  if (action === 'details') {
    const { campaignId } = body as { campaignId: string }
    const { data: campaign } = await admin.from('campaigns').select('*').eq('id', campaignId).single()
    const { data: contacts } = await admin.from('campaign_contacts')
      .select('*').eq('campaign_id', campaignId).order('created_at').limit(200)
    return NextResponse.json({ campaign, contacts })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
