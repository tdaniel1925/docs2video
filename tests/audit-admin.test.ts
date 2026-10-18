import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeDb, type FakeDb } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 #10 — admin access needs a confirmed email AND the
 * profile's is_admin flag. Being on the admin email list used to be enough on
 * its own (confirmed or not), and it also made every video free.
 * isAdminRequest runs for real against a pretend profiles table.
 */

const h = vi.hoisted(() => ({ db: null as unknown as FakeDb }))
vi.mock('../app/_lib/supabase/admin', async () => {
  const { fakeClient } = await import('./fixtures/fake-supabase')
  return { createAdminClient: () => fakeClient(h.db) }
})

import { isAdminRequest } from '../app/_lib/admin'
import { videoIsFree } from '../app/_lib/price-quote'

const LISTED = 'tdaniel@botmakers.ai' // on the hardcoded list

beforeEach(() => { h.db = makeDb({ profiles: [] }) })

describe('isAdminRequest — confirmed email AND the flag', () => {
  it('on the email list but NOT flagged → not an admin', async () => {
    h.db.tables.profiles.push({ id: 'u1', is_admin: false })
    expect(await isAdminRequest({ id: 'u1', email: LISTED, email_confirmed_at: '2026-01-01' })).toBe(false)
  })

  it('flagged but the email is not confirmed → not an admin', async () => {
    h.db.tables.profiles.push({ id: 'u1', is_admin: true })
    expect(await isAdminRequest({ id: 'u1', email: LISTED, email_confirmed_at: null })).toBe(false)
  })

  it('flagged AND confirmed → admin', async () => {
    h.db.tables.profiles.push({ id: 'u1', is_admin: true })
    expect(await isAdminRequest({ id: 'u1', email: 'phil@x.com', email_confirmed_at: '2026-01-01' })).toBe(true)
  })

  it('profile unreadable → not an admin (fails closed)', async () => {
    h.db.failOn.profiles = { error: { message: 'timeout' } }
    expect(await isAdminRequest({ id: 'u1', email: LISTED, email_confirmed_at: '2026-01-01' })).toBe(false)
  })
})

describe('free videos follow the flag, not the email', () => {
  it('only a flagged admin or beta account renders free', () => {
    expect(videoIsFree({ isAdmin: false, isBeta: false })).toBe(false)
    expect(videoIsFree({ isAdmin: true })).toBe(true)
    expect(videoIsFree({ isBeta: true })).toBe(true)
    // @ts-expect-error — the email-list switch no longer exists
    expect(videoIsFree({ emailIsAdmin: true })).toBe(false)
  })
})
