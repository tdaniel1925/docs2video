import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/_lib/supabase/admin'
import { createClient } from '@/app/_lib/supabase/server'
import { isAdmin } from '@/app/_lib/admin'
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

// POST: Generate AI email copy for an industry
// or send emails if contacts are included
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const { action, industry, subIndustry, contacts, subject, emailBody, ctaUrl } = body as {
      action: 'generate' | 'send'
      industry: IndustryId
      subIndustry?: string
      contacts?: { email: string; name?: string; company?: string }[]
      subject?: string
      emailBody?: string
      ctaUrl?: string
    }

    const industryConfig = INDUSTRIES[industry]
    if (!industryConfig) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 })
    }

    // Action: Generate email copy
    if (action === 'generate') {
      const openai = getOpenAI()
      const verticalLabel = subIndustry || industryConfig.label

      const prompt = `You are a B2B SaaS email copywriter. Write a cold outreach email for Docs2Video — a platform that turns documents (PDFs, illustrations, reports) into professional narrated video explainers in under 2 minutes.

TARGET AUDIENCE: ${verticalLabel} professionals
INDUSTRY CONTEXT: ${industryConfig.tone}
TERMINOLOGY THEY USE: ${industryConfig.terminology.use.join(', ')}

The email should:
1. Open with a pain point specific to ${verticalLabel} professionals (they spend too much time explaining complex documents to clients)
2. Position Docs2Video as the solution (upload any document → AI creates a branded video explainer)
3. Mention the free trial (2 free videos, no credit card required)
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
          body: generated.body || `Hi {{name}},\n\nI noticed {{company}} works in ${verticalLabel}. We built Docs2Video to help professionals like you turn complex documents into clear, branded video explainers — in under 2 minutes.\n\nUpload a PDF, paste a URL, or describe what you need. Our AI handles the rest: script, visuals, narration, and branding.\n\nWant to try it? 2 free videos, no credit card required.\n\nBest,\nTrent`,
          ctaText: generated.ctaText || 'Try It Free',
        })
      } catch {
        return NextResponse.json({
          subject: `Turn your ${verticalLabel} documents into videos`,
          body: `Hi {{name}},\n\nI noticed {{company}} works in ${verticalLabel}. We built Docs2Video to help professionals like you turn complex documents into clear, branded video explainers — in under 2 minutes.\n\nUpload a PDF, paste a URL, or describe what you need. Our AI handles the rest: script, visuals, narration, and branding.\n\nWant to try it? 2 free videos, no credit card required.\n\nBest,\nTrent`,
          ctaText: 'Try It Free',
        })
      }
    }

    // Action: Send emails
    if (action === 'send') {
      if (!contacts?.length || !subject || !emailBody) {
        return NextResponse.json({ error: 'Missing contacts, subject, or body' }, { status: 400 })
      }
      if (contacts.length > 500) {
        return NextResponse.json({ error: 'Maximum 500 contacts per batch' }, { status: 400 })
      }

      const resend = new Resend(process.env.RESEND_API_KEY!)
      const landingPage = ctaUrl || `https://docs2video.com/industries/${industry === 'general' ? '' : industry}`
      const results = { sent: 0, failed: 0, errors: [] as { email: string; error: string }[] }

      for (const contact of contacts) {
        try {
          const vars: Record<string, string> = {
            name: contact.name || 'there',
            company: contact.company || 'your company',
          }

          const personalizedSubject = replacePlaceholders(subject, vars)
          const personalizedBody = replacePlaceholders(emailBody, vars)

          // Add tracking params to CTA URL
          const trackingUrl = new URL(landingPage)
          trackingUrl.searchParams.set('ref', 'campaign')
          trackingUrl.searchParams.set('industry', industry)
          if (contact.email) trackingUrl.searchParams.set('email', contact.email)

          const ctaButtonText = body.ctaText || 'Try It Free'
          const html = buildEmailHtml(personalizedBody, trackingUrl.toString(), ctaButtonText)

          const { error: sendError } = await resend.emails.send({
            from: 'Trent from Docs2Video <trent@docs2video.com>',
            to: contact.email,
            subject: personalizedSubject,
            html,
          })

          if (sendError) {
            results.failed++
            results.errors.push({ email: contact.email, error: sendError.message })
          } else {
            results.sent++
          }

          // Rate limit: 200ms between sends
          await new Promise(r => setTimeout(r, 200))
        } catch (err: any) {
          results.failed++
          results.errors.push({ email: contact.email, error: err?.message || 'Unknown error' })
        }
      }

      // Audit log
      const admin = createAdminClient()
      try {
        await admin.from('audit_log').insert({
          admin_id: user.id,
          action: 'campaign_send',
          details: { industry, subIndustry, total: contacts.length, sent: results.sent, failed: results.failed },
        })
      } catch {}

      return NextResponse.json(results)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('[campaign-send] Error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
