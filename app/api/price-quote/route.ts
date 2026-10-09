import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { getBalance, spendBlockReason } from '../../_lib/credits'
import {
  outputsOffered,
  presentationIsFree,
  quoteOutput,
  videoIsFree,
  videoPriceInputs,
  STARTABLE_STATUSES,
  type MakeOutput,
  type OutputQuote,
  type PriceQuoteResponse,
} from '../../_lib/price-quote'

export const runtime = 'nodejs'
export const maxDuration = 15


/**
 * GET /api/price-quote?videoId=…
 * READ-ONLY. What each output would cost for this saved draft, worked out by
 * the same functions generate-video and generate-presentation charge with.
 * Changes nothing and charges nothing.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const videoId = request.nextUrl.searchParams.get('videoId')
  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: row }, { data: profile }] = await Promise.all([
    admin.from('videos')
      .select('id, status, output_type, detail_level, draft_data')
      .eq('id', videoId)
      .eq('user_id', user.id) // owner only
      .maybeSingle(),
    admin.from('profiles')
      .select('subscription_status, is_admin, is_beta, card_on_file')
      .eq('id', user.id)
      .maybeSingle(),
  ])
  if (!row) return NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 })

  let balance = 0
  try {
    balance = (await getBalance(user.id)).total
  } catch {
    return NextResponse.json({ error: 'We couldn’t read your credits just now. Please refresh.' }, { status: 503 })
  }

  const free = {
    video: videoIsFree({ isAdmin: profile?.is_admin, isBeta: profile?.is_beta }),
    presentation: presentationIsFree({ isAdmin: profile?.is_admin, isBeta: profile?.is_beta }),
  }
  const inputs = videoPriceInputs(row)
  const offered = outputsOffered(inputs.draftOutputType)
  const options: Partial<Record<MakeOutput, OutputQuote>> = {}
  for (const o of offered) options[o] = quoteOutput(row, o, user.id, free)

  const body: PriceQuoteResponse = {
    current: inputs.draftOutputType,
    detailLevel: inputs.detailLevel,
    fileCount: inputs.fileCount,
    options,
    offered,
    balance,
    blockedReason: spendBlockReason(profile),
    startable: (STARTABLE_STATUSES as readonly string[]).includes(String(row.status || '')),
    status: String(row.status || ''),
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
