import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { makeFakeDb } from './fake-db'

// ── Mocks: no real Twilio, email, credits ledger or owner alerts ──────────
const credits = vi.hoisted(() => ({
  check: vi.fn(async () => ({ allowed: true, remaining: 5000, shortfall: 0 } as { allowed: boolean; remaining: number; shortfall: number; blockedReason?: string })),
  deduct: vi.fn(async () => true),
  refund: vi.fn(async () => true),
}))
vi.mock('../app/_lib/credits', async (orig) => {
  const real = await orig<typeof import('../app/_lib/credits')>()
  return { ...real, checkCredits: credits.check, deductCredits: credits.deduct, refundCredits: credits.refund }
})
const ops = vi.hoisted(() => ({ alert: vi.fn(async () => true), log: vi.fn(async () => {}) }))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: ops.alert }))
vi.mock('../app/_lib/error-logger', () => ({ upsertErrorLog: ops.log }))
const mail = vi.hoisted(() => ({ send: vi.fn(async () => ({ ok: true, id: 'm1' })) }))
vi.mock('../app/_lib/client-email', async (orig) => {
  const real = await orig<typeof import('../app/_lib/client-email')>()
  return { ...real, sendWithResend: mail.send, appUrl: () => 'https://docs2video.com' }
})
const health = vi.hoisted(() => ({ value: { agentTexts: true, clientTexts: true, state: 'ok', detail: 'ok', numberType: 'local', checkedAt: '' } as Record<string, unknown> }))
vi.mock('../app/_lib/twilio-rest', async (orig) => {
  const real = await orig<typeof import('../app/_lib/twilio-rest')>()
  return { ...real, checkTextingHealth: vi.fn(async () => health.value) }
})

import * as T from '../app/_lib/texting'
import * as core from '../app/_lib/texting-core'
import type { TextingHealth } from '../app/_lib/twilio-rest'
import { CREDIT_COSTS, MIN_ACTION_COST } from '../app/_lib/credits'

const OWNER = '11111111-1111-4111-8111-111111111111'
const VIDEO = '22222222-2222-4222-8222-222222222222'
const CLIENT_PHONE = '+15125550147'
const AGENT_PHONE = '+15125550199'
const OK_HEALTH = { agentTexts: true, clientTexts: true, state: 'ok', detail: 'ok', numberType: 'local', checkedAt: '' } as TextingHealth

// Twilio over fetch: every send is recorded; `twilioReply` decides the answer.
let sends: { to: string; body: string; media: string | null }[] = []
let twilioReply: () => Response = () => new Response(JSON.stringify({ sid: `SM${sends.length}`, status: 'queued' }), { status: 201 })
const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
  const u = String(url)
  if (u.includes('/Messages.json') && init?.method === 'POST') {
    const f = new URLSearchParams(String(init.body))
    sends.push({ to: f.get('To')!, body: f.get('Body')!, media: f.get('MediaUrl') })
    return twilioReply()
  }
  throw new Error(`unexpected fetch ${u}`)
})

function seed(extra: Record<string, Record<string, unknown>[]> = {}, missing: string[] = []) {
  return makeFakeDb({
    videos: [{ id: VIDEO, user_id: OWNER, title: 'Maria’s coverage', thumbnail_url: 'https://cdn.example.com/thumb.jpg', output_type: 'video', script: {}, agent_note: null }],
    profiles: [{ id: OWNER, full_name: 'Dana Agent', email: 'dana@example.com' }],
    agent_alert_settings: [], hot_alerts: [], client_text_consent: [], sms_opt_outs: [], text_messages: [], sent_emails: [], video_analytics: [], notifications: [], quotes: [], clients: [], client_activities: [],
    ...extra,
  }, {
    missing,
    unique: {
      hot_alerts: [['user_id', 'video_id', 'viewer_key', 'trigger', 'day']],
      text_messages: [['twilio_sid']],
      client_text_consent: [['user_id', 'phone']],
      agent_alert_settings: [['user_id']],
    },
  })
}

beforeEach(() => {
  sends = []
  twilioReply = () => new Response(JSON.stringify({ sid: `SM${sends.length}`, status: 'queued' }), { status: 201 })
  vi.stubGlobal('fetch', fetchMock)
  // The production values had a stray "\n" on the end — prove it is trimmed.
  process.env.TWILIO_ACCOUNT_SID = 'ACtest\\n'
  process.env.TWILIO_AUTH_TOKEN = 'secret-token\n'
  process.env.TWILIO_PHONE_NUMBER = '+15005550006\\n'
  credits.check.mockClear(); credits.deduct.mockClear(); credits.refund.mockClear()
  credits.check.mockImplementation(async () => ({ allowed: true, remaining: 5000, shortfall: 0 }))
  ops.alert.mockClear(); ops.log.mockClear(); mail.send.mockClear()
  health.value = { ...OK_HEALTH }
  core.resetTextingReadyCache()
})
afterEach(() => { vi.unstubAllGlobals() })

// ── The fake database itself must be able to FAIL (checkers that lie) ──────
describe('fake database', () => {
  it('reports a missing table and refuses a duplicate key', async () => {
    const db = seed({}, ['hot_alerts'])
    expect((await db.client.from('hot_alerts').select('*').limit(1) as unknown as { error: { code: string } }).error.code).toBe('PGRST205')
    const db2 = seed()
    await db2.client.from('client_text_consent').insert({ user_id: OWNER, phone: CLIENT_PHONE })
    const again = await db2.client.from('client_text_consent').insert({ user_id: OWNER, phone: CLIENT_PHONE }) as unknown as { error: { code: string } }
    expect(again.error.code).toBe('23505')
  })
})

describe('phone numbers and the message', () => {
  it('normalises to E.164 with US as the default', () => {
    expect(T.normalizePhone('(512) 555-0147')).toBe('+15125550147')
    expect(T.normalizePhone('512.555.0147')).toBe('+15125550147')
    expect(T.normalizePhone('1 512 555 0147')).toBe('+15125550147')
    expect(T.normalizePhone('+44 20 7946 0958')).toBe('+442079460958')
    expect(T.normalizePhone('555-0147')).toBeNull()
    expect(T.normalizePhone('012 555 0147')).toBeNull() // no US area code starts with 0
    expect(T.normalizePhone('call me')).toBeNull()
    expect(T.formatPhone('+15125550147')).toBe('(512) 555-0147')
  })
  it('names the agent, carries the link, keeps a short note, says how to stop', () => {
    const m = T.buildClientText({ clientName: 'Maria Lopez', agentName: 'Dana Agent', link: 'https://x.test/watch/1?s=a', note: 'Call me with questions!' })
    expect(m).toMatch(/^Hi Maria, it's Dana Agent\./)
    expect(m).toContain('https://x.test/watch/1?s=a')
    expect(m).toContain('Call me with questions!')
    expect(m.endsWith('Reply STOP to opt out.')).toBe(true)
    const long = T.buildClientText({ agentName: 'Dana', link: 'L', note: 'x'.repeat(T.NOTE_IN_TEXT_MAX + 1) })
    expect(long).not.toContain('xxxx')
  })
  it('knows the carrier keywords and nothing else', () => {
    expect(T.optKeywordOf('stop')).toBe('STOP')
    expect(T.optKeywordOf(' Unsubscribe. ')).toBe('STOP')
    expect(T.optKeywordOf('START')).toBe('START')
    expect(T.optKeywordOf('help')).toBe('HELP')
    expect(T.optKeywordOf('stop by tomorrow?')).toBeNull()
    expect(T.optKeywordOf('anything', 'STOP')).toBe('STOP')
  })
  it('the price is a real list entry and does not move the cheapest price', () => {
    expect(CREDIT_COSTS['client-text']).toBe(50)
    expect(MIN_ACTION_COST).toBe(50)
  })
})

describe('quiet hours and the alert day', () => {
  const tz = 'America/Chicago'
  it('sends at noon, holds 10pm and 7:30am until 8am', () => {
    const noon = new Date('2026-10-10T17:00:00Z') // 12:00 Chicago (CDT, UTC-5)
    expect(T.alertSendAt(noon, tz)).toEqual({ quiet: false, sendAt: noon })
    const tenPm = new Date('2026-10-11T03:00:00Z') // 22:00 Chicago on the 10th
    const q = T.alertSendAt(tenPm, tz)
    expect(q.quiet).toBe(true)
    expect(q.sendAt.toISOString()).toBe('2026-10-11T13:00:00.000Z') // 08:00 Chicago on the 11th
    const early = new Date('2026-10-11T12:30:00Z') // 07:30 Chicago
    expect(T.alertSendAt(early, tz).sendAt.toISOString()).toBe('2026-10-11T13:00:00.000Z')
  })
  it('an unknown time zone uses US Central', () => {
    const tenPm = new Date('2026-10-11T03:00:00Z')
    expect(T.alertSendAt(tenPm, null).quiet).toBe(true)
    expect(T.alertSendAt(tenPm, 'Not/AZone').quiet).toBe(true)
    expect(T.alertDay(tenPm, null)).toBe('2026-10-10')
  })
  it('maps share-page events to triggers', () => {
    expect(T.triggerForEvent('complete', {})).toBe('finished')
    expect(T.triggerForEvent('progress', { percent: 75 })).toBeNull()
    expect(T.triggerForEvent('view', {}, 1)).toBeNull()
    expect(T.triggerForEvent('view', {}, 2)).toBe('twice')
    expect(T.triggerForEvent('download', { type: 'source_pdf' })).toBe('pdf')
    expect(T.triggerForEvent('booking_click', {})).toBe('booking')
    expect(T.triggerForEvent('payment_click', {})).toBeNull()
  })
})

describe('Twilio signature check', () => {
  const url = 'https://docs2video.com/api/webhooks/twilio'
  const params = { From: CLIENT_PHONE, Body: 'STOP', MessageSid: 'SM1' }
  const sign = (p: Record<string, string>, token: string) => crypto.createHmac('sha1', token)
    .update(url + Object.keys(p).sort().map((k) => k + p[k]).join('')).digest('base64')
  it('accepts a correct signature and refuses tampering, a wrong key, or none', async () => {
    const { validateTwilioSignature } = await import('../app/_lib/twilio-rest')
    const sig = sign(params, 'secret-token')
    expect(validateTwilioSignature(url, params, sig)).toBe(true) // env token is trimmed
    expect(validateTwilioSignature(url, { ...params, Body: 'hi' }, sig)).toBe(false)
    expect(validateTwilioSignature(url, params, sign(params, 'other'))).toBe(false)
    expect(validateTwilioSignature(url, params, null)).toBe(false)
  })
  it('the webhook route checks it against OUR address, before reading anything', () => {
    const src = readFileSync(path.join(__dirname, '../app/api/webhooks/twilio/route.ts'), 'utf8')
    expect(src).toMatch(/validateTwilioSignature\(url, params, request\.headers\.get\('x-twilio-signature'\)\)/)
    expect(src).toMatch(/\$\{siteUrl\(\)\}\/api\/webhooks\/twilio/)
    expect(src.indexOf('validateTwilioSignature(')).toBeLessThan(src.indexOf('handleInbound(db'))
  })
})

describe('sending a client text', () => {
  const base = { userId: OWNER, videoId: VIDEO, phone: '(512) 555-0147', clientName: 'Maria Lopez', health: OK_HEALTH }

  it('refuses without the consent tick — nothing charged, nothing sent', async () => {
    const db = seed()
    const r = await core.sendClientText(db.client, { ...base, consent: false })
    expect(r).toMatchObject({ ok: false, status: 400, code: 'consent' })
    expect(sends).toHaveLength(0)
    expect(credits.deduct).not.toHaveBeenCalled()
  })

  it('with consent: charges, records like an email, sends a picture text with a tagged link', async () => {
    const db = seed()
    const r = await core.sendClientText(db.client, { ...base, consent: true })
    expect(r).toMatchObject({ ok: true, to: CLIENT_PHONE, withPicture: true, credits: 50 })
    expect(credits.deduct).toHaveBeenCalledWith(OWNER, 50, 'client-text', VIDEO, expect.any(String))
    const share = db.rows('sent_emails')[0]
    expect(share).toMatchObject({ to_email: CLIENT_PHONE, email_type: 'text', video_id: VIDEO })
    expect(sends[0].to).toBe(CLIENT_PHONE)
    expect(sends[0].body).toContain(`/watch/${VIDEO}?s=${share.id}`)
    expect(sends[0].body).toContain('Dana Agent')
    expect(sends[0].media).toBe('https://cdn.example.com/thumb.jpg')
    expect(db.rows('client_text_consent')).toHaveLength(1)
    // Consent is stored: the next text needs no tick.
    const again = await core.sendClientText(db.client, { ...base, consent: false })
    expect(again.ok).toBe(true)
  })

  it('a number that replied STOP is blocked before any charge', async () => {
    const db = seed({ sms_opt_outs: [{ phone: CLIENT_PHONE, opted_out: true }] })
    const r = await core.sendClientText(db.client, { ...base, consent: true })
    expect(r).toMatchObject({ ok: false, status: 409, code: 'opted_out' })
    expect(sends).toHaveLength(0)
    expect(credits.deduct).not.toHaveBeenCalled()
  })

  it('when Twilio refuses: credits back, no "sent" row left, owner sees the error', async () => {
    const db = seed()
    twilioReply = () => new Response(JSON.stringify({ code: 21211, message: 'Invalid To number' }), { status: 400 })
    const r = await core.sendClientText(db.client, { ...base, consent: true })
    expect(r).toMatchObject({ ok: false, status: 502 })
    expect(credits.refund).toHaveBeenCalledWith(OWNER, 50, 'client-text', expect.any(String))
    expect(db.rows('sent_emails')).toHaveLength(0)
    expect(db.rows('text_messages')[0]).toMatchObject({ status: 'failed', credits: 0, error_code: '21211' })
    expect(ops.log).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'twilio' }))
  })

  it('an account without a card cannot text', async () => {
    const db = seed()
    credits.check.mockImplementation(async () => ({ allowed: false, remaining: 0, shortfall: 50, blockedReason: 'card_required' }))
    const r = await core.sendClientText(db.client, { ...base, consent: true })
    expect(r).toMatchObject({ ok: false, status: 402, code: 'card_required' })
    expect(sends).toHaveLength(0)
  })

  it('until the number is registered, clients cannot be texted', async () => {
    const db = seed()
    const r = await core.sendClientText(db.client, { ...base, consent: true, health: { ...OK_HEALTH, clientTexts: false, state: 'not_registered', detail: 'not registered' } })
    expect(r).toMatchObject({ ok: false, status: 409, code: 'not_registered' })
    expect(credits.deduct).not.toHaveBeenCalled()
  })

  it('stops at the daily cap', async () => {
    const now = new Date().toISOString()
    const many = Array.from({ length: T.CLIENT_TEXT_DAILY_CAP }, (_, i) => ({ id: `t${i}`, user_id: OWNER, kind: 'client', direction: 'out', phone: `+1512555${String(1000 + i)}`, created_at: now }))
    const db = seed({ text_messages: many })
    const r = await core.sendClientText(db.client, { ...base, consent: true })
    expect(r).toMatchObject({ ok: false, status: 429 })
    expect(sends).toHaveLength(0)
  })
})

describe('what comes back from Twilio', () => {
  async function sentOnce() {
    const db = seed()
    await core.sendClientText(db.client, { userId: OWNER, videoId: VIDEO, phone: CLIENT_PHONE, clientName: 'Maria Lopez', consent: true, health: OK_HEALTH })
    return db
  }
  it('STOP puts the number on the do-not-text list, and the next send is blocked; START undoes it', async () => {
    const db = await sentOnce()
    expect(await core.handleInbound(db.client, { From: CLIENT_PHONE, Body: 'Stop', MessageSid: 'SMin1' })).toBe('stop')
    expect(await core.isOptedOut(db.client, CLIENT_PHONE)).toBe(true)
    expect(db.rows('notifications').some((n) => n.type === 'text_opt_out')).toBe(true)
    const blocked = await core.sendClientText(db.client, { userId: OWNER, videoId: VIDEO, phone: CLIENT_PHONE, health: OK_HEALTH })
    expect(blocked).toMatchObject({ ok: false, code: 'opted_out' })
    expect(await core.handleInbound(db.client, { From: CLIENT_PHONE, Body: 'START', MessageSid: 'SMin2' })).toBe('start')
    expect(await core.isOptedOut(db.client, CLIENT_PHONE)).toBe(false)
  })
  it('a reply is stored on the video and passed to the agent; a repeat delivery is ignored', async () => {
    const db = await sentOnce()
    expect(await core.handleInbound(db.client, { From: CLIENT_PHONE, Body: 'Can we talk Tuesday?', MessageSid: 'SMr1' })).toBe('reply')
    const reply = db.rows('text_messages').find((m) => m.kind === 'reply')!
    expect(reply).toMatchObject({ user_id: OWNER, video_id: VIDEO, body: 'Can we talk Tuesday?' })
    expect(db.rows('notifications').some((n) => n.type === 'text_reply')).toBe(true)
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'dana@example.com' })) // alerts not on text → email
    expect(await core.handleInbound(db.client, { From: CLIENT_PHONE, Body: 'Can we talk Tuesday?', MessageSid: 'SMr1' })).toBe('duplicate')
  })
  it('an undelivered client text gives its credits back exactly once', async () => {
    const db = await sentOnce()
    const sid = String(db.rows('text_messages')[0].twilio_sid)
    credits.refund.mockClear()
    expect(await core.handleStatus(db.client, { MessageSid: sid, MessageStatus: 'undelivered', ErrorCode: '30034' })).toBe('refunded')
    expect(await core.handleStatus(db.client, { MessageSid: sid, MessageStatus: 'undelivered', ErrorCode: '30034' })).toBe('ok')
    expect(credits.refund).toHaveBeenCalledTimes(1)
    expect(ops.log).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'twilio', detail: expect.stringContaining('A2P 10DLC') }))
  })
})

describe('hot-client alerts', () => {
  const settings = { user_id: OWNER, channel: 'text', on_finished: true, on_twice: true, on_pdf: true, on_booking: true, phone: AGENT_PHONE, phone_verified_at: '2026-10-01T00:00:00Z', time_zone: 'America/Chicago', code_tries: 0 }
  const noon = new Date('2026-10-10T17:00:00Z')
  const ev = (eventType: string, extra: Partial<Parameters<typeof core.handleHotEvent>[1]> = {}) =>
    ({ videoId: VIDEO, ownerId: OWNER, eventType, metadata: {}, viewerIp: '1.2.3.4', isOwner: false, now: noon, ...extra })

  it('never alerts on the agent’s own views', async () => {
    const db = seed({ agent_alert_settings: [settings] })
    expect(await core.handleHotEvent(db.client, ev('complete', { isOwner: true }))).toBe('own')
    expect(db.rows('hot_alerts')).toHaveLength(0)
    expect(sends).toHaveLength(0)
  })
  it('texts the agent when a client finishes — once per client, video, kind and day', async () => {
    const db = seed({ agent_alert_settings: [settings] })
    expect(await core.handleHotEvent(db.client, ev('complete'))).toBe('sent')
    expect(sends).toHaveLength(1)
    expect(sends[0].to).toBe(AGENT_PHONE)
    expect(sends[0].body).toMatch(/watched "Maria’s coverage" to the end/)
    expect(sends[0].body).toContain(`/videos/${VIDEO}`)
    expect(await core.handleHotEvent(db.client, ev('complete'))).toBe('duplicate')
    expect(sends).toHaveLength(1)
    // A different kind the same day still alerts.
    expect(await core.handleHotEvent(db.client, ev('booking_click'))).toBe('sent')
  })
  it('a second visit counts as "came back"; the first does not', async () => {
    const db = seed({ agent_alert_settings: [settings], video_analytics: [{ video_id: VIDEO, event_type: 'view', viewer_ip: '1.2.3.4', metadata: {} }] })
    expect(await core.handleHotEvent(db.client, ev('view'))).toBe('none')
    db.rows('video_analytics').push({ video_id: VIDEO, event_type: 'view', viewer_ip: '1.2.3.4', metadata: {} })
    expect(await core.handleHotEvent(db.client, ev('view'))).toBe('sent')
  })
  it('is quiet at night and sends at 8am from the cron', async () => {
    const db = seed({ agent_alert_settings: [settings] })
    const tenPm = new Date('2026-10-11T03:00:00Z')
    expect(await core.handleHotEvent(db.client, ev('complete', { now: tenPm }))).toBe('queued')
    expect(sends).toHaveLength(0)
    expect(await core.sendQueuedAlerts(db.client, new Date('2026-10-11T12:59:00Z'))).toEqual({ tried: 0, sent: 0 })
    expect(await core.sendQueuedAlerts(db.client, new Date('2026-10-11T13:05:00Z'))).toEqual({ tried: 1, sent: 1 })
    expect(sends).toHaveLength(1)
    expect(await core.sendQueuedAlerts(db.client, new Date('2026-10-11T13:20:00Z'))).toEqual({ tried: 0, sent: 0 })
  })
  it('off, or a trigger switched off, sends nothing', async () => {
    const db = seed({ agent_alert_settings: [{ ...settings, channel: 'off' }] })
    expect(await core.handleHotEvent(db.client, ev('complete'))).toBe('off')
    const db2 = seed({ agent_alert_settings: [{ ...settings, on_pdf: false }] })
    expect(await core.handleHotEvent(db2.client, ev('download', { metadata: { type: 'source_pdf' } }))).toBe('off')
    expect(sends).toHaveLength(0)
  })
  it('email channel emails instead of texting', async () => {
    const db = seed({ agent_alert_settings: [{ ...settings, channel: 'email' }] })
    expect(await core.handleHotEvent(db.client, ev('complete'))).toBe('sent')
    expect(sends).toHaveLength(0)
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'dana@example.com' }))
  })
  it('missing tables: nothing happens and the owner is told which file to run', async () => {
    const db = seed({}, ['agent_alert_settings'])
    expect(await core.handleHotEvent(db.client, ev('complete'))).toBe('not_ready')
    expect(ops.alert).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('20261010_texting_and_alerts.sql') }))
  })
})

describe('the agent’s mobile number', () => {
  it('text alerts need a confirmed number; a wrong code fails, the right one confirms', async () => {
    const db = seed()
    expect(await core.saveAlertSettings(db.client, OWNER, { channel: 'text' })).toMatchObject({ ok: false, status: 400 })
    expect(await core.sendVerifyCode(db.client, OWNER, '512-555-0199', { health: OK_HEALTH, code: '123456' })).toMatchObject({ ok: true })
    expect(sends[0]).toMatchObject({ to: AGENT_PHONE })
    expect(sends[0].body).toContain('123456')
    expect(JSON.stringify(db.rows('text_messages'))).not.toContain('123456') // the code is never stored readable
    expect(await core.checkVerifyCode(db.client, OWNER, '000000')).toMatchObject({ ok: false })
    expect(await core.checkVerifyCode(db.client, OWNER, '123456')).toMatchObject({ ok: true })
    expect((await core.getAlertSettings(db.client, OWNER)).phoneVerified).toBe(true)
    expect(await core.saveAlertSettings(db.client, OWNER, { channel: 'text' })).toMatchObject({ ok: true })
  })
})

describe('Twilio account check (read only)', () => {
  it('a suspended account blocks every text and says so', async () => {
    const real = await vi.importActual<typeof import('../app/_lib/twilio-rest')>('../app/_lib/twilio-rest')
    real.resetTextingHealthCache()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 20003, message: 'authentication failed, account ACx with status 4 is not active' }), { status: 401 })))
    const h = await real.checkTextingHealth(true)
    expect(h).toMatchObject({ state: 'account_inactive', agentTexts: false, clientTexts: false })
  })
  it('an approved 10DLC campaign allows client texts', async () => {
    const real = await vi.importActual<typeof import('../app/_lib/twilio-rest')>('../app/_lib/twilio-rest')
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      const url = String(u)
      const j = (o: unknown) => new Response(JSON.stringify(o), { status: 200 })
      if (url.endsWith('/Accounts/ACtest.json')) return j({ status: 'active' })
      if (url.includes('IncomingPhoneNumbers')) return j({ incoming_phone_numbers: [{ sid: 'PN1', phone_number: '+15005550006' }] })
      if (url.endsWith('/Services?PageSize=50')) return j({ services: [{ sid: 'MG1' }] })
      if (url.includes('/PhoneNumbers')) return j({ phone_numbers: [{ phone_number: '+15005550006' }] })
      if (url.includes('Usa2p')) return j({ compliance: [{ campaign_status: 'VERIFIED' }] })
      return new Response('{}', { status: 404 })
    }))
    expect(await real.checkTextingHealth(true)).toMatchObject({ state: 'ok', clientTexts: true })
  })
})

// ── Collected but never sent: the box and the number must reach the route ──
describe('the Text tab sends what it asks for', () => {
  it('posts phone, consent and note to the route the route reads', () => {
    const ui = readFileSync(path.join(__dirname, '../app/(dashboard)/videos/[id]/send/SendByText.tsx'), 'utf8')
    const route = readFileSync(path.join(__dirname, '../app/api/texting/send/route.ts'), 'utf8')
    expect(ui).toMatch(/fetch\('\/api\/texting\/send'/)
    expect(ui).toMatch(/JSON\.stringify\(\{ videoId, phone, clientName[^}]*note, consent: knownConsent \|\| agreed \}\)/)
    for (const f of ['phone: body.phone', 'consent: body.consent === true', 'note: body.note']) expect(route).toContain(f)
  })
  it('settings save sends the browser time zone (quiet hours)', () => {
    const ui = readFileSync(path.join(__dirname, '../app/(dashboard)/settings/HotClientAlerts.tsx'), 'utf8')
    expect(ui).toMatch(/timeZone: tz/)
  })
})
