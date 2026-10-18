'use client'

import { useEffect, useState } from 'react'
import { useToast } from '../../../_components/Toast'
import { useConfirm } from './useConfirm'

/*
 * The "Prospects" tab of /admin (prospect demo pipeline + industry email
 * campaigns). Moved out of admin/page.tsx unchanged except: the two browser
 * confirm() boxes are now the kit pop-up.
 */
export default function ProspectsTab() {
  const notify = useToast()
  const [ask, confirmDialog] = useConfirm()
  const [prospectUrls, setProspectUrls] = useState('')
  const [prospects, setProspects] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [sendModal, setSendModal] = useState<{ prospectId: string; companyName: string; email: string; subject: string } | null>(null)
  const [sendForm, setSendForm] = useState({ email: '', name: '', subject: '', body: '' })
  const [sendBusy, setSendBusy] = useState(false)
  // Campaign system
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [campaignIndustry, setCampaignIndustry] = useState('insurance')
  const [campaignSubIndustry, setCampaignSubIndustry] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignContacts, setCampaignContacts] = useState<{ email: string; name?: string; company?: string }[]>([])
  const [campaignCsvText, setCampaignCsvText] = useState('')
  const [campaignSubject, setCampaignSubject] = useState('')
  const [campaignBody, setCampaignBody] = useState('')
  const [campaignCtaText, setCampaignCtaText] = useState('Try It Free')
  const [campaignCtaUrl, setCampaignCtaUrl] = useState('')
  const [campaignGenerating, setCampaignGenerating] = useState(false)
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignStep, setCampaignStep] = useState<'setup' | 'preview' | 'done'>('setup')
  const [campaignBusy, setCampaignBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/prospect-pipeline').then(r => r.json()).then(d => {
      setProspects(d.prospects ?? [])
    }).catch(() => {})
    fetch('/api/admin/campaign-send').then(r => r.json()).then(d => {
      setCampaigns(d.campaigns ?? [])
    }).catch(() => {})
  }, [])

  function reloadCampaigns() {
    fetch('/api/admin/campaign-send').then(r => r.json()).then(d => {
      setCampaigns(d.campaigns ?? [])
    }).catch(() => {})
  }

  async function campaignAction(campaignId: string, action: string) {
    setCampaignBusy(campaignId)
    try {
      const r = await fetch('/api/admin/campaign-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, campaignId }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); notify(d.error || 'Failed', 'error'); }
      reloadCampaigns()
    } catch { notify('Network error', 'error') }
    setCampaignBusy(null)
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <>
        <div>
          {/* Section 1: Generate New Demos */}
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>Generate New Demos</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Paste prospect website URLs (one per line). Each URL will be scraped, branded, scripted, and turned into a 45-60 second sales video automatically.
            </p>
            <textarea
              className="input"
              placeholder={"https://example.com\nhttps://another-company.com"}
              value={prospectUrls}
              onChange={e => setProspectUrls(e.target.value)}
              rows={5}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                disabled={generating || !prospectUrls.trim()}
                onClick={async () => {
                  setGenerating(true)
                  try {
                    const urls = prospectUrls.split('\n').map(u => u.trim()).filter(Boolean)
                    for (const url of urls.slice(0, 10)) {
                      try {
                        await fetch('/api/admin/prospect-pipeline', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url }),
                        })
                      } catch {}
                    }
                    setProspectUrls('')
                    // Refresh list
                    const r = await fetch('/api/admin/prospect-pipeline')
                    const d = await r.json()
                    setProspects(d.prospects ?? [])
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'Failed to generate demos', 'error')
                  }
                  setGenerating(false)
                }}
              >
                {generating ? 'Generating...' : 'Generate Demos'}
              </button>
              <button
                className="btn btn-sm btn-soft"
                onClick={async () => {
                  const r = await fetch('/api/admin/prospect-pipeline')
                  const d = await r.json()
                  setProspects(d.prospects ?? [])
                }}
              >
                Refresh
              </button>
            </div>

            {generating && (
              <div style={{ marginTop: 16, padding: 20, background: 'var(--bg-soft)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div className="spinner" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Pipeline running...</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>Scraping, scripting, generating slides, assembling video. This takes 2-5 minutes per URL.</div>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--accent-ink)', borderRadius: 4, animation: 'progressPulse 2s ease-in-out infinite', width: '60%' }} />
                </div>
                <style>{`@keyframes progressPulse { 0%, 100% { width: 20%; opacity: 0.7; } 50% { width: 80%; opacity: 1; } }`}</style>
              </div>
            )}
          </div>

          {/* Section 2: Review Queue */}
          {prospects.filter(p => p.status === 'ready_for_review').length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>Review Queue</h3>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {prospects.filter(p => p.status === 'ready_for_review').map((p, i, arr) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    {p.thumbnail_url && (
                      <img src={p.thumbnail_url} alt="" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.company_name ?? 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 2 }}>{p.url}</div>
                      {p.duration && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{p.duration}s</div>}
                    </div>
                    {p.video_url && (
                      <a href={p.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-soft" style={{ fontSize: 11, textDecoration: 'none' }}>Play</a>
                    )}
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ fontSize: 11 }}
                      onClick={() => {
                        setSendModal({ prospectId: p.id, companyName: p.company_name ?? '', email: p.contact_email ?? '', subject: `${p.company_name ?? 'Your company'} + Docs2Video — personalized demo` })
                        setSendForm({ email: p.contact_email ?? '', name: p.contact_name ?? '', subject: `${p.company_name ?? 'Your company'} + Docs2Video — personalized demo`, body: '' })
                      }}
                    >
                      Approve &amp; Send
                    </button>
                    <button
                      className="btn btn-sm btn-soft"
                      style={{ fontSize: 11 }}
                      onClick={async () => {
                        // Pass regenerateId so the pipeline replaces the existing
                        // row instead of inserting a duplicate.
                        await fetch('/api/admin/prospect-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.url, regenerateId: p.id }) })
                        const r = await fetch('/api/admin/prospect-pipeline')
                        const d = await r.json()
                        setProspects(d.prospects ?? [])
                      }}
                    >
                      Regenerate
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 11, color: 'var(--error)', border: '1px solid var(--error-border)' }}
                      onClick={async () => {
                        // Mark as rejected (simple inline update)
                        await fetch('/api/admin/prospect-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: '__reject__', prospectId: p.id }) }).catch(() => {})
                        setProspects(prev => prev.map(x => x.id === p.id ? { ...x, status: 'rejected' } : x))
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send Modal */}
          {sendModal && (
            <div className="settings-card" style={{ marginBottom: 16, border: '2px solid var(--accent-ink)' }}>
              <h3>Send to {sendModal.companyName}</h3>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Contact Email *</label>
                  <input className="input" value={sendForm.email} onChange={e => setSendForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@company.com" style={{ width: '100%', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Contact Name</label>
                  <input className="input" value={sendForm.name} onChange={e => setSendForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" style={{ width: '100%', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Subject *</label>
                  <input className="input" value={sendForm.subject} onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)' }}>Custom Message (optional)</label>
                  <textarea className="input" value={sendForm.body} onChange={e => setSendForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Leave blank for auto-generated message" style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    disabled={sendBusy || !sendForm.email || !sendForm.subject}
                    onClick={async () => {
                      setSendBusy(true)
                      try {
                        const r = await fetch('/api/admin/prospect-send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            prospectId: sendModal.prospectId,
                            contactEmail: sendForm.email,
                            contactName: sendForm.name || undefined,
                            subject: sendForm.subject,
                            body: sendForm.body || undefined,
                          }),
                        })
                        const d = await r.json()
                        if (!r.ok) throw new Error(d.error || 'Failed to send')
                        setSendModal(null)
                        // Refresh
                        const rr = await fetch('/api/admin/prospect-pipeline')
                        const dd = await rr.json()
                        setProspects(dd.prospects ?? [])
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'Send failed', 'error')
                      }
                      setSendBusy(false)
                    }}
                  >
                    {sendBusy ? 'Sending...' : 'Send Email'}
                  </button>
                  <button className="btn btn-soft" onClick={() => setSendModal(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Sent */}
          {prospects.filter(p => ['sent', 'watched', 'converted'].includes(p.status)).length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>Sent</h3>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ flex: 1 }}>Company</div>
                  <div style={{ width: 160 }}>Contact</div>
                  <div style={{ width: 100 }}>Sent</div>
                  <div style={{ width: 100 }}>Status</div>
                </div>
                {prospects.filter(p => ['sent', 'watched', 'converted'].includes(p.status)).map((p, i, arr) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.company_name ?? 'Unknown'}</div>
                    <div style={{ width: 160, fontSize: 12, color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.contact_email ?? '—'}</div>
                    <div style={{ width: 100, fontSize: 12, color: 'var(--ink-light)' }}>{p.email_sent_at ? fmt(p.email_sent_at) : '—'}</div>
                    <div style={{ width: 100 }}>
                      {p.status === 'sent' && <span className="tag peach" style={{ fontSize: 11 }}>Sent</span>}
                      {p.status === 'watched' && <span className="tag mint" style={{ fontSize: 11 }}>Watched</span>}
                      {p.status === 'converted' && <span className="tag" style={{ fontSize: 11, background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>Converted</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Failed/Rejected */}
          {prospects.filter(p => ['failed', 'rejected'].includes(p.status)).length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>Failed / Rejected</h3>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {prospects.filter(p => ['failed', 'rejected'].includes(p.status)).map((p, i, arr) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{p.company_name ?? p.url}</div>
                      {p.error_message && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 2 }}>{p.error_message}</div>}
                      {p.review_notes && <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{p.review_notes}</div>}
                    </div>
                    <span className={`tag ${p.status === 'failed' ? 'rose' : ''}`} style={{ fontSize: 11, textTransform: 'capitalize' }}>{p.status}</span>
                    <button
                      className="btn btn-sm btn-soft"
                      style={{ fontSize: 11 }}
                      onClick={async () => {
                        await fetch('/api/admin/prospect-pipeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: p.url }) })
                        const r = await fetch('/api/admin/prospect-pipeline')
                        const d = await r.json()
                        setProspects(d.prospects ?? [])
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In-progress */}
          {prospects.filter(p => ['queued', 'scraping', 'scripting', 'generating', 'assembling'].includes(p.status)).length > 0 && (
            <div className="settings-card" style={{ marginBottom: 16 }}>
              <h3>In Progress</h3>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                {prospects.filter(p => ['queued', 'scraping', 'scripting', 'generating', 'assembling'].includes(p.status)).map((p, i, arr) => (
                  <div key={p.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    <div style={{ flex: 1, fontWeight: 600 }}>{p.company_name ?? p.url}</div>
                    <span className="tag peach" style={{ fontSize: 11, textTransform: 'capitalize' }}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Industry Campaign System */}
          <div className="settings-card" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 2 }}>Industry Email Campaigns</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
                  Create targeted campaigns by industry. Upload CSV or paste contacts, AI generates copy, preview and send.
                </p>
              </div>
              <button className="btn btn-sm btn-soft" onClick={reloadCampaigns}>Refresh</button>
            </div>

            {campaignStep === 'setup' && (
              <div>
                {/* Campaign Name */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Campaign Name</label>
                  <input className="input" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Life Insurance Agents — May 2026" style={{ width: '100%', fontSize: 13 }} />
                </div>

                {/* Industry Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Industry *</label>
                    <select className="input" value={campaignIndustry} onChange={e => setCampaignIndustry(e.target.value)} style={{ width: '100%' }}>
                      <option value="insurance">Insurance</option>
                      <option value="financial">Financial Services</option>
                      <option value="real_estate">Real Estate</option>
                      <option value="mortgage">Mortgage & Lending</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="legal">Legal</option>
                      <option value="consulting">Consulting</option>
                      <option value="education">Education</option>
                      <option value="accounting">Accounting</option>
                      <option value="technology">Technology</option>
                      <option value="hr">HR & Recruiting</option>
                      <option value="sales">Sales</option>
                      <option value="general">General / Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Sub-vertical (optional)</label>
                    <input className="input" value={campaignSubIndustry} onChange={e => setCampaignSubIndustry(e.target.value)} placeholder="e.g. Life Insurance, P&C, Health" style={{ width: '100%' }} />
                  </div>
                </div>

                {/* Add Contacts — Manual + CSV */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 8 }}>Contacts</label>

                  {/* Manual add form */}
                  <div style={{ background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Add Individual Contact</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--ink-light)', display: 'block', marginBottom: 2 }}>Email *</label>
                        <input id="manual-email" className="input" placeholder="email@company.com" style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--ink-light)', display: 'block', marginBottom: 2 }}>Name</label>
                        <input id="manual-name" className="input" placeholder="John Smith" style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--ink-light)', display: 'block', marginBottom: 2 }}>Company</label>
                        <input id="manual-company" className="input" placeholder="Acme Inc" style={{ width: '100%', fontSize: 12 }} />
                      </div>
                      <button className="btn btn-sm btn-primary" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => {
                        const emailEl = document.getElementById('manual-email') as HTMLInputElement
                        const nameEl = document.getElementById('manual-name') as HTMLInputElement
                        const companyEl = document.getElementById('manual-company') as HTMLInputElement
                        const email = emailEl?.value.trim()
                        if (!email || !email.includes('@')) { notify('Enter a valid email', 'error'); return }
                        const line = `${email}, ${nameEl?.value.trim() || ''}, ${companyEl?.value.trim() || ''}`
                        setCampaignCsvText(prev => prev ? `${prev}\n${line}` : line)
                        if (emailEl) emailEl.value = ''
                        if (nameEl) nameEl.value = ''
                        if (companyEl) companyEl.value = ''
                        emailEl?.focus()
                      }}>
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* CSV upload or paste */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Bulk Import</div>
                    <label className="btn btn-sm btn-soft" style={{ fontSize: 11, cursor: 'pointer', margin: 0 }}>
                      Upload CSV
                      <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          const text = ev.target?.result as string
                          if (text) setCampaignCsvText(prev => prev ? `${prev}\n${text}` : text)
                        }
                        reader.readAsText(file)
                        e.target.value = ''
                      }} />
                    </label>
                    {campaignCsvText.trim() && (
                      <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--error)', border: '1px solid var(--error-border)' }} onClick={() => setCampaignCsvText('')}>
                        Clear All
                      </button>
                    )}
                  </div>
                  <textarea
                    className="input"
                    placeholder={"Paste CSV or type contacts (email, name, company — one per line):\njohn@acme.com, John Smith, Acme Insurance\njane@bigcorp.com, Jane Doe, BigCorp Financial\nor just emails:\nbob@example.com"}
                    value={campaignCsvText}
                    onChange={e => setCampaignCsvText(e.target.value)}
                    rows={6}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  />
                  {campaignCsvText.trim() && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-light)' }}>
                      {campaignCsvText.split('\n').filter(l => l.trim() && l.includes('@')).length} valid contacts
                    </div>
                  )}
                </div>

                {/* CTA URL override */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Landing Page URL (leave blank for industry page)</label>
                  <input className="input" value={campaignCtaUrl} onChange={e => setCampaignCtaUrl(e.target.value)} placeholder={`https://docs2video.com/industries/${campaignIndustry}`} style={{ width: '100%', fontSize: 13 }} />
                </div>

                <button
                  className="btn btn-primary"
                  disabled={campaignGenerating || !campaignCsvText.trim()}
                  onClick={async () => {
                    const lines = campaignCsvText.split('\n').map(l => l.trim()).filter(Boolean)
                    const startIdx = lines[0]?.toLowerCase().includes('email') ? 1 : 0
                    const parsed = lines.slice(startIdx).map(line => {
                      const parts = line.split(',').map(p => p.trim())
                      return { email: parts[0], name: parts[1] || '', company: parts[2] || '' }
                    }).filter(c => c.email && c.email.includes('@'))
                    if (!parsed.length) { notify('No valid contacts found.', 'error'); return }
                    setCampaignContacts(parsed)
                    setCampaignGenerating(true)
                    try {
                      const r = await fetch('/api/admin/campaign-send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'generate', industry: campaignIndustry, subIndustry: campaignSubIndustry || undefined }),
                      })
                      const d = await r.json()
                      if (!r.ok) { notify(d.error || 'Failed to generate copy', 'error'); return }
                      setCampaignSubject(d.subject)
                      setCampaignBody(d.body)
                      setCampaignCtaText(d.ctaText || 'Try It Free')
                      setCampaignStep('preview')
                    } catch (err) { notify(err instanceof Error ? err.message : 'Network error', 'error') }
                    setCampaignGenerating(false)
                  }}
                >
                  {campaignGenerating ? 'Generating email copy...' : `Generate Campaign for ${campaignCsvText.split('\n').filter(l => l.trim() && l.includes('@')).length} contacts`}
                </button>
              </div>
            )}

            {campaignStep === 'preview' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span className="tag mint" style={{ fontSize: 11 }}>{campaignIndustry}</span>
                  {campaignSubIndustry && <span className="tag" style={{ fontSize: 11 }}>{campaignSubIndustry}</span>}
                  <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{campaignContacts.length} contacts</span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Subject Line</label>
                  <input className="input" value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Email Body (use &#123;&#123;name&#125;&#125; and &#123;&#123;company&#125;&#125;)</label>
                  <textarea className="input" value={campaignBody} onChange={e => setCampaignBody(e.target.value)} rows={8} style={{ width: '100%', fontSize: 13, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>CTA Button Text</label>
                    <input className="input" value={campaignCtaText} onChange={e => setCampaignCtaText(e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }}>Landing Page</label>
                    <input className="input" value={campaignCtaUrl || `https://docs2video.com/industries/${campaignIndustry}`} onChange={e => setCampaignCtaUrl(e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                  </div>
                </div>

                {/* Preview. The white page, near-black text and button inside stay typed on
                    purpose (also in dark mode): they copy the real campaign email's own colours. */}
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border-light)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Preview (first contact)</div>
                  <div style={{ background: 'white', borderRadius: 8, padding: 20, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                      <strong>To:</strong> {campaignContacts[0]?.email} &nbsp; <strong>Subject:</strong> {campaignSubject.replace(/\{\{name\}\}/g, campaignContacts[0]?.name || 'there').replace(/\{\{company\}\}/g, campaignContacts[0]?.company || 'your company')}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line', color: '#333', marginTop: 12 }}>
                      {campaignBody.replace(/\{\{name\}\}/g, campaignContacts[0]?.name || 'there').replace(/\{\{company\}\}/g, campaignContacts[0]?.company || 'your company')}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                      <span style={{ display: 'inline-block', background: '#1a1a1a', color: 'white', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>{campaignCtaText} →</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-soft" onClick={() => setCampaignStep('setup')}>Back</button>
                  <button className="btn btn-soft" disabled={campaignGenerating} onClick={async () => {
                    setCampaignGenerating(true)
                    try {
                      const r = await fetch('/api/admin/campaign-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate', industry: campaignIndustry, subIndustry: campaignSubIndustry || undefined }) })
                      const d = await r.json()
                      if (r.ok) { setCampaignSubject(d.subject); setCampaignBody(d.body); setCampaignCtaText(d.ctaText || 'Try It Free') }
                    } catch {}
                    setCampaignGenerating(false)
                  }}>
                    {campaignGenerating ? 'Regenerating...' : 'Regenerate Copy'}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={campaignSending}
                    onClick={async () => {
                      if (!(await ask({ title: `Start sending to ${campaignContacts.length} contacts?`, body: 'The campaign is created and emails start going out straight away. You can pause or cancel it below.', confirmLabel: 'Start sending' })).ok) return
                      setCampaignSending(true)
                      try {
                        // Create the campaign in DB
                        const r = await fetch('/api/admin/campaign-send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'create',
                            name: campaignName || `${campaignIndustry} Campaign`,
                            industry: campaignIndustry,
                            subIndustry: campaignSubIndustry || undefined,
                            subject: campaignSubject,
                            emailBody: campaignBody,
                            ctaText: campaignCtaText,
                            ctaUrl: campaignCtaUrl || `https://docs2video.com/industries/${campaignIndustry}`,
                            contacts: campaignContacts,
                          }),
                        })
                        const d = await r.json()
                        if (!r.ok) { notify(d.error || 'Failed to create campaign', 'error'); setCampaignSending(false); return }

                        // Start sending immediately
                        await fetch('/api/admin/campaign-send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'send', campaignId: d.campaignId }),
                        })

                        reloadCampaigns()
                        setCampaignStep('done')
                      } catch (err) { notify(err instanceof Error ? err.message : 'Network error', 'error') }
                      setCampaignSending(false)
                    }}
                  >
                    {campaignSending ? 'Creating & Sending...' : `Send to ${campaignContacts.length} contacts`}
                  </button>
                </div>
              </div>
            )}

            {campaignStep === 'done' && (
              <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mint-darker)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Campaign Created & Sending!</h4>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>Track progress below. You can pause or cancel at any time.</p>
                <button className="btn btn-soft" onClick={() => {
                  setCampaignStep('setup')
                  setCampaignCsvText('')
                  setCampaignContacts([])
                  setCampaignSubject('')
                  setCampaignBody('')
                  setCampaignName('')
                }}>
                  New Campaign
                </button>
              </div>
            )}
          </div>

          {/* Campaign History & Controls */}
          {campaigns.length > 0 && (
            <div className="settings-card" style={{ marginTop: 16 }}>
              <h3>Campaign History</h3>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <div style={{ flex: 1 }}>Campaign</div>
                  <div style={{ width: 100 }}>Industry</div>
                  <div style={{ width: 80, textAlign: 'center' }}>Sent</div>
                  <div style={{ width: 80, textAlign: 'center' }}>Pending</div>
                  <div style={{ width: 80, textAlign: 'center' }}>Failed</div>
                  <div style={{ width: 90 }}>Status</div>
                  <div style={{ width: 180 }}>Actions</div>
                </div>
                {campaigns.map((c: any, i: number) => {
                  const statusColors: Record<string, string> = { draft: '', sending: 'peach', paused: '', completed: 'mint', cancelled: 'rose' }
                  const pct = c.total_contacts > 0 ? Math.round(((c.stats?.sent ?? 0) / c.total_contacts) * 100) : 0
                  return (
                    <div key={c.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: i < campaigns.length - 1 ? '1px solid var(--border-light)' : 'none', fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>
                          {fmt(c.created_at)} — {c.total_contacts} contacts
                        </div>
                        {c.status === 'sending' && (
                          <div style={{ marginTop: 4, height: 3, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden', width: '100%', maxWidth: 200 }}>
                            <div style={{ height: '100%', background: 'var(--accent-ink)', borderRadius: 3, width: `${pct}%`, transition: 'width 0.3s' }} />
                          </div>
                        )}
                      </div>
                      <div style={{ width: 100 }}>
                        <span className="tag" style={{ fontSize: 10, textTransform: 'capitalize' }}>{(c.industry || '').replace('_', ' ')}</span>
                      </div>
                      <div style={{ width: 80, textAlign: 'center', fontWeight: 600, color: 'var(--success)' }}>{c.stats?.sent ?? c.sent_count ?? 0}</div>
                      <div style={{ width: 80, textAlign: 'center', color: 'var(--ink-light)' }}>{c.stats?.pending ?? 0}</div>
                      <div style={{ width: 80, textAlign: 'center', color: (c.stats?.failed ?? 0) > 0 ? 'var(--error)' : 'var(--ink-light)' }}>{c.stats?.failed ?? c.failed_count ?? 0}</div>
                      <div style={{ width: 90 }}>
                        <span className={`tag ${statusColors[c.status] || ''}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>{c.status}</span>
                      </div>
                      <div style={{ width: 180, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(c.status === 'draft' || c.status === 'paused') && (
                          <button className="btn btn-sm btn-primary" style={{ fontSize: 10 }} disabled={campaignBusy === c.id}
                            onClick={() => campaignAction(c.id, c.status === 'draft' ? 'send' : 'resume')}>
                            {campaignBusy === c.id ? '...' : c.status === 'draft' ? 'Start' : 'Resume'}
                          </button>
                        )}
                        {c.status === 'sending' && (
                          <button className="btn btn-sm btn-soft" style={{ fontSize: 10 }} disabled={campaignBusy === c.id}
                            onClick={() => campaignAction(c.id, 'pause')}>
                            {campaignBusy === c.id ? '...' : 'Pause'}
                          </button>
                        )}
                        {['draft', 'sending', 'paused'].includes(c.status) && (
                          <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--error)', border: '1px solid var(--error-border)' }} disabled={campaignBusy === c.id}
                            onClick={async () => { if ((await ask({ title: 'Cancel this campaign?', body: 'Emails not sent yet are skipped. This can’t be undone.', danger: true, confirmLabel: 'Cancel campaign' })).ok) campaignAction(c.id, 'cancel') }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      {confirmDialog}
    </>
  )
}
