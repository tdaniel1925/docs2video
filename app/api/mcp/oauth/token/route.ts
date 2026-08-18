import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'
import { sha256, verifyPkce, newToken, ACCESS_TTL_SEC } from '../../../../_lib/mcp-oauth'

// POST /api/mcp/oauth/token — RFC 6749 token endpoint.
//  grant_type=authorization_code : code + code_verifier (PKCE) → access + refresh
//  grant_type=refresh_token       : refresh_token → new access (+ rotated refresh)
// Tokens are stored HASHED. Access token TTL 1h; refresh long-lived until revoked
// (mcp_oauth_tokens.is_active=false = the "turn a connection off" control).
export const runtime = 'nodejs'

const jsonErr = (error: string, desc?: string, status = 400) =>
  NextResponse.json({ error, ...(desc ? { error_description: desc } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } })

async function issue(admin: ReturnType<typeof createAdminClient>, opts: { clientId: string; userId: string; scope: string | null; resource: string | null; oldTokenId?: string }) {
  const access = newToken('mcpat')
  const refresh = newToken('mcprt')
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_SEC * 1000).toISOString()
  await admin.from('mcp_oauth_tokens').insert({
    access_token_hash: sha256(access), refresh_token_hash: sha256(refresh),
    client_id: opts.clientId, user_id: opts.userId, scope: opts.scope, resource: opts.resource,
    is_active: true, access_expires_at: accessExpiresAt,
  })
  // rotate: retire the old refresh token's row on a refresh grant
  if (opts.oldTokenId) await admin.from('mcp_oauth_tokens').update({ is_active: false }).eq('id', opts.oldTokenId).then(() => {}, () => {})
  return NextResponse.json({
    access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_SEC,
    refresh_token: refresh, scope: opts.scope || 'mcp',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  if (!form) return jsonErr('invalid_request', 'Expected form-encoded body.')
  const grantType = String(form.get('grant_type') || '')
  const admin = createAdminClient()

  if (grantType === 'authorization_code') {
    const code = String(form.get('code') || '')
    const verifier = String(form.get('code_verifier') || '')
    const redirectUri = String(form.get('redirect_uri') || '')
    const clientId = String(form.get('client_id') || '')
    if (!code || !verifier || !redirectUri || !clientId) return jsonErr('invalid_request', 'Missing code, code_verifier, redirect_uri, or client_id.')

    const { data: row } = await admin.from('mcp_oauth_codes').select('*').eq('code', code).maybeSingle()
    if (!row) return jsonErr('invalid_grant', 'Unknown or used code.')
    // spend the code immediately (one-time use), regardless of what follows
    await admin.from('mcp_oauth_codes').delete().eq('code', code).then(() => {}, () => {})

    if (new Date(row.expires_at).getTime() < Date.now()) return jsonErr('invalid_grant', 'Code expired.')
    if (row.client_id !== clientId) return jsonErr('invalid_grant', 'Client mismatch.')
    if (row.redirect_uri !== redirectUri) return jsonErr('invalid_grant', 'redirect_uri mismatch.')
    if (!verifyPkce(verifier, row.code_challenge)) return jsonErr('invalid_grant', 'PKCE verification failed.')

    return issue(admin, { clientId, userId: row.user_id, scope: row.scope, resource: row.resource })
  }

  if (grantType === 'refresh_token') {
    const refresh = String(form.get('refresh_token') || '')
    if (!refresh) return jsonErr('invalid_request', 'Missing refresh_token.')
    const { data: row } = await admin.from('mcp_oauth_tokens').select('*').eq('refresh_token_hash', sha256(refresh)).eq('is_active', true).maybeSingle()
    if (!row) return jsonErr('invalid_grant', 'Unknown or revoked refresh token.')
    return issue(admin, { clientId: row.client_id, userId: row.user_id, scope: row.scope, resource: row.resource, oldTokenId: row.id })
  }

  return jsonErr('unsupported_grant_type')
}
