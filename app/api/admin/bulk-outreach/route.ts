import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/_lib/supabase/admin'
import { createClient } from '@/app/_lib/supabase/server'
import { Resend } from 'resend'

export const maxDuration = 300

function slugify(name: string): string {
  return (name || 'demo')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
  }
  return result
}

function buildEmailHtml(body: string, landingUrl: string, videoUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F1EC;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <tr><td>
      <div style="background:white;border-radius:10px;padding:32px 28px;border:1px solid #e5e2dc;">
        <div style="font-size:15px;line-height:1.7;color:#333;margin-bottom:24px;white-space:pre-line;">${body}</div>

        <a href="${landingUrl}" style="display:block;text-decoration:none;margin-bottom:24px;">
          <div style="position:relative;border-radius:10px;overflow:hidden;background:#1a1a1a;aspect-ratio:16/9;max-height:300px;">
            <div style="width:100%;height:100%;background:linear-gradient(135deg,#1B365D,#0A1628);display:flex;align-items:center;justify-content:center;min-height:200px;">
              <div style="text-align:center;">
                <div style="width:64px;height:64px;border-radius:50%;background:rgba(199,232,168,0.9);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
                  <span style="font-size:24px;margin-left:4px;">&#9654;</span>
                </div>
                <div style="color:white;font-size:14px;font-weight:600;">Click to watch your personalized demo</div>
              </div>
            </div>
          </div>
        </a>

        <div style="text-align:center;">
          <a href="${landingUrl}" style="display:inline-block;background:#1a1a1a;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Watch Your Demo &rarr;
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

export async function POST(req: NextRequest) {
  try {
    // Auth check — admin only
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { contacts, videoUrl, subjectTemplate, bodyTemplate } = body as {
      contacts: { email: string; name?: string; company?: string; url?: string }[]
      videoUrl: string
      subjectTemplate: string
      bodyTemplate: string
    }

    if (!contacts?.length || !subjectTemplate || !bodyTemplate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (contacts.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 contacts per batch' }, { status: 400 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY!)
    const results: { sent: number; failed: number; errors: { email: string; error: string }[] } = {
      sent: 0, failed: 0, errors: [],
    }

    for (const contact of contacts) {
      try {
        const companySlug = slugify(contact.company || '')
        const vars: Record<string, string> = {
          name: contact.name || '',
          company: contact.company || '',
          url: contact.url || '',
        }

        const subject = replacePlaceholders(subjectTemplate, vars)
        const bodyText = replacePlaceholders(bodyTemplate, vars)

        const landingParams = new URLSearchParams()
        landingParams.set('ref', 'outreach')
        landingParams.set('email', contact.email)
        if (contact.url) landingParams.set('url', contact.url)
        const landingUrl = `https://docs2video.com/try/${companySlug || 'demo'}?${landingParams.toString()}`

        const html = buildEmailHtml(bodyText, landingUrl, videoUrl)

        const { error: sendError } = await resend.emails.send({
          from: 'Docs2Video <noreply@docs2video.com>',
          to: contact.email,
          subject,
          html,
        })

        if (sendError) {
          results.failed++
          results.errors.push({ email: contact.email, error: sendError.message })
        } else {
          results.sent++
        }

        // Small delay between sends to avoid rate limits
        await new Promise(r => setTimeout(r, 200))
      } catch (err: any) {
        results.failed++
        results.errors.push({ email: contact.email, error: err?.message || 'Unknown error' })
      }
    }

    // Log the bulk send
    try {
      await admin.from('audit_log').insert({
        admin_id: user.id,
        action: 'bulk_outreach',
        details: { total: contacts.length, sent: results.sent, failed: results.failed },
      })
    } catch {}

    return NextResponse.json(results)
  } catch (err: any) {
    console.error('[bulk-outreach] Error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
