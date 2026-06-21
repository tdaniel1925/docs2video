import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/sent-emails?email=<to_email>
 * Sent-email history for the Clients detail page Emails tab. Owner-scoped:
 * returns this user's sent_emails to the given recipient. (Previously this
 * route did not exist, so the Emails tab silently showed empty — audit fix.)
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const email = new URL(request.url).searchParams.get('email')?.trim()
  if (!email) return NextResponse.json({ emails: [] })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sent_emails')
    .select('id, subject, to_email, video_id, opened_at, created_at')
    .eq('user_id', user.id)
    .eq('to_email', email)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ emails: data ?? [] })
}
