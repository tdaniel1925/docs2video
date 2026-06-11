import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { verifyCronAuth } from '../../../_lib/cron-auth'
import { Resend } from 'resend'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Cron endpoint: sends referral prompt emails to users who have
 * created 3+ completed videos and haven't been prompted yet.
 *
 * Called daily at 15:00 UTC via Vercel Cron.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  let sentCount = 0
  const errors: string[] = []

  try {
    // Find users with 3+ completed videos who are not admins
    // and haven't been sent a referral prompt yet
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, referral_code, is_admin, referral_prompt_sent, nurture_sent')
      .eq('is_admin', false)
      .or('referral_prompt_sent.is.null,referral_prompt_sent.eq.false')

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: 'No eligible users', sentCount: 0 })
    }

    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

    // Backlog protection: drip the queue, honor opt-outs
    const MAX_SENDS_PER_RUN = 25

    for (const profile of profiles) {
      if (sentCount >= MAX_SENDS_PER_RUN) break
      if ((profile as any).nurture_sent?.unsubscribed) continue
      try {
        // Count completed videos for this user
        const { count } = await supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'completed')

        if (!count || count < 3) continue

        // Generate referral code if none exists
        let referralCode = profile.referral_code
        if (!referralCode) {
          referralCode = crypto.randomBytes(4).toString('hex')
          await supabase
            .from('profiles')
            .update({ referral_code: referralCode })
            .eq('id', profile.id)
        }

        const referralLink = `https://docs2video.com/signup?ref=${referralCode}`
        const firstName = profile.full_name?.split(' ')[0] ?? 'there'

        // Send referral prompt email
        if (resend && profile.email) {
          await resend.emails.send({
            from: 'Docs2Video <support@docs2video.com>',
            to: profile.email,
            subject: 'Love Docs2Video? Share it with a colleague',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="font-size: 22px; font-weight: 800; color: #1B3A5C; margin: 0 0 16px;">
                  Hey ${firstName}, you're on a roll!
                </h1>
                <p style="font-size: 15px; line-height: 1.6; color: #444;">
                  You've already created ${count} videos with Docs2Video. Know someone who could use it too?
                </p>
                <p style="font-size: 15px; line-height: 1.6; color: #444;">
                  Share your personal referral link and <strong>you both get 2 free video credits</strong> when they sign up and create their first video.
                </p>
                <div style="background: #F0F4F8; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
                  <div style="font-size: 12px; color: #7A8FA3; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
                    Your Referral Link
                  </div>
                  <a href="${referralLink}" style="font-size: 16px; font-weight: 700; color: #1B3A5C; text-decoration: none; word-break: break-all;">
                    ${referralLink}
                  </a>
                </div>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${referralLink}" style="display: inline-block; background: #1B3A5C; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
                    Share Now
                  </a>
                </div>
                <p style="font-size: 13px; color: #7A8FA3; line-height: 1.5; margin-top: 24px;">
                  Just send this link to a colleague. When they sign up and create their first video, you'll both automatically receive 2 free video credits.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">
                  Docs2Video &mdash; Turn any document into a professional video explainer.<br/>
                  <a href="https://docs2video.com/privacy" style="color: #999;">Privacy Policy</a> &bull;
                  <a href="https://docs2video.com/api/email-prefs?uid=${profile.id}" style="color: #999;">Unsubscribe</a>
                </p>
              </div>
            `,
          })
        }

        // Mark user as prompted
        await supabase
          .from('profiles')
          .update({ referral_prompt_sent: true })
          .eq('id', profile.id)

        sentCount++
      } catch (userErr) {
        const msg = userErr instanceof Error ? userErr.message : 'Unknown'
        errors.push(`User ${profile.id}: ${msg}`)
        console.error(`[referral-prompt] Error for user ${profile.id}:`, userErr)
      }
    }

    return NextResponse.json({
      message: `Referral prompts sent: ${sentCount}`,
      sentCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: unknown) {
    console.error('[referral-prompt] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
