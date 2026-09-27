'use client'

import { formatCents, type PreviewModel } from './share-options'

/**
 * A small picture of the client's share page, inside a browser frame.
 *
 * It is built from the same facts the real page uses (see share-options.ts),
 * so what it shows is what the client gets. The buttons in here are for
 * looking at only — the real page is one click away ("Open their page").
 */
export default function SharePreview({
  model, shareUrl, title, isDeck, videoId, videoUrl, posterUrl, version, notice,
}: {
  model: PreviewModel
  shareUrl: string
  title: string | null
  isDeck: boolean
  videoId: string
  videoUrl: string | null
  posterUrl: string | null
  version: number
  /** Shown when the live share-page facts could not be loaded. */
  notice?: string | null
}) {
  const hasSide = !!(model.bookingUrl || model.paymentLink || model.quote || model.sourcePdf)
  return (
    <div className="rts-browser">
      <div className="rts-browser-bar">
        <span className="rts-dot" /><span className="rts-dot" /><span className="rts-dot" />
        <span className="rts-url" title={shareUrl}>{shareUrl.replace(/^https?:\/\//, '')}</span>
        <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="rts-open">Open their page ↗</a>
      </div>

      <div className="rts-page">
        {title && <div className="rts-page-title">{title}</div>}

        {(model.greetingName || model.note) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {model.greetingName && (
              <div className="rts-greeting">
                Hi {model.greetingName} — {model.agentName ? <>prepared for you by <strong>{model.agentName}</strong></> : 'prepared just for you'}.
              </div>
            )}
            {model.note && (
              <div className="rts-note">
                {model.agentName && <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>A note from {model.agentName}</div>}
                {model.note}
              </div>
            )}
          </div>
        )}

        <div className={`rts-page-main${hasSide ? '' : ' single'}`}>
          <div className="rts-media">
            {isDeck ? (
              <iframe
                src={`/api/public/presentation/${videoId}?share=1&v=${version}`}
                title={title ?? 'Presentation'}
                loading="lazy"
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              />
            ) : videoUrl ? (
              <video
                src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}v=${version}`}
                poster={posterUrl ?? undefined}
                controls
                preload="none"
                playsInline
                style={{ width: '100%', height: '100%', display: 'block', background: '#000', objectFit: 'contain' }}
              />
            ) : null}
          </div>

          {hasSide && (
            <div className="rts-side" aria-label="What else your client sees">
              {model.bookingUrl && <div className="rts-fake-btn primary">Book a call</div>}
              {model.paymentLink && <div className="rts-fake-btn dark">Make a payment</div>}
              {model.quote && model.quote.state === 'unpaid' && (
                <div className="rts-quote">
                  <div className="rts-quote-label">Quote{model.quote.clientName ? ` for ${model.quote.clientName}` : ''}</div>
                  <div className="rts-quote-total">{formatCents(model.quote.total)}</div>
                  <div className="rts-fake-btn dark small">
                    {model.quote.total === 0
                      ? 'Complimentary'
                      : model.quote.payable ? `Pay ${formatCents(model.quote.total)}` : `Contact ${model.agentName || 'you'} to pay`}
                  </div>
                </div>
              )}
              {model.quote && model.quote.state === 'paid' && (
                <div className="rts-quote"><div className="rts-quote-label">Payment complete</div><div className="rts-quote-total">{formatCents(model.quote.total)}</div></div>
              )}
              {model.sourcePdf && <div className="rts-fake-btn outline">Download the original PDF</div>}
            </div>
          )}
        </div>
        {notice && <div className="rts-row-hint" style={{ marginTop: 10 }}>{notice}</div>}
      </div>
    </div>
  )
}
