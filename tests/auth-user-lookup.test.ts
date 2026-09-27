import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findAuthUserByEmail, isEmailConfirmed } from '../app/_lib/auth-user-lookup'

// A fake admin client whose user list is split into pages, like Supabase's.
function fakeAdmin(users: { id: string; email: string; email_confirmed_at?: string | null }[]) {
  const calls: number[] = []
  const admin = {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
          calls.push(page)
          const slice = users.slice((page - 1) * perPage, page * perPage)
          return { data: { users: slice }, error: null }
        },
      },
    },
  } as unknown as SupabaseClient
  return { admin, calls }
}

describe('findAuthUserByEmail', () => {
  it('finds a user on a later page, ignoring case', async () => {
    const { admin, calls } = fakeAdmin([
      { id: 'a', email: 'one@x.com' },
      { id: 'b', email: 'two@x.com' },
      { id: 'c', email: 'Buyer@Example.com', email_confirmed_at: '2026-01-01' },
    ])
    const hit = await findAuthUserByEmail(admin, 'buyer@example.com', { perPage: 2 })
    expect(hit?.id).toBe('c')
    expect(calls).toEqual([1, 2])
  })

  it('returns null (and stops) when nobody has that sign-in email', async () => {
    const { admin, calls } = fakeAdmin([{ id: 'a', email: 'one@x.com' }])
    expect(await findAuthUserByEmail(admin, 'nobody@x.com', { perPage: 2 })).toBeNull()
    expect(calls).toEqual([1])
  })

  it('never matches an empty address', async () => {
    const { admin } = fakeAdmin([{ id: 'a', email: '' }])
    expect(await findAuthUserByEmail(admin, '  ')).toBeNull()
  })
})

describe('isEmailConfirmed', () => {
  it('is true only once the owner proved the inbox', () => {
    expect(isEmailConfirmed({ email_confirmed_at: '2026-01-01T00:00:00Z' })).toBe(true)
    expect(isEmailConfirmed({ email_confirmed_at: undefined })).toBe(false)
  })
})
