'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface IndustryCard {
  id: string
  name: string
  /** Words the script is told to use (INDUSTRIES[id].terminology.use). */
  terms: string[]
  /** The disclaimer the script and share page carry, or null when the field needs none. */
  fine: string | null
  /** The closing ask the script is given (INDUSTRIES[id].ctaText). */
  ask: string
  /** Example slide title — illustration only. */
  sample: string
  /** The industry landing page. */
  href: string
}

// "It knows your field": pick an industry, see what the script does
// differently. Every line shown comes from app/_lib/industries.ts (passed in
// by the server page), so the page can't promise more than the generator does.
export default function IndustrySwitcher({ items, more }: { items: IndustryCard[]; more: string[] }) {
  const [sel, setSel] = useState(0)
  const ind = items[sel]

  return (
    <>
      <div className="mk-ind-tabs" role="group" aria-label="Choose an industry">
        {items.map((x, i) => (
          <button
            key={x.id}
            type="button"
            className="mk-ind-tab"
            aria-pressed={i === sel}
            aria-controls="mk-ind-panel"
            onClick={() => setSel(i)}
          >
            {x.name}
          </button>
        ))}
        {more.length > 0 && <span className="mk-ind-more">+ {more.join(', ')}</span>}
      </div>

      <div id="mk-ind-panel" className="mk-ind-panel" aria-live="polite">
        {/* A code-drawn example slide in this industry's words. */}
        <div className="mk-ind-slide" key={ind.id} aria-hidden="true">
          <div className="mk-ind-slide-eyebrow">{ind.name} &middot; example slide</div>
          <div className="mk-ind-slide-title">{ind.sample}</div>
          <div className="mk-ind-slide-chips">
            {ind.terms.slice(0, 4).map((t) => <span key={t}>{t}</span>)}
          </div>
          <div className="mk-ind-slide-fine">{ind.fine ?? 'No standard disclaimer for this field.'}</div>
        </div>

        <div className="mk-ind-copy">
          <h3>{ind.name}</h3>
          <div>
            <div className="mk-label">Knows the language</div>
            <p>{ind.terms.join(', ')}.</p>
          </div>
          <div>
            <div className="mk-label">Adds the fine print</div>
            <p className="mk-ind-fine">
              {ind.fine ?? 'This field has no standard disclaimer, so none is added.'}
            </p>
          </div>
          <div>
            <div className="mk-label">Ends with a clear ask</div>
            <p>&ldquo;{ind.ask}&rdquo;</p>
          </div>
          <Link href={ind.href} className="mk-textlink">More for {ind.name.toLowerCase()} &rarr;</Link>
        </div>
      </div>
    </>
  )
}
