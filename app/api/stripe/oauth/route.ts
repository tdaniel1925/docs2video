import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.STRIPE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Stripe client ID not configured' }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const redirectUri = `${siteUrl}/api/stripe/oauth/callback`

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      redirect_uri: redirectUri,
      state: user.id,
    })

    return NextResponse.redirect(`https://connect.stripe.com/oauth/authorize?${params.toString()}`)
  } catch (err: unknown) {
    console.error('[stripe/oauth] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
