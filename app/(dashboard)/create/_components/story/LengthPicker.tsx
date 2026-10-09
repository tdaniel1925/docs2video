'use client'

/*
 * STEP 2 — the length, compact: Short / Standard / Detailed, beside the
 * scene count.
 *
 * Before the story exists, picking a length just remembers it — the story is
 * written at that length. Once the story exists it was written FOR a length,
 * so picking another one offers a free rewrite instead of quietly changing the
 * length (the price on step 3 follows the saved length, and the story must
 * match what is charged).
 */

import s from './length.module.css'
import { LENGTHS, LENGTH_ANCHOR, lengthName, type StoryLength } from './lengths'

export default function LengthPicker({
  picked,
  storyLength,
  hasStory,
  writing,
  spoken,
  flash,
  onPick,
  onRewrite,
  onKeep,
}: {
  /** The chip shown as chosen. */
  picked: StoryLength
  /** The length the story on screen was written at. */
  storyLength: StoryLength
  hasStory: boolean
  writing: boolean
  /** Narrated outputs talk in minutes; silent slides in scenes. */
  spoken: boolean
  /** Kept for callers that still pass it; the price note lives on step 3. */
  isVideo?: boolean
  flash: boolean
  onPick: (l: StoryLength) => void
  onRewrite: () => void
  onKeep: () => void
}) {
  const offer = hasStory && !writing && picked !== storyLength
  return (
    <section id={LENGTH_ANCHOR} className={`${s.box} ${flash ? s.flash : ''}`} aria-label="Length">
      <div className="cf-length" role="radiogroup" aria-label="Length">
        {LENGTHS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={picked === l.id}
            className="cf-chip"
            disabled={writing}
            title={spoken ? l.minutes : l.scenes}
            onClick={() => onPick(l.id)}
          >
            {l.name} <small>{spoken ? l.minutes : l.scenes}</small>
          </button>
        ))}
      </div>
      {offer ? (
        <div className={s.offer} role="status">
          <p>
            Your story is written for <strong>{lengthName(storyLength)}</strong>. Rewrite it as{' '}
            <strong>{lengthName(picked)}</strong>? It&rsquo;s free and takes about a minute. Any changes
            you made to the scenes will be replaced.
          </p>
          <div className={s.actions}>
            <button type="button" className="kit-btn kit-btn--secondary kit-btn--sm" onClick={onRewrite}>
              Rewrite at this length
            </button>
            <button type="button" className={s.keep} onClick={onKeep}>
              Keep {lengthName(storyLength)}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
