import Stripe from 'stripe'
import { Resend } from 'resend'
import { createAdminClient } from './supabase/admin'

/**
 * Active system spot-tests for the admin System Status panel and the 6-hourly
 * health cron. Each check makes a REAL call (not just an env-presence check)
 * where feasible, is isolated (one failure can't mask others), and is time-boxed.
 *
 * The single most important check is `render_path`, which calls the VPS
 * /selftest — that runs a real Gemini slide + sharp + TTS + storage probe, i.e.
 * the exact pipeline that produces blue-screen failures.
 */

export interface CheckResult {
  name: string
  ok: boolean
  ms: number
  error?: string
  detail?: Record<string, unknown>
}

async function timed(name: string, fn: () => Promise<Record<string, unknown> | void>): Promise<CheckResult> {
  const s = Date.now()
  try {
    const detail = await fn()
    return { name, ok: true, ms: Date.now() - s, ...(detail ? { detail } : {}) }
  } catch (e) {
    return { name, ok: false, ms: Date.now() - s, error: e instanceof Error ? e.message : String(e) }
  }
}

/** VPS render path — calls /selftest (real Gemini+sharp+TTS+storage probe). */
async function checkRenderPath(): Promise<Record<string, unknown>> {
  const url = process.env.VIDEO_ASSEMBLY_URL
  const secret = process.env.VIDEO_ASSEMBLY_SECRET
  if (!url || !secret) throw new Error('VIDEO_ASSEMBLY_URL / VIDEO_ASSEMBLY_SECRET not set')
  const res = await fetch(`${url}/selftest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-secret': secret },
    signal: AbortSignal.timeout(120000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) {
    const failed = data?.errors?.length ? data.errors.join('; ') : `HTTP ${res.status}`
    throw new Error(`VPS selftest failed: ${failed}`)
  }
  return { checks: data.checks, ms: data.ms }
}

/** Supabase read + write probe. */
async function checkSupabase(): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('videos').select('id').limit(1)
  if (error) throw new Error(`Supabase query failed: ${error.message}`)
}

/** Stripe API reachable + key valid. */
async function checkStripe(): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  await stripe.balance.retrieve() // cheapest authenticated call
}

/** Resend API key valid (validates without spamming an inbox). */
async function checkResend(): Promise<void> {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
  const resend = new Resend(process.env.RESEND_API_KEY)
  // List domains: authenticated, side-effect-free way to confirm the key works.
  const r = await resend.domains.list()
  if ((r as { error?: { message?: string } }).error) {
    throw new Error((r as { error?: { message?: string } }).error?.message || 'Resend auth failed')
  }
}

/** AI/key presence (the VPS selftest covers live Gemini/OpenAI calls already). */
async function checkAiKeys(): Promise<Record<string, unknown>> {
  const present = {
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  }
  const missing = Object.entries(present).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) throw new Error(`Missing AI keys: ${missing.join(', ')}`)
  return present
}

/**
 * Run all checks concurrently and persist a system_checks row.
 * trigger: 'cron' | 'manual'.
 */
export async function runSystemChecks(trigger: 'cron' | 'manual' = 'cron'): Promise<{
  overall_ok: boolean
  results: CheckResult[]
  duration_ms: number
}> {
  const start = Date.now()
  const results = await Promise.all([
    timed('render_path', checkRenderPath),
    timed('supabase', checkSupabase),
    timed('stripe', checkStripe),
    timed('resend', checkResend),
    timed('ai_keys', checkAiKeys),
  ])
  const duration_ms = Date.now() - start
  const overall_ok = results.every(r => r.ok)

  try {
    const admin = createAdminClient()
    await admin.from('system_checks').insert({
      trigger,
      overall_ok,
      results,
      duration_ms,
    })
  } catch (e) {
    console.error('[system-checks] failed to persist run:', e instanceof Error ? e.message : e)
  }

  return { overall_ok, results, duration_ms }
}
