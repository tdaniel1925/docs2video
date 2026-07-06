import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

/** GET /api/admin/affiliates — affiliates + pending-payout summary. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const admin = createAdminClient()

  const { data: affiliates } = await admin
    .from('affiliates')
    .select('id, user_id, referral_code, promo_code, commission_rate, status, created_at, payout_email, payout_method, payout_via')
    .order('created_at', { ascending: false })

  const userIds = [...new Set((affiliates ?? []).map(a => a.user_id))]
  const [{ data: profiles }, { data: commissions }] = await Promise.all([
    admin.from('profiles').select('id, email').in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
    admin.from('affiliate_commissions').select('affiliate_id, commission_cents, status'),
  ])
  const emailById = new Map((profiles ?? []).map(p => [p.id, p.email]))

  const sumBy = (affId: string, status: string) =>
    (commissions ?? []).filter(c => c.affiliate_id === affId && c.status === status)
      .reduce((a, c) => a + (c.commission_cents || 0), 0)

  return NextResponse.json({
    affiliates: (affiliates ?? []).map(a => ({
      ...a,
      email: emailById.get(a.user_id) ?? null,
      payout_ready: !!a.payout_email,
      pending_cents: sumBy(a.id, 'pending'),
      approved_cents: sumBy(a.id, 'approved'),
      paid_cents: sumBy(a.id, 'paid'),
    })),
  })
}

/**
 * POST /api/admin/affiliates
 * { action: 'set-status', affiliateId, status }       — active|paused|suspended
 * { action: 'approve-pending' }                        — pending -> approved (clears hold)
 * { action: 'export-csv' }                             — returns approved commissions as CSV text
 * { action: 'mark-paid', batch }                       — approved -> paid for a batch label
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  const admin = createAdminClient()
  const body = await request.json() as { action: string; affiliateId?: string; status?: string; batch?: string }

  if (body.action === 'set-status') {
    if (!body.affiliateId || !['active', 'paused', 'suspended'].includes(body.status || '')) {
      return NextResponse.json({ error: 'bad params' }, { status: 400 })
    }
    await admin.from('affiliates').update({ status: body.status }).eq('id', body.affiliateId)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'approve-pending') {
    // Approve commissions older than the 30-day refund hold.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('affiliate_commissions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .select('id')
    return NextResponse.json({ ok: true, approved: data?.length ?? 0 })
  }

  if (body.action === 'export-csv') {
    const { data: allRows } = await admin
      .from('affiliate_commissions')
      .select('id, affiliate_id, referred_user_id, commission_cents, created_at')
      .eq('status', 'approved')
      .order('affiliate_id')
    // Apex reps (payout_via='apex') are paid through the Apex comp plan —
    // recorded here for audit, never in the local payout file.
    const { data: apexAffs } = await admin.from('affiliates').select('id').eq('payout_via', 'apex')
    const apexIds = new Set((apexAffs ?? []).map(a => a.id))
    const data = (allRows ?? []).filter(c => !apexIds.has(c.affiliate_id))
    const affIds = [...new Set((data ?? []).map(c => c.affiliate_id))]
    const { data: affs } = await admin.from('affiliates').select('id, user_id, payout_email, referral_code').in('id', affIds.length ? affIds : ['x'])
    const userIds = [...new Set((affs ?? []).map(a => a.user_id))]
    const { data: profs } = await admin.from('profiles').select('id, email').in('id', userIds.length ? userIds : ['x'])
    const affById = new Map((affs ?? []).map(a => [a.id, a]))
    const emailById = new Map((profs ?? []).map(p => [p.id, p.email]))

    // One line per affiliate: total owed.
    const totals = new Map<string, number>()
    for (const c of data ?? []) totals.set(c.affiliate_id, (totals.get(c.affiliate_id) || 0) + (c.commission_cents || 0))
    const rows = [['affiliate_id', 'code', 'payout_email', 'amount_usd']]
    for (const [affId, cents] of totals) {
      const a = affById.get(affId)
      const email = a?.payout_email || (a ? emailById.get(a.user_id) : '') || ''
      rows.push([affId, a?.referral_code || '', email, (cents / 100).toFixed(2)])
    }
    const csv = rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n')
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="affiliate-payouts.csv"' },
    })
  }

  if (body.action === 'mark-paid') {
    const batch = body.batch || `batch-${new Date().toISOString().slice(0, 10)}`
    // Exclude Apex-paid affiliates — their approved rows stay 'approved'
    // forever as an audit trail; the Apex comp plan is the payer of record.
    const { data: apexAffs } = await admin.from('affiliates').select('id').eq('payout_via', 'apex')
    const apexIds = (apexAffs ?? []).map(a => a.id)
    let query = admin
      .from('affiliate_commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString(), payout_batch: batch })
      .eq('status', 'approved')
    if (apexIds.length) {
      query = query.not('affiliate_id', 'in', `(${apexIds.join(',')})`)
    }
    const { data } = await query.select('id')
    return NextResponse.json({ ok: true, paid: data?.length ?? 0, batch })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
