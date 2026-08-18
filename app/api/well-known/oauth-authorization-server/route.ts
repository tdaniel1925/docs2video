import { NextResponse } from 'next/server'

// RFC 8414 — Authorization Server Metadata. Points the MCP client at our
// authorize / token / register endpoints. We advertise a PUBLIC client flow
// (PKCE S256, token_endpoint_auth_method "none") — Jordyn registers dynamically,
// signs the user in, and gets a bearer that /api/mcp accepts.
export const runtime = 'nodejs'
const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')

export async function GET() {
  return NextResponse.json({
    issuer: BASE,
    authorization_endpoint: `${BASE}/api/mcp/oauth/authorize`,
    token_endpoint: `${BASE}/api/mcp/oauth/token`,
    registration_endpoint: `${BASE}/api/mcp/oauth/register`,
    scopes_supported: ['mcp'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
