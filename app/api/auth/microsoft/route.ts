import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'))

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    scope: 'Mail.Send Mail.ReadWrite User.Read offline_access',
    response_mode: 'query',
    state: user.id,
  })

  return NextResponse.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`)
}
