import { NextResponse } from 'next/server'

// RFC 9728 — bare fallback (some clients try the un-scoped path too).
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
