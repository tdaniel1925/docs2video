import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'
  if (!user) return NextResponse.redirect(new URL('/login', siteUrl))

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: `${siteUrl}/api/auth/google/callback`,
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state: `${user.id}:calendar`,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
