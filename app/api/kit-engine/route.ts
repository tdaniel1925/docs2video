import { NextResponse } from 'next/server'
import { kitEngineOn } from '../../_lib/kit-engine'
import { filmEngineFor } from '../../_lib/film-engine'
import { createClient } from '../../_lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/kit-engine — is the scene engine switched on (env KIT_ENGINE=on), and is the film engine on for this
 * user (env FILM_ENGINE, film-engine.ts)? Step 3 asks this to decide which look cards to show. Only yes/no answers.
 */
export async function GET() {
  let film = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    film = await filmEngineFor(user?.id)
  } catch { /* signed out or no session: no film cards */ }
  return NextResponse.json({ on: kitEngineOn() || film, film }, { headers: { 'Cache-Control': 'no-store' } })
}
