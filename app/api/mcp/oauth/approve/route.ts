import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { newCode, CODE_TTL_SEC } from '../../../../_lib/mcp-oauth'

// POST /api/mcp/oauth/approve — the consent decision. Issues a one-time auth code
// bound to (client_id, redirect_uri, PKCE challenge, the logged-in user, resource)
// and redirects back to the client's redirect_uri with code + state. Deny → error.
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  if (!form) return new NextResponse('Bad request', { status: 400 })
  const clientId = String(form.get('client_id') || '')
  const redirectUri = String(form.get('redirect_uri') || '')
  const challenge = String(form.get('code_challenge') || '')
  const state = String(form.get('state') || '')
  const scope = String(form.get('scope') || 'mcp')
  const resource = String(form.get('resource') || '')
  const decision = String(form.get('decision') || '')

  // Validate the client + redirect_uri BEFORE any redirect (never trust the
  // posted form alone). Deny / not-signed-in used to bounce to whatever
  // redirect_uri was posted — an open redirect — and a malformed one was a 500.
  if (!clientId || !redirectUri) return new NextResponse('Missing client_id or redirect_uri', { status: 400 })
  let target: URL
  try { target = new URL(redirectUri) } catch { return new NextResponse('Malformed redirect_uri', { status: 400 }) }

  const admin = createAdminClient()
  const { data: client } = await admin.from('mcp_oauth_clients').select('client_id, redirect_uris').eq('client_id', clientId).maybeSingle()
  if (!client || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
    return new NextResponse('Invalid client or redirect_uri', { status: 400 })
  }

  const back = (params: Record<string, string>) => {
    const u = new URL(target.toString())
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v)
    if (state) u.searchParams.set('state', state)
    return NextResponse.redirect(u.toString(), { status: 303 })
  }

  if (decision !== 'approve') return back({ error: 'access_denied' })
  if (!challenge) return back({ error: 'invalid_request', error_description: 'Missing code_challenge.' })

  // must still be the logged-in user who saw the consent screen
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return back({ error: 'access_denied', error_description: 'Not signed in.' })

  const code = newCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString()
  const { error } = await admin.from('mcp_oauth_codes').insert({
    code, client_id: clientId, user_id: user.id, redirect_uri: redirectUri,
    code_challenge: challenge, resource: resource || null, scope, expires_at: expiresAt,
  })
  if (error) {
    console.error('[mcp-oauth/approve] code insert failed:', error.message)
    return back({ error: 'server_error' })
  }
  return back({ code })
}
