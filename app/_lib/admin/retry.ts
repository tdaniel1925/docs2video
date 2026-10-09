import { createAdminClient } from '../supabase/admin'
import { videoCreditCost, videoIsFree, videoPriceInputs } from '../price-quote'

/**
 * Admin "Try again" / "Approve" for a video — one place, used by the Retry
 * button, the review Approve button and the price shown BEFORE either runs.
 *
 * Who pays (unchanged rule, review B14): a review-held video was refunded when
 * it was held, so approving it charges the owner again; a failed video whose
 * charge was never given back (deducted_cost > 0) re-runs free; a failed
 * video that WAS refunded charges again. The price comes from the same
 * functions generate-video charges with (price-quote.ts), so the number in the
 * confirm box is the number charged.
 */

export interface RetryQuote {
  videoId: string
  ownerId: string
  ownerEmail: string | null
  status: string
  chargeOwner: boolean
  /** Credits the owner will be charged (0 when free). */
  credits: number
  /** One plain sentence for the confirm box. */
  words: string
}

export async function retryQuote(videoId: string): Promise<RetryQuote | null> {
  const db = createAdminClient()
  const { data: v } = await db.from('videos')
    .select('id, user_id, status, deducted_cost, output_type, detail_level, draft_data')
    .eq('id', videoId).maybeSingle()
  if (!v) return null
  const { data: owner } = await db.from('profiles').select('email, is_admin, is_beta').eq('id', v.user_id).maybeSingle()
  const chargeOwner = v.status === 'review_required' || !(v.deducted_cost && v.deducted_cost > 0)
  const free = videoIsFree({ isAdmin: owner?.is_admin, isBeta: owner?.is_beta })
  const price = videoCreditCost(videoPriceInputs(v), v.user_id)
  const who = owner?.email ?? 'the customer'
  let credits = 0
  let words: string
  if (!chargeOwner) {
    words = `Free — the first charge was never given back, so ${who} is not charged again.`
  } else if (free) {
    words = `Free — ${who} is an admin or beta account and doesn’t pay for videos.`
  } else {
    credits = price
    words = `This will charge ${who} ${price.toLocaleString('en-US')} credits.`
  }
  return { videoId: v.id, ownerId: v.user_id, ownerEmail: owner?.email ?? null, status: v.status, chargeOwner, credits, words }
}

/**
 * Re-run a failed or review-held video as its owner. Resets the row, then
 * asks generate-video (server to server) to start it again with the saved
 * inputs. Returns an error message, or null when it was started.
 */
export async function rerunVideo(videoId: string): Promise<{ error: string | null; chargeOwner: boolean; ownerId: string | null }> {
  const db = createAdminClient()
  const { data: video, error: loadErr } = await db.from('videos')
    .select('id, user_id, draft_data, status, deducted_cost').eq('id', videoId).single()
  if (loadErr || !video) return { error: 'Video not found', chargeOwner: false, ownerId: null }

  const chargeOwner = video.status === 'review_required' || !(video.deducted_cost && video.deducted_cost > 0)
  const internalSecret = (process.env.INTERNAL_API_SECRET || '').trim()
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').trim().replace(/\/+$/, '')
  if (!internalSecret) return { error: 'INTERNAL_API_SECRET not configured — cannot re-trigger generation', chargeOwner, ownerId: video.user_id }

  const { error: resetErr } = await db.from('videos')
    .update({ status: 'pending', error_message: null, progress_pct: 0, progress_detail: null }).eq('id', videoId)
  if (resetErr) return { error: resetErr.message, chargeOwner, ownerId: video.user_id }

  const draft = (video.draft_data as Record<string, unknown> | null) || {}
  const genBody = {
    videoId: video.id,
    policyData: draft.policyData ?? draft.extractedData ?? null,
    brandId: draft.brandId ?? null,
    voiceId: draft.voiceId,
    detailLevel: draft.detailLevel,
    narrationStyle: draft.narrationStyle,
    purpose: draft.purpose,
    uploadMode: draft.uploadMode,
    industry: draft.industry,
    preGeneratedScenes: draft.scenes ?? undefined,
    chargeOwner,
  }
  // Fire-and-forget — generate-video runs the pipeline in waitUntil.
  fetch(`${baseUrl}/api/generate-video`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-service': internalSecret, 'x-internal-user-id': video.user_id },
    body: JSON.stringify(genBody),
  }).catch((e) => console.error('[admin/retry] re-trigger failed:', e))
  return { error: null, chargeOwner, ownerId: video.user_id }
}
