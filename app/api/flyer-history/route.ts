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

  const params = new URL(req.url).searchParams
  const limit = Math.min(Number(params.get('limit') ?? 25) || 25, 50)
  // Which project chat to open. Absent means the most recent one.
  const wantChat = params.get('chat')
  const admin = createAdminClient()

  // The price per design comes from the server, never from a constant in the
  // browser: some accounts are grandfathered at the old rate, and quoting a
  // figure the checkout then disagrees with is worse than quoting none.
  const unit = costForUser('flyer', user.id)
  const balance = await getBalance(user.id).then((b) => b.total).catch(() => null)

  // The sidebar. Missing table (migration not yet run) is not fatal — the page
  // then behaves exactly as it did before chats existed.
  const { data: chatRows } = await admin
    .from('flyer_chats')
    .select('id, title, updated_at, pinned')
    .eq('user_id', user.id)
    // Pinned first, then most recent — a job you return to weekly should not
    // sink under a dozen one-offs.
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(40)
  const chats = chatRows ?? []

  // BE HONEST ABOUT A CHAT WE DO NOT KNOW. Asking for one that has nothing
  // saved yet used to fall through to "most recent", so pressing New chat
  // fetched the PREVIOUS conversation and dropped the customer straight back
  // into it. A brand-new chat has no rows yet — that is normal, and the right
  // answer is an empty one, not somebody else's.
  if (wantChat && !chats.some((c) => c.id === wantChat)) {
    return NextResponse.json({ rounds: [], chats, openChat: wantChat, unit, balance })
  }
  const openChat = wantChat || chats[0]?.id || null

  let q = admin
    .from('flyer_rounds')
    .select('id, template_id, fields, note, messages, created_at')
    .eq('user_id', user.id)
  // Only scope by chat where chats actually exist. Before the migration runs
  // there is no chat_id column at all, and naming it would 400 the whole query
  // — which in this codebase has meant a dead feature more than once.
  if (openChat) q = q.eq('chat_id', openChat)

  const { data: rounds, error } = await q
    .order('created_at', { ascending: false })
    .limit(limit)

  // The table may not exist yet on an environment where the migration has not
  // been run. That should leave the page empty and usable, not broken — this
  // project has form for a missing column 404-ing a whole feature.
  if (error) {
    console.error('[flyer-history] load failed:', error.message)
    return NextResponse.json({ rounds: [], chats, openChat, unit, balance, unavailable: true })
  }
  if (!rounds?.length) return NextResponse.json({ rounds: [], chats, openChat, unit, balance })

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
    chats,
    openChat,
    // Oldest first, so the page reads top-to-bottom like the conversation it was.
    rounds: rounds.reverse().map((r) => ({
      id: r.id,
      templateId: r.template_id,
      fields: r.fields ?? {},
      note: r.note ?? '',
      messages: r.messages ?? [],
      createdAt: r.created_at,
      designs: dedupeNewest(
        (designs ?? [])
          .filter((d) => d.round_id === r.id)
          // A design whose file has vanished is worse than one left out: it
          // renders as a broken image with a download button that does nothing.
          .filter((d) => signed.has(d.id)),
      ).map((d) => ({
        id: d.id, sizeId: d.size_id, label: d.label,
        w: d.width, h: d.height, url: signed.get(d.id)!,
      })),
    })),
  })
}

/**
 * ONE design per slot — the NEWEST version wins.
 *
 * A paint-edit saves the edited image as a NEW row in the same round + slot
 * (never over the original, so nothing is ever lost). But returning both rows
 * made an edited deck show the slide TWICE — old then new — in the grid, in
 * "download all", and as two pages in the PDF. Here we keep only the latest row
 * per slot for display; older versions stay safe in the database.
 *
 * Deck slots (slide-N) are then re-sorted by slide number, because an edit's
 * newer created_at would otherwise push slide 3 to the end of the deck.
 */
function dedupeNewest<T extends { size_id: string; created_at: string }>(rows: T[]): T[] {
  const bySlot = new Map<string, T>()
  for (const d of rows) {
    const prev = bySlot.get(d.size_id)
    if (!prev || d.created_at >= prev.created_at) bySlot.set(d.size_id, d)
  }
  const out = [...bySlot.values()]
  const slideNo = (s: string) => { const m = /^slide-(\d+)$/.exec(s); return m ? Number(m[1]) : null }
  return out.sort((a, b) => {
    const an = slideNo(a.size_id), bn = slideNo(b.size_id)
    if (an != null && bn != null) return an - bn            // deck: slide order
    if (an != null || bn != null) return an != null ? -1 : 1
    return a.created_at < b.created_at ? -1 : 1              // others: made order
  })
}
