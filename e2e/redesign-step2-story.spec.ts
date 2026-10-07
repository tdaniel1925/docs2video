import { test, expect, type Page } from '@playwright/test'
import { FAKE_ID, BRIEF, draftRow, mockDraft, quote, scenes, storyDraft } from './helpers/fixtures'
import { alertOf, collectConsoleErrors, expectNoBlockedCalls, guardRealWorld, jsonBody, type Guard } from './helpers/guard'

/*
 * STEP 2 — "Check the story" (/create/script).
 *
 * Every server call is mocked around a pretend draft, so each button can be
 * pressed and the request it sends checked, without writing a real story.
 */

const url = `/create/script?id=${FAKE_ID}`
const titleOf = (page: Page, n: number) => page.getByLabel(`Scene ${n} title`)

let guard: Guard
let consoleErrors: string[]

test.beforeEach(async ({ page }) => {
  guard = await guardRealWorld(page)
  consoleErrors = collectConsoleErrors(page, [/\[story\] (autosave failed|load draft error)/, /status of (404|500)/])
  // "Your video so far" shows the server's price for the draft.
  await page.route('**/api/price-quote**', (route) => route.fulfill({ json: quote() }))
})
test.afterEach(() => {
  expectNoBlockedCalls(guard)
  expect(consoleErrors, 'console errors on the story screen').toEqual([])
})

test.describe('Step 2 — the story, already written', () => {
  test('shows the one point, the numbers and every scene with its time', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft()))
    await page.goto(url)
    await expect(page.getByRole('heading', { name: /story\./ })).toBeVisible()
    await expect(page.locator('.ws-work').getByText('The one point')).toBeVisible()
    await expect(page.locator('.ws-work').getByText(BRIEF.angle)).toBeVisible()
    await expect(page.getByText('$84.50')).toBeVisible()
    await page.getByText('What it covers').click()
    await expect(page.getByText('20-year term')).toBeVisible()
    await expect(page.getByText('Leaving out: jargon')).toBeVisible()

    for (const [i, s] of scenes().entries()) await expect(titleOf(page, i + 1)).toHaveValue(s.title)
    await expect(page.getByText('Opening')).toBeVisible()
    await expect(page.getByText('Closing', { exact: true })).toBeVisible()
    await expect(page.getByText(/5 scenes · about 1 min/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Looks right — pick the look →' })).toBeEnabled()
  })

  test('editing a title autosaves the whole story and shows Saved only after the save', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    await page.goto(url)
    await titleOf(page, 2).fill('What you pay each month')
    await expect.poll(() => draft.patches.length, { timeout: 5000 }).toBe(1)
    const saved = draft.patches[0]
    expect(saved.videoId).toBe(FAKE_ID)
    expect(saved.updates.scenes).toHaveLength(5)
    expect(saved.updates.scenes[1].title).toBe('What you pay each month')
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    // Narration edits save too.
    await page.getByLabel('What the voice says in scene 3').fill('Your family receives half a million dollars.')
    await expect.poll(() => draft.patches.length, { timeout: 5000 }).toBe(2)
    expect(draft.patches[1].updates.scenes[2].narration).toBe('Your family receives half a million dollars.')
  })

  test('a failed save says so out loud instead of showing a tick', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    draft.patchStatus = 500
    await page.goto(url)
    await titleOf(page, 2).fill('This will not save')
    await expect(alertOf(page)).toHaveText('Your changes aren’t saving right now. Keep this tab open — don’t reload.')
    await expect(page.getByText('Saved', { exact: true })).toHaveCount(0)

    // …and the warning clears once a save works again.
    draft.patchStatus = 200
    await titleOf(page, 2).fill('This will save')
    await expect(page.getByText('Your changes aren’t saving right now', { exact: false })).toHaveCount(0, { timeout: 5000 })
  })

  test('dragging a scene moves it and saves the new order; the opening cannot be moved onto', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    await page.goto(url)
    const card = (n: number) => page.locator('div[draggable]', { has: titleOf(page, n) })
    await expect(card(1)).toHaveAttribute('draggable', 'false') // opening
    await expect(card(5)).toHaveAttribute('draggable', 'false') // closing

    // Real drag events, dispatched straight at the two cards, so a drop that
    // "does nothing" is known to have been delivered (Playwright's mouse drag
    // could miss the target and pass for the wrong reason).
    const drag = async (from: number, to: number) => {
      const dt = await page.evaluateHandle(() => new DataTransfer())
      await card(from).dispatchEvent('dragstart', { dataTransfer: dt })
      await card(to).dispatchEvent('dragover', { dataTransfer: dt })
      await card(to).dispatchEvent('drop', { dataTransfer: dt })
      await card(from).dispatchEvent('dragend', { dataTransfer: dt }).catch(() => {})
    }

    await drag(3, 2)
    await expect.poll(() => draft.patches.length).toBe(1)
    expect(draft.patches[0].updates.scenes.map((s: { title: string }) => s.title))
      .toEqual(['Your Family Plan', 'What it pays', 'What it costs', 'How long it lasts', 'Thank You'])
    await expect(titleOf(page, 2)).toHaveValue('What it pays')

    // Dropping onto the opening (or the closing) does nothing.
    await drag(4, 1)
    await drag(2, 5)
    await page.waitForTimeout(400)
    expect(draft.patches).toHaveLength(1)
    await expect(titleOf(page, 1)).toHaveValue('Your Family Plan')
    await expect(titleOf(page, 5)).toHaveValue('Thank You')

    // …while a drop between content scenes in the same state still works.
    await drag(4, 3)
    await expect.poll(() => draft.patches.length).toBe(2)
    expect(draft.patches[1].updates.scenes.map((s: { title: string }) => s.title))
      .toEqual(['Your Family Plan', 'What it pays', 'How long it lasts', 'What it costs', 'Thank You'])
  })

  test('"More" opens the words on screen: numbers, points, AI helper and preview', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    await page.route('**/api/scene-edit', async (route) => {
      const body = jsonBody(route.request())
      expect(body.instruction).toBe('make it punchier')
      expect(body.scene.title).toBe('What it costs')
      await route.fulfill({ json: { scene: { ...body.scene, narration: 'Eighty four fifty a month. Locked in.' }, reply: 'Made it punchier.' } })
    })
    await page.route('**/api/style-previews', (route) => route.fulfill({ json: { previewUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } }))
    await page.goto(url)

    const more = page.getByRole('button', { name: 'More — words on screen, ask AI, preview' }).nth(1)
    await more.click()
    await expect(page.getByText('Words on screen', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true')

    // + Add number saves at once with an empty number added.
    await page.getByRole('button', { name: '+ Add number' }).click()
    await expect.poll(() => draft.patches.length).toBe(1)
    expect(draft.patches[0].updates.scenes[1].slideData.stats).toHaveLength(2)
    // Remove the first number.
    await page.getByTitle('Remove number').first().click()
    await expect.poll(() => draft.patches.length).toBe(2)
    expect(draft.patches[1].updates.scenes[1].slideData.stats).toEqual([{ value: '', label: '' }])
    // + Add point / remove a point.
    await page.getByRole('button', { name: '+ Add point' }).click()
    await expect.poll(() => draft.patches.length).toBe(3)
    expect(draft.patches[2].updates.scenes[1].slideData.bullets).toEqual(['Fixed price', 'No surprises', ''])
    await page.getByTitle('Remove point').first().click()
    await expect.poll(() => draft.patches.length).toBe(4)
    expect(draft.patches[3].updates.scenes[1].slideData.bullets).toEqual(['No surprises', ''])

    // The per-scene AI helper, with its own undo.
    await page.getByRole('button', { name: '✨ Edit with AI' }).click()
    const sceneAsk = page.getByPlaceholder('e.g. "make it shorter and more upbeat"')
    await sceneAsk.fill('make it punchier')
    await sceneAsk.press('Enter')
    await expect(page.getByText('Made it punchier.')).toBeVisible()
    await expect(page.getByLabel('What the voice says in scene 2')).toHaveValue('Eighty four fifty a month. Locked in.')
    await page.getByRole('button', { name: '↺ Undo' }).click()
    await expect(page.getByLabel('What the voice says in scene 2')).toHaveValue(/eighty four dollars and fifty cents/)

    // Preview slide opens and closes.
    await page.getByRole('button', { name: 'Preview slide' }).click()
    await expect(page.getByText('Slide 2 preview')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Slide preview' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByText('Slide 2 preview')).toHaveCount(0)

    await page.getByRole('button', { name: 'Less' }).click()
    await expect(page.getByText('Words on screen', { exact: true })).toHaveCount(0)
  })

  test('asking for a change rewrites the story, and Undo puts it back', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    let asks = 0
    await page.route('**/api/ai-edit-scenes', async (route) => {
      asks++
      const body = jsonBody(route.request())
      expect(body.instruction).toBe('Make it shorter')
      expect(body.scenes).toHaveLength(5)
      // The AI drops the _auto marks on the bookends — the page must keep them.
      const out = body.scenes.map((s: Record<string, unknown>) => {
        const { _auto, _autoNarration, ...rest } = s
        return s._role ? rest : { ...rest, title: `${rest.title} (short)` }
      })
      await route.fulfill({ json: { scenes: out } })
    })
    await page.goto(url)
    await page.getByRole('button', { name: 'Make it shorter' }).click()
    await expect(page.getByText('Done — I rewrote the story.', { exact: false })).toBeVisible()
    await expect(titleOf(page, 2)).toHaveValue('What it costs (short)')
    expect(asks).toBe(1)
    await expect.poll(() => draft.patches.length).toBe(1)
    const saved = draft.patches[0].updates.scenes
    expect(saved[0]._auto, 'the opening keeps its "untouched default" mark').toBe(true)
    expect(saved[4]._auto).toBe(true)

    await page.getByRole('button', { name: 'Undo that change' }).click()
    await expect(titleOf(page, 2)).toHaveValue('What it costs')
    await expect(page.getByText('Put it back the way it was.')).toBeVisible()
    await expect.poll(() => draft.patches.length).toBe(2)
    expect(draft.patches[1].updates.scenes[1].title).toBe('What it costs')
    await expect(page.getByRole('button', { name: 'Undo that change' })).toHaveCount(0)

    // Typing an instruction works the same way (Enter sends).
    await page.route('**/api/ai-edit-scenes', (route) => route.fulfill({ status: 500, json: { error: 'x' } }))
    await page.getByLabel('Tell it what to change').fill('Simpler please')
    await page.getByLabel('Tell it what to change').press('Enter')
    await expect(page.getByText('That change didn’t work — nothing was changed.')).toBeVisible()
    await expect(titleOf(page, 2)).toHaveValue('What it costs')
  })

  test('"Write it again" asks first; Cancel keeps the story, OK writes a new one', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    const writes: any[] = []
    await page.route('**/api/generate-script', async (route) => {
      writes.push(jsonBody(route.request()))
      // The job finishes in the background; the next draft read has new scenes.
      draft.set(draftRow(storyDraft({ scriptStatus: 'ready', scenes: [{ title: 'A fresh start', narration: 'Brand new opening line for the story.' }] })))
      await route.fulfill({ json: { status: 'generating' } })
    })
    await page.goto(url)

    page.once('dialog', (d) => { expect(d.message()).toContain('Write the story again from the start?'); void d.dismiss() })
    await page.getByRole('button', { name: 'Write it again from the start' }).click()
    await page.waitForTimeout(300)
    expect(writes).toHaveLength(0)
    await expect(titleOf(page, 2)).toHaveValue('What it costs')

    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Write it again from the start' }).click()
    await expect(page.getByText('Writing your story…')).toBeVisible()
    await expect(titleOf(page, 2)).toHaveValue('A fresh start', { timeout: 15000 })
    expect(writes).toHaveLength(1)
    expect(writes[0].videoId).toBe(FAKE_ID)
    expect(writes[0].outputType).toBe('video')
    expect(writes[0].detailLevel).toBe('standard')
  })

  test('Back goes to step 1 of the same draft', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft()))
    await page.goto(url)
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page).toHaveURL(new RegExp(`/create\\?id=${FAKE_ID}$`))
    await expect(page.getByRole('heading', { name: 'What’s this about?' })).toBeVisible()
  })

  test('"Looks right" saves the story, approves the point and opens step 3', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    await page.goto(url)
    await titleOf(page, 3).fill('What your family gets')
    await page.getByRole('button', { name: 'Looks right — pick the look →' }).click()
    await expect(page).toHaveURL(new RegExp(`/create/theme\\?id=${FAKE_ID}$`))
    const last = draft.patches[draft.patches.length - 1].updates
    expect(last.step).toBe(5)
    expect(last.brief.approved).toBe(true)
    expect(last.briefSkipped).toBe(false)
    expect(last.detailLevel).toBe('standard')
    expect(last.scenes[2].title).toBe('What your family gets')
  })

  test('"Looks right" that cannot save stays here and says so', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    await page.goto(url)
    draft.patchStatus = 500
    await page.getByRole('button', { name: 'Looks right — pick the look →' }).click()
    await expect(alertOf(page)).toContainText('We couldn’t save your story. Please try again.')
    await expect(page).toHaveURL(new RegExp('/create/script'))
    await expect(page.getByRole('button', { name: 'Looks right — pick the look →' })).toBeEnabled()
  })
})

test.describe('Step 2 — the length', () => {
  const radio = (page: Page, name: string) => page.getByRole('radiogroup', { name: 'Length' }).getByRole('radio', { name: new RegExp(`^${name}`) })
  const looksRight = (page: Page) => page.getByRole('button', { name: 'Looks right — pick the look →' })

  test('a written story offers a free rewrite at a new length; Keep changes nothing', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    let writes = 0
    await page.route('**/api/generate-script', async (route) => { writes++; await route.fulfill({ json: { status: 'generating' } }) })
    await page.goto(url)
    await expect(radio(page, 'Standard')).toHaveAttribute('aria-checked', 'true')

    await radio(page, 'Short').click()
    await expect(page.getByText('Your story is written for Standard', { exact: false })).toBeVisible()
    // Step 3 would price the old length — so decide first.
    await expect(looksRight(page)).toBeDisabled()

    await page.getByRole('button', { name: 'Keep Standard' }).click()
    await expect(page.getByText('Your story is written for Standard', { exact: false })).toHaveCount(0)
    await expect(radio(page, 'Standard')).toHaveAttribute('aria-checked', 'true')
    await expect(looksRight(page)).toBeEnabled()
    expect(draft.patches, 'the saved length never changes without a rewrite').toHaveLength(0)
    expect(writes).toBe(0)
  })

  test('"Rewrite at this length" writes the story at it, and "Looks right" saves that length', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft()))
    const writes: any[] = []
    await page.route('**/api/generate-script', async (route) => {
      writes.push(jsonBody(route.request()))
      // The writer saves the scenes and the length it wrote at.
      draft.set(draftRow(storyDraft({ scriptStatus: 'ready', detailLevel: 'detailed', scenes: [{ title: 'The long version', narration: 'Every detail of the plan, one by one, explained in full.' }] })))
      await route.fulfill({ json: { status: 'generating' } })
    })
    await page.goto(url)
    await radio(page, 'Detailed').click()
    await page.getByRole('button', { name: 'Rewrite at this length' }).click()
    await expect(titleOf(page, 2)).toHaveValue('The long version', { timeout: 15000 })
    expect(writes).toHaveLength(1)
    expect(writes[0].detailLevel).toBe('detailed')
    expect(writes[0].detailed).toBe(true)
    await expect(radio(page, 'Detailed')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('button', { name: 'Rewrite at this length' })).toHaveCount(0)

    await looksRight(page).click()
    await expect(page).toHaveURL(new RegExp(`/create/theme\\?id=${FAKE_ID}$`))
    expect(draft.patches[draft.patches.length - 1].updates.detailLevel).toBe('detailed')
  })

  test('a rewrite that fails keeps the story as it was', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft()))
    await page.route('**/api/generate-script', (route) => route.fulfill({ status: 500, json: { error: 'x' } }))
    await page.goto(url)
    await radio(page, 'Short').click()
    await page.getByRole('button', { name: 'Rewrite at this length' }).click()
    await expect(alertOf(page)).toContainText('We couldn’t rewrite the story as Short just now. Your story is unchanged')
    await expect(titleOf(page, 2)).toHaveValue('What it costs')
    await expect(radio(page, 'Short')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('button', { name: 'Rewrite at this length' })).toBeVisible()
  })

  test('before the story exists, a picked length is saved and the story is written at it', async ({ page }) => {
    const questions = [{ id: 'audience', question: 'Who will watch this?', why: 'Changes the words we use.', options: ['Parents'] }]
    const draft = await mockDraft(page, draftRow(storyDraft({ scenes: undefined, brief: { ...BRIEF, clarifyingQuestions: questions } })))
    const writes: any[] = []
    await page.route('**/api/generate-script', async (route) => {
      writes.push(jsonBody(route.request()))
      draft.set(draftRow(storyDraft({ scriptStatus: 'ready', detailLevel: 'quick' })))
      await route.fulfill({ json: { status: 'generating' } })
    })
    await page.goto(url)
    await radio(page, 'Short').click()
    await expect.poll(() => draft.patches.length).toBe(1)
    expect(draft.patches[0]).toEqual({ videoId: FAKE_ID, updates: { detailLevel: 'quick' } })
    // No story yet, so nothing to rewrite — just remembered.
    await expect(page.getByRole('button', { name: 'Rewrite at this length' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Skip — just write it' }).click()
    await expect(titleOf(page, 2)).toHaveValue('What it costs', { timeout: 15000 })
    expect(writes[0].detailLevel).toBe('quick')
    await expect(radio(page, 'Short')).toHaveAttribute('aria-checked', 'true')
  })

  test('a copy made by Duplicate says so', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft()))
    await page.goto(`${url}&copied=1`)
    await expect(page.getByText('This is a copy of your earlier project', { exact: false })).toBeVisible()
  })
})

test.describe('Step 2 — before the story exists', () => {
  const questions = [
    { id: 'audience', question: 'Who will watch this?', why: 'Changes the words we use.', options: ['Parents', 'Retirees'] },
  ]

  test('questions first: answer one and the story is written with the answer', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft({ scenes: undefined, brief: { ...BRIEF, clarifyingQuestions: questions } })))
    const briefCalls: any[] = []
    await page.route('**/api/brief', async (route) => {
      briefCalls.push(jsonBody(route.request()))
      await route.fulfill({ json: { brief: { ...BRIEF, clarifyingQuestions: [] } } })
    })
    await page.route('**/api/generate-script', async (route) => {
      draft.set(draftRow(storyDraft({ scriptStatus: 'ready' })))
      await route.fulfill({ json: { status: 'generating' } })
    })
    await page.goto(url)

    await expect(page.getByText('A couple of quick questions first')).toBeVisible()
    await expect(page.getByText('Who will watch this?')).toBeVisible()
    const use = page.getByRole('button', { name: 'Use my answers and write the story' })
    await expect(use).toBeDisabled()
    // "Looks right" can't be pressed before there is a story.
    await expect(page.getByRole('button', { name: 'Looks right — pick the look →' })).toBeDisabled()
    await page.getByRole('button', { name: 'Parents' }).click()
    await expect(use).toBeEnabled()
    await use.click()
    await expect(titleOf(page, 2)).toHaveValue('What it costs', { timeout: 15000 })
    expect(briefCalls).toEqual([{ videoId: FAKE_ID, answers: { audience: 'Parents' } }])
    await expect(page.getByText('A couple of quick questions first')).toHaveCount(0)
  })

  test('"Skip — just write it" writes the story without answers', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft({ scenes: undefined, brief: { ...BRIEF, clarifyingQuestions: questions } })))
    let wrote = 0
    await page.route('**/api/brief', (route) => route.fulfill({ status: 500, json: {} }))
    await page.route('**/api/generate-script', async (route) => {
      wrote++
      draft.set(draftRow(storyDraft({ scriptStatus: 'ready' })))
      await route.fulfill({ json: { status: 'generating' } })
    })
    await page.goto(url)
    await page.getByRole('button', { name: 'Skip — just write it' }).click()
    await expect(titleOf(page, 2)).toHaveValue('What it costs', { timeout: 15000 })
    expect(wrote).toBe(1)
  })

  test('asking before the story exists reshapes the point (brief chat)', async ({ page }) => {
    await mockDraft(page, draftRow(storyDraft({ scenes: undefined, brief: { ...BRIEF, clarifyingQuestions: questions } })))
    await page.route('**/api/brief/chat', async (route) => {
      expect(jsonBody(route.request())).toEqual({ videoId: FAKE_ID, message: 'Focus on the price' })
      await route.fulfill({ json: { brief: { ...BRIEF, angle: 'It costs less than a phone bill.' }, reply: 'I’ll lead with the price.' } })
    })
    await page.goto(url)
    await page.getByLabel('Tell it what to change').fill('Focus on the price')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByText('I’ll lead with the price.')).toBeVisible()
    await expect(page.locator('.ws-work').getByText('It costs less than a phone bill.')).toBeVisible()
  })

  test('a failed story shows the reason and Try again writes it again', async ({ page }) => {
    const draft = await mockDraft(page, draftRow(storyDraft({ scenes: undefined, scriptStatus: 'failed', scriptError: 'The document was empty.' })))
    await page.route('**/api/generate-script', async (route) => {
      draft.set(draftRow(storyDraft({ scriptStatus: 'ready' })))
      await route.fulfill({ json: { status: 'generating' } })
    })
    await page.goto(url)
    await expect(alertOf(page)).toContainText('The document was empty.')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(titleOf(page, 2)).toHaveValue('What it costs', { timeout: 15000 })
  })

  test('a draft that cannot be opened says so', async ({ page }) => {
    await page.route('**/api/videos/draft**', (route) => route.fulfill({ status: 404, json: { error: 'Not found' } }))
    await page.goto(url)
    await expect(alertOf(page)).toHaveText('We couldn’t open this project. Go back and try again.')
  })
})
