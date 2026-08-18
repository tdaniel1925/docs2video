import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { newClientId } from '../../../../_lib/mcp-oauth'

// RFC 7591 — Dynamic Client Registration. A connecting MCP client (Jordyn) posts
// its redirect_uris and gets a client_id back. Public client: no secret issued
// (PKCE replaces it). We only accept the fields we use.
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }) }

  const redirectUris: string[] = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u: unknown) => typeof u === 'string' && /^https?:\/\//.test(u)) : []
  if (!redirectUris.length) return NextResponse.json({ error: 'invalid_redirect_uri', error_description: 'At least one https redirect_uri is required.' }, { status: 400 })

  const clientId = newClientId()
  const admin = createAdminClient()
  const { error } = await admin.from('mcp_oauth_clients').insert({
    client_id: clientId,
    client_name: typeof body?.client_name === 'string' ? body.client_name.slice(0, 120) : null,
    redirect_uris: redirectUris,
    scopes: typeof body?.scope === 'string' ? body.scope.slice(0, 200) : 'mcp',
  })
  if (error) {
    console.error('[mcp-oauth/register] insert failed:', error.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }

  // RFC 7591 response. Public client → token_endpoint_auth_method "none".
  return NextResponse.json({
    client_id: clientId,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'mcp',
  }, { status: 201 })
}
