import { test, expect, type Page, type Route } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { FAKE_ID, draftRow, mockDraft, quote, storyDraft, BRIEF } from './helpers/fixtures'
import { alertOf, collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * STEP 1 — "Your content" (/create).
 *
 * Opens on what was picked on Home (a document when nothing was): "Add your
 * document." with a big drop box, chips to switch to a website, pasted text
 * or an idea, then the optional "For" and "Goal". "Read it →" in the bottom
 * bar reads it and opens step 2. The client list, the upload and the draft
 * are mocked so every button can be pressed and the request it sends
 * checked. (One real end-to-end run lives in redesign-journey.spec.ts.)
 */

const PDF = path.join(__dirname, 'fixtures', 'sample-plan.pdf')
const CLIENTS = [
  { id: '00000000-e2e0-4000-8000-0000000000c1', name: 'Jordan Lee', email: 'jordan@example.com' },
  { id: '00000000-e2e0-4000-8000-0000000000c2', name: 'Priya Shah', email: null },
]

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page, [/status of (400|402|409|422|500)/])
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors on step 1').toEqual([])
})

type ClientMock = { searches: string[]; created: any[]; made: typeof CLIENTS; createStatus: number }
async function mockClients(page: Page): Promise<ClientMock> {
  const m: ClientMock = { searches: [], created: [], made: [], createStatus: 201 }
  await page.route('**/api/clients**', async (route: Route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (req.method() === 'GET' && u.pathname === '/api/clients') {
      const q = u.searchParams.get('search') ?? ''
      m.searches.push(q)
      expect(u.searchParams.get('sort')).toBe('last_activity_at')
      return route.fulfill({ json: { clients: CLIENTS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) } })
    }
    if (req.method() === 'GET') {
      const c = [...CLIENTS, ...m.made].find((x) => u.pathname.endsWith(x.id))
      return c ? route.fulfill({ json: { client: c } }) : route.fulfill({ status: 404, json: {} })
    }
    if (req.method() === 'POST') {
      const body = jsonBody(req)
      m.created.push(body)
      if (m.createStatus !== 201) return route.fulfill({ status: m.createStatus, json: { error: 'A client with that email already exists.' } })
      const client = { id: '00000000-e2e0-4000-8000-0000000000c9', name: body.name, email: body.email ?? null }
      m.made.push(client)
      return route.fulfill({ status: 201, json: { client } })
    }
    return route.fallback()
  })
  return m
}

type UploadMock = { extractBodies: any[]; uploads: number; extractStatus: number; extractError: string }
async function mockUpload(page: Page): Promise<UploadMock> {
  const m: UploadMock = { extractBodies: [], uploads: 0, extractStatus: 200, extractError: '' }
  let n = 0
  await page.route('**/api/extract-doc/upload-url', async (route) => {
    const body = jsonBody(route.request())
    n++
    await route.fulfill({ json: { bucket: 'creation-assets', path: `e2e/${n}-${body.fileName}`, token: 'e2e-token' } })
  })
  await page.route('**/storage/v1/object/upload/sign/**', async (route) => {
    m.uploads++
    await route.fulfill({ json: { Key: 'creation-assets/e2e' } })
  })
  await page.route('**/api/extract-doc', async (route) => {
    const body = jsonBody(route.request())
    m.extractBodies.push(body)
    if (m.extractStatus !== 200) return route.fulfill({ status: m.extractStatus, json: { error: m.extractError } })
    await route.fulfill({ json: { title: 'Family Protection Plan', industry: 'insurance', sections: [{ title: 'Cost', content: '$84.50 a month' }] } })
  })
  return m
}

type NewDraft = { posts: any[]; status: number; briefs: any[]; draft: Awaited<ReturnType<typeof mockDraft>> }
async function mockNewDraft(page: Page): Promise<NewDraft> {
  const draft = await mockDraft(page, draftRow(storyDraft()))
  const m: NewDraft = { posts: [], status: 200, briefs: [], draft }
  await mockSummary(page, m.briefs)
  await page.route('**/api/videos/draft', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    m.posts.push(jsonBody(route.request()))
    if (m.status !== 200) return route.fulfill({ status: m.status, json: { error: 'You’ve used your 2 free projects this month.' } })
    await route.fulfill({ json: { videoId: FAKE_ID } })
  })
  return m
}

/** Reading asks /api/brief once (the point and numbers step 2 shows). */
async function mockSummary(page: Page, briefs: any[] = []) {
  await page.route('**/api/brief', async (route) => { briefs.push(jsonBody(route.request())); await route.fulfill({ json: { brief: BRIEF } }) })
  await page.route('**/api/price-quote**', (route) => route.fulfill({ json: quote() }))
}

const goalBox = (page: Page) => page.getByPlaceholder('e.g. Book a review call')
const bar = (page: Page) => page.getByRole('region', { name: 'Next step' })
const nextBtn = (page: Page) => bar(page).getByRole('button', { name: 'Read it →' })
const useSource = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()
const chip = (page: Page, name: string) => page.getByRole('group', { name: 'Your clients' }).getByRole('button', { name, exact: true })

test.describe('Step 1 — what it opens on', () => {
  test('a document by default; Home’s ?source= opens a website, text or an idea', async ({ page }) => {
    await page.goto('/create')
    await expect(page.getByRole('heading', { name: 'Add your document.' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Drop your file here/ })).toBeVisible()
    for (const c of ['Use a website', 'Paste text', 'Describe an idea']) await expect(page.getByRole('button', { name: c, exact: true })).toBeVisible()
    await expect(bar(page)).toContainText('Free')
    await expect(bar(page)).toContainText('Nothing charged yet')

    await page.goto('/create?source=url')
    await expect(page.getByRole('heading', { name: 'Add your website.' })).toBeVisible()
    await expect(page.getByPlaceholder('yourcompany.com')).toBeVisible()
    await page.goto('/create?source=paste')
    await expect(page.getByRole('heading', { name: 'Paste your text.' })).toBeVisible()
    await page.goto('/create?source=ai')
    await expect(page.getByRole('heading', { name: 'Describe your idea.' })).toBeVisible()
    // The chips switch in place.
    await useSource(page, 'Use a document')
    await expect(page.getByRole('heading', { name: 'Add your document.' })).toBeVisible()
  })
})

test.describe('Step 1 — who it is for (optional)', () => {
  test('recent clients as chips: pick, unpick, find', async ({ page }) => {
    const clients = await mockClients(page)
    await page.goto('/create')
    await expect(chip(page, 'Jordan Lee')).toBeVisible()
    await expect(chip(page, 'Priya Shah')).toBeVisible()

    await chip(page, 'Priya Shah').click()
    await expect(chip(page, 'Priya Shah')).toHaveAttribute('aria-pressed', 'true')
    await expect(chip(page, 'Jordan Lee')).toHaveAttribute('aria-pressed', 'false')
    // Pressing it again makes it general.
    await chip(page, 'Priya Shah').click()
    await expect(chip(page, 'Priya Shah')).toHaveAttribute('aria-pressed', 'false')

    await page.getByRole('button', { name: 'Find', exact: true }).click()
    await page.getByLabel('Search your clients').fill('pri')
    await expect(chip(page, 'Jordan Lee')).toHaveCount(0)
    await expect(chip(page, 'Priya Shah')).toBeVisible()
    expect(clients.searches).toContain('pri')
  })

  test('a new client can be added inline; a missing name and a server refusal are both explained', async ({ page }) => {
    const clients = await mockClients(page)
    await page.goto('/create')
    await page.getByRole('button', { name: '+ New', exact: true }).click()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(alertOf(page)).toHaveText('Add their name')
    expect(clients.created).toHaveLength(0)

    clients.createStatus = 409
    await page.getByLabel('New client name').fill('Sam Rivera')
    await page.getByLabel('New client email').fill('sam@example.com')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(alertOf(page)).toHaveText('A client with that email already exists.')

    clients.createStatus = 201
    await page.getByLabel('New client email').fill('sam.rivera@example.com')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(chip(page, 'Sam Rivera')).toHaveAttribute('aria-pressed', 'true')
    expect(clients.created[clients.created.length - 1]).toEqual({ name: 'Sam Rivera', email: 'sam.rivera@example.com' })
  })
})

test.describe('Step 1 — what it says when something is missing', () => {
  test('each missing piece is named under the held-back button, with "Show me"', async ({ page }) => {
    await mockClients(page)
    const drafts = await mockNewDraft(page)
    await page.goto('/create')
    const err = bar(page).locator('.kit-btn-reason')

    await expect(nextBtn(page)).toBeDisabled()
    await expect(err).toContainText('Add a file to continue')
    // "Show me" takes you to the missing answer
    await err.getByRole('button', { name: 'Show me' }).click()
    await expect(page.getByRole('button', { name: /Drop your file here/ })).toBeFocused()
    await useSource(page, 'Paste text')
    await page.getByPlaceholder('Paste your content here (at least 50 characters)').fill('too short')
    await expect(err).toContainText('Paste at least 50 characters')
    await useSource(page, 'Describe an idea')
    await expect(err).toContainText('Describe your idea first')
    await useSource(page, 'Use a website')
    await expect(err).toContainText('Type or paste a website to continue')
    await page.getByPlaceholder('yourcompany.com').fill('example.com')
    await expect(err).toHaveCount(0)
    await expect(nextBtn(page)).toBeEnabled()
    expect(drafts.posts).toHaveLength(0)
  })

  test('the commercial link opens its page; no graphics maker', async ({ page }) => {
    await page.goto('/create')
    // Docs2Video no longer makes custom graphics (videos-only, 2026-10-09).
    await expect(page.getByRole('link', { name: /Custom graphics/i })).toHaveCount(0)
    await page.getByRole('button', { name: 'Got it' }).click({ timeout: 5000 }).catch(() => {})
    await page.getByRole('link', { name: 'Start a commercial' }).click()
    await expect(page).toHaveURL(/\/create\/commercial$/)
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('Step 1 — reading the content', () => {
  test('upload a PDF: the request carries the client, the goal and the file, then step 2 opens', async ({ page }) => {
    await mockClients(page)
    const up = await mockUpload(page)
    const drafts = await mockNewDraft(page)
    await page.goto('/create')
    await chip(page, 'Jordan Lee').click()
    await goalBox(page).fill('Explain the family plan to Jordan')
    await page.locator('input[type=file]').first().setInputFiles(PDF)
    await expect(page.getByRole('list', { name: 'Your files' })).toContainText('sample-plan.pdf')
    await nextBtn(page).click()
    // Straight on to the story — the point and the numbers are checked there.
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}$`))
    expect(drafts.briefs).toEqual([{ videoId: FAKE_ID }])
    await expect(page.getByLabel('The one point')).toHaveValue(BRIEF.angle)

    expect(up.uploads).toBe(1)
    expect(up.extractBodies).toEqual([{ path: 'e2e/1-sample-plan.pdf', purpose: 'Explain the family plan to Jordan' }])
    expect(drafts.posts).toHaveLength(1)
    expect(drafts.posts[0]).toMatchObject({
      outputType: 'video',
      purpose: 'Explain the family plan to Jordan',
      recipientName: 'Jordan Lee',
      clientId: CLIENTS[0].id,
      contentMethod: 'upload',
      sourcePdfPath: 'e2e/1-sample-plan.pdf',
      sourcePdfName: 'sample-plan.pdf',
    })
    expect(drafts.posts[0].extractedData.title).toBe('Family Protection Plan')
  })

  test('nothing optional is needed: a file alone is enough', async ({ page }) => {
    await mockClients(page)
    await mockUpload(page)
    const drafts = await mockNewDraft(page)
    await page.goto('/create')
    await page.locator('input[type=file]').first().setInputFiles(PDF)
    await nextBtn(page).click()
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}$`))
    expect(drafts.posts[0]).toMatchObject({ purpose: '', contentMethod: 'upload' })
    expect(drafts.posts[0].clientId).toBeUndefined()
  })

  test('a file can be taken off the list before reading', async ({ page }) => {
    await page.goto('/create')
    await page.locator('input[type=file]').first().setInputFiles(PDF)
    const files = page.getByRole('list', { name: 'Your files' })
    await expect(files.getByRole('listitem')).toHaveCount(1)
    await page.getByRole('button', { name: 'Remove sample-plan.pdf' }).click()
    await expect(files).toHaveCount(0)
    await expect(nextBtn(page)).toBeDisabled()
  })

  test('a document that cannot be read shows the server’s reason and can be tried again', async ({ page }) => {
    await mockClients(page)
    const up = await mockUpload(page)
    const drafts = await mockNewDraft(page)
    up.extractStatus = 422
    up.extractError = 'This PDF is password protected. Remove the password and try again.'
    await page.goto('/create')
    await page.locator('input[type=file]').first().setInputFiles(PDF)
    await nextBtn(page).click()
    await expect(page.getByText('This PDF is password protected. Remove the password and try again.')).toBeVisible()
    await expect(nextBtn(page)).toBeEnabled()
    expect(drafts.posts).toHaveLength(0)
  })

  test('the wrong kind of file is refused before uploading', async ({ page }) => {
    const up = await mockUpload(page)
    await page.goto('/create')
    await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') })
    await nextBtn(page).click()
    await expect(page.getByText('Unsupported file type. Allowed: PDF, DOCX, PPTX, TXT, CSV, XLSX')).toBeVisible()
    expect(up.uploads).toBe(0)
  })

  test('two files are compared; if comparing fails, step 2 says so', async ({ page }) => {
    await mockClients(page)
    const up = await mockUpload(page)
    const drafts = await mockNewDraft(page)
    const combines: any[] = []
    await page.route('**/api/combine-docs', async (route) => { combines.push(jsonBody(route.request())); await route.fulfill({ status: 500, json: { error: 'x' } }) })
    await page.goto('/create')
    await goalBox(page).fill('Compare these two plans')
    await page.locator('input[type=file]').first().setInputFiles([
      { name: 'sample-plan.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) },
      { name: 'second.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) },
    ])
    await expect(page.getByRole('list', { name: 'Your files' }).getByRole('listitem')).toHaveCount(2)
    // The extra file's cost is shown on step 3, never worked out here.
    await expect(page.getByText('Each extra file adds to the price', { exact: false })).toBeVisible()
    await nextBtn(page).click()
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}&combine=failed$`))
    await expect(page.getByText('We couldn’t compare your files automatically this time.', { exact: false })).toBeVisible()
    expect(up.uploads).toBe(2)
    expect(combines).toEqual([{ videoId: FAKE_ID }])
    expect(drafts.posts[0].extractedDocs).toHaveLength(2)
    expect(drafts.posts[0].combineInstruction).toBe('Compare these two plans')
    expect(drafts.posts[0].clientId).toBeUndefined()
  })

  test('pasted text, an idea and a web link each send the right request', async ({ page }) => {
    await mockClients(page)
    const drafts = await mockNewDraft(page)
    const extract: any[] = []
    const urls: any[] = []
    await page.route('**/api/extract', async (route) => { extract.push(jsonBody(route.request())); await route.fulfill({ json: { title: 'Read' } }) })
    await page.route('**/api/extract-url', async (route) => { urls.push(jsonBody(route.request())); await route.fulfill({ json: { title: 'Site', autoBrandId: 'b-1' } }) })
    const text = 'Our family plan costs $84.50 a month and pays $500,000 if the worst happens to you.'

    await page.goto('/create')
    await goalBox(page).fill('Explain it')
    await useSource(page, 'Paste text')
    await page.getByPlaceholder('Paste your content here (at least 50 characters)').fill(text)
    await nextBtn(page).click()
    await expect(page).toHaveURL(/\/create\/script\?id=/)
    expect(extract[0]).toEqual({ text, purpose: 'Explain it' })
    expect(drafts.posts[0].contentMethod).toBe('text')

    await page.goto('/create?source=ai')
    await page.getByLabel('Your idea').fill('Why term life makes sense for young parents')
    await nextBtn(page).click()
    await expect(page).toHaveURL(/\/create\/script\?id=/)
    // With no goal, the idea is the goal too.
    expect(extract[1]).toEqual({ idea: 'Why term life makes sense for young parents', purpose: 'Why term life makes sense for young parents' })
    expect(drafts.posts[1]).toMatchObject({ contentMethod: 'idea', purpose: 'Why term life makes sense for young parents' })

    await page.goto('/create')
    await goalBox(page).fill('Explain our agency')
    await useSource(page, 'Use a website')
    await page.getByPlaceholder('yourcompany.com').fill('example.com/about')
    await nextBtn(page).click()
    await expect(page).toHaveURL(/\/create\/script\?id=/)
    expect(urls[0]).toEqual({ url: 'https://example.com/about' })
    expect(drafts.posts[2].contentMethod).toBe('url')
    expect(drafts.posts[2].extractedData._autoBrandId).toBe('b-1')
  })

  test('a refused draft shows the server’s own words', async ({ page }) => {
    await mockClients(page)
    const drafts = await mockNewDraft(page)
    drafts.status = 402
    await page.route('**/api/extract', (route) => route.fulfill({ json: { title: 'x' } }))
    await page.goto('/create?source=ai')
    await page.getByLabel('Your idea').fill('Explain it')
    await nextBtn(page).click()
    await expect(page.getByText('You’ve used your 2 free projects this month.')).toBeVisible()
    await expect(page).toHaveURL(/\/create\?source=ai$/)
  })
})

test('coming back to step 1 reopens the same draft and updates it instead of making a new one', async ({ page }) => {
  guard = await guardRealWorld(page)
  await mockClients(page)
  const draft = await mockDraft(page, draftRow(storyDraft({ clientId: CLIENTS[0].id, purpose: 'Explain the family plan', contentMethod: 'upload' })))
  await mockSummary(page)
  let posts = 0
  await page.route('**/api/videos/draft', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    posts++ // must not happen — and must never reach the real database
    return route.fulfill({ json: { videoId: FAKE_ID } })
  })
  await page.route('**/api/extract', (route) => route.fulfill({ json: { title: 'Again' } }))
  await page.goto(`/create?id=${FAKE_ID}`)
  await expect(goalBox(page)).toHaveValue('Explain the family plan')
  await expect(chip(page, 'Jordan Lee')).toHaveAttribute('aria-pressed', 'true')
  // It says the project was read already, with a way back to the story.
  await expect(page.getByRole('link', { name: 'Back to the story' })).toHaveAttribute('href', `/create/script?id=${FAKE_ID}`)
  await useSource(page, 'Describe an idea')
  await page.getByLabel('Your idea').fill('A fresh idea')
  await nextBtn(page).click()
  await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}$`))
  expect(posts).toBe(0)
  expect(draft.patches[0]).toMatchObject({ videoId: FAKE_ID, updates: { purpose: 'Explain the family plan', clientId: CLIENTS[0].id, recipientName: 'Jordan', contentMethod: 'idea', sourcePdfPath: null, extractedDocs: [] } })
})

test('an old "Here’s what we read" link lands on the story step', async ({ page }) => {
  await mockDraft(page, draftRow(storyDraft()))
  await mockSummary(page)
  await page.goto(`/create?id=${FAKE_ID}&review=1`)
  await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}$`))
})

test.describe('Duplicate (from a finished project’s page)', () => {
  const SOURCE_ID = '00000000-e2e0-4000-8000-0000000000d1'

  test('makes the copy on the server and opens it on the story step', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft()))
    await mockSummary(page)
    const asked: any[] = []
    // The copy itself is a database write — mocked here, checked by its body.
    await page.route('**/api/videos/draft/duplicate', async (route) => {
      asked.push(jsonBody(route.request()))
      await route.fulfill({ json: { videoId: FAKE_ID, next: `/create/script?id=${FAKE_ID}&copied=1` } })
    })
    await page.goto(`/create?duplicate=${SOURCE_ID}`)
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}&copied=1$`))
    expect(asked).toEqual([{ videoId: SOURCE_ID }])
    await expect(page.getByText('This is a copy of your earlier project', { exact: false })).toBeVisible()
    await expect(page.locator('[data-scene="2"]')).toContainText('What it costs')
  })

  test('a project that can’t be copied says why and leaves a blank step 1 to start fresh', async ({ page }) => {
    await mockClients(page)
    await page.route('**/api/videos/draft/duplicate', (route) => route.fulfill({ status: 422, json: { error: 'This one wasn’t made from a document or a story, so there’s nothing to copy.' } }))
    await page.goto(`/create?duplicate=${SOURCE_ID}`)
    await expect(page.getByText('This one wasn’t made from a document or a story, so there’s nothing to copy. You can start a new one here.')).toBeVisible()
    await expect(page).toHaveURL(/\/create$/)
    await expect(page.getByRole('heading', { name: 'Add your document.' })).toBeVisible()
  })
})
