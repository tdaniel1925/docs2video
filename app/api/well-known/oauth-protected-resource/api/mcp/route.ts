import { NextResponse } from 'next/server'

// RFC 9728 — OAuth Protected Resource Metadata for the MCP endpoint.
// Jordyn (and any spec-compliant MCP client) fetches this after a 401 to learn
// which authorization server protects /api/mcp. Path-scoped form:
//   /.well-known/oauth-protected-resource/api/mcp
export const runtime = 'nodejs'

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')

export async function GET() {
  return NextResponse.json({
    resource: `${BASE}/api/mcp`,
    authorization_servers: [BASE],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
