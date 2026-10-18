import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * RETIRED (2026-10-14): the Stripe billing portal is no longer used — plans,
 * cards, invoices, cancel and resume all live in Settings → Billing & credits
 * (/api/billing/manage). A browser tab opened before the change may still
 * call this and follow `url`, so it answers with our OWN billing page instead
 * of a Stripe address. No Stripe call is made.
 */
export async function POST() {
  return NextResponse.json({ url: '/settings?tab=billing', retired: true })
}
