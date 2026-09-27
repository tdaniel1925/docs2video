import { test, expect, type Page, type Route } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { FAKE_ID, draftRow, mockDraft, storyDraft } from './helpers/fixtures'
import { alertOf, collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * STEP 1 — "What's this about?" (/create).
 *
 * The client list, the upload and the draft are mocked so every button can
 * be pressed and the request it sends checked. (One real end-to-end run —
 * real upload, real reading, real story — lives in redesign-journey.spec.ts.)
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

type NewDraft = { posts: any[]; status: number }
async function mockNewDraft(page: Page): Promise<NewDraft> {
  const m: NewDraft = { posts: [], status: 200 }
  await mockDraft(page, draftRow(storyDraft()))
  await page.route('**/api/videos/draft', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    m.posts.push(jsonBody(route.request()))
    if (m.status !== 200) return route.fulfill({ status: m.status, json: { error: 'You’ve used your 2 free projects this month.' } })
    await route.fulfill({ json: { videoId: FAKE_ID } })
  })
  return m
}

const purposeBox = (page: Page) => page.getByPlaceholder(/Explain our services/)
const nextBtn = (page: Page) => page.getByRole('button', { name: 'Read it and plan the story →' })
const method = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}`) })

test.describe('Step 1 — who it is for', () => {
  test('recent clients, search, pick, change, and "No client — general"', async ({ page }) => {
    const clients = await mockClients(page)
    await page.goto('/create')
    await expect(page.getByRole('button', { name: 'Jordan Lee' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Priya Shah' })).toBeVisible()

    await page.getByLabel('Search your clients').fill('pri')
    await expect(page.getByRole('button', { name: 'Jordan Lee' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Priya Shah' })).toBeVisible()
    expect(clients.searches).toContain('pri')

    await page.getByRole('button', { name: 'Priya Shah' }).click()
    await expect(page.getByText('Priya Shah', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Search your clients')).toHaveCount(0)
    await page.getByRole('button', { name: 'Change' }).click()
    await expect(page.getByLabel('Search your clients')).toBeVisible()

    await page.getByRole('button', { name: 'No client — general' }).click()
    await expect(page.getByText('No client — general', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible()
  })

  test('a new client can be added inline; a missing name and a server refusal are both explained', async ({ page }) => {
    const clients = await mockClients(page)
    await page.goto('/create')
    await page.getByRole('button', { name: '+ New client' }).click()
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
    await expect(page.getByText('Sam Rivera', { exact: true })).toBeVisible()
    expect(clients.created[clients.created.length - 1]).toEqual({ name: 'Sam Rivera', email: 'sam.rivera@example.com' })
  })
})

test.describe('Step 1 — what it says when something is missing', () => {
  test('each missing piece gets its own message and nothing is sent', async ({ page }) => {
    await mockClients(page)
    const drafts = await mockNewDraft(page)
    await page.goto('/create')
    const err = page.getByText(/Describe what you want first|Pick where your content comes from|Select a file to continue|Paste at least 50 characters|Paste a URL to continue/)

    await nextBtn(page).click()
    await expect(err).toHaveText('Describe what you want first')
    await purposeBox(page).fill('Explain the family plan to Jordan')
    await nextBtn(page).click()
    await expect(err).toHaveText('Pick where your content comes from (or choose "AI writes it")')
    await method(page, 'Upload file').click()
    await expect(err).toHaveCount(0) // picking a source clears the message
    await nextBtn(page).click()
    await expect(err).toHaveText('Select a file to continue')
    await method(page, 'Paste text').click()
    await page.getByPlaceholder('Paste your content here (at least 50 characters)').fill('too short')
    await nextBtn(page).click()
    await expect(err).toHaveText('Paste at least 50 characters')
    await method(page, 'Website URL').click()
    await nextBtn(page).click()
    await expect(err).toHaveText('Paste a URL to continue')
    expect(drafts.posts).toHaveLength(0)
  })

  test('Cancel goes Home; the other-things links open their pages', async ({ page }) => {
    await page.goto('/create')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto('/create')
    await page.getByRole('link', { name: 'Custom graphics' }).click()
    await expect(page).toHaveURL(/\/design$/)
    await expect(page.locator('h1').first()).toBeVisible()
    await page.goto('/create')
    await page.getByRole('link', { name: 'A commercial' }).click()
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
    await page.getByRole('button', { name: 'Jordan Lee' }).click()
    await purposeBox(page).fill('Explain the family plan to Jordan')
    await method(page, 'Upload file').click()
    await page.locator('input[type=file]').first().setInputFiles(PDF)
    await expect(page.getByText('sample-plan.pdf')).toBeVisible()
    await nextBtn(page).click()
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}$`))

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

  test('a document that cannot be read shows the server’s reason and can be tried again', async ({ page }) => {
    await mockClients(page)
    const up = await mockUpload(page)
    const drafts = await mockNewDraft(page)
    up.extractStatus = 422
    up.extractError = 'This PDF is password protected. Remove the password and try again.'
    await page.goto('/create')
    await purposeBox(page).fill('Explain the plan')
    await method(page, 'Upload file').click()
    await page.locator('input[type=file]').first().setInputFiles(PDF)
    await nextBtn(page).click()
    await expect(page.getByText('This PDF is password protected. Remove the password and try again.')).toBeVisible()
    await expect(nextBtn(page)).toBeEnabled()
    expect(drafts.posts).toHaveLength(0)
  })

  test('the wrong kind of file is refused before uploading', async ({ page }) => {
    const up = await mockUpload(page)
    await page.goto('/create')
    await purposeBox(page).fill('Explain the plan')
    await method(page, 'Upload file').click()
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
    await page.getByRole('button', { name: 'No client — general' }).click()
    await purposeBox(page).fill('Compare these two plans')
    await method(page, 'Upload file').click()
    await page.locator('input[type=file]').first().setInputFiles([
      { name: 'sample-plan.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) },
      { name: 'second.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) },
    ])
    await expect(page.getByText('2 files selected')).toBeVisible()
    await nextBtn(page).click()
    await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}&combine=failed$`))
    await expect(page.getByText('We couldn’t compare your files automatically this time.', { exact: false })).toBeVisible()
    expect(up.uploads).toBe(2)
    expect(combines).toEqual([{ videoId: FAKE_ID }])
    expect(drafts.posts[0].extractedDocs).toHaveLength(2)
    expect(drafts.posts[0].combineInstruction).toBe('Compare these two plans')
    expect(drafts.posts[0].clientId).toBeUndefined()
  })

  test('pasted text, "AI writes it" and a web link each send the right request', async ({ page }) => {
    await mockClients(page)
    const drafts = await mockNewDraft(page)
    const extract: any[] = []
    const urls: any[] = []
    await page.route('**/api/extract', async (route) => { extract.push(jsonBody(route.request())); await route.fulfill({ json: { title: 'Read' } }) })
    await page.route('**/api/extract-url', async (route) => { urls.push(jsonBody(route.request())); await route.fulfill({ json: { title: 'Site', autoBrandId: 'b-1' } }) })
    const text = 'Our family plan costs $84.50 a month and pays $500,000 if the worst happens to you.'

    await page.goto('/create')
    await purposeBox(page).fill('Explain it')
    await method(page, 'Paste text').click()
    await page.getByPlaceholder('Paste your content here (at least 50 characters)').fill(text)
    await nextBtn(page).click()
    await expect(page).toHaveURL(/\/create\/script\?id=/)
    expect(extract[0]).toEqual({ text, purpose: 'Explain it' })
    expect(drafts.posts[0].contentMethod).toBe('text')

    await page.goto('/create')
    await purposeBox(page).fill('Why term life makes sense for young parents')
    await method(page, 'AI writes it').click()
    await expect(page.getByText('AI will generate content based on your description above.')).toBeVisible()
    await nextBtn(page).click()
    await expect(page).toHaveURL(/\/create\/script\?id=/)
    expect(extract[1]).toEqual({ idea: 'Why term life makes sense for young parents', purpose: 'Why term life makes sense for young parents' })
    expect(drafts.posts[1].contentMethod).toBe('idea')

    await page.goto('/create')
    await purposeBox(page).fill('Explain our agency')
    await method(page, 'Website URL').click()
    await page.getByPlaceholder('https://example.com').fill('example.com/about')
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
    await page.goto('/create')
    await purposeBox(page).fill('Explain it')
    await method(page, 'AI writes it').click()
    await nextBtn(page).click()
    await expect(page.getByText('You’ve used your 2 free projects this month.')).toBeVisible()
    await expect(page).toHaveURL(/\/create$/)
  })
})

test('coming back to step 1 reopens the same draft and updates it instead of making a new one', async ({ page }) => {
  guard = await guardRealWorld(page)
  await mockClients(page)
  const draft = await mockDraft(page, draftRow(storyDraft({ clientId: CLIENTS[0].id, purpose: 'Explain the family plan' })))
  let posts = 0
  await page.route('**/api/videos/draft', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    posts++ // must not happen — and must never reach the real database
    return route.fulfill({ json: { videoId: FAKE_ID } })
  })
  await page.route('**/api/extract', (route) => route.fulfill({ json: { title: 'Again' } }))
  await page.goto(`/create?id=${FAKE_ID}`)
  await expect(purposeBox(page)).toHaveValue('Explain the family plan')
  await expect(page.getByText('Jordan Lee', { exact: true })).toBeVisible()
  await method(page, 'AI writes it').click()
  await nextBtn(page).click()
  await expect(page).toHaveURL(new RegExp(`/create/script\\?id=${FAKE_ID}$`))
  expect(posts).toBe(0)
  expect(draft.patches[0]).toMatchObject({ videoId: FAKE_ID, updates: { purpose: 'Explain the family plan', clientId: CLIENTS[0].id, recipientName: 'Jordan', contentMethod: 'idea', sourcePdfPath: null, extractedDocs: [] } })
})
