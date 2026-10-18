import { test, expect } from '@playwright/test'
import { NO_AUTH } from './helpers/auth'

/**
 * Client questions + annual reviews, against the running app. Sends nothing:
 * the only question posted is caught by the honeypot (a bot is thanked and
 * nothing is saved or emailed), and every other call is a read.
 * Works before AND after the migration: before it, the screens say the
 * feature isn't on yet and the public answers list is empty — never an error.
 */
test.describe('public share-page endpoints', () => {
  test.use({ storageState: NO_AUTH })

  test('approved answers: an unknown video gets an empty list, not an error', async ({ request }) => {
    const res = await request.get('/api/watch/00000000-0000-4000-8000-000000000000/answers')
    expect(res.status()).toBe(200)
    expect((await res.json()).answers).toEqual([])
  })

  test('a filled honeypot is thanked and nothing happens', async ({ request }) => {
    const res = await request.post('/api/watch/00000000-0000-4000-8000-000000000000/ask', {
      data: { question: 'Buy cheap pills now', website: 'http://spam.example' },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  test('a form sent faster than a person can type is treated the same way', async ({ request }) => {
    const res = await request.post('/api/watch/00000000-0000-4000-8000-000000000000/ask', {
      data: { question: 'Hello?', elapsedMs: 50 },
    })
    expect(res.status()).toBe(200)
  })
})

test.describe('signed-in screens', () => {
  test('Client questions opens (list, or "not switched on yet")', async ({ page }) => {
    await page.goto('/questions')
    await expect(page.getByRole('heading', { name: 'Client questions' })).toBeVisible()
    await expect(page.getByText(/No questions yet|aren’t switched on yet|Answer ready to check|Needs your answer|Answered/).first()).toBeVisible({ timeout: 20000 })
  })

  test('reviews API answers (available or not) and Clients still loads', async ({ page, request }) => {
    const res = await request.get('/api/reviews')
    expect(res.status()).toBe(200)
    expect(typeof (await res.json()).available).toBe('boolean')
    await page.goto('/clients')
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()
  })
})
