'use client'

import { madeNoun } from '../generatingTips'
import { formatCredits } from '../make/usePriceQuote'

/**
 * "YOUR VIDEO SO FAR" — every choice made so far, on every step, so nobody has
 * to go back to remember what they picked (VidWiz and One Dollar Decks keep
 * the same summary beside the work).
 *
 * The price is never worked out here: it is the server's quote
 * (/api/price-quote) or, once made, what was actually charged. Until then the
 * row says when it will be known — never a guess.
 */
export type SoFar = {
  client: string | null
  source: string | null
  point: string | null
  /** the output type id: video | interactive | deck | pptx | pdf */
  output: string | null
  look: string | null
  voice: string | null
  length: string | null
  price:
    | { kind: 'quote'; credits: number | null; free?: boolean; loading?: boolean }
    | { kind: 'charged'; credits: number }
    | { kind: 'later' }
}

const OUTPUT_NAMES: Record<string, string> = {
  video: 'Narrated video',
  interactive: 'Interactive presentation',
  deck: 'Slide deck',
  pptx: 'Slides (PDF + PowerPoint)',
  pdf: 'Slides (PDF + PowerPoint)',
}

export function outputName(id: string | null | undefined): string | null {
  return id ? OUTPUT_NAMES[id] ?? null : null
}

function priceText(p: SoFar['price']): { text: string; money: boolean } {
  if (p.kind === 'later') return { text: 'Shown once the story is written', money: false }
  if (p.kind === 'charged') return { text: `${formatCredits(p.credits)} (charged)`, money: true }
  if (p.free) return { text: 'Not charged', money: false }
  if (p.credits == null) return { text: p.loading ? 'Working it out…' : 'Shown on step 3', money: false }
  return { text: formatCredits(p.credits), money: true }
}

export default function SoFarPanel({ facts, open, onToggle }: { facts: SoFar; open: boolean; onToggle: () => void }) {
  const noun = madeNoun(facts.output)
  const price = priceText(facts.price)
  const rows: [string, string | null, string][] = [
    ['Client', facts.client, 'Not picked yet'],
    ['Source', facts.source, 'Not added yet'],
    ['The one point', facts.point, 'Found when we read it'],
    ['Making', outputName(facts.output), 'Picked on step 3'],
    ['Look', facts.look, 'Picked on step 3'],
    ['Voice', facts.voice, 'Picked on step 3'],
    ['Length', facts.length, 'Picked on step 2'],
  ]
  return (
    <section className="ws-sofar" data-open={open ? 'true' : 'false'} aria-labelledby="ws-sofar-title">
      <button type="button" className="ws-sofar-head" onClick={onToggle} aria-expanded={open}>
        <span id="ws-sofar-title" className="ws-sofar-title">Your {noun} so far</span>
        <span className="ws-sofar-price-mini">{price.money ? price.text : ''}</span>
        <span className="ws-sofar-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <dl className="ws-sofar-body">
        {rows.map(([label, value, empty]) => (
          <div key={label} className="ws-sofar-row">
            <dt>{label}</dt>
            <dd className={value ? '' : 'ws-sofar-empty'}>{value || empty}</dd>
          </div>
        ))}
        <div className="ws-sofar-row ws-sofar-total">
          <dt>Price</dt>
          <dd className={price.money ? 'ws-sofar-money' : 'ws-sofar-empty'} data-testid="so-far-price">{price.text}</dd>
        </div>
      </dl>
    </section>
  )
}
