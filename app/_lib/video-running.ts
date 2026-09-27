/**
 * Every status that means "this job is still running". ONE list, used by the
 * one-at-a-time limit in generate-video, the stuck-video cron, and the
 * generating page — so a job the cron watches always counts against the limit,
 * and the page never spins forever on a status it doesn't recognise.
 *
 * Pure (no imports) so browser pages can use it too.
 */
export const IN_PROGRESS_STATUSES = [
  'pending', 'starting', 'scripting', 'generating_slides', 'generating_audio',
  'assembling', 'queued', 'processing', 'rendering',
] as const
