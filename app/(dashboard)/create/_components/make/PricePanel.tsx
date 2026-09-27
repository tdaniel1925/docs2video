'use client'

import s from './make.module.css'
import { formatCredits } from './usePriceQuote'
import type { OutputQuote } from '../../../../_lib/price-quote'

/**
 * THE PRICE — the one place on step 3 that spends credits. Every number here
 * comes from the server's quote (/api/price-quote); while it loads the panel
 * shows "…", never a made-up price.
 */
export default function PricePanel({
  quote,
  balance,
  quoteError,
  loading,
  blockedReason,
  submitting,
  submitLabel,
  timeNote,
  error,
  onMake,
  onTopUp,
}: {
  quote: OutputQuote | null
  balance: number | null
  quoteError: string | null
  loading: boolean
  blockedReason: string | null
  submitting: boolean
  submitLabel: string
  /** How long it usually takes — only an estimate the app already stands behind. */
  timeNote: string | null
  error: { message: string; topUp?: boolean } | null
  onMake: () => void
  onTopUp: () => void
}) {
  const total = quote?.total ?? null
  const after = total !== null && balance !== null ? balance - total : null
  const short = !quote?.free && after !== null && after < 0
  const ready = !!quote && !loading && !submitting

  return (
    <aside className={s.panel} aria-label="The price">
      <h2 className={s.panelTitle}>The price</h2>

      {quote ? (
        <>
          {quote.lines.map((l) => (
            <div key={l.label} className={s.line}>
              <span>{l.label}</span>
              <span>{formatCredits(l.credits)}</span>
            </div>
          ))}
          <div className={s.total}>
            <span>Total</span>
            <span>{formatCredits(quote.total)}</span>
          </div>
        </>
      ) : (
        <div className={`${s.line} ${s.muted}`}>{quoteError || 'Working out the price…'}</div>
      )}

      {quote?.free ? (
        <p className={s.balance}>Your account isn’t charged for this.</p>
      ) : balance !== null && after !== null ? (
        <p className={s.balance}>
          You have {formatCredits(balance)}.{' '}
          {after >= 0 ? `${formatCredits(after)} left after this.` : ''}
        </p>
      ) : null}

      {short && blockedReason !== 'card_required' ? (
        <div className={s.warn}>
          You need {formatCredits(-(after as number))} more.{' '}
          <button type="button" className={s.link} onClick={onTopUp}>Top up credits</button>
        </div>
      ) : null}

      {blockedReason === 'card_required' ? (
        <div className={s.warn}>Add a card to start your free trial. We’ll take you there when you press Make it, then bring you back here.</div>
      ) : null}

      {error ? (
        <div className={s.error} role="alert">
          {error.message}
          {error.topUp ? (<> <button type="button" className={s.link} onClick={onTopUp}>Top up credits</button></>) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary btn-lg btn-full"
        onClick={onMake}
        disabled={!ready}
        aria-busy={submitting}
      >
        {submitting ? 'Starting…' : quote ? `${submitLabel} — ${formatCredits(quote.total)}` : submitLabel}
      </button>
      <p className={s.makeNote}>
        This is the only button that spends credits.{timeNote ? ` ${timeNote}` : ''}
      </p>
    </aside>
  )
}
