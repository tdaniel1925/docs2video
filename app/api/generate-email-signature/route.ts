import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { CREDIT_COSTS } from '../../_lib/credits'
import { runCharged } from '../../_lib/credit-charge'
import {
  esc, safeUrl, SIGNATURE_GENERATORS as GENERATORS, SIGNATURE_STYLE_LABELS as STYLE_LABELS,
  ALL_SIGNATURE_STYLES as ALL_STYLES, type SignatureInput,
} from '../../_lib/email-signature'

export const runtime = 'nodejs'
export const maxDuration = 300

// The five signature styles live in app/_lib/email-signature.ts so the overflow
// check (scripts/graphics-overflow-check.mjs) can build and measure them.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { fullName, title, company, email, phone, logoUrl, photoUrl, primaryColor } = body as SignatureInput
  // Drop any non-http(s)/mailto scheme up front (e.g. javascript:) so no
  // generator can emit it as a live href.
  const website = safeUrl((body as SignatureInput).website)

  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const COST = CREDIT_COSTS['email-signature']

  // Charge BEFORE the work (this used to deduct 1 credit afterwards and
  // ignore a failed deduction) and refund if anything fails (audit H5).
  return runCharged({ userId: user.id, amount: COST, action: 'email-signature' }, async () => {
  try {
    const signatures: { style: string; html: string; previewUrl: string }[] = []

    for (const style of ALL_STYLES) {
      const input: SignatureInput = { fullName, title, company, email, phone, website, logoUrl, photoUrl, primaryColor, style }
      const html = GENERATORS[style](input)

      // Wrap in a full HTML document for preview
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fullName)} - ${STYLE_LABELS[style]} Email Signature</title></head><body style="margin:20px;font-family:Arial,sans-serif;">${html}</body></html>`

      // Upload to Supabase storage
      const fileName = `${user.id}/email-signatures/${Date.now()}-${style}.html`
      const { error: uploadError } = await admin.storage
        .from('infographics')
        .upload(fileName, Buffer.from(fullHtml, 'utf-8'), {
          contentType: 'text/html',
          upsert: true,
        })

      if (uploadError) {
        console.error(`[email-signature] Upload error for ${style}:`, uploadError)
        throw uploadError
      }

      const { data: urlData } = admin.storage.from('infographics').getPublicUrl(fileName)

      signatures.push({
        style: STYLE_LABELS[style],
        html,
        previewUrl: urlData.publicUrl,
      })
    }

    // Log to creations table
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'email-signature',
      title: `Email Signature: ${fullName}`,
      file_url: signatures[0].previewUrl,
      credits_used: COST,
    })

    return NextResponse.json({ signatures })
  } catch (err: any) {
    console.error('[email-signature] Error:', err)
    return NextResponse.json({ error: 'Failed to generate signatures. Your credits were returned — please try again.' }, { status: 500 })
  }
  })
}
