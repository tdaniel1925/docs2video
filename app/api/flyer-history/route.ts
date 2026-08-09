import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { costForUser, getBalance } from '../../_lib/credits'

// =============================================================================
// The saved timeline.
//
// Rounds newest-first, each with its designs. The images live in a PRIVATE
// bucket, so what goes out is a short-lived signed link rather than a public
// URL — a flyer can carry a client's name, address and phone number, and those
// should not sit on a guessable path forever.
// =============================================================================

export const runtime = 'nodejs'

/** Long enough to read the page and download; short enough not to be a leak. */
const LINK_TTL_SECONDS = 60 * 60

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 25) || 25, 50)
  const admin = createAdminClient()

  // The price per design comes from the server, never from a constant in the
  // browser: some accounts are grandfathered at the old rate, and quoting a
  // figure the checkout then disagrees with is worse than quoting none.
  const unit = costForUser('flyer', user.id)
  const balance = await getBalance(user.id).then((b) => b.total).catch(() => null)

  const { data: rounds, error } = await admin
    .from('flyer_rounds')
    .select('id, template_id, fields, note, messages, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  // The table may not exist yet on an environment where the migration has not
  // been run. That should leave the page empty and usable, not broken — this
  // project has form for a missing column 404-ing a whole feature.
  if (error) {
    console.error('[flyer-history] load failed:', error.message)
    return NextResponse.json({ rounds: [], unit, balance, unavailable: true })
  }
  if (!rounds?.length) return NextResponse.json({ rounds: [], unit, balance })

  const { data: designs } = await admin
    .from('flyer_designs')
    .select('id, round_id, size_id, label, width, height, image_path, created_at')
    .in('round_id', rounds.map((r) => r.id))
    .order('created_at', { ascending: true })

  // One signing call per file. Sequential would be a round trip each.
  const signed = new Map<string, string>()
  await Promise.all((designs ?? []).map(async (d) => {
    const { data } = await admin.storage
      .from('creation-assets')
      .createSignedUrl(d.image_path, LINK_TTL_SECONDS)
    if (data?.signedUrl) signed.set(d.id, data.signedUrl)
  }))

  return NextResponse.json({
    unit,
    balance,
    // Oldest first, so the page reads top-to-bottom like the conversation it was.
    rounds: rounds.reverse().map((r) => ({
      id: r.id,
      templateId: r.template_id,
      fields: r.fields ?? {},
      note: r.note ?? '',
      messages: r.messages ?? [],
      createdAt: r.created_at,
      designs: (designs ?? [])
        .filter((d) => d.round_id === r.id)
        // A design whose file has vanished is worse than one left out: it
        // renders as a broken image with a download button that does nothing.
        .filter((d) => signed.has(d.id))
        .map((d) => ({
          id: d.id, sizeId: d.size_id, label: d.label,
          w: d.width, h: d.height, url: signed.get(d.id)!,
        })),
    })),
  })
}
