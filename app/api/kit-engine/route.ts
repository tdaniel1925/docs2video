import { NextResponse } from 'next/server'
import { kitEngineOn } from '../../_lib/kit-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/kit-engine — is the new scene engine switched on (env KIT_ENGINE=on)?
 * Step 3 asks this to decide which look cards to show. Only a yes/no.
 */
export async function GET() {
  return NextResponse.json({ on: kitEngineOn() }, { headers: { 'Cache-Control': 'no-store' } })
}
