import { createAdminClient } from '../supabase/admin'
import { PAID_STATUSES } from '../subscription'
import { CREDIT_COSTS } from '../credits'
import { failReason, reviewReason } from './fail-reason'
import { isTestAccount } from './money'
import { loadMoneySnapshot, testEmails } from './money-server'
import { PAYMENT_ERROR_ENDPOINTS } from './payment-alerts'

/**
 * "WHAT NEEDS YOU" — the short list of things the owner has to look at,
 * worked out on the server. The admin home card and the daily email both read
 * this ONE function, so they always say the same thing. Every item carries a
 * link (`href`, relative to the site) that opens the right admin screen.
 * READ ONLY.
 */

export interface NeedItem {
  id: string
  title: string
  /** One plain line under the title. */
  detail: string
  /** Where one click takes the owner (admin page). */
  href: string
  when?: string | null
  /** Extra technical text, folded away on screen. */
  technical?: string | null
  /** For review items: the video id the Approve / Reject buttons act on. */
  videoId?: string
}

export interface NeedSection {
  key: 'failed' | 'review' | 'payments' | 'past_due' | 'slipping' | 'payouts' | 'providers'
  title: string
  /** Shown when the list is empty / why it couldn't be read. */
  note?: string
  items: NeedItem[]
  /** "See all" link for the section. */
  href: string
  /** Problem (red) vs heads-up (amber) vs info. */
  tone: 'stop' | 'warn' | 'info'
}

export interface NeedsYou {
  at: string
  total: number
  sections: NeedSection[]
}

const DAY = 86_400_000
const fmtMoney = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function loadNeedsYou(): Promise<NeedsYou> {
  const db = createAdminClient()
  const now = Date.now()
  const dayAgo = new Date(now - DAY).toISOString()
  const twoWeeksAgo = new Date(now - 14 * DAY).toISOString()
  const tests = testEmails()

  const [failedRes, reviewRes, payErrRes, pastDueRes, paidRes, approvedRes, pendingRes, checkRes] = await Promise.all([
    db.from('videos').select('id, user_id, title, error_message, progress_detail, updated_at')
      .eq('status', 'failed').gte('updated_at', dayAgo).order('updated_at', { ascending: false }).limit(25),
    db.from('videos').select('id, user_id, title, progress_detail, created_at')
      .eq('status', 'review_required').order('created_at', { ascending: false }).limit(25),
    db.from('error_logs').select('id, message, detail, count, last_seen, user_id, endpoint')
      .in('endpoint', [...PAYMENT_ERROR_ENDPOINTS]).eq('resolved', false).gte('last_seen', twoWeeksAgo)
      .order('last_seen', { ascending: false }).limit(20),
    db.from('profiles').select('id, email, full_name, updated_at').eq('subscription_status', 'past_due').limit(50),
    db.from('profiles').select('id, email, full_name, subscription_status, is_admin, stripe_customer_id')
      .in('subscription_status', PAID_STATUSES).limit(1000),
    db.from('affiliate_commissions').select('affiliate_id, commission_cents').eq('status', 'approved').limit(5000),
    db.from('affiliate_commissions').select('affiliate_id, commission_cents').eq('status', 'pending')
      .lt('created_at', new Date(now - 30 * DAY).toISOString()).limit(5000),
    db.from('system_checks').select('run_at, overall_ok, results').order('run_at', { ascending: false }).limit(1),
  ])

  // Owner emails for the video rows.
  const ownerIds = [...new Set([...(failedRes.data ?? []), ...(reviewRes.data ?? [])].map((v) => v.user_id))]
  const { data: owners } = ownerIds.length
    ? await db.from('profiles').select('id, email').in('id', ownerIds)
    : { data: [] as { id: string; email: string }[] }
  const emailOf = new Map((owners ?? []).map((o) => [o.id, o.email]))

  const sections: NeedSection[] = []

  // 1. Videos that didn't finish (last 24 hours)
  sections.push({
    key: 'failed', title: 'Videos that didn’t finish (last 24 hours)', tone: 'stop',
    href: '/admin?tab=videos&filter=failed&since=24h',
    items: (failedRes.data ?? []).map((v) => {
      const r = failReason(v.progress_detail, v.error_message)
      return {
        id: v.id, title: v.title || 'Untitled', detail: `${emailOf.get(v.user_id) ?? 'unknown'} — ${r.plain}`,
        technical: r.technical, when: v.updated_at, href: `/admin/users/${v.user_id}`,
      }
    }),
  })

  // 2. Waiting for your OK
  sections.push({
    key: 'review', title: 'Videos waiting for your OK', tone: 'warn',
    href: '/admin?tab=videos&filter=review_required',
    items: (reviewRes.data ?? []).map((v) => ({
      id: v.id, videoId: v.id, title: v.title || 'Untitled',
      detail: `${emailOf.get(v.user_id) ?? 'unknown'} — ${reviewReason(v.progress_detail)}`,
      technical: v.progress_detail, when: v.created_at, href: '/admin?tab=videos&filter=review_required',
    })),
  })

  // 3. Payment errors (Stripe)
  sections.push({
    key: 'payments', title: 'Payment problems from Stripe', tone: 'stop', href: '/admin/logs',
    note: payErrRes.error ? 'Could not read the error log just now.' : undefined,
    items: (payErrRes.data ?? []).map((e) => ({
      id: e.id,
      title: e.endpoint === 'stripe-webhook:payment_failed' ? e.message
        : e.endpoint === 'stripe-webhook' ? 'A Stripe message was refused (signature check failed)'
        : 'Our Stripe handler crashed on a payment message',
      detail: `${e.count > 1 ? `${e.count} times · ` : ''}${(e.detail || e.message || '').split('\n')[0].slice(0, 160)}`,
      when: e.last_seen, href: e.user_id ? `/admin/users/${e.user_id}` : '/admin/logs',
    })),
  })

  // 4. Past-due customers
  sections.push({
    key: 'past_due', title: 'Customers whose payment is late', tone: 'stop', href: '/admin/billing',
    items: (pastDueRes.data ?? []).filter((p) => !isTestAccount(p.email, tests)).map((p) => ({
      id: p.id, title: p.full_name || p.email, detail: `${p.email} — card failed; they can’t make videos until it’s fixed.`,
      when: p.updated_at, href: `/admin/users/${p.id}`,
    })),
  })

  // 5. Paying customers slipping
  const paying = (paidRes.data ?? []).filter((p) => !p.is_admin && !isTestAccount(p.email, tests))
  const payingIds = paying.map((p) => p.id)
  const slipping: NeedItem[] = []
  let slippingNote: string | undefined
  if (payingIds.length) {
    const [recentVids, wallets] = await Promise.all([
      db.from('videos').select('user_id').in('user_id', payingIds).gte('created_at', twoWeeksAgo).neq('status', 'draft').limit(5000),
      db.from('credit_balances').select('user_id, balance, topup_balance').in('user_id', payingIds),
    ])
    const active = new Set((recentVids.data ?? []).map((v) => v.user_id))
    const wallet = new Map((wallets.data ?? []).map((w) => [w.user_id, (w.balance ?? 0) + (w.topup_balance ?? 0)]))
    const cheapest = CREDIT_COSTS.videoQuick
    let cancelling = new Map<string, number>()
    try {
      const snap = await loadMoneySnapshot()
      cancelling = new Map(snap.rows.filter((r) => r.kind !== 'other' && r.cancelAtPeriodEnd && r.userId).map((r) => [r.userId as string, r.currentPeriodEnd]))
    } catch {
      slippingNote = 'Stripe could not be read, so “cancelling at period end” is not checked right now.'
    }
    for (const p of paying) {
      const reasons: string[] = []
      if (cancelling.has(p.id)) {
        const end = cancelling.get(p.id)
        reasons.push(`cancelling${end ? ` on ${new Date(end * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' at the end of the period'}`)
      }
      if ((wallet.get(p.id) ?? 0) < cheapest) reasons.push('credits used up')
      if (!active.has(p.id)) reasons.push('no video in 14 days')
      if (reasons.length) slipping.push({ id: p.id, title: p.full_name || p.email, detail: `${p.email} — ${reasons.join(' · ')}`, href: `/admin/users/${p.id}` })
    }
    // Cancelling first, then credits, then quiet.
    slipping.sort((a, b) => score(b.detail) - score(a.detail))
  }
  sections.push({ key: 'slipping', title: 'Paying customers slipping', tone: 'warn', href: '/admin?tab=users', note: slippingNote, items: slipping.slice(0, 25) })

  // 6. Affiliate payouts owed
  const owed = sumBy(approvedRes.data ?? [])
  const ready = sumBy(pendingRes.data ?? [])
  const payoutItems: NeedItem[] = []
  if (owed.cents > 0) payoutItems.push({ id: 'owed', title: `${fmtMoney(owed.cents)} owed to ${owed.people} affiliate${owed.people === 1 ? '' : 's'}`, detail: 'Approved and not paid yet. Download the payout file, send the money, then mark them paid.', href: '/admin/affiliates' })
  if (ready.cents > 0) payoutItems.push({ id: 'ready', title: `${fmtMoney(ready.cents)} past the 30-day hold`, detail: 'Ready to approve (no refund came in).', href: '/admin/affiliates' })
  sections.push({ key: 'payouts', title: 'Affiliate payouts', tone: 'warn', href: '/admin/affiliates', items: payoutItems })

  // 7. AI providers
  sections.push({ key: 'providers', title: 'AI services', tone: 'info', href: '/admin/system', items: await providerItems(checkRes.data?.[0] ?? null) })

  const total = sections.filter((s) => s.key !== 'providers').reduce((n, s) => n + s.items.length, 0)
    + sections.find((s) => s.key === 'providers')!.items.filter((i) => i.id.endsWith(':low') || i.id.endsWith(':down')).length
  return { at: new Date().toISOString(), total, sections }
}

function score(detail: string) {
  return (detail.includes('cancelling') ? 4 : 0) + (detail.includes('credits used up') ? 2 : 0) + (detail.includes('no video') ? 1 : 0)
}

function sumBy(rows: { affiliate_id: string; commission_cents: number | null }[]) {
  return { cents: rows.reduce((a, r) => a + (r.commission_cents || 0), 0), people: new Set(rows.map((r) => r.affiliate_id)).size }
}

/**
 * What can be read about each AI service. Only ElevenLabs and fal have a
 * balance API; OpenAI, Gemini and Anthropic have none, so the last health
 * check (every 6 hours) is shown for them. A key without the permission to
 * read its balance is said plainly — never shown as "OK".
 * Item ids end in ":low" / ":down" when it needs the owner.
 */
export async function providerItems(lastCheck: { run_at: string; overall_ok: boolean; results: { name: string; ok: boolean; error?: string }[] } | null): Promise<NeedItem[]> {
  const items: NeedItem[] = []

  // ElevenLabs — characters used this month.
  const eleven = process.env.ELEVENLABS_API_KEY
  if (!eleven) {
    items.push({ id: 'elevenlabs:none', title: 'ElevenLabs (voice)', detail: 'No key set here, so the balance can’t be read.', href: 'https://elevenlabs.io/app/subscription' })
  } else {
    try {
      const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': eleven }, signal: AbortSignal.timeout(6000) })
      if (r.status === 401 || r.status === 403) {
        items.push({ id: 'elevenlabs:noperm', title: 'ElevenLabs (voice)', detail: 'The key isn’t allowed to read the balance (it needs the “User: read” permission). Check it on elevenlabs.io.', href: 'https://elevenlabs.io/app/subscription' })
      } else if (!r.ok) {
        items.push({ id: 'elevenlabs:down', title: 'ElevenLabs (voice)', detail: `Couldn’t read the balance (error ${r.status}).`, href: 'https://elevenlabs.io/app/subscription' })
      } else {
        const j = await r.json() as { character_count?: number; character_limit?: number; next_character_count_reset_unix?: number; tier?: string }
        const used = j.character_count ?? 0
        const limit = j.character_limit ?? 0
        const left = Math.max(0, limit - used)
        const pct = limit ? Math.round((left / limit) * 100) : 0
        const reset = j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
        items.push({
          id: pct < 15 ? 'elevenlabs:low' : 'elevenlabs:ok', title: 'ElevenLabs (voice)',
          detail: `${left.toLocaleString('en-US')} of ${limit.toLocaleString('en-US')} characters left (${pct}%)${reset ? ` · resets ${reset}` : ''}${pct < 15 ? ' — running low' : ''}`,
          href: 'https://elevenlabs.io/app/subscription',
        })
      }
    } catch {
      items.push({ id: 'elevenlabs:down', title: 'ElevenLabs (voice)', detail: 'Couldn’t reach ElevenLabs to read the balance.', href: 'https://elevenlabs.io/app/subscription' })
    }
  }

  // fal — account credit (needs an ADMIN-scoped key).
  const fal = process.env.FAL_KEY
  if (!fal) {
    items.push({ id: 'fal:none', title: 'fal (drawn slides)', detail: 'No key set here, so the balance can’t be read.', href: 'https://fal.ai/dashboard/billing' })
  } else {
    try {
      const r = await fetch('https://api.fal.ai/v1/account/billing?expand=credits', { headers: { Authorization: `Key ${fal}` }, signal: AbortSignal.timeout(6000) })
      if (r.status === 401 || r.status === 403) {
        items.push({ id: 'fal:noperm', title: 'fal (drawn slides)', detail: 'The key isn’t allowed to read the balance (fal only shows it to an admin key). Check it on fal.ai.', href: 'https://fal.ai/dashboard/billing' })
      } else if (!r.ok) {
        items.push({ id: 'fal:down', title: 'fal (drawn slides)', detail: `Couldn’t read the balance (error ${r.status}).`, href: 'https://fal.ai/dashboard/billing' })
      } else {
        const j = await r.json() as { credits?: { current_balance?: number; currency?: string } }
        const bal = j.credits?.current_balance
        items.push({
          id: typeof bal === 'number' && bal < 10 ? 'fal:low' : 'fal:ok', title: 'fal (drawn slides)',
          detail: typeof bal === 'number' ? `$${bal.toFixed(2)} left${bal < 10 ? ' — running low' : ''}` : 'Balance not shown by fal.',
          href: 'https://fal.ai/dashboard/billing',
        })
      }
    } catch {
      items.push({ id: 'fal:down', title: 'fal (drawn slides)', detail: 'Couldn’t reach fal to read the balance.', href: 'https://fal.ai/dashboard/billing' })
    }
  }

  // OpenAI / Gemini / Anthropic — no balance API: last health check instead.
  if (!lastCheck) {
    items.push({ id: 'health:none', title: 'OpenAI, Gemini, Claude', detail: 'No balance API. No health check has run yet.', href: '/admin/system' })
  } else {
    const when = new Date(lastCheck.run_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const failed = (lastCheck.results || []).filter((r) => !r.ok)
    items.push({
      id: failed.length ? 'health:down' : 'health:ok', title: 'OpenAI, Gemini, Claude',
      detail: failed.length
        ? `No balance API. Last health check (${when}) FAILED: ${failed.map((f) => f.name.replace('_', ' ')).join(', ')}.`
        : `No balance API. Last health check (${when}) passed.`,
      href: '/admin/system',
    })
  }
  return items
}
