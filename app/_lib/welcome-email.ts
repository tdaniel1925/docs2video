import type { User } from '@supabase/supabase-js'
import { createAdminClient } from './supabase/admin'

/**
 * Welcome email — sent once, and only to a CONFIRMED address. It used to go
 * out at sign-up, before the person had proven the inbox was theirs, so a
 * typo'd or someone-else's address got our mail.
 *
 * "Sent once" is recorded on the auth user's app_metadata (only the server
 * can write it), so the confirmation link and the login callback can both
 * call this safely.
 */
export async function sendWelcomeEmailOnce(user: User): Promise<void> {
  if (!user.email || !user.email_confirmed_at) return
  if ((user.app_metadata as Record<string, unknown> | undefined)?.welcome_email_sent) return
  if (!process.env.RESEND_API_KEY) return
  // Only brand-new accounts that JUST confirmed. Accounts from before this
  // change have no "sent" mark, and must not get a welcome on their next login.
  const DAY = 24 * 60 * 60 * 1000
  const confirmedAgo = Date.now() - new Date(user.email_confirmed_at).getTime()
  const createdAgo = Date.now() - new Date(user.created_at).getTime()
  if (!(confirmedAgo < DAY) || !(createdAgo < 7 * DAY)) return

  const admin = createAdminClient()
  // Mark first so two near-simultaneous callbacks can't both send.
  const { error: markErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata || {}), welcome_email_sent: true },
  })
  if (markErr) {
    console.error('[welcome-email] could not mark as sent:', markErr.message)
    return
  }

  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
  const firstName = escapeHtml(fullName.split(' ')[0] || 'there')
  await sendWelcomeEmail(user.email, firstName)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function sendWelcomeEmail(email: string, firstName: string): Promise<void> {
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Docs2Video <support@docs2video.com>',
    to: email,
    subject: 'Welcome to Docs2Video — your first video is 3 steps away',
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;">
  <tr><td style="background:#1B3A5C;padding:24px 32px;"><h1 style="margin:0;font-size:20px;font-weight:800;color:#fff;">Docs2Video</h1></td></tr>
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a1a;">Welcome, ${firstName}!</h2>
    <p style="font-size:15px;line-height:1.7;color:#444;">You're set up to turn any document, website, or idea into a personalized client video. Here's all it takes:</p>
    <ol style="font-size:15px;line-height:2;color:#444;">
      <li><strong>Pick who it's for</strong> — choose a client or skip for a general video</li>
      <li><strong>Add your content</strong> — paste a URL, upload a file, or describe it</li>
      <li><strong>Generate</strong> — we write the script, design the slides, and narrate it</li>
    </ol>
    <p style="font-size:15px;line-height:1.7;color:#444;">Your free credits cover your first videos. Most videos are ready in a few minutes.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://docs2video.com/create/client" style="display:inline-block;background:#3BB5C8;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Create your first video</a>
    </div>
    <p style="font-size:13px;color:#888;line-height:1.6;">Questions? Just reply to this email.</p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:16px 32px;text-align:center;"><p style="margin:0;font-size:11px;color:#aaa;">Docs2Video &mdash; Turn any document into a professional video.<br/><a href="https://docs2video.com/help" style="color:#aaa;">Help Center</a></p></td></tr>
</table>
</body></html>`,
  })
  if (error) console.error('[welcome-email] send failed:', error.message)
}
