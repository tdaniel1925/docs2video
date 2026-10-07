'use client'

import { useState } from 'react'
import type { QuoteLike } from '../send/share-options'

type Notice = (n: { type: 'error' | 'success'; message: string }) => void
type LineItem = { description: string; amount: number }

/**
 * Quote / Invoice — attach pricing to this project; the client sees it with a
 * pay button on their page. Moved out of the result page unchanged (it now
 * sits in the "More for this" area). The send panel's quote switch shows or
 * hides it; this is where it's written and where the deal is marked.
 */
export default function QuoteSection({ videoId, quote: existingQuote, setQuote: setExistingQuote, builderOpen: showQuoteBuilder, setBuilderOpen: setShowQuoteBuilder, onNotice }: {
  videoId: string
  quote: (QuoteLike & Record<string, any>) | null
  setQuote: (q: any) => void
  builderOpen: boolean
  setBuilderOpen: (open: boolean) => void
  onNotice: Notice
}) {
  const setInlineNotice = onNotice
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [quoteClientName, setQuoteClientName] = useState('')
  const [quoteClientEmail, setQuoteClientEmail] = useState('')
  const [quoteLineItems, setQuoteLineItems] = useState<LineItem[]>([{ description: '', amount: 0 }])
  const [quoteNotes, setQuoteNotes] = useState('')
  const [quoteSaving, setQuoteSaving] = useState(false)

  // Quote functions
  function addLineItem() {
    setQuoteLineItems([...quoteLineItems, { description: '', amount: 0 }])
  }
  function removeLineItem(index: number) {
    setQuoteLineItems(quoteLineItems.filter((_, i) => i !== index))
  }
  function updateLineItem(index: number, field: 'description' | 'amount', value: string | number) {
    const updated = [...quoteLineItems]
    updated[index] = { ...updated[index], [field]: value }
    setQuoteLineItems(updated)
  }

  function editQuote() {
    if (!existingQuote) return
    setQuoteClientName(existingQuote.client_name ?? '')
    setQuoteClientEmail(existingQuote.client_email ?? '')
    setQuoteLineItems(
      (existingQuote.line_items ?? []).map((i: any) => ({
        description: i.description,
        amount: i.amount / 100,
      }))
    )
    setQuoteNotes(existingQuote.notes ?? '')
    setShowQuoteBuilder(true)
  }


  async function removeQuote() {
    if (!existingQuote) return
    setConfirmRemove(false)
    // Check the answer — a failed remove used to vanish from the screen
    // anyway, and come back on the next visit.
    try {
      const r = await fetch(`/api/quotes?quoteId=${encodeURIComponent(existingQuote.id)}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setInlineNotice({ type: 'error', message: d.error || 'The quote was NOT removed — try again.' }); return }
      setExistingQuote(null)
      setInlineNotice({ type: 'success', message: 'Quote removed.' })
    } catch {
      setInlineNotice({ type: 'error', message: 'The quote was NOT removed — check your connection and try again.' })
    }
  }

  async function saveQuote() {
    if (!videoId) return
    const validItems = quoteLineItems.filter(i => i.description.trim() && i.amount > 0)
    if (validItems.length === 0) { setInlineNotice({ type: 'error', message: 'Add at least one line item with a description and amount' }); return }
    if (quoteClientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quoteClientEmail)) { setInlineNotice({ type: 'error', message: 'Please enter a valid client email' }); return }
    setQuoteSaving(true)

    // Saved through /api/quotes. Editing never sends a status — it used to
    // write status 'sent' on every save, which turned a PAID quote back into
    // an unpaid one (and put the client back on the follow-up list). And the
    // result is checked: "saved" only when it really saved.
    const lineItems = validItems.map(i => ({ description: i.description, amount: Math.round(i.amount * 100) }))
    try {
      const r = await fetch('/api/quotes', {
        method: existingQuote ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existingQuote
          ? { quoteId: existingQuote.id, clientName: quoteClientName, clientEmail: quoteClientEmail, lineItems, notes: quoteNotes || '' }
          : { videoId, clientName: quoteClientName, clientEmail: quoteClientEmail, lineItems, notes: quoteNotes || null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.quote) {
        setInlineNotice({ type: 'error', message: d.error || 'The quote was NOT saved — try again.' })
        return
      }
      setExistingQuote(d.quote)
      setShowQuoteBuilder(false)
      setInlineNotice({ type: 'success', message: 'Quote saved' })
    } catch {
      setInlineNotice({ type: 'error', message: 'The quote was NOT saved — check your connection and try again.' })
    } finally {
      setQuoteSaving(false)
    }
  }

  // Agent-side deal tracking. Nothing marks a quote paid by itself — a click on
  // the payment link is not a payment — so the agent says when it happened.
  // Paid / accepted / declined quotes are never followed up automatically.
  const [quoteUpdating, setQuoteUpdating] = useState(false)
  async function updateQuote(patch: { status?: string; autoFollowUp?: boolean }, successMessage: string) {
    if (!existingQuote || quoteUpdating) return
    setQuoteUpdating(true)
    try {
      const r = await fetch('/api/quotes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: existingQuote.id, ...patch }),
      })
      const d = await r.json().catch(() => ({}))
      if (d.quote) setExistingQuote(d.quote)
      if (!r.ok) { setInlineNotice({ type: 'error', message: d.error || 'That change was NOT saved — try again.' }); return }
      setInlineNotice({ type: 'success', message: successMessage })
    } catch {
      setInlineNotice({ type: 'error', message: 'That change was NOT saved — check your connection and try again.' })
    } finally {
      setQuoteUpdating(false)
    }
  }

  function quoteStatusBadge(status: string) {
    const map: Record<string, string> = { draft: '', sent: 'peach', viewed: 'lilac', accepted: 'mint', paid: 'mint', declined: 'rose' }
    return map[status] ?? ''
  }

  return (
    <div id="quote-section" className="res-quote">
  {!existingQuote && !showQuoteBuilder && (
    <div style={{
      background: 'white',
      border: '1px dashed var(--border)',
      borderRadius: 10,
      padding: '32px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 14 }}>
        Attach pricing. Your client sees it on their page with a payment button.
      </p>
      <button onClick={() => setShowQuoteBuilder(true)} className="btn btn-primary">
        Add Quote &rarr;
      </button>
    </div>
  )}

  {existingQuote && !showQuoteBuilder && (
    <div style={{
      background: 'white',
      border: '1px solid var(--border-light)',
      borderRadius: 10,
      padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Quote</span>
        <span className={`tag ${quoteStatusBadge(existingQuote.status)}`} style={{ fontSize: 11 }}>
          {existingQuote.status.charAt(0).toUpperCase() + existingQuote.status.slice(1)}
        </span>
      </div>
      {existingQuote.client_name && (
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 4 }}>
          {existingQuote.client_name} {existingQuote.client_email ? `(${existingQuote.client_email})` : ''}
        </p>
      )}
      <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 12, paddingTop: 12 }}>
        {(existingQuote.line_items ?? []).map((item: any, i: number) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            fontSize: 14,
            borderBottom: i < (existingQuote.line_items ?? []).length - 1 ? '1px solid var(--border-light)' : 'none',
          }}>
            <span>{item.description}</span>
            <span style={{ fontWeight: 600 }}>${(item.amount / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTop: '2px solid var(--ink)',
        fontSize: 16,
        fontWeight: 700,
      }}>
        <span>Total</span>
        <span>${(Number(existingQuote.total ?? 0) / 100).toFixed(2)}</span>
      </div>
      {existingQuote.notes && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>{existingQuote.notes}</p>
      )}
      {/* Deal status — the agent marks it; nothing else can know. */}
      <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 16, paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Where does this deal stand?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {existingQuote.status !== 'paid' && (
            <button className="btn btn-mint btn-sm" disabled={quoteUpdating}
              onClick={() => updateQuote({ status: 'paid' }, 'Marked as paid. No more automatic reminders will go to this client.')}>
              Mark as paid
            </button>
          )}
          {existingQuote.status !== 'accepted' && existingQuote.status !== 'paid' && (
            <button className="btn btn-soft btn-sm" disabled={quoteUpdating}
              onClick={() => updateQuote({ status: 'accepted' }, 'Marked as accepted. No more automatic reminders will go to this client.')}>
              Mark as accepted
            </button>
          )}
          {existingQuote.status !== 'declined' && existingQuote.status !== 'paid' && (
            <button className="btn btn-soft btn-sm" disabled={quoteUpdating}
              onClick={() => updateQuote({ status: 'declined' }, 'Marked as declined. No more automatic reminders will go to this client.')}>
              Mark as declined
            </button>
          )}
          {['paid', 'accepted', 'declined'].includes(existingQuote.status) && (
            <button className="btn btn-soft btn-sm" disabled={quoteUpdating}
              onClick={() => updateQuote({ status: 'sent' }, 'Quote reopened.')}>
              Reopen
            </button>
          )}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={existingQuote.auto_follow_up === true}
            disabled={quoteUpdating || !existingQuote.client_email || !['sent', 'viewed'].includes(existingQuote.status)}
            onChange={e => updateQuote({ autoFollowUp: e.target.checked }, e.target.checked
              ? 'Automatic follow-ups on. Reminders go out about 3 and 7 days after the quote, from your connected email.'
              : 'Automatic follow-ups off.')}
            style={{ marginTop: 2 }}
          />
          <span>
            <strong>Automatic follow-ups</strong>
            <span style={{ display: 'block', color: 'var(--ink-soft)', fontSize: 12 }}>
              {!existingQuote.client_email
                ? 'Add the client’s email to the quote to use this.'
                : existingQuote.status === 'draft'
                  ? 'Off — this quote is hidden from the share page. Show it with the switch at the top.'
                : !['sent', 'viewed'].includes(existingQuote.status)
                  ? 'Off — this deal is closed.'
                  : 'Sends up to two short reminders (about day 3 and day 7) from your connected email, with an unsubscribe link. Stops as soon as you mark the deal paid, accepted or declined.'}
            </span>
          </span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={editQuote} className="btn btn-soft">Edit</button>
        {confirmRemove ? (
          <>
            <span style={{ fontSize: 13, color: 'var(--warning-text)', fontWeight: 600 }}>Remove this quote?</span>
            <button onClick={() => setConfirmRemove(false)} className="btn btn-soft btn-sm">Cancel</button>
            <button onClick={removeQuote} className="btn btn-danger btn-sm">Yes, remove</button>
          </>
        ) : (
          <button onClick={() => setConfirmRemove(true)} className="btn btn-danger btn-sm">Remove</button>
        )}
      </div>
    </div>
  )}

  {showQuoteBuilder && (
    <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Name</label>
        <input
          type="text"
          className="input"
          placeholder="Jane Smith"
          value={quoteClientName}
          onChange={e => setQuoteClientName(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client Email</label>
        <input
          type="email"
          className="input"
          placeholder="jane@example.com"
          value={quoteClientEmail}
          onChange={e => setQuoteClientEmail(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Line Items</label>
        {quoteLineItems.map((item, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: i < quoteLineItems.length - 1 ? '1px solid var(--border-light)' : 'none',
          }}>
            <input
              type="text"
              className="input"
              placeholder="Description"
              value={item.description}
              onChange={e => updateLineItem(i, 'description', e.target.value)}
              style={{ flex: 1 }}
            />
            <div style={{ position: 'relative', width: 120 }}>
              <span style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 14,
                color: 'var(--ink-soft)',
                pointerEvents: 'none',
              }}>$</span>
              <input
                type="number"
                className="input"
                placeholder="0.00"
                value={item.amount || ''}
                onChange={e => updateLineItem(i, 'amount', parseFloat(e.target.value) || 0)}
                style={{ width: '100%', paddingLeft: 22 }}
                step="0.01"
                min="0"
              />
            </div>
            {quoteLineItems.length > 1 && (
              <button
                onClick={() => removeLineItem(i)}
                className="btn btn-danger btn-sm"
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                &times;
              </button>
            )}
          </div>
        ))}
        <button onClick={addLineItem} className="btn btn-soft btn-sm" style={{ marginTop: 4 }}>
          + Add line item
        </button>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderTop: '2px solid var(--ink)',
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 20,
      }}>
        <span>Subtotal</span>
        <span>${quoteLineItems.reduce((sum, i) => sum + (i.amount || 0), 0).toFixed(2)}</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notes (optional)</label>
        <textarea
          className="input"
          placeholder="Payment terms, additional details..."
          value={quoteNotes}
          onChange={e => setQuoteNotes(e.target.value)}
          style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={saveQuote}
          disabled={quoteSaving}
          className="btn btn-primary"
          style={quoteSaving ? { opacity: 0.6 } : undefined}
        >
          {quoteSaving ? 'Saving...' : 'Save Quote'}
        </button>
        <button
          onClick={() => setShowQuoteBuilder(false)}
          className="btn btn-soft"
        >
          Cancel
        </button>
      </div>
    </div>
  )}
    </div>
  )
}
