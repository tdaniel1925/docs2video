import type { NeedsYou } from './needs-you'

/**
 * The daily "What needs you" email — the same list as the admin home card,
 * every item a link straight to the right admin screen. Pure (string in,
 * string out) so it can be tested without sending anything.
 */
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function abs(base: string, href: string) {
  return /^https?:\/\//.test(href) ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`
}

export function needsYouSubject(n: NeedsYou, stuck: number): string {
  const total = n.total + stuck
  return total === 0 ? '[Docs2Video] Nothing needs you today' : `[Docs2Video] ${total} thing${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} you today`
}

export function needsYouEmailHtml(n: NeedsYou, base: string, extra: { completed24h: number; stuck: { title: string; status: string; href: string }[] }): string {
  const colour = { stop: '#b42318', warn: '#8a5a00', info: '#1B3A5C' }
  const section = (title: string, tone: 'stop' | 'warn' | 'info', href: string, rows: string, note?: string) => `
    <h3 style="margin:24px 0 8px;font-size:16px;color:${colour[tone]};">${esc(title)} <a href="${esc(abs(base, href))}" style="font-size:12px;font-weight:600;color:#1B3A5C;">See all</a></h3>
    ${note ? `<p style="margin:0 0 8px;font-size:13px;color:#555;">${esc(note)}</p>` : ''}
    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${rows}</table>`
  const row = (title: string, detail: string, href: string) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;">
      <a href="${esc(abs(base, href))}" style="color:#111;font-weight:700;text-decoration:none;">${esc(title)}</a>
      <div style="font-size:13px;color:#555;margin-top:2px;">${esc(detail)}</div>
    </td></tr>`

  const parts: string[] = []
  for (const s of n.sections) {
    const items = s.items
    if (!items.length && s.key !== 'providers') continue
    const extraNote = s.key === 'review' ? 'Open the admin to Approve or Reject each one.' : s.note
    parts.push(section(s.title, s.tone, s.href, items.slice(0, 15).map((i) => row(i.title, i.detail, i.href)).join('')
      + (items.length > 15 ? row(`…and ${items.length - 15} more`, 'Open the admin to see them all.', s.href) : ''), extraNote))
  }
  if (extra.stuck.length) {
    parts.push(section(`Stuck for over an hour (${extra.stuck.length})`, 'warn', '/admin?tab=videos&filter=running',
      extra.stuck.map((v) => row(v.title, `Still “${v.status}” — the automatic clean-up stops it and gives the credits back.`, v.href)).join('')))
  }

  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#111;">
  <h2 style="color:#1B3A5C;margin-bottom:4px;">What needs you today</h2>
  <p style="font-size:14px;color:#444;margin-top:0;">${n.total === 0 && !extra.stuck.length ? 'Nothing needs you. ' : ''}Last 24 hours: <b>${extra.completed24h}</b> videos finished.</p>
  ${parts.join('')}
  <p style="font-size:12px;color:#999;margin-top:28px;">Every line opens the right page in the <a href="${esc(abs(base, '/admin'))}">admin</a>. This email goes to one inbox (OWNER_ALERT_EMAIL).</p>
</div>`
}
