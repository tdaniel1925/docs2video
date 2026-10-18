import { getStripe } from './stripe'

/**
 * Is the $50/mo AI Social add-on really paid for?
 *
 * profiles.social_addon_active is set by the Stripe webhook, but until the
 * 20260926_profiles_guard_v2 migration is applied a user can flip it on from
 * the browser. So when the flag says "on" we confirm with Stripe: there must
 * be a live add-on subscription carrying this user's id in its metadata (the
 * add-on checkout puts it there). Positive answers are cached briefly so a
 * posting session doesn't call Stripe on every click.
 *
 * Fails CLOSED: if Stripe can't be asked, the add-on is treated as off.
 */
const LIVE = new Set(['active', 'trialing', 'past_due'])
const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, number>() // userId -> verified-until (ms)

export async function hasSocialAddon(userId: string, profileFlag: boolean | null | undefined): Promise<boolean> {
  if (!profileFlag) return false
  const until = cache.get(userId)
  if (until && until > Date.now()) return true
  if (!process.env.STRIPE_SECRET_KEY) return false

  try {
    const stripe = getStripe()
    const safeId = userId.replace(/[^a-zA-Z0-9-]/g, '')
    const res = await stripe.subscriptions.search({
      query: `metadata['supabase_user_id']:'${safeId}' AND metadata['type']:'social_addon'`,
      limit: 10,
    })
    const priceId = process.env.STRIPE_PRICE_ADDON_SOCIAL
    const ok = res.data.some(s =>
      LIVE.has(s.status) &&
      (!priceId || s.items.data.some(i => i.price?.id === priceId)),
    )
    if (ok) cache.set(userId, Date.now() + CACHE_MS)
    else console.warn(`[social-addon] flag on but no live add-on subscription for user ${userId}`)
    return ok
  } catch (e) {
    console.error('[social-addon] Stripe check failed:', e instanceof Error ? e.message : e)
    return false
  }
}
