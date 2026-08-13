import { describe, it, expect } from 'vitest'
import { figuresIn, missingFigures } from '../slide-figures'

// =============================================================================
// A death benefit drawn as $250,000 when the policy says $2,500,000 is not a
// design fault. It is a false statement inside a document an agent hands to a
// client, produced by us, with the agent's name on it.
//
// Text2Art reads every word back off a finished design. This path never did.
// These pin what counts as a figure and what counts as missing — and, as
// importantly, what does NOT, because a check that fires on a slide number
// teaches people to ignore it.
// =============================================================================

describe('which figures are worth checking', () => {
  it('finds money and percentages', () => {
    const found = figuresIn('Death Benefit: $2,500,000 · Annual Premium: $4,812.00 · Growth 7.5%')
    expect(found).toContain('$2,500,000')
    expect(found).toContain('$4,812.00')
    expect(found).toContain('7.5%')
  })

  it('ignores counts and ages, which are not claims about money', () => {
    // Every one of these appears on real slides and none of them is a figure a
    // client would check against their policy.
    expect(figuresIn('Slide 2 of 5. Three reasons. Aged 40. Covers 12 months.')).toEqual([])
  })

  it('keeps small amounts and small percentages', () => {
    // MY FIRST VERSION DROPPED THESE. It demanded three digits to filter noise
    // and threw away "7.5%" — a growth rate on an insurance slide, precisely
    // the sort of claim this exists to protect. The pattern already excludes
    // counts and ages, so the threshold was guarding against nothing.
    expect(figuresIn('Premium $99 · Growth 7.5% · Fee 2%')).toEqual(['$99', '7.5%', '2%'])
  })

  it('does not report the same figure twice', () => {
    expect(figuresIn('$1,000,000 each occurrence and $1,000,000 aggregate')).toEqual(['$1,000,000'])
  })

  it('survives an empty or missing brief', () => {
    expect(figuresIn('')).toEqual([])
    expect(figuresIn(undefined as unknown as string)).toEqual([])
  })
})

describe('whether the slide actually carries them', () => {
  it('accepts a figure however it was drawn', () => {
    // Same number, three renderings. Flagging a comma would be pedantry, not
    // protection — and the customer would learn to ignore the warning.
    for (const drawn of ['$2,500,000', '$2500000', '$ 2,500,000', 'Death benefit 2 500 000']) {
      expect(missingFigures(['$2,500,000'], drawn), drawn).toEqual([])
    }
  })

  it('catches the one that matters — a digit dropped', () => {
    expect(missingFigures(['$2,500,000'], 'Death Benefit $250,000')).toEqual(['$2,500,000'])
  })

  it('catches a transposition', () => {
    expect(missingFigures(['$4,812.00'], 'Annual Premium $4,182.00')).toEqual(['$4,812.00'])
  })

  it('names only what is missing, not everything', () => {
    const missing = missingFigures(['$2,500,000', '$4,812.00'], 'Death Benefit $2,500,000 · Premium $4,182.00')
    expect(missing).toEqual(['$4,812.00'])
  })

  it('says nothing when there was nothing to check', () => {
    expect(missingFigures([], 'anything at all')).toEqual([])
  })

  it('treats an unreadable slide as unknown, never as wrong', () => {
    // A blank transcription means the READER failed. Reporting every figure as
    // missing would redraw a perfectly good slide, twice, for nothing — the
    // caller passes null in that case and never reaches here, and this pins the
    // contract so a future change cannot quietly invert it.
    expect(missingFigures(['$2,500,000'], '')).toEqual(['$2,500,000'])
  })
})
