import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { escapeHtml, sendWithResend } from '../../_lib/client-email'
export const maxDuration = 30

// 1x1 transparent PNG pixel
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64')

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    const admin = createAdminClient()
    // Stamp the FIRST open only — and learn whether this call was that first
    // open (the update returns rows only when it actually changed one).
    //
    // Select only columns the table has always had. This used to ask for
    // `recipient` (never a column) — which made the WHOLE update fail, so no
    // open was ever recorded. The address lives in to_email.
    const { data: opened, error } = await admin
      .from('sent_emails')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', id)
      .is('opened_at', null)
      .select('id, user_id, video_id, to_email')
    if (error) console.error('[email-track] could not stamp open:', error.message)

    // FIRST OPEN of an email about a video → tell the sender. This is the "I
    // want to be notified when the email is opened" half of the Sent → Opened
    // → Watched trail. Fire-and-forget: a notify failure must never break the
    // pixel. Automatic follow-up reminders don't trigger this — only emails
    // the agent sent themselves.
    const row = opened?.[0]
    if (row && row.video_id) {
      try {
        // email_type arrives with migration 20260926. Missing column → treat as
        // a share (the only kind that existed before).
        const { data: typed, error: typeErr } = await admin.from('sent_emails').select('email_type').eq('id', row.id).maybeSingle()
        const type = typeErr ? null : (typed?.email_type ?? null)
        const isShare = type === null || type === 'share'
        if (isShare) {
          const [{ data: profile }, { data: video }] = await Promise.all([
            admin.from('profiles').select('email, full_name').eq('id', row.user_id).single(),
            admin.from('videos').select('title').eq('id', row.video_id).single(),
          ])
          if (profile?.email) {
            const who = escapeHtml(row.to_email ?? 'Your client')
            const title = video?.title ? escapeHtml(video.title) : ''
            const res = await sendWithResend({
              from: 'Docs2Video <notifications@docs2video.com>',
              to: profile.email,
              subject: `${row.to_email ?? 'Your client'} opened your email${video?.title ? ` about "${video.title}"` : ''}`,
              html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;color:#1a1a1a;">
  <h2 style="font-size:18px;margin:0 0 10px;">📬 Your email was opened</h2>
  <p style="font-size:14px;line-height:1.6;margin:0 0 6px;"><strong>${who}</strong> just opened the email${title ? ` about &ldquo;${title}&rdquo;` : ''}.</p>
  <p style="font-size:13px;color:#555;line-height:1.6;margin:0;">You&rsquo;ll get another note if they watch the video. Opened doesn&rsquo;t always mean read — but it means it arrived.</p>
</div>`,
            })
            if (!res.ok) console.error('[email-track] open-notify not accepted:', res.error)
          }
        }
      } catch (e) {
        console.error('[email-track] open-notify failed (pixel still served):', e)
      }
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
