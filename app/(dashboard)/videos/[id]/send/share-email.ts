// =============================================================================
// The words that go out with a share — moved here from the old "Send to Your
// Client" window when it was retired, so the one send panel keeps everything
// that window could do:
//   * the insurance disclosure that goes with the link for policy videos
//     (the old "Copy Link" button added it; the send route adds it to emails);
//   * "Copy the email" — the whole email (message, a View button, the link)
//     as rich text plus a plain-text copy, for people who send from their own
//     inbox. Copying sends nothing.
// Pure: no browser, so it can be tested.
// =============================================================================

export const INSURANCE_DISCLOSURE = 'Important Disclosure: This video is for educational and informational purposes only and is not intended as legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. The policy contract and official carrier-issued illustration govern all policy values and guarantees. This video is not endorsed by or affiliated with any insurance carrier and is not a solicitation to purchase insurance. Please review all official policy materials and consult with your licensed professional before making any decisions.'

/** A policy-illustration video — the same test the send route uses. */
export function isInsuranceVideo(script: unknown): boolean {
  const pd = (script as { _pipeline_input?: { policyData?: { deathBenefit?: unknown } } } | null)?._pipeline_input?.policyData
  return !!pd?.deathBenefit
}

/** What "copy the link" puts on the clipboard. */
export function linkToCopy(url: string, insurance: boolean): string {
  return insurance
    ? `I've prepared a video overview of your policy illustration. Click below to watch:\n\n${url}\n\n${INSURANCE_DISCLOSURE}`
    : url
}

/** The message used when the agent wrote no note. */
export function defaultMessage(thing: 'video' | 'presentation', clientName: string, insurance: boolean): string {
  const name = clientName.trim().split(/\s+/)[0] || 'there'
  if (insurance) {
    return `Hi ${name},\n\nI've put together a short video overview of your policy illustration that walks you through the key details in plain language.\n\nIt only takes a couple of minutes — press the button below to watch.\n\nLet me know if you have any questions after watching.`
  }
  return `Hi ${name},\n\nI've put together a short ${thing} for you. It only takes a few minutes — press the button below to see it.\n\nLet me know if you have any questions!`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The rich email for pasting into Gmail / Outlook. Email clients ignore the
 *  app's colour names, so the colours here are written out (navy = the app's
 *  --ink). */
export function emailHtml(body: string, url: string, thing: 'video' | 'presentation', insurance: boolean): string {
  const bodyHtml = escapeHtml(body).replace(/\n/g, '<br/>')
  const button = thing === 'presentation' ? 'View Your Presentation →' : 'View Your Video Now →'
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a2b1f;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 20px;">${bodyHtml}</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:#0B2545;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:8px;">${button}</a>
  </p>
  <p style="font-size:13px;color:#5b6b60;margin:24px 0 0;">Or paste this link into your browser:<br/><a href="${url}" style="color:#0B2545;">${url}</a></p>${insurance ? `\n  <p style="font-size:11px;color:#8a968d;margin-top:24px;line-height:1.5;">${escapeHtml(INSURANCE_DISCLOSURE)}</p>` : ''}
</div>`
}

export function emailText(body: string, url: string, thing: 'video' | 'presentation', insurance: boolean): string {
  const button = thing === 'presentation' ? 'View Your Presentation' : 'View Your Video Now'
  return `${body}\n\n► ${button}: ${url}\n\nOr paste this link into your browser:\n${url}${insurance ? `\n\n${INSURANCE_DISCLOSURE}` : ''}`
}
