import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button, Note, Chip, EmptyState, Choices, Card, Dialog } from '../app/_components/kit'

/**
 * The kit's promises, checked on real rendered HTML:
 *  - a disabled button says WHY, and the reason is tied to the button;
 *  - the price sits on the button;
 *  - notes, chips and choices carry their tone / real radio buttons.
 */
describe('kit Button', () => {
  it('a disabled button shows its reason and points at it', () => {
    const html = renderToStaticMarkup(h(Button, { disabled: true, disabledReason: 'Pick a look first.', children: 'Make it' }))
    expect(html).toMatch(/<button[^>]*disabled/)
    expect(html).toContain('Pick a look first.')
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(describedBy).toBeTruthy()
    expect(html).toContain(`id="${describedBy}"`)
  })

  it('an enabled button never shows a reason', () => {
    const html = renderToStaticMarkup(h(Button, { disabledReason: 'Pick a look first.', children: 'Make it' }))
    expect(html).not.toContain('Pick a look first.')
    expect(html).not.toContain('aria-describedby')
  })

  it('puts the price on the button', () => {
    const html = renderToStaticMarkup(h(Button, { price: '1,000 credits', children: 'Make it' }))
    expect(html).toContain('kit-btn--primary')
    expect(html).toMatch(/<span class="kit-btn-label">Make it<\/span><span class="kit-btn-price">— 1,000 credits<\/span>/)
  })

  it('with href it is a link that looks like a button', () => {
    const html = renderToStaticMarkup(h(Button, { href: '/create', variant: 'secondary', size: 'sm', children: 'Open' }))
    expect(html).toMatch(/^<a [^>]*href="\/create"/)
    expect(html).toContain('kit-btn--secondary kit-btn--sm')
  })
})

describe('kit parts', () => {
  it('Note carries its tone and a bold lead-in', () => {
    const html = renderToStaticMarkup(h(Note, { tone: 'stop', title: 'Out of credits.', children: 'Top up to keep making.' }))
    expect(html).toContain('kit-note--stop')
    expect(html).toContain('role="alert"')
    expect(html).toContain('<strong class="kit-note-title">Out of credits.</strong>')
  })

  it('Chip carries its tone', () => {
    expect(renderToStaticMarkup(h(Chip, { tone: 'money', children: '1,000 credits' }))).toContain('kit-chip--money')
  })

  it('EmptyState says what will be here', () => {
    const html = renderToStaticMarkup(h(EmptyState, { title: 'Nothing here yet', children: 'Everything you make shows up here.' }))
    expect(html).toContain('kit-empty-title')
    expect(html).toContain('Everything you make shows up here.')
  })

  it('Choices are real radio buttons under one question', () => {
    const html = renderToStaticMarkup(h(Choices, {
      legend: 'What do you want to send?',
      choices: [{ value: 'video', label: 'Narrated video', aside: '1,000 credits' }, { value: 'deck', label: 'Slide deck' }],
      value: 'video',
      onChange: () => {},
    }))
    expect(html).toMatch(/<fieldset/)
    expect(html).toContain('<legend class="kit-choices-legend">What do you want to send?</legend>')
    expect(html.match(/type="radio"/g)?.length).toBe(2)
    expect(html).toMatch(/<input type="radio"[^>]*checked=""[^>]*value="video"/)
    expect(html).not.toMatch(/<input type="radio"[^>]*checked=""[^>]*value="deck"/)
    expect(html).toContain('kit-choice-aside')
  })

  it('a link Card is one link', () => {
    const html = renderToStaticMarkup(h(Card, { href: '/create?source=url', children: 'From a website' }))
    expect(html).toMatch(/^<a [^>]*class="kit-card kit-card--link"/)
  })

  it('a closed Dialog is not in the page at all (its words would shadow the screen’s)', () => {
    const closed = renderToStaticMarkup(h(Dialog, { open: false, onClose: () => {}, title: 'How to use: Home', children: 'Press Save' }))
    expect(closed).toBe('')
    const open = renderToStaticMarkup(h(Dialog, { open: true, onClose: () => {}, title: 'How to use: Home', children: 'Press Save' }))
    expect(open).toMatch(/^<dialog class="kit-dialog" aria-labelledby="[^"]+"/)
    expect(open).toContain('aria-label="Close"')
  })
})
