import { NextResponse } from 'next/server'
import { authenticateApiKey, getApiBalance } from '../../../_lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/v1/credits
 * Returns the caller's metered API credit balance (separate from UI credits).
 */
export async function GET(request: Request) {
  const caller = await authenticateApiKey(request)
  if (!caller) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }
  const balance = await getApiBalance(caller.userId)
  return NextResponse.json({ balance })
}
