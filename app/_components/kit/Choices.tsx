'use client'

import { useId, type ReactNode } from 'react'

/*
 * CHOICES — "pick one" as a list of cards, each a real radio button (so the
 * arrow keys, screen readers and the form all work). The chosen card fills
 * with the soft accent and gets a green edge (app/kit.css).
 *
 * `aside` sits at the right of a choice — use it for the price
 * ("1,000 credits"), which is shown in gold because it is money.
 */
export type Choice<T extends string> = {
  value: T
  label: ReactNode
  hint?: ReactNode
  aside?: ReactNode
  disabled?: boolean
}

type Props<T extends string> = {
  /** The question, shown above the list (and read out as its name). */
  legend: ReactNode
  /** Hide the legend visually (still read out) when a heading already asks. */
  hideLegend?: boolean
  choices: Choice<T>[]
  value: T | null
  onChange: (value: T) => void
  /** Form field name; one is made up when not given. */
  name?: string
  className?: string
}

export default function Choices<T extends string>({ legend, hideLegend, choices, value, onChange, name, className = '' }: Props<T>) {
  const auto = useId()
  const group = name ?? `choices-${auto}`
  return (
    <fieldset className={`kit-choices ${className}`.trim()}>
      <legend className={hideLegend ? 'kit-sr' : 'kit-choices-legend'}>{legend}</legend>
      {choices.map((c) => (
        <label key={c.value} className="kit-choice">
          <input
            type="radio"
            name={group}
            value={c.value}
            checked={value === c.value}
            disabled={c.disabled}
            onChange={() => onChange(c.value)}
          />
          <span className="kit-choice-body">
            <span className="kit-choice-label">{c.label}</span>
            {c.hint != null && <span className="kit-choice-hint">{c.hint}</span>}
          </span>
          {c.aside != null && <span className="kit-choice-aside">{c.aside}</span>}
        </label>
      ))}
    </fieldset>
  )
}
