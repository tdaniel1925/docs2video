'use client'

import { useState } from 'react'
import { createClient } from '../../../../_lib/supabase/client'

type Notice = (n: { type: 'error' | 'success'; message: string }) => void

interface FollowUpEmail {
  id: string
  plan_id: string
  user_id: string
  day_offset: number
  subject: string
  body: string
  scheduled_date: string | null
  status: 'pending' | 'sent' | 'skipped'
  sent_at: string | null
  created_at: string
}

export interface FollowUpPlan {
  id: string
  user_id: string
  video_id: string
  client_name: string | null
  client_email: string | null
  suggestions: any[]
  created_at: string
  emails: FollowUpEmail[]
}

function toneLabel(offset: number): string {
  if (offset <= 3) return 'Reminder'
  if (offset <= 7) return 'Educational'
  return 'Soft Close'
}

function statusClass(status: string): string {
  if (status === 'sent') return 'mint'
  if (status === 'skipped') return ''
  return 'peach'
}

function statusLabel(status: string): string {
  if (status === 'sent') return 'Sent'
  if (status === 'skipped') return 'Skipped'
  // Not "Pending" — that read like it was queued to send by itself. It isn't.
  return 'Draft — not sent'
}

/**
 * Follow-Up Plan — AI-drafted follow-up emails for this project. Drafts only:
 * nothing is sent on a schedule; the agent presses Send now on each one.
 * Moved out of the result page unchanged (it now sits in "More for this").
 */
export default function FollowUpSection({ videoId, plan: followUpPlan, setPlan: setFollowUpPlan, onNotice }: {
  videoId: string
  plan: FollowUpPlan | null
  setPlan: (updater: (prev: FollowUpPlan | null) => FollowUpPlan | null) => void
  onNotice: Notice
}) {
  const setInlineNotice = onNotice
  const params = { id: videoId }
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [followUpClientName, setFollowUpClientName] = useState('')
  const [followUpClientEmail, setFollowUpClientEmail] = useState('')
  const [generatingPlan, setGeneratingPlan] = useState(false)

  async function handleCreateFollowUp() {
    if (!followUpClientName.trim()) { setInlineNotice({ type: 'error', message: 'Please enter a client name' }); return }
    if (!followUpClientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(followUpClientEmail)) { setInlineNotice({ type: 'error', message: 'Please enter a valid email address' }); return }
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/follow-up/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: params.id }),
      })
      if (!res.ok) { setInlineNotice({ type: 'error', message: 'Failed to generate follow-up plan' }); return }
      const { suggestions } = await res.json()

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create the plan
      const { data: plan, error: planErr } = await supabase
        .from('follow_up_plans')
        .insert({
          user_id: user.id,
          video_id: params.id as string,
          client_name: followUpClientName,
          client_email: followUpClientEmail,
          suggestions,
        })
        .select()
        .single()

      if (planErr || !plan) { setInlineNotice({ type: 'error', message: 'Failed to save plan' }); return }

      // Create individual email records
      const now = new Date()
      const emailRows = suggestions.map((s: any) => ({
        plan_id: plan.id,
        user_id: user.id,
        day_offset: s.dayOffset,
        subject: s.subject,
        body: s.body,
        scheduled_date: new Date(now.getTime() + s.dayOffset * 86400000).toISOString().split('T')[0],
        status: 'pending',
      }))

      const { data: emails } = await supabase
        .from('follow_up_emails')
        .insert(emailRows)
        .select()

      setFollowUpPlan(() => ({ ...plan, emails: emails ?? [] } as FollowUpPlan))
      setShowFollowUpForm(false)
    } catch (err) {
      console.error(err)
      setInlineNotice({ type: 'error', message: 'Error creating follow-up plan' })
    } finally {
      setGeneratingPlan(false)
    }
  }

  async function handleSendFollowUp(emailId: string) {
    setSendingEmail(emailId)
    try {
      const res = await fetch('/api/follow-up/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setInlineNotice({ type: 'error', message: data.error ?? 'Send failed' })
        return
      }
      // Update local state
      setFollowUpPlan(prev => {
        if (!prev) return prev
        return {
          ...prev,
          emails: prev.emails.map(e =>
            e.id === emailId ? { ...e, status: 'sent' as const, sent_at: new Date().toISOString() } : e
          ),
        }
      })
      // SAY IT SENT, and to whom. A tag quietly flipping to "Sent" is not
      // confirmation anyone notices — the share-modal complaint proved that.
      setInlineNotice({ type: 'success', message: `Email sent to ${followUpPlan?.client_email ?? 'your client'}` })
    } catch (err) {
      setInlineNotice({ type: 'error', message: 'The email did NOT send — try again.' })
    } finally {
      setSendingEmail(null)
    }
  }

  async function handleSkipFollowUp(emailId: string) {
    const supabase = createClient()
    // A failed skip used to pass silently — the row LOOKED skipped locally but
    // the schedule still had it, so the email would still go out. Check + say.
    const { error } = await supabase
      .from('follow_up_emails')
      .update({ status: 'skipped' })
      .eq('id', emailId)
    if (error) {
      setInlineNotice({ type: 'error', message: 'Could not skip that email — try again.' })
      return
    }
    setFollowUpPlan(prev => {
      if (!prev) return prev
      return {
        ...prev,
        emails: prev.emails.map(e =>
          e.id === emailId ? { ...e, status: 'skipped' as const } : e
        ),
      }
    })
    setInlineNotice({ type: 'success', message: 'Email skipped — it will not be sent.' })
  }

  return (
    <div className="res-followup">
  {!followUpPlan && !showFollowUpForm && (
    <div style={{
      background: 'white',
      border: '1px dashed var(--border)',
      borderRadius: 10,
      padding: '32px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 14 }}>
        Get AI-drafted follow-up emails for this presentation. You review each one and send it yourself.
      </p>
      <button onClick={() => setShowFollowUpForm(true)} className="btn btn-primary">
        Create Follow-Up Plan
      </button>
    </div>
  )}

  {!followUpPlan && showFollowUpForm && (
    <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client name</label>
        <input
          type="text"
          className="input"
          placeholder="Jane Smith"
          value={followUpClientName}
          onChange={e => setFollowUpClientName(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Client email</label>
        <input
          type="email"
          className="input"
          placeholder="jane@example.com"
          value={followUpClientEmail}
          onChange={e => setFollowUpClientEmail(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleCreateFollowUp}
          disabled={generatingPlan || !followUpClientName || !followUpClientEmail}
          className="btn btn-primary"
          style={generatingPlan ? { opacity: 0.6 } : undefined}
        >
          {generatingPlan ? 'Generating...' : 'Generate Follow-Up Emails'}
        </button>
        <button onClick={() => setShowFollowUpForm(false)} className="btn btn-soft">
          Cancel
        </button>
      </div>
    </div>
  )}

  {followUpPlan && (
    <div>
      <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 6 }}>
        Follow-up plan for <strong>{followUpPlan.client_name}</strong> ({followUpPlan.client_email})
      </p>
      {/* These are DRAFTS. Nothing sends them on a schedule — the "Day N"
          labels used to read like a promise that they would go out by
          themselves. Say plainly that the agent sends each one. */}
      <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 14 }}>
        These are drafts — nothing here is sent automatically. Press <strong>Send now</strong> on each one when the day comes.
      </p>
      <div style={{
        background: 'white',
        border: '1px solid var(--border-light)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        {(followUpPlan.emails ?? [])
          .sort((a, b) => a.day_offset - b.day_offset)
          .map((email, i, arr) => (
          <div
            key={email.id}
            style={{
              padding: '16px 20px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
                Suggested for day {email.day_offset}
                {email.scheduled_date ? ` (${new Date(email.scheduled_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})` : ''}
                {' '}&mdash; {toneLabel(email.day_offset)}
              </span>
              <span className={`tag ${statusClass(email.status)}`} style={{ fontSize: 11 }}>
                {statusLabel(email.status)}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {email.subject}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                className="btn btn-soft btn-sm"
              >
                {expandedEmail === email.id ? 'Hide Preview' : 'Preview'}
              </button>
              {email.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleSendFollowUp(email.id)}
                    disabled={sendingEmail === email.id}
                    className="btn btn-mint btn-sm"
                    style={sendingEmail === email.id ? { opacity: 0.6 } : undefined}
                  >
                    {sendingEmail === email.id ? 'Sending...' : 'Send now'}
                  </button>
                  <button
                    onClick={() => handleSkipFollowUp(email.id)}
                    className="btn btn-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
            {expandedEmail === email.id && (
              <div style={{
                marginTop: 12,
                padding: '14px 16px',
                background: 'var(--bg)',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.7,
                color: 'var(--ink-soft)',
                whiteSpace: 'pre-wrap',
              }}>
                {email.body}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )}
    </div>
  )
}
