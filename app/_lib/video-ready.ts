import type { SupabaseClient } from '@supabase/supabase-js'
import { siteUrl } from './site-url'

/*
 * "YOUR VIDEO IS READY" — one bell notice and one email per finished project.
 *
 * WHY. The waiting screen told people "You can safely leave — we'll notify
 * you", but nothing emailed them: `sendVideoReadyEmail` existed and was never
 * called, and most finished videos (the render service marks them done
 * itself) didn't even get a bell notice. Leaving the page meant never hearing.
 *
 * HOW. The render service flips the row to 'completed' directly, so the app
 * learns about it in the stuck-video cron (every 2 minutes), which calls
 * sweepReadyVideos(). The Creatomate webhook and the cron's own recovery call
 * announceVideoReady() at the moment they finish a video.
 *
 * ONCE PER VIDEO. The bell notice (type 'video_ready', link /videos/<id>) is
 * the marker: it is written FIRST, and a project that already has one is
 * never announced again — so a re-render, a second cron run or the webhook
 * and the cron both seeing it send nothing more. If the person watched it
 * finish on the waiting screen, that screen writes the notice already read
 * (markReadySeen), so no email and no "finished while you were away".
 *
 * NEVER for drafts (only status 'completed'), never for the admin's prospect
 * demos, and never from tests: the sender is passed in, and with none given
 * it refuses to run under a test runner.
 */

export const READY_TYPE = 'video_ready'
export const readyLink = (videoId: string) => `/videos/${videoId}`

export type ReadyVideo = {
  id: string
  user_id: string
  title?: string | null
  status?: string | null
  output_type?: string | null
}

export type SendReadyEmail = (to: string, title: string, url: string, noun: string) => Promise<void>

/** What to call it in the notice and email. */
export function readyNoun(outputType: string | null | undefined): string {
  switch (outputType) {
    case 'interactive': return 'presentation'
    case 'deck': return 'slide deck'
    case 'pptx':
    case 'pdf': return 'slides'
    default: return 'video'
  }
}

/** Is this one the admin's own sales demo rather than a customer's project? */
function isProspectDemo(v: ReadyVideo): boolean {
  return typeof v.title === 'string' && v.title.startsWith('Prospect:')
}

/**
 * Write the "ready" bell notice unless this project already has one.
 * True only when THIS call wrote it — the caller may then send the email.
 */
export async function claimReadyNotice(admin: SupabaseClient, v: ReadyVideo, opts: { read: boolean }): Promise<boolean> {
  const { data: existing, error } = await admin.from('notifications')
    .select('id')
    .eq('user_id', v.user_id)
    .eq('type', READY_TYPE)
    .eq('link', readyLink(v.id))
    .limit(1)
  // Can't tell whether it was announced → don't risk a second email.
  if (error) return false
  if (existing && existing.length > 0) return false
  const noun = readyNoun(v.output_type)
  const { error: insErr } = await admin.from('notifications').insert({
    user_id: v.user_id,
    type: READY_TYPE,
    title: `Your ${noun} is ready`,
    message: v.title ? String(v.title).slice(0, 120) : `Your ${noun} has finished.`,
    link: readyLink(v.id),
    read: opts.read,
  })
  return !insErr
}

/** The default sender: Resend, via the existing template in notifications.ts. */
async function defaultSender(): Promise<SendReadyEmail | null> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return null
  const { sendVideoReadyEmail } = await import('./notifications')
  return (to, title, url, noun) => sendVideoReadyEmail(to, title, url, noun)
}

/** Announce one finished project: bell notice + email, once. */
export async function announceVideoReady(
  admin: SupabaseClient,
  v: ReadyVideo,
  deps: { send?: SendReadyEmail } = {},
): Promise<'sent' | 'skipped' | 'no-email'> {
  if (v.status && v.status !== 'completed') return 'skipped'
  if (isProspectDemo(v)) return 'skipped'
  if (!(await claimReadyNotice(admin, v, { read: false }))) return 'skipped'
  const { data: profile } = await admin.from('profiles').select('email').eq('id', v.user_id).maybeSingle()
  const to = (profile as { email?: string | null } | null)?.email
  if (!to) return 'no-email'
  const send = deps.send ?? (await defaultSender())
  if (!send) return 'no-email'
  const noun = readyNoun(v.output_type)
  await send(to, (v.title || `Your ${noun}`).slice(0, 120), `${siteUrl()}${readyLink(v.id)}`, noun)
  return 'sent'
}

/** They saw it finish on the waiting screen: mark it announced, quietly. */
export async function markReadySeen(admin: SupabaseClient, v: ReadyVideo): Promise<void> {
  if (v.status !== 'completed') return
  await claimReadyNotice(admin, v, { read: true })
}

/** How far back the cron looks for newly finished projects. It runs every
 *  2 minutes; the margin covers missed runs without reaching old projects. */
export const READY_WINDOW_MS = 45 * 60 * 1000

/** Find projects finished in the last few minutes and announce each once. */
export async function sweepReadyVideos(
  admin: SupabaseClient,
  deps: { send?: SendReadyEmail; now?: number } = {},
): Promise<number> {
  const since = new Date((deps.now ?? Date.now()) - READY_WINDOW_MS).toISOString()
  const { data, error } = await admin.from('videos')
    .select('id, user_id, title, status, output_type')
    .eq('status', 'completed')
    // The render service stamps progress_updated_at as it finishes; rows it
    // never stamped (presentations built in the app) fall back to created_at.
    .or(`progress_updated_at.gt.${since},and(progress_updated_at.is.null,created_at.gt.${since})`)
    .limit(50)
  if (error || !data) return 0
  let sent = 0
  for (const v of data as ReadyVideo[]) {
    try {
      if ((await announceVideoReady(admin, v, deps)) === 'sent') sent++
    } catch (e) {
      console.error(`[video-ready] announce failed for ${v.id}:`, e instanceof Error ? e.message : e)
    }
  }
  return sent
}
