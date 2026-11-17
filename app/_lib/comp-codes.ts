/**
 * COMP CODES — a code typed in the sign-up form's code box that makes the new
 * account fully free: no card, no limits (owner, 2026-11-17: "give Paul a code
 * to enter at sign up that will comp him and not require credit card").
 *
 * The same comp the admin "promo user" action gives: subscription_status
 * 'enterprise', is_beta true (credits.ts lets beta accounts spend without
 * limit), card_on_file true (no card asked for), plus the Enterprise credit
 * balance.
 *
 * Codes live in app_settings under 'comp_codes' (no migration; service role
 * only — app_settings has RLS on and no public policies). Each code can be
 * locked to one email, and has a number of uses left. A code that doesn't
 * match is not an error: the sign-up form's box also takes referral codes.
 */
import { createAdminClient } from './supabase/admin'
import { ensureCreditBalance } from './credits'

export type CompCode = {
  code: string
  /** Only this email may use it (lower case). null = anyone with the code. */
  email: string | null
  usesLeft: number
  note?: string
  createdAt?: string
  redeemed?: { userId: string; email: string; at: string }[]
}

const KEY = 'comp_codes'
export const normCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '')

export async function readCompCodes(): Promise<CompCode[]> {
  const { data } = await createAdminClient().from('app_settings').select('value').eq('key', KEY).maybeSingle()
  const raw = data?.value
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? (list as CompCode[]) : []
  } catch { return [] }
}

async function writeCompCodes(list: CompCode[]) {
  await createAdminClient().from('app_settings').upsert(
    { key: KEY, value: JSON.stringify(list), updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

/** Which code (if any) this sign-up may use. Pure: no database. */
export function matchCompCode(list: CompCode[], code: string, email: string): CompCode | null {
  const want = normCode(code)
  if (!want) return null
  const hit = list.find((c) => normCode(c.code) === want)
  if (!hit || hit.usesLeft < 1) return null
  if (hit.email && hit.email.trim().toLowerCase() !== email.trim().toLowerCase()) return null
  return hit
}

/**
 * Called by sign-up with the code they typed. True when it was a comp code and
 * the account is now comped. Never throws (a sign-up must not fail over this).
 */
export async function redeemCompCode(code: string, email: string, userId: string): Promise<boolean> {
  try {
    const list = await readCompCodes()
    const hit = matchCompCode(list, code, email)
    if (!hit) return false
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({
      subscription_status: 'enterprise',
      is_beta: true,
      card_on_file: true,
    }).eq('id', userId)
    if (error) { console.error('[comp-code] profile update failed:', error.message); return false }
    await ensureCreditBalance(userId, 'enterprise')
    hit.usesLeft -= 1
    hit.redeemed = [...(hit.redeemed ?? []), { userId, email: email.trim().toLowerCase(), at: new Date().toISOString() }]
    await writeCompCodes(list)
    console.log(`[comp-code] ${normCode(hit.code)} used by ${userId}; ${hit.usesLeft} left`)
    return true
  } catch (e) {
    console.error('[comp-code] redeem failed:', e instanceof Error ? e.message : e)
    return false
  }
}
