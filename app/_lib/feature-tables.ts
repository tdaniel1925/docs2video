import { alertOps } from './ops-alert'

// =============================================================================
// "IS THE TABLE THERE YET?" for features whose migration is run by hand.
//
// Production does not run migrations on deploy (feedback: migration drift). A
// feature that reads a table which isn't there must not break the screen it
// sits on — it hides itself and emails the owner ONE line saying which file
// to run (ops-alert throttles repeats). Same idea as trial-card.ts.
// =============================================================================

export const QA_REVIEWS_MIGRATION = 'supabase/migrations/20261010_client_questions_and_reviews.sql'

type PgError = { code?: string; message?: string } | null | undefined

/** True when the error means "that table or column doesn't exist (yet)". */
export function isMissingSchema(error: PgError): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  if (['PGRST205', '42P01', '42703', 'PGRST204', 'PGRST200'].includes(code)) return true
  const msg = String(error.message ?? '').toLowerCase()
  return /could not find the (table|column)|does not exist|schema cache/.test(msg) &&
    /(client_questions|client_question_events|client_reviews|anniversary_)/.test(msg)
}

export type Feature = 'questions' | 'reviews'

const WHAT: Record<Feature, string> = {
  questions: 'AI answers to client questions are off (questions are still emailed to the agent)',
  reviews: 'Annual reviews (policy dates, Review due, Prepare review, the Reviews box) are hidden',
}

/** Tell the owner, once per window, that the migration hasn't been run. Never throws. */
export async function alertMissingSchema(feature: Feature, detail?: string): Promise<void> {
  await alertOps({
    source: feature === 'questions' ? 'client-questions' : 'annual-reviews',
    message: `Run ${QA_REVIEWS_MIGRATION} in production. ${WHAT[feature]} until then.`,
    detail,
  }).catch(() => false)
}
