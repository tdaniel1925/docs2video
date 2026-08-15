'use client'

import { useState } from 'react'
import { useWizard } from '../useWizard'
import { INK, SOFT, LINE, card, plainBtn, StepNav, StepShell } from '../ui'

/**
 * STEP 2 — the words that go on it.
 *
 * A deck wants a subject; a flyer wants the exact words (headline, the details,
 * the call to action). We collect them as STRUCTURED fields, not one blob,
 * because the generator's word-check verifies each one landed on the image —
 * "$89" has to survive, and a single free-text box makes that impossible to
 * confirm. Or drop a document / paste a website and we read it (that path is
 * lifted from /flyer in a follow-up; the manual fields cover the core now).
 */
export default function WordsStep() {
  const { state, patch, ready } = useWizard()
  const isDeck = state.kind === 'deck'
  const [headline, setHeadline] = useState('')
  const [details, setDetails] = useState('')
  const [cta, setCta] = useState('')
  const [contact, setContact] = useState('')
  const [hydrated, setHydrated] = useState(false)

  // Seed the boxes from saved state once ready (can't read localStorage on first paint).
  if (ready && !hydrated) {
    setHeadline(state.fields.headline ?? '')
    setDetails((state.fields.details ?? []).join('\n'))
    setCta(state.fields.cta ?? '')
    setContact(state.fields.contact ?? '')
    setHydrated(true)
  }

  if (!ready) return null

  const save = () => patch({
    fields: {
      ...state.fields,
      headline: headline.trim() || undefined,
      details: details.split('\n').map((s) => s.trim()).filter(Boolean),
      cta: cta.trim() || undefined,
      contact: contact.trim() || undefined,
    },
  })

  const box = {
    width: '100%', padding: '11px 13px', borderRadius: 9, border: `1px solid ${LINE}`,
    font: 'inherit', fontSize: 15, boxSizing: 'border-box' as const, color: INK,
  }
  const lbl = { fontSize: 13, fontWeight: 700, color: INK, display: 'block', margin: '0 0 6px' }

  const ready2 = headline.trim().length > 0 || details.trim().length > 0

  return (
    <StepShell
      title={isDeck ? 'What is the deck about?' : 'What should it say?'}
      subtitle={isDeck
        ? 'Tell us the subject and who it’s for — the exact words for each slide come next.'
        : 'The words that go on it, exactly as you want them — a headline, the details, a call to action.'}>

      <div style={{ ...card, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={lbl}>{isDeck ? 'Title / subject' : 'Headline'}</label>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} onBlur={save}
            placeholder={isDeck ? 'e.g. Q3 results for the sales team' : 'e.g. Grand Opening BBQ'}
            style={box} />
        </div>
        <div>
          <label style={lbl}>{isDeck ? 'Key points' : 'The details'} <span style={{ color: SOFT, fontWeight: 400 }}>(one per line)</span></label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} onBlur={save} rows={4}
            placeholder={'Saturday, Sept 12\n$89 tune-up\nFree food'}
            style={{ ...box, resize: 'vertical' }} />
        </div>
        {!isDeck && (
          <>
            <div>
              <label style={lbl}>Call to action <span style={{ color: SOFT, fontWeight: 400 }}>(optional)</span></label>
              <input value={cta} onChange={(e) => setCta(e.target.value)} onBlur={save}
                placeholder="e.g. Book now · RSVP · Call today" style={box} />
            </div>
            <div>
              <label style={lbl}>Contact <span style={{ color: SOFT, fontWeight: 400 }}>(optional)</span></label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} onBlur={save}
                placeholder="e.g. 555-0142 · yoursite.com" style={box} />
            </div>
          </>
        )}
      </div>

      <StepNav back="/design" next="/design/make" nextReady={ready2}
        nextHint="Type at least a headline or a detail" onNext={() => { save() }} />
    </StepShell>
  )
}
