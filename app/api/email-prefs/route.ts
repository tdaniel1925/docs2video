import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 15

/**
 * GET /api/email-prefs?uid=<profileId>&action=unsubscribe
 * One-click opt-out for user lifecycle emails (nurture, referral, weekly
 * report). Linked from those email footers; must work without a session
 * (exempted from the auth proxy). Stores the flag inside the existing
 * profiles.nurture_sent jsonb so no migration is required.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')

  const page = (msg: string) => new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;background:#F4F1EC;"><div style="text-align:center;max-width:420px;"><h2 style="color:#1B3A5C;">${msg}</h2><p style="color:#666;font-size:14px;">You can close this window.</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )

  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) {
    return page('Invalid unsubscribe link.')
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, nurture_sent').eq('id', uid).single()
  if (!profile) return page('Invalid unsubscribe link.')

  await admin.from('profiles').update({
    nurture_sent: { ...(profile.nurture_sent ?? {}), unsubscribed: new Date().toISOString() },
  }).eq('id', uid)

  return page('You’ve been unsubscribed from Docs2Video emails.')
}
