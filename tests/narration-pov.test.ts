import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { narratorMode, voiceGenderOf, voiceNote, thirdPersonIntro, checkNarration, repairNarration, hasFirstPerson, VOICE_GENDER } from '../app/_lib/narration-pov'
import { VOICE_OPTIONS } from '../app/_lib/types'
import { buildOpeningNarration } from '../app/_lib/personalize'

/* WHO IS SPEAKING (owner, 2026-10-18): "the voice is not the person — it is a presentation for the person." */
const DARRELL = { name: 'Darrell Wolfe', role: 'financial advisor' }

describe('the voices', () => {
  it('knows how each of the six voices sounds, as the voice picker says', () => {
    for (const v of VOICE_OPTIONS) expect(VOICE_GENDER[v.id], v.id).toBe(v.gender.toLowerCase())
    expect(voiceGenderOf('nova')).toBe('female')
    expect(voiceGenderOf(undefined)).toBe('female') // the default, Sarah
  })
})

describe('first person is earned', () => {
  it('speaks FOR the presenter unless they chose "Speak as me" with a voice that matches', () => {
    expect(narratorMode({ hasPresenter: true, voiceId: 'nova' })).toBe('for')
    expect(narratorMode({ hasPresenter: true, speakAs: 'as', voiceId: 'onyx' })).toBe('for') // no voice said
    expect(narratorMode({ hasPresenter: true, speakAs: 'as', presenterVoice: 'male', voiceId: 'nova' })).toBe('for') // Darrell + Sarah
    expect(narratorMode({ hasPresenter: true, speakAs: 'as', presenterVoice: 'male', voiceId: 'alloy' })).toBe('for') // neutral is not his
    expect(narratorMode({ hasPresenter: true, speakAs: 'as', presenterVoice: 'male', voiceId: 'onyx' })).toBe('as')
    expect(narratorMode({ hasPresenter: false, speakAs: 'as', presenterVoice: 'male', voiceId: 'onyx' })).toBe('for')
  })
  it('warns on the opener step when the voice cannot be the person', () => {
    expect(voiceNote({ presenterName: 'Darrell Wolfe', speakAs: 'as', presenterVoice: 'male', voiceId: 'nova' })).toMatch(/female voice.*on Darrell Wolfe’s behalf/)
    expect(voiceNote({ presenterName: 'Darrell Wolfe', speakAs: 'as', voiceId: 'onyx' })).toMatch(/Say which voice fits Darrell Wolfe/)
    expect(voiceNote({ presenterName: 'Darrell Wolfe', speakAs: 'as', presenterVoice: 'male', voiceId: 'echo' })).toBeNull()
    expect(voiceNote({ presenterName: 'Darrell Wolfe', voiceId: 'nova', intro: 'Hello, I’m Darrell Wolfe.' })).toMatch(/third person/)
    expect(voiceNote({ presenterName: 'Darrell Wolfe', voiceId: 'nova', intro: 'Darrell Wolfe helps families plan.' })).toBeNull()
  })
})

describe('the presenter’s intro, said on their behalf', () => {
  it('the Darrell Wolfe video: no "I’m Darrell Wolfe" after the greeting', () => {
    const intro = thirdPersonIntro('Hello, I’m Darrell Wolfe. I’ve put together this summary of your retirement plan.', DARRELL, { greeted: true })
    expect(intro).toBe('Darrell has put together this summary of your retirement plan.')
    const opening = buildOpeningNarration({ client: 'Jane Smith', agent: 'Darrell Wolfe', regulated: false, baseNarration: intro })
    expect(opening).toBe('Jane, thank you for letting Darrell Wolfe share this summary with you. Darrell has put together this summary of your retirement plan.')
    expect(checkNarration([opening], { presenterName: 'Darrell Wolfe', mode: 'for' })).toEqual([])
  })
  it('the old placeholder line keeps the role and the purpose', () => {
    expect(thirdPersonIntro('Hi, I’m Sarah Talls, a registered nurse. I’ve prepared this video to walk you through your prescription plan.', { name: 'Sarah Talls' }))
      .toBe('Sarah Talls, a registered nurse, has prepared this video to walk you through your prescription plan.')
  })
  it('a bare self-introduction becomes who they are, or nothing when the greeting named them', () => {
    expect(thirdPersonIntro('Hello, I’m Darrell Wolfe.', DARRELL)).toBe('This comes to you from Darrell Wolfe.')
    expect(thirdPersonIntro('Hello, I’m Darrell Wolfe.', DARRELL, { greeted: true })).toBe('')
    expect(thirdPersonIntro('My name is Darrell Wolfe, your financial advisor.', DARRELL, { greeted: true })).toBe('Darrell is your financial advisor.')
  })
  it('my / me / I become theirs', () => {
    expect(thirdPersonIntro('I help families protect what matters. Call me any time with my number below.', DARRELL))
      .toBe('Darrell Wolfe helps families protect what matters. Call Darrell any time with their number below.')
  })
  it('a line already in the third person is left alone', () => {
    const s = 'Darrell Wolfe helps families plan for retirement.'
    expect(thirdPersonIntro(s, DARRELL)).toBe(s)
    expect(hasFirstPerson(s)).toBe(false)
  })
})

describe('the deterministic check, on every scene', () => {
  const ctx = { presenterName: 'Darrell Wolfe', presenterRole: 'financial advisor', mode: 'for' as const }
  it('finds and repairs the exact bug', () => {
    const bad = 'Jane, thank you for letting Darrell Wolfe share this summary with you. Hello, I’m Darrell Wolfe. Let’s look at your plan.'
    expect(checkNarration([bad], ctx).map((i) => i.code).sort()).toEqual(['double-greeting', 'self-intro'])
    const fixed = repairNarration(bad, ctx, 0)
    expect(fixed).toBe('Jane, thank you for letting Darrell Wolfe share this summary with you. Let’s look at your plan.')
    expect(checkNarration([fixed], ctx)).toEqual([])
  })
  it('a self-introduction in a later scene is said on their behalf', () => {
    expect(repairNarration('As I mentioned, I’m Darrell, and I’ll be in touch soon.', ctx, 3)).toBe('As Darrell mentioned, Darrell will be in touch soon.')
    expect(repairNarration('Darrell Wolfe here — call any time.', ctx, 5)).toBe('This comes to you from Darrell Wolfe. Call any time.')
    expect(repairNarration('Thanks for watching. Hello, I’m Darrell Wolfe, your financial advisor, and I look forward to talking.', ctx, 5))
      .toBe('Thanks for watching. Darrell Wolfe, your financial advisor, looks forward to talking.')
  })
  it('a company never introduces itself as the voice', () => {
    const c = { brandName: 'Acme Insurance', mode: 'for' as const }
    const fixed = repairNarration('Hi, this is Acme Insurance. Here is your policy.', c, 0)
    expect(fixed).toBe('This comes to you from Acme Insurance. Here is your policy.')
    expect(checkNarration([fixed], c)).toEqual([])
  })
  it('speaking AS a matching presenter keeps "I’m Darrell"', () => {
    const s = 'Hi Jane. I’m Darrell Wolfe, and I put this together for you.'
    expect(repairNarration(s, { ...ctx, mode: 'as' }, 0)).toBe(s)
    expect(checkNarration([s], { ...ctx, mode: 'as' })).toEqual([])
  })
  it('the narrator’s own "let me" is not a claim to be anyone', () => {
    const s = 'Let me walk you through the three numbers that matter.'
    expect(repairNarration(s, ctx, 2)).toBe(s)
  })
  it('flags a name that does not belong in this video', () => {
    expect(checkNarration(['Call Trent Daniel at the number below.'], { ...ctx, foreignNames: ['Trent Daniel'] })[0]).toMatchObject({ code: 'foreign-name', text: 'Trent Daniel' })
  })
})

describe('the client is greeted as a person would greet them', () => {
  it('families, couples, titles, companies and "Last, First"', async () => {
    const { salutationFor } = await import('../app/_lib/text-format')
    expect(salutationFor('The Smith Family')).toBe('Smith family')
    expect(salutationFor('John and Mary Smith')).toBe('John and Mary')
    expect(salutationFor('Mr. John Smith')).toBe('Mr. Smith')
    expect(salutationFor('Acme Corp')).toBe('Acme Corp')
    // A business named for its trade is greeted by its whole name, not its first word.
    expect(salutationFor('Harbor Street Bakery')).toBe('Harbor Street Bakery')
    expect(salutationFor('Bluewater Dental')).toBe('Bluewater Dental')
    expect(salutationFor('Grace Bell')).toBe('Grace')
    const svc = (await import('fs')).readFileSync(require('path').join(__dirname, '../render-service/slides.js'), 'utf8')
    expect(svc).toMatch(/A business named for its trade/)
    expect(salutationFor('SMITH, JOHN')).toBe('John')
    expect(salutationFor('jane smith')).toBe('Jane')
    expect(salutationFor('Valued Client')).toBe('')
    expect(buildOpeningNarration({ client: 'The Smith Family', agent: 'Darrell Wolfe', regulated: false, baseNarration: 'Here is your plan.' }))
      .toBe('Smith family, thank you for letting Darrell Wolfe share this summary with you. Here is your plan.')
  })
  it('the render service greets the same way', () => {
    const slides = readFileSync('render-service/slides.js', 'utf8')
    expect(slides).toContain('KEEP IN SYNC with app/_lib/text-format.ts salutationFor')
    expect(slides).toContain('KEEP IN SYNC with app/_lib/narration-pov.ts (repairNarration)')
  })
})
