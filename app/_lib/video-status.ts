// =============================================================================
// The only statuses a video row is allowed to hold.
//
// WHAT WENT WRONG. The database has a CHECK constraint on videos.status that
// REJECTS 'processing'. Two routes knew this and worked around it, each with
// its own comment explaining the trap. Six others did not, and wrote
// 'processing' anyway — so pressing Apply on the slide editor showed the
// customer this:
//
//   new row for relation "videos" violates check constraint "videos_status_check"
//
// A raw database error, in the interface, on a paid product.
//
// The knowledge existed. It was just written in comments in two files instead
// of being in one place the code reads, so it could not stop the other six.
// That is the actual bug — the wrong string is only the symptom.
//
// KNOWN, NOT GUESSED:
//   'pending'   — the column default, and what the two working routes insert
//   'completed' — 260 of the 313 rows in the live table
//   'failed'    — the other 53
//   'processing' — REJECTED. Two independent routes hit it and worked around it.
//
// The full allowed set has never been read back from the live database, because
// the constraint was created by hand and is in no migration in this repo. So
// this list is deliberately SMALL: only values with evidence behind them. If
// you want to add one, read the constraint first — do not reason it out.
//
//   select pg_get_constraintdef(oid) from pg_constraint
//   where conname = 'videos_status_check';
// =============================================================================

/** A job that has been accepted and is not finished. */
export const VIDEO_WORKING = 'pending' as const

/** It finished, and there is something to watch. */
export const VIDEO_DONE = 'completed' as const

/** It stopped, and there is a reason on the row. */
export const VIDEO_FAILED = 'failed' as const

export type VideoStatus = typeof VIDEO_WORKING | typeof VIDEO_DONE | typeof VIDEO_FAILED

/**
 * Every value this code is allowed to write. Anything outside it is a bet on a
 * constraint nobody has read.
 */
export const VIDEO_STATUSES: readonly VideoStatus[] = [VIDEO_WORKING, VIDEO_DONE, VIDEO_FAILED]

/**
 * Is this row still working?
 *
 * Reading is a different question from writing, and deliberately more generous.
 * Rows already in the table carry older words — 'scripting', 'assembling',
 * 'queued', and yes, 'processing' — written before the constraint existed or by
 * the render box. They must still show a progress bar rather than looking
 * finished, so this accepts anything that is not plainly an ending.
 */
export function isWorking(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return Boolean(s) && s !== VIDEO_DONE && s !== VIDEO_FAILED
}
