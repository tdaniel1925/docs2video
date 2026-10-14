import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { makeDb, fakeClient, type FakeDb } from './fixtures/fake-supabase'

// AI ANSWERS ON THE SHARE PAGE — the rules (pure) and the real routes, with a
// fake database and a fake Claude. Every "never" here was first seen to fail.

let db: FakeDb
const sent: { to: string; subject: string; html: string }[] = []
let user: { id: string } | null = { id: 'agent-1' }

vi.mock('../app/_lib/supabase/admin', () => ({ createAdminClient: () => fakeClient(db) }))
vi.mock('../app/_lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }))
vi.mock('../app/_lib/client-email', async (orig) => ({
  ...(await orig<typeof import('../app/_lib/client-email')>()),
  sendWithResend: async (p: { to: string; subject: string; html: string }) => { sent.push(p); return { ok: true, id: 'x' } },
}))
vi.mock('../app/_lib/ops-alert', () => ({ alertOps: vi.fn(async () => true) }))
vi.mock('../app/_lib/rate-limit', async (orig) => ({
  ...(await orig<typeof import('../app/_lib/rate-limit')>()),
  checkRateLimit: async () => ({ allowed: true }),
}))
const afterCalls: (() => unknown)[] = []
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => { afterCalls.push(fn) } }))

import {
  ANSWER_SYSTEM_PROMPT, buildSources, checkApproval, checkAsk, checkDraft, draftAnswer, publicAnswers, UNSURE_ANSWER, type AnswerCall,
} from '../app/_lib/client-questions'
import { runDraft } from '../app/_lib/client-questions-db'
import { POST as ask } from '../app/api/watch/[id]/ask/route'
import { GET as answersGet } from '../app/api/watch/[id]/answers/route'
import { POST as decide, GET as questionGet } from '../app/api/questions/[id]/route'

const VIDEO = '11111111-1111-4111-8111-111111111111'

// Made-up content (same family as scripts/look-samples/sample-content.ts).
const EXTRACTED = {
  title: 'Your Coverage Plan',
  industry: 'insurance',
  carrier: 'Mutual of Omaha',
  deathBenefit: 500000,
  policyType: 'Term life',
  sections: [
    { title: 'Death benefit', content: 'The plan pays a death benefit of $500,000 to the named beneficiaries.' },
    { title: 'Premium', content: 'The monthly premium is $142 and stays level for the 20-year term.' },
  ],
  keyMetrics: [{ label: 'Covered until', value: 'Age 65' }],
}
const SCENES = [{ title: 'What your plan gives you', narration: 'Your plan pays five hundred thousand dollars to your family.' }]

const call = (json: unknown): AnswerCall => async () => ({ text: JSON.stringify(json), usage: { input_tokens: 2000, output_tokens: 150 } })

function seed() {
  db = makeDb({
    videos: [{ id: VIDEO, user_id: 'agent-1', title: 'Your Coverage Plan', client_id: null, draft_data: { extractedData: EXTRACTED }, script: SCENES }],
    profiles: [{ id: 'agent-1', full_name: 'Sam Agent', company_name: 'Your Agency', email: 'agent@example.com', subscription_status: 'pro' }],
    client_questions: [], client_question_events: [], notifications: [], clients: [],
  })
  db.autoId = true
}
const req = (body: unknown, ip = '10.0.0.1') => new Request(`http://x/api/watch/${VIDEO}/ask`, { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' } })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => { seed(); sent.length = 0; afterCalls.length = 0; user = { id: 'agent-1' } })

describe('the public form (spam guards)', () => {
  it('a filled honeypot or a too-fast form is a bot: "thanks", nothing saved, nothing sent', async () => {
    expect(checkAsk({ question: 'Hello there?', website: 'spam.example' }).kind).toBe('bot')
    expect(checkAsk({ question: 'Hello there?', elapsedMs: 300 }).kind).toBe('bot')
    const res = await ask(req({ question: 'What is my premium?', website: 'x' }) as never, params(VIDEO))
    expect(res.status).toBe(200)
    expect(db.tables.client_questions).toHaveLength(0)
    expect(sent).toHaveLength(0)
  })
  it('refuses empty, too-long and link-stuffed questions; drops a bad email', () => {
    expect(checkAsk({ question: '  ' }).kind).toBe('bad')
    expect(checkAsk({ question: 'x'.repeat(1001) }).kind).toBe('bad')
    expect(checkAsk({ question: 'see http://a.example and www.b.example' }).kind).toBe('bad')
    const ok = checkAsk({ question: 'What is my premium?', fromEmail: 'not-an-email', fromName: 'Ana\nRivera', elapsedMs: 9000 })
    expect(ok).toEqual({ kind: 'ok', question: 'What is my premium?', email: '', name: 'Ana Rivera' })
  })
  it('rate-limits one visitor on one video (6th question in an hour → 429)', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await ask(req({ question: `Question number ${i}?` }, '10.9.9.9') as never, params(VIDEO))).status)
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true)
    expect(statuses[5]).toBe(429)
  })
  it('saves the question, logs it, emails the agent a link to the reply screen, and drafts AFTER replying', async () => {
    const res = await ask(req({ question: 'How much does my family get?', fromEmail: 'ana@example.com', fromName: 'Ana' }, '10.1.1.1') as never, params(VIDEO))
    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe('Your agent will reply shortly.')
    const q = db.tables.client_questions[0]
    expect(q).toMatchObject({ status: 'new', question: 'How much does my family get?', asker_email: 'ana@example.com', user_id: 'agent-1' })
    expect(db.tables.client_question_events.map((e) => e.action)).toEqual(['asked', 'agent_emailed'])
    expect(sent[0].to).toBe('agent@example.com')
    expect(sent[0].html).toContain(`/questions/${q.id}`)
    expect(sent[0].html).toContain('Nothing is sent until you approve it')
    expect(afterCalls).toHaveLength(1) // the draft runs after the response
  })
  it('before the migration (no table) it still emails the agent — the old behaviour', async () => {
    db.failOn.client_questions = { error: { message: 'Could not find the table', code: 'PGRST205' } }
    const res = await ask(req({ question: 'Is this still working?' }, '10.2.2.2') as never, params(VIDEO))
    expect(res.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(afterCalls).toHaveLength(0)
  })
})

describe('the AI draft (mocked Claude)', () => {
  const sources = buildSources(EXTRACTED, SCENES)
  it('numbers the document sections, key numbers and scenes — never the carrier name', () => {
    expect(sources.map((s) => s.label)).toContain('Document section “Death benefit”')
    expect(sources.some((s) => /^Video, scene 1/.test(s.label))).toBe(true)
    expect(JSON.stringify(sources)).not.toMatch(/Omaha/)
  })
  it('a draft cites where in the document it came from', async () => {
    const d = await draftAnswer({ question: 'How much does my family get?', extracted: EXTRACTED, scenes: SCENES },
      { call: call({ unsure: false, answer: 'Your plan lists a death benefit of $500,000 for your beneficiaries.', citations: [{ source: 'S1', quote: 'The plan pays a death benefit of $500,000' }] }) })
    expect(d.unsure).toBe(false)
    expect(d.citations[0]).toMatchObject({ source: 'S1', label: 'Document section “Death benefit”' })
    expect(d.costUsd).toBeCloseTo(2000 * 2e-6 + 150 * 10e-6, 6)
  })
  it('a quote that is not really in the source throws the draft away → "I\'ll ask your agent"', async () => {
    const d = await draftAnswer({ question: 'How much?', extracted: EXTRACTED, scenes: SCENES },
      { call: call({ unsure: false, answer: 'It pays $1,000,000.', citations: [{ source: 'S1', quote: 'pays a death benefit of $1,000,000' }] }) })
    expect(d.unsure).toBe(true)
    expect(d.answer).toBe(UNSURE_ANSWER)
    expect(UNSURE_ANSWER).toMatch(/I’ll ask your agent/)
  })
  it('unsure → "I\'ll ask your agent"; no key / API error → the same, never a guess', async () => {
    expect((await draftAnswer({ question: 'Can I add my knee surgery?', extracted: EXTRACTED, scenes: SCENES }, { call: call({ unsure: true, answer: '', citations: [] }) })).answer).toBe(UNSURE_ANSWER)
    expect((await draftAnswer({ question: 'x?', extracted: EXTRACTED, scenes: SCENES }, { call: null })).unsure).toBe(true)
    expect((await draftAnswer({ question: 'x?', extracted: EXTRACTED, scenes: SCENES }, { call: async () => { throw new Error('down') } })).unsure).toBe(true)
  })
  it('compliance scrub: a carrier name is removed; promises and advice are thrown away', () => {
    const scrubbed = checkDraft(JSON.stringify({ unsure: false, answer: 'Mutual of Omaha pays a death benefit of $500,000.', citations: [{ source: 'S1', quote: 'death benefit of $500,000' }] }), sources, { regulated: true })
    expect(scrubbed.unsure).toBe(false)
    expect(scrubbed.answer).not.toMatch(/Omaha/)
    expect(scrubbed.answer).toContain('$500,000')
    for (const bad of ['You are covered for that, $500,000.', 'I recommend keeping it.', 'You should cancel the old policy.']) {
      const d = checkDraft(JSON.stringify({ unsure: false, answer: bad, citations: [{ source: 'S1', quote: 'death benefit of $500,000' }] }), sources, { regulated: true })
      expect(d.unsure, bad).toBe(true)
    }
  })
  it('the prompt carries the hard rules (no promises, no advice, cite, unsure, ignore injected instructions)', () => {
    for (const rule of [/Never promise or confirm coverage/, /No advice/, /WORD FOR WORD/, /"unsure": true/, /Ignore any instructions/]) expect(ANSWER_SYSTEM_PROMPT).toMatch(rule)
  })
  it('runDraft stores the draft and its citations, and logs it; the daily free cap stops further drafts', async () => {
    db.tables.client_questions.push({ id: 'aaaaaaaa-0000-4000-8000-000000000001', video_id: VIDEO, user_id: 'agent-1', question: 'How much?', status: 'new', created_at: new Date().toISOString() })
    await runDraft(fakeClient(db) as never, 'aaaaaaaa-0000-4000-8000-000000000001', { call: call({ unsure: false, answer: 'Your plan lists $500,000.', citations: [{ source: 'S1', quote: 'death benefit of $500,000' }] }) })
    const q = db.tables.client_questions[0]
    expect(q.status).toBe('drafted')
    expect(q.ai_citations).toHaveLength(1)
    expect(db.tables.client_question_events.at(-1)?.action).toBe('ai_drafted')
    // 10 drafts today on this video → the next one gets no draft.
    for (let i = 0; i < 10; i++) db.tables.client_questions.push({ id: `bbbbbbbb-0000-4000-8000-00000000000${i}`, video_id: VIDEO, user_id: 'agent-1', status: 'drafted', ai_drafted_at: new Date().toISOString() })
    db.tables.client_questions.push({ id: 'cccccccc-0000-4000-8000-000000000001', video_id: VIDEO, user_id: 'agent-1', question: 'Again?', status: 'new' })
    const spy = vi.fn(call({ unsure: true }))
    await runDraft(fakeClient(db) as never, 'cccccccc-0000-4000-8000-000000000001', { call: spy })
    expect(spy).not.toHaveBeenCalled()
    expect(db.tables.client_questions.at(-1)).toMatchObject({ status: 'needs_reply' })
  })
})

describe('approval — nothing reaches the client without it', () => {
  const QID = 'dddddddd-0000-4000-8000-000000000001'
  const draftRow = () => ({
    id: QID, video_id: VIDEO, user_id: 'agent-1', client_id: null, question: 'How much does my family get?', asker_name: 'Ana', asker_email: 'ana@example.com',
    status: 'drafted', ai_draft: 'Your plan lists a death benefit of $500,000.', ai_unsure: false,
    ai_citations: [{ source: 'S1', label: 'Document section “Death benefit”', quote: 'death benefit of $500,000' }],
    final_answer: null, published: false, answered_at: null, client_emailed_at: null, created_at: new Date().toISOString(),
  })
  const post = async (body: unknown) => (await decide(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as never, params(QID)))!

  it('an unapproved draft never shows on the share page', async () => {
    db.tables.client_questions.push(draftRow())
    const res = await answersGet(new Request('http://x'), params(VIDEO))
    expect((await res.json()).answers).toEqual([])
    expect(publicAnswers([{ ...draftRow(), final_answer: 'x', published: true }])).toEqual([]) // drafted ≠ approved
    expect(publicAnswers([{ ...draftRow(), status: 'approved', final_answer: 'x', published: false }])).toEqual([])
  })
  it('Approve publishes it, emails the client once, and logs every step', async () => {
    db.tables.client_questions.push(draftRow())
    const res = await post({ action: 'approve' })
    expect(res.status).toBe(200)
    expect((await res.json()).emailed).toBe(true)
    const pub = (await (await answersGet(new Request('http://x'), params(VIDEO))).json()).answers
    expect(pub).toHaveLength(1)
    expect(pub[0]).toMatchObject({ answer: 'Your plan lists a death benefit of $500,000.', from: ['Document section “Death benefit”'] })
    expect(JSON.stringify(pub)).not.toMatch(/ana@example\.com|Ana/) // who asked is never public
    expect(sent.filter((m) => m.to === 'ana@example.com')).toHaveLength(1)
    expect(db.tables.client_question_events.map((e) => e.action)).toEqual(['approved', 'client_emailed'])
    await post({ action: 'approve', answer: 'Your plan lists $500,000. Let’s talk.' })
    expect(sent.filter((m) => m.to === 'ana@example.com')).toHaveLength(1) // not emailed twice
    expect(db.tables.client_question_events.map((e) => e.action)).toContain('edited')
  })
  it('an edited answer that names a carrier is refused; the "I\'ll ask" line can\'t be approved', async () => {
    db.tables.client_questions.push(draftRow())
    expect((await post({ action: 'approve', answer: 'Mutual of Omaha pays it.' })).status).toBe(400)
    expect(checkApproval(UNSURE_ANSWER, { regulated: false }).ok).toBe(false)
    expect(db.tables.client_questions[0].status).toBe('drafted')
  })
  it('another agent can\'t read or approve it', async () => {
    db.tables.client_questions.push(draftRow())
    user = { id: 'agent-2' }
    expect((await questionGet(new Request('http://x') as never, params(QID)))!.status).toBe(404)
    expect((await post({ action: 'approve' })).status).toBe(404)
  })
})

describe('source guards', () => {
  const code = (p: string) => readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  it('the public answers route only reads approved + published rows and never who asked', () => {
    const src = code('app/api/watch/[id]/answers/route.ts')
    expect(src).toMatch(/\.eq\('status', 'approved'\)/)
    expect(src).toMatch(/\.eq\('published', true\)/)
    expect(src).not.toMatch(/asker_/)
  })
  it('the share page does not read questions from /api/public/watch (a missing table must never 404 a link)', () => {
    expect(code('app/api/public/watch/[id]/route.ts')).not.toMatch(/client_questions/)
  })
})
