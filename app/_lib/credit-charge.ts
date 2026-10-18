import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { checkCredits, deductCredits, refundCredits, spendBlockMessage } from './credits'

/**
 * ONE safe way for a one-off tool to charge credits (audit H5):
 *
 *   1. check the user may spend and can afford it (card, past_due, balance)
 *   2. take the credits BEFORE the work starts
 *   3. run the work
 *   4. if the work throws OR answers with an error (status 400+), give the
 *      credits back — exactly once
 *
 * Before this, many tools charged first and kept the credits when the AI call
 * timed out or the upload was bad, and a few charged AFTER the work and
 * ignored a failed deduction (free work). Routes wrap their paid part in
 * `runCharged` instead of hand-rolling check/deduct/refund.
 *
 * Streaming responses: only the status at the moment the response is returned
 * is seen here, so a stream that fails half-way is not refunded. None of the
 * routes using this stream today.
 */
export interface ChargeSpec {
  userId: string
  /** Credits to take (use CREDIT_COSTS / costForUser — never a bare 1). */
  amount: number
  /** Ledger action name, e.g. 'scene-edit'. */
  action: string
  description?: string
  /** Only a real videos.id uuid — anything else must stay undefined. */
  videoId?: string
}

/** The 402 a route returns when the user can't be charged. */
export function creditDeniedResponse(
  check: { remaining: number; blockedReason?: Parameters<typeof spendBlockMessage>[0] },
  amount: number,
): NextResponse {
  if (check.blockedReason) {
    return NextResponse.json(
      { error: spendBlockMessage(check.blockedReason), code: check.blockedReason },
      { status: 402 },
    )
  }
  return NextResponse.json(
    { error: `Not enough credits. Need ${amount.toLocaleString()}, have ${check.remaining.toLocaleString()}.`, code: 'insufficient_credits' },
    { status: 402 },
  )
}

export type ChargeResult =
  | { ok: true; refund: () => Promise<void> }
  | { ok: false; response: NextResponse }

/**
 * Take the credits now and hand back a `refund()` that is safe to call more
 * than once (only the first call gives credits back). Use this directly when
 * a route can't be wrapped by runCharged (e.g. it refunds from inside a
 * background task).
 */
export async function chargeCredits(spec: ChargeSpec): Promise<ChargeResult> {
  const amount = Math.max(0, Math.round(spec.amount))
  if (amount === 0) return { ok: true, refund: async () => {} }

  const check = await checkCredits(spec.userId, amount)
  if (!check.allowed) return { ok: false, response: creditDeniedResponse(check, amount) }

  const ok = await deductCredits(spec.userId, amount, spec.action, spec.videoId, spec.description)
  if (!ok) {
    // Lost a race with another charge, or the wallet row couldn't be read.
    // Re-check so the message says why.
    const again = await checkCredits(spec.userId, amount)
    return {
      ok: false,
      response: again.allowed
        ? NextResponse.json({ error: 'We could not charge your credits just now. Please try again.' }, { status: 402 })
        : creditDeniedResponse(again, amount),
    }
  }

  const chargeKey = randomUUID()
  let refunded = false
  return {
    ok: true,
    refund: async () => {
      if (refunded) return
      refunded = true
      await refundCredits(spec.userId, amount, spec.action, chargeKey)
    },
  }
}

/**
 * Charge → run `work` → refund if it throws or returns an error status.
 * A thrown error becomes a friendly 500 (the detail goes to the server log,
 * never to the user).
 */
export async function runCharged(spec: ChargeSpec, work: () => Promise<Response>): Promise<Response> {
  const charge = await chargeCredits(spec)
  if (!charge.ok) return charge.response

  try {
    const res = await work()
    if (res.status >= 400) await charge.refund()
    return res
  } catch (err) {
    console.error(`[credit-charge] ${spec.action} failed after charging — refunding:`, err instanceof Error ? err.message : err)
    await charge.refund()
    return NextResponse.json(
      { error: 'Something went wrong and your credits were returned. Please try again.' },
      { status: 500 },
    )
  }
}
