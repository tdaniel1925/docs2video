import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CREDIT_COSTS, checkCredits, deductCredits, refundCredits, spendBlockMessage } from './credits'
import { alertOps } from './ops-alert'
import { upsertErrorLog } from './error-logger'
import { sendWithResend, appUrl } from './client-email'
import { sendNotification } from './notify'
import { twilioSend, checkTextingHealth, type TextingHealth } from './twilio-rest'
import {
  normalizePhone, formatPhone, canSendPicture, buildClientText, optKeywordOf, triggerForEvent,
  alertDay, alertSendAt, alertMessage, normalizeChannel, isValidTimeZone,
  CLIENT_TEXT_DAILY_CAP, ALERT_TEXT_DAILY_CAP, CODE_MINUTES, CODE_MAX_TRIES,
  DEFAULT_ALERT_SETTINGS, HOT_TRIGGERS,
  type AlertSettings, type AlertChannel, type HotTrigger,
} from './texting'

// =============================================================================
// TEXTING ON THE SERVER — send a client text, verify the agent's mobile,
// hot-client alerts, and what comes back from Twilio (STOP / HELP / replies /
// delivery reports).
//
// Every function takes the service-role client as `db`, so tests can hand in
// a fake one. Twilio is reached only through twilio-rest.ts (plain fetch).
//
// TABLES (supabase/migrations/20261010_texting_and_alerts.sql — run by hand):
// agent_alert_settings, hot_alerts, client_text_consent, sms_opt_outs,
// text_messages. Until it runs, texting hides itself and the owner gets one
// email (textingReady).
// =============================================================================

type Db = SupabaseClient
export const TEXTING_MIGRATION = 'supabase/migrations/20261010_texting_and_alerts.sql'
const TABLES = ['agent_alert_settings', 'hot_alerts', 'client_text_consent', 'sms_opt_outs', 'text_messages'] as const

type PgError = { code?: string; message?: string } | null | undefined
export function isMissingTable(error: PgError): boolean {
  const code = String(error?.code ?? '')
  return code === 'PGRST205' || code === '42P01' || code === '42703' || code === 'PGRST204'
}

let readyCache: { at: number; ok: boolean } | null = null
export function resetTextingReadyCache() { readyCache = null }

/**
 * Are the texting tables there? Reads a real row from each (a status-only
 * probe once said a made-up table existed). Missing → false, and the owner is
 * emailed which file to run. A "yes" is remembered for 5 minutes.
 */
export async function textingReady(db: Db): Promise<boolean> {
  if (readyCache?.ok && Date.now() - readyCache.at < 5 * 60_000) return true
  for (const t of TABLES) {
    const { error } = await db.from(t).select('*').limit(1)
    if (error) {
      if (isMissingTable(error)) {
        await alertOps({ source: 'texting', message: `Run ${TEXTING_MIGRATION} in production. Hot-client alerts and Send by text are hidden until then (table ${t} is missing).` }).catch(() => false)
      } else {
        console.error(`[texting] could not read ${t}:`, error.message)
      }
      readyCache = { at: Date.now(), ok: false }
      return false
    }
  }
  readyCache = { at: Date.now(), ok: true }
  return true
}

/** A Twilio problem the owner should see on admin "What needs you". Never throws. */
export async function recordTwilioError(o: { what: string; code?: string | null; message?: string | null; userId?: string | null; videoId?: string | null }) {
  await upsertErrorLog({
    source: 'app',
    severity: 'error',
    endpoint: 'twilio',
    message: `${o.what}${o.code ? ` (Twilio ${o.code})` : ''}`,
    detail: o.message ?? null,
    userId: o.userId ?? null,
    videoId: o.videoId ?? null,
  }).catch(() => {})
}

// ── Settings ────────────────────────────────────────────────────────────────

type SettingsRow = {
  user_id: string; channel: string; on_finished: boolean; on_twice: boolean; on_pdf: boolean; on_booking: boolean
  phone: string | null; phone_verified_at: string | null; pending_phone: string | null
  code_hash: string | null; code_expires_at: string | null; code_tries: number; time_zone: string | null
}

export function settingsFromRow(r: Partial<SettingsRow> | null | undefined): AlertSettings {
  if (!r) return { ...DEFAULT_ALERT_SETTINGS, triggers: { ...DEFAULT_ALERT_SETTINGS.triggers } }
  return {
    channel: normalizeChannel(r.channel),
    triggers: { finished: r.on_finished !== false, twice: r.on_twice !== false, pdf: r.on_pdf !== false, booking: r.on_booking !== false },
    phone: r.phone ?? null,
    phoneVerified: !!(r.phone && r.phone_verified_at),
    timeZone: r.time_zone ?? null,
  }
}

export async function getAlertSettings(db: Db, userId: string): Promise<AlertSettings> {
  const { data } = await db.from('agent_alert_settings').select('*').eq('user_id', userId).maybeSingle()
  return settingsFromRow(data as SettingsRow | null)
}

export type SaveResult = { ok: true; settings: AlertSettings } | { ok: false; status: number; error: string }

export async function saveAlertSettings(db: Db, userId: string, patch: {
  channel?: unknown; triggers?: Partial<Record<HotTrigger, unknown>>; timeZone?: unknown
}): Promise<SaveResult> {
  const current = await getAlertSettings(db, userId)
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() }
  if (patch.channel !== undefined) {
    const ch = normalizeChannel(patch.channel)
    if (ch !== patch.channel) return { ok: false, status: 400, error: 'Pick Text, Email, Both or Off.' }
    if ((ch === 'text' || ch === 'both') && !current.phoneVerified) {
      return { ok: false, status: 400, error: 'Confirm your mobile number first — then we can text you.' }
    }
    row.channel = ch
  }
  if (patch.triggers) {
    const map: Record<HotTrigger, string> = { finished: 'on_finished', twice: 'on_twice', pdf: 'on_pdf', booking: 'on_booking' }
    for (const t of HOT_TRIGGERS) if (typeof patch.triggers[t] === 'boolean') row[map[t]] = patch.triggers[t]
  }
  if (patch.timeZone !== undefined && isValidTimeZone(patch.timeZone)) row.time_zone = patch.timeZone
  const { error } = await db.from('agent_alert_settings').upsert(row, { onConflict: 'user_id' })
  if (error) {
    console.error('[texting] save settings failed:', error.message)
    return { ok: false, status: 503, error: 'That was NOT saved — please try again.' }
  }
  return { ok: true, settings: await getAlertSettings(db, userId) }
}

// ── Verify the agent's mobile ───────────────────────────────────────────────

function codeHash(userId: string, phone: string, code: string) {
  return crypto.createHash('sha256').update(`${userId}:${phone}:${code}`).digest('hex')
}

export type Outcome = { ok: true; message?: string } | { ok: false; status: number; error: string }

export async function sendVerifyCode(db: Db, userId: string, rawPhone: unknown, o: { health?: TextingHealth; code?: string } = {}): Promise<Outcome> {
  const phone = normalizePhone(String(rawPhone ?? ''))
  if (!phone) return { ok: false, status: 400, error: 'That doesn’t look like a mobile number. Try 10 digits, like 512 555 0100.' }
  const health = o.health ?? await checkTextingHealth()
  if (!health.agentTexts) return { ok: false, status: 503, error: `We can’t send texts right now. ${health.detail}` }
  if (await isOptedOut(db, phone)) return { ok: false, status: 409, error: 'This number replied STOP to our texts. Text START to us from it first, then try again.' }
  // At most 5 codes an hour per account.
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('text_messages').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('kind', 'code').gte('created_at', hourAgo)
  if ((count ?? 0) >= 5) return { ok: false, status: 429, error: 'Too many codes in the last hour. Please wait a bit and try again.' }

  const code = o.code ?? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const { error } = await db.from('agent_alert_settings').upsert({
    user_id: userId, pending_phone: phone, code_hash: codeHash(userId, phone, code),
    code_expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(), code_tries: 0, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) return { ok: false, status: 503, error: 'We could not start the check just now. Please try again.' }

  const body = `Docs2Video code: ${code}. It confirms this number for client alerts. It expires in ${CODE_MINUTES} minutes.`
  const sent = await twilioSend({ to: phone, body })
  await logText(db, { user_id: userId, direction: 'out', kind: 'code', phone, body: 'Docs2Video code: ******', twilio_sid: sent.ok ? sent.sid : null, status: sent.ok ? sent.status : 'failed', error_code: sent.ok ? null : sent.code, error: sent.ok ? null : sent.message })
  if (!sent.ok) {
    await recordTwilioError({ what: 'A verify code did not send', code: sent.code, message: sent.message, userId })
    return { ok: false, status: 502, error: 'The code did NOT send. Check the number and try again.' }
  }
  return { ok: true, message: `We texted a 6-digit code to ${formatPhone(phone)}.` }
}

export async function checkVerifyCode(db: Db, userId: string, rawCode: unknown): Promise<Outcome> {
  const code = String(rawCode ?? '').replace(/\D/g, '')
  const { data } = await db.from('agent_alert_settings').select('*').eq('user_id', userId).maybeSingle()
  const r = data as SettingsRow | null
  if (!r?.pending_phone || !r.code_hash) return { ok: false, status: 400, error: 'Press Send code first.' }
  if (!r.code_expires_at || new Date(r.code_expires_at).getTime() < Date.now()) return { ok: false, status: 400, error: 'That code has expired. Press Send code for a new one.' }
  if ((r.code_tries ?? 0) >= CODE_MAX_TRIES) return { ok: false, status: 429, error: 'Too many wrong tries. Press Send code for a new one.' }
  if (code.length !== 6 || codeHash(userId, r.pending_phone, code) !== r.code_hash) {
    await db.from('agent_alert_settings').update({ code_tries: (r.code_tries ?? 0) + 1 }).eq('user_id', userId)
    return { ok: false, status: 400, error: 'That code isn’t right. Check the text and try again.' }
  }
  const { error } = await db.from('agent_alert_settings').update({
    phone: r.pending_phone, phone_verified_at: new Date().toISOString(), pending_phone: null, code_hash: null, code_expires_at: null, code_tries: 0,
  }).eq('user_id', userId)
  if (error) return { ok: false, status: 503, error: 'That was NOT saved — please try again.' }
  return { ok: true, message: `Confirmed: ${formatPhone(r.pending_phone)}.` }
}

// ── Opt-outs and consent ────────────────────────────────────────────────────

export async function isOptedOut(db: Db, phone: string): Promise<boolean> {
  const { data, error } = await db.from('sms_opt_outs').select('opted_out').eq('phone', phone).maybeSingle()
  if (error) return true // can't tell → don't text (fail closed)
  return (data as { opted_out?: boolean } | null)?.opted_out === true
}

export async function setOptOut(db: Db, phone: string, optedOut: boolean, keyword: string) {
  await db.from('sms_opt_outs').upsert({ phone, opted_out: optedOut, keyword, updated_at: new Date().toISOString() }, { onConflict: 'phone' })
}

export async function hasConsent(db: Db, userId: string, phone: string): Promise<boolean> {
  const { data } = await db.from('client_text_consent').select('id').eq('user_id', userId).eq('phone', phone).maybeSingle()
  return !!data
}

async function logText(db: Db, row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.from('text_messages').insert(row).select('id').single()
  if (error) {
    if (String(error.code) !== '23505') console.error('[texting] text log failed:', error.message)
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

// ── Send a client text ──────────────────────────────────────────────────────

const PICTURE_EXT = /\.(jpe?g|png|gif)(\?|$)/i

export type ClientTextResult =
  | { ok: true; to: string; withPicture: boolean; credits: number }
  | { ok: false; status: number; error: string; code?: string }

/**
 * Text a client the share link. In order: tables there → texting allowed for
 * clients (registered number) → good number → not opted out → consent (ticked
 * now, or ticked before for this number) → daily caps → credits (card needed)
 * → record → send → refund + remove the record if Twilio refuses.
 */
export async function sendClientText(db: Db, o: {
  userId: string
  videoId: string
  phone: unknown
  clientName?: string | null
  clientId?: string | null
  note?: string | null
  consent?: boolean
  health?: TextingHealth
}): Promise<ClientTextResult> {
  const phone = normalizePhone(String(o.phone ?? ''))
  if (!phone) return { ok: false, status: 400, error: 'That doesn’t look like a mobile number. Try 10 digits, like 512 555 0100.' }

  const health = o.health ?? await checkTextingHealth()
  if (!health.clientTexts) {
    return { ok: false, status: 409, code: 'not_registered', error: `Texting clients isn’t switched on yet: ${health.detail}` }
  }

  if (await isOptedOut(db, phone)) {
    return { ok: false, status: 409, code: 'opted_out', error: 'This person replied STOP, so they can’t be texted. Send it by email instead.' }
  }

  const { data: video } = await db.from('videos').select('id, title, thumbnail_url, output_type, script, agent_note')
    .eq('id', o.videoId).eq('user_id', o.userId).maybeSingle()
  if (!video) return { ok: false, status: 404, error: 'Video not found' }

  // Consent: once per agent + number, stored.
  if (!(await hasConsent(db, o.userId, phone))) {
    if (o.consent !== true) return { ok: false, status: 400, code: 'consent', error: 'Tick “This client agreed to get texts from me” first.' }
    const { error } = await db.from('client_text_consent').insert({
      user_id: o.userId, phone, client_id: o.clientId || null, client_name: String(o.clientName ?? '').slice(0, 120) || null,
    })
    if (error && String(error.code) !== '23505') return { ok: false, status: 503, error: 'We could not save that they agreed, so nothing was sent. Please try again.' }
  }

  // Caps: per account per day, and per person per day.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
  const [{ count: today, error: capErr }, { count: toThem }] = await Promise.all([
    db.from('text_messages').select('id', { count: 'exact', head: true }).eq('user_id', o.userId).eq('kind', 'client').gte('created_at', dayAgo),
    db.from('text_messages').select('id', { count: 'exact', head: true }).eq('user_id', o.userId).eq('kind', 'client').eq('phone', phone).gte('created_at', dayAgo),
  ])
  if (capErr) return { ok: false, status: 503, error: 'We could not check today’s texts, so nothing was sent. Please try again.' }
  if ((today ?? 0) >= CLIENT_TEXT_DAILY_CAP) return { ok: false, status: 429, error: `You’ve sent ${CLIENT_TEXT_DAILY_CAP} texts today — the daily limit. Try again tomorrow, or send by email.` }
  if ((toThem ?? 0) >= 3) return { ok: false, status: 429, error: 'You’ve already texted this person 3 times today. Please wait until tomorrow.' }

  // Credits (also refuses an account without a card, and a late payment).
  const amount = CREDIT_COSTS['client-text']
  const check = await checkCredits(o.userId, amount)
  if (!check.allowed) {
    return check.blockedReason
      ? { ok: false, status: 402, code: check.blockedReason, error: spendBlockMessage(check.blockedReason) }
      : { ok: false, status: 402, code: 'insufficient_credits', error: `Not enough credits. A text is ${amount.toLocaleString()}, you have ${check.remaining.toLocaleString()}.` }
  }
  if (!(await deductCredits(o.userId, amount, 'client-text', o.videoId, `Text to ${formatPhone(phone)}`))) {
    return { ok: false, status: 402, error: 'We could not charge your credits just now. Nothing was sent. Please try again.' }
  }

  const { data: profile } = await db.from('profiles').select('full_name, company_name').eq('id', o.userId).maybeSingle()
  const agentName = (profile as { full_name?: string; company_name?: string } | null)?.full_name
    || (profile as { company_name?: string } | null)?.company_name || ''
  const v = video as { id: string; title: string | null; thumbnail_url: string | null; output_type: string | null; script: unknown; agent_note: string | null }
  const thing = v.output_type === 'interactive' || v.output_type === 'deck' ? 'presentation' : 'video'
  const insurance = !!(v.script as { _pipeline_input?: { policyData?: { deathBenefit?: unknown } } } | null)?._pipeline_input?.policyData?.deathBenefit

  // Recorded like an emailed share (so Who watched, Home and the dashboard
  // count it): a sent_emails row whose id rides in the link as ?s=.
  const shareRow = { user_id: o.userId, video_id: o.videoId, to_email: phone, to_name: String(o.clientName ?? '').slice(0, 120) || null, subject: 'Text message' }
  let shareId: string | null = null
  const first = await db.from('sent_emails').insert({ ...shareRow, email_type: 'text' }).select('id').single()
  if (!first.error) shareId = (first.data as { id: string }).id
  else {
    const second = await db.from('sent_emails').insert(shareRow).select('id').single()
    if (!second.error) shareId = (second.data as { id: string }).id
  }
  const link = `${appUrl()}/watch/${v.id}${shareId ? `?s=${shareId}` : ''}`
  const body = buildClientText({ clientName: o.clientName, agentName, link, note: o.note ?? v.agent_note, thing, insurance })
  const mediaUrl = canSendPicture(phone) && /^https:\/\//i.test(String(v.thumbnail_url ?? '')) && PICTURE_EXT.test(String(v.thumbnail_url)) ? String(v.thumbnail_url) : null

  const rowId = await logText(db, {
    user_id: o.userId, video_id: o.videoId, sent_email_id: shareId, direction: 'out', kind: 'client',
    phone, body, media_url: mediaUrl, status: 'sending', credits: amount,
  })
  const sent = await twilioSend({ to: phone, body, mediaUrl, statusCallback: `${appUrl()}/api/webhooks/twilio/status` })

  if (!sent.ok) {
    await refundCredits(o.userId, amount, 'client-text', rowId ?? `${o.videoId}:${Date.now()}`)
    if (shareId) await db.from('sent_emails').delete().eq('id', shareId)
    if (rowId) await db.from('text_messages').update({ status: 'failed', error_code: sent.code, error: sent.message.slice(0, 500), credits: 0 }).eq('id', rowId)
    await recordTwilioError({ what: 'A text to a client did not send', code: sent.code, message: sent.message, userId: o.userId, videoId: o.videoId })
    return { ok: false, status: 502, error: 'The text did NOT send and your credits were given back. Try again, or send by email.' }
  }
  if (rowId) await db.from('text_messages').update({ twilio_sid: sent.sid, status: sent.status }).eq('id', rowId)
  await logClientActivity(db, o.userId, o.clientId ?? null, phone, v.title ?? 'Untitled', o.videoId)
  return { ok: true, to: phone, withPicture: !!mediaUrl, credits: amount }
}

async function logClientActivity(db: Db, userId: string, clientId: string | null, phone: string, title: string, videoId: string) {
  try {
    let cid = clientId
    if (!cid) {
      const { data } = await db.from('clients').select('id').eq('user_id', userId).eq('phone', phone).maybeSingle()
      cid = (data as { id: string } | null)?.id ?? null
    }
    if (!cid) return
    await db.from('client_activities').insert({
      client_id: cid, user_id: userId, type: 'text_sent', title: `Video texted: ${title}`,
      description: `Texted "${title}" to ${formatPhone(phone)}`, metadata: { video_id: videoId },
    })
  } catch { /* history is a nice-to-have */ }
}

// ── Hot-client alerts ───────────────────────────────────────────────────────

export type HotEventResult = 'none' | 'off' | 'own' | 'duplicate' | 'queued' | 'sent' | 'failed' | 'not_ready'

/**
 * Called by /api/track-view after it stored a share-page event — and only
 * when the viewer is NOT the owner (`isOwner` must be false; it is checked
 * here too so a caller mistake can never alert an agent about themselves).
 */
export async function handleHotEvent(db: Db, o: {
  videoId: string
  ownerId: string
  eventType: string
  metadata: Record<string, unknown> | null
  viewerIp: string
  isOwner: boolean
  now?: Date
}): Promise<HotEventResult> {
  if (o.isOwner) return 'own'
  const share = typeof o.metadata?.share === 'string' && /^[0-9a-f-]{36}$/i.test(o.metadata.share) ? o.metadata.share : null
  const viewerKey = share ? `s:${share}` : `ip:${o.viewerIp}`

  let views = 0
  if (o.eventType === 'view') {
    let q = db.from('video_analytics').select('id', { count: 'exact', head: true }).eq('video_id', o.videoId).eq('event_type', 'view')
    q = share ? q.eq('metadata->>share', share) : q.eq('viewer_ip', o.viewerIp)
    const { count } = await q
    views = count ?? 0
  }
  const trigger = triggerForEvent(o.eventType, o.metadata, views)
  if (!trigger) return 'none'
  if (!(await textingReady(db))) return 'not_ready'

  const settings = await getAlertSettings(db, o.ownerId)
  if (settings.channel === 'off' || !settings.triggers[trigger]) return 'off'

  const now = o.now ?? new Date()
  const { quiet, sendAt } = alertSendAt(now, settings.timeZone)
  const { data, error } = await db.from('hot_alerts').insert({
    user_id: o.ownerId, video_id: o.videoId, viewer_key: viewerKey, trigger,
    day: alertDay(now, settings.timeZone), channel: settings.channel, status: 'queued', send_after: sendAt.toISOString(),
  }).select('*').single()
  if (error) {
    if (String(error.code) === '23505') return 'duplicate' // one per client per video per trigger per day
    console.error('[texting] hot alert insert failed:', error.message)
    return 'failed'
  }
  if (quiet) return 'queued'
  return (await deliverHotAlert(db, data as HotAlertRow)) ? 'sent' : 'failed'
}

export type HotAlertRow = { id: string; user_id: string; video_id: string; viewer_key: string; trigger: HotTrigger; channel: AlertChannel; status: string }

/** Send one queued alert. Claims it first, so two runs can't both send it. */
export async function deliverHotAlert(db: Db, row: HotAlertRow, health?: TextingHealth): Promise<boolean> {
  const { data: claimed } = await db.from('hot_alerts').update({ status: 'sending' }).eq('id', row.id).eq('status', 'queued').select('id')
  if (!claimed || (claimed as unknown[]).length === 0) return false

  const settings = await getAlertSettings(db, row.user_id)
  const [{ data: video }, { data: profile }] = await Promise.all([
    db.from('videos').select('id, title').eq('id', row.video_id).maybeSingle(),
    db.from('profiles').select('email, full_name').eq('id', row.user_id).maybeSingle(),
  ])
  // Who it was: the tagged email/text, else the quote's client.
  let clientName: string | null = null
  let clientPhone: string | null = null
  if (row.viewer_key.startsWith('s:')) {
    const { data: s } = await db.from('sent_emails').select('to_email, to_name').eq('id', row.viewer_key.slice(2)).maybeSingle()
    const se = s as { to_email?: string; to_name?: string | null } | null
    clientName = se?.to_name || (se?.to_email && !se.to_email.startsWith('+') ? se.to_email : null)
    if (se?.to_email?.startsWith('+')) clientPhone = formatPhone(se.to_email)
  }
  if (!clientName) {
    const { data: q } = await db.from('quotes').select('client_name').eq('video_id', row.video_id).neq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle()
    clientName = (q as { client_name?: string } | null)?.client_name ?? null
  }
  let visits = 0
  {
    let q = db.from('video_analytics').select('id', { count: 'exact', head: true }).eq('video_id', row.video_id).eq('event_type', 'view')
    q = row.viewer_key.startsWith('s:') ? q.eq('metadata->>share', row.viewer_key.slice(2)) : q.eq('viewer_ip', row.viewer_key.slice(3))
    visits = (await q).count ?? 0
  }
  const title = (video as { title?: string } | null)?.title ?? null
  const link = `${appUrl()}/videos/${row.video_id}`
  const message = alertMessage({ trigger: row.trigger, clientName, title, visits, clientPhone, link })

  let textOk = false
  let emailOk = false
  const errors: string[] = []
  const wantText = row.channel === 'text' || row.channel === 'both'
  const wantEmail = row.channel === 'email' || row.channel === 'both'

  if (wantText && settings.phone && settings.phoneVerified) {
    const h = health ?? await checkTextingHealth()
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
    const { count } = await db.from('text_messages').select('id', { count: 'exact', head: true }).eq('user_id', row.user_id).eq('kind', 'alert').gte('created_at', dayAgo)
    if (!h.agentTexts) errors.push(`texting down: ${h.detail}`)
    else if ((count ?? 0) >= ALERT_TEXT_DAILY_CAP) errors.push('daily alert-text limit reached')
    else if (await isOptedOut(db, settings.phone)) errors.push('agent phone replied STOP')
    else {
      const sent = await twilioSend({ to: settings.phone, body: message })
      await logText(db, { user_id: row.user_id, video_id: row.video_id, direction: 'out', kind: 'alert', phone: settings.phone, body: message, twilio_sid: sent.ok ? sent.sid : null, status: sent.ok ? sent.status : 'failed', error_code: sent.ok ? null : sent.code, error: sent.ok ? null : sent.message })
      if (sent.ok) textOk = true
      else {
        errors.push(`text: ${sent.code} ${sent.message}`)
        await recordTwilioError({ what: 'A hot-client alert text did not send', code: sent.code, message: sent.message, userId: row.user_id, videoId: row.video_id })
      }
    }
  }
  // Email when asked for — and as the fallback when a text couldn't go.
  const email = (profile as { email?: string } | null)?.email
  if ((wantEmail || (wantText && !textOk)) && email) {
    const r = await sendWithResend({
      from: 'Docs2Video <notifications@docs2video.com>', to: email,
      subject: message.split('\n')[0].slice(0, 120),
      html: alertEmailHtml(message, link),
    })
    if (r.ok) emailOk = true
    else errors.push(`email: ${r.error}`)
  }
  await sendNotification(db, row.user_id, { type: 'hot_client', title: message.split('\n')[0].slice(0, 120), link: `/videos/${row.video_id}` }).catch(() => {})

  const ok = textOk || emailOk
  await db.from('hot_alerts').update({ status: ok ? 'sent' : 'failed', sent_at: ok ? new Date().toISOString() : null, message, error: errors.join(' | ').slice(0, 500) || null }).eq('id', row.id)
  return ok
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

export function alertEmailHtml(message: string, link: string): string {
  const [head, ...rest] = message.split('\n').filter((l) => !l.startsWith('Open: '))
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;">
  <h1 style="font-size:20px;font-weight:800;color:#0B2545;margin:0 0 12px;">${esc(head)}</h1>
  ${rest.map((l) => `<p style="font-size:15px;color:#333;margin:0 0 8px;">${esc(l)}</p>`).join('')}
  <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#0B2545;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;">See what they watched →</a></p>
  <p style="font-size:11px;color:#999;">Change these alerts in Settings → Email &amp; sending.</p>
</div>`
}

/** The cron: send alerts held back by quiet hours. */
export async function sendQueuedAlerts(db: Db, now = new Date()): Promise<{ tried: number; sent: number }> {
  if (!(await textingReady(db))) return { tried: 0, sent: 0 }
  const { data } = await db.from('hot_alerts').select('*').eq('status', 'queued').lte('send_after', now.toISOString()).order('send_after', { ascending: true }).limit(50)
  let sent = 0
  const rows = (data ?? []) as HotAlertRow[]
  for (const r of rows) if (await deliverHotAlert(db, r)) sent++
  return { tried: rows.length, sent }
}

// ── What Twilio sends us ────────────────────────────────────────────────────

export type InboundResult = 'stop' | 'start' | 'help' | 'reply' | 'duplicate' | 'unknown'

/**
 * A text sent TO our number. STOP/START/HELP change the do-not-text list
 * (Twilio itself answers those with the standard reply). Anything else from a
 * client we texted is a REPLY: stored against that video and passed to the
 * agent (bell + text or email).
 */
export async function handleInbound(db: Db, params: Record<string, string>): Promise<InboundResult> {
  const from = normalizePhone(params.From) ?? String(params.From ?? '')
  const body = String(params.Body ?? '').trim()
  const sid = String(params.MessageSid ?? params.SmsSid ?? '') || null
  if (!from) return 'unknown'

  // The last client text we sent to this number — whose client this is.
  const { data: last } = await db.from('text_messages').select('user_id, video_id, sent_email_id')
    .eq('phone', from).eq('kind', 'client').eq('direction', 'out').order('created_at', { ascending: false }).limit(1).maybeSingle()
  const owner = last as { user_id: string; video_id: string | null; sent_email_id: string | null } | null

  const kw = optKeywordOf(body, params.OptOutType)
  if (kw) {
    const id = await logText(db, { user_id: owner?.user_id ?? null, video_id: owner?.video_id ?? null, direction: 'in', kind: 'keyword', phone: from, body: body.slice(0, 160), twilio_sid: sid })
    if (sid && !id) return 'duplicate'
    if (kw === 'STOP') await setOptOut(db, from, true, 'STOP')
    if (kw === 'START') await setOptOut(db, from, false, 'START')
    if (kw === 'STOP' && owner) {
      await sendNotification(db, owner.user_id, { type: 'text_opt_out', title: `${formatPhone(from)} replied STOP — no more texts to them`, link: owner.video_id ? `/videos/${owner.video_id}` : undefined }).catch(() => {})
    }
    return kw === 'STOP' ? 'stop' : kw === 'START' ? 'start' : 'help'
  }
  if (!owner) return 'unknown'

  const id = await logText(db, { user_id: owner.user_id, video_id: owner.video_id, sent_email_id: owner.sent_email_id, direction: 'in', kind: 'reply', phone: from, body: body.slice(0, 1600), twilio_sid: sid })
  if (sid && !id) return 'duplicate'

  let name: string | null = null
  if (owner.sent_email_id) {
    const { data } = await db.from('sent_emails').select('to_name').eq('id', owner.sent_email_id).maybeSingle()
    name = (data as { to_name?: string | null } | null)?.to_name ?? null
  }
  const who = name || formatPhone(from)
  const short = body.length > 120 ? `${body.slice(0, 119)}…` : body
  const link = owner.video_id ? `${appUrl()}/videos/${owner.video_id}` : `${appUrl()}/dashboard`
  const msg = `${who} replied: "${short}"\nCall: ${formatPhone(from)}\nOpen: ${link}`
  await sendNotification(db, owner.user_id, { type: 'text_reply', title: `${who} replied to your text`, message: short, link: owner.video_id ? `/videos/${owner.video_id}` : undefined }).catch(() => {})

  // Pass it on the way the agent gets alerts (text if confirmed, else email).
  const settings = await getAlertSettings(db, owner.user_id)
  let passed = false
  if ((settings.channel === 'text' || settings.channel === 'both') && settings.phone && settings.phoneVerified && !(await isOptedOut(db, settings.phone))) {
    const sent = await twilioSend({ to: settings.phone, body: msg })
    await logText(db, { user_id: owner.user_id, video_id: owner.video_id, direction: 'out', kind: 'alert', phone: settings.phone, body: msg, twilio_sid: sent.ok ? sent.sid : null, status: sent.ok ? sent.status : 'failed', error_code: sent.ok ? null : sent.code })
    passed = sent.ok
  }
  if (!passed) {
    const { data: p } = await db.from('profiles').select('email').eq('id', owner.user_id).maybeSingle()
    const email = (p as { email?: string } | null)?.email
    if (email) await sendWithResend({ from: 'Docs2Video <notifications@docs2video.com>', to: email, subject: `${who} replied to your text`, html: alertEmailHtml(msg, link) })
  }
  return 'reply'
}

/** Delivery report for a text we sent. A failed client text gives the credits back (once). */
export async function handleStatus(db: Db, params: Record<string, string>): Promise<'ok' | 'refunded' | 'unknown'> {
  const sid = String(params.MessageSid ?? params.SmsSid ?? '')
  const status = String(params.MessageStatus ?? params.SmsStatus ?? '').toLowerCase()
  if (!sid || !status) return 'unknown'
  const code = params.ErrorCode ? String(params.ErrorCode) : null
  const { data } = await db.from('text_messages').select('id, user_id, video_id, kind, credits').eq('twilio_sid', sid).maybeSingle()
  const row = data as { id: string; user_id: string | null; video_id: string | null; kind: string; credits: number } | null
  if (!row) return 'unknown'
  await db.from('text_messages').update({ status, ...(code ? { error_code: code } : {}) }).eq('id', row.id)
  if (status !== 'failed' && status !== 'undelivered') return 'ok'
  await recordTwilioError({ what: `A ${row.kind === 'client' ? 'client' : row.kind} text was ${status}`, code, message: twilioCodeHint(code), userId: row.user_id, videoId: row.video_id })
  if (row.kind !== 'client' || !row.user_id || !(row.credits > 0)) return 'ok'
  // Zero the credits on the row FIRST (only one run can win), then refund.
  const { data: won } = await db.from('text_messages').update({ credits: 0 }).eq('id', row.id).gt('credits', 0).select('id')
  if (!won || (won as unknown[]).length === 0) return 'ok'
  await refundCredits(row.user_id, row.credits, 'client-text', row.id)
  return 'refunded'
}

/** The few Twilio error codes worth explaining in plain words. */
export function twilioCodeHint(code: string | null | undefined): string {
  switch (String(code ?? '')) {
    case '30034': return 'The carrier blocked it: the sending number is not registered for business texts (A2P 10DLC).'
    case '30032': return 'The sending toll-free number is not verified.'
    case '30007': return 'The carrier filtered it as spam.'
    case '30003': case '30005': return 'The phone is off, out of service, or the number doesn’t exist.'
    case '30006': return 'That number is a landline or can’t get texts.'
    case '21610': return 'The person replied STOP earlier.'
    case '20003': return 'Twilio refused our login — the account may be suspended.'
    default: return code ? `Twilio error ${code}.` : 'No error code from Twilio.'
  }
}
