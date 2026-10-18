import { NextResponse } from 'next/server'
import { createClient } from '../../../../_lib/supabase/server'
import { createAdminClient } from '../../../../_lib/supabase/admin'

// GET /api/mcp/oauth/authorize — the authorization endpoint.
// The MCP client sends the user's browser here with response_type=code, client_id,
// redirect_uri, code_challenge (S256), state, scope, resource. We:
//   1. require a docs2video login (redirect to /login?next=... if absent),
//   2. validate the client + redirect_uri,
//   3. render a small consent screen (approve → POST to /api/mcp/oauth/approve).
// Issuing the code happens on approval, not here, so a logged-in GET never grants.
export const runtime = 'nodejs'

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')

function plainError(error: string, desc?: string) {
  return new NextResponse(`OAuth error: ${error}${desc ? ` — ${desc}` : ''}`, { status: 400 })
}

// Only called AFTER the redirect_uri is known to be registered for the client
// and parses as a URL — errors never bounce the browser to an unchecked address.
function errRedirect(redirectUri: URL, state: string | null, error: string, desc?: string) {
  const u = new URL(redirectUri.toString())
  u.searchParams.set('error', error)
  if (desc) u.searchParams.set('error_description', desc)
  if (state) u.searchParams.set('state', state)
  return NextResponse.redirect(u.toString())
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const p = url.searchParams
  const clientId = p.get('client_id')
  const redirectUri = p.get('redirect_uri')
  const responseType = p.get('response_type')
  const challenge = p.get('code_challenge')
  const method = p.get('code_challenge_method')
  const state = p.get('state')
  const scope = p.get('scope') || 'mcp'
  const resource = p.get('resource') || `${BASE}/api/mcp`

  // 1. Client + redirect_uri first. Until both check out, every error is a
  //    plain 400 page — redirecting to an unvalidated redirect_uri would make
  //    this endpoint an open redirect.
  if (!clientId || !redirectUri) return plainError('invalid_request', 'Missing client_id or redirect_uri.')
  let redirectTarget: URL
  try { redirectTarget = new URL(redirectUri) } catch { return plainError('invalid_request', 'Malformed redirect_uri.') }

  const admin = createAdminClient()
  const { data: client } = await admin.from('mcp_oauth_clients').select('client_id, client_name, redirect_uris').eq('client_id', clientId).maybeSingle()
  if (!client) return plainError('unauthorized_client', 'Unknown client_id.')
  if (!Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
    // Never redirect to an unregistered URI — that's an open-redirect. Fail plainly.
    return plainError('invalid_request', 'redirect_uri not registered for this client.')
  }

  // 2. Now the rest of the request; these errors may go back to the client.
  if (responseType !== 'code') return errRedirect(redirectTarget, state, 'unsupported_response_type')
  if (!challenge) return errRedirect(redirectTarget, state, 'invalid_request', 'Missing code_challenge.')
  if (method && method !== 'S256') return errRedirect(redirectTarget, state, 'invalid_request', 'Only S256 PKCE is supported.')

  // Require a signed-in docs2video/Text2Art user. If not, bounce through /login and
  // come straight back to this exact authorize URL.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const next = encodeURIComponent(url.pathname + url.search)
    return NextResponse.redirect(`${BASE}/login?next=${next}`)
  }

  // Consent screen. Approving POSTs the same params to /approve (below) which
  // issues the code and redirects back to the client.
  const clientName = (client.client_name || 'An app').replace(/[<>&"]/g, '')
  const hidden = (name: string, value: string) => `<input type="hidden" name="${name}" value="${value.replace(/"/g, '&quot;')}" />`
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connect ${clientName}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F4F1EC;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;max-width:440px;width:92%;padding:32px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{font-size:20px;margin:0 0 6px;color:#1a1a1a}p{color:#555;font-size:14px;line-height:1.55}
.who{font-size:13px;color:#888;margin:14px 0 20px}.perm{background:#faf8f4;border:1px solid #eee;border-radius:8px;padding:12px 14px;font-size:13px;color:#333;margin-bottom:20px}
button{font:inherit;font-weight:600;font-size:15px;border:none;border-radius:8px;padding:12px 20px;cursor:pointer}
.approve{background:#3BB5C8;color:#fff;width:100%}.deny{background:transparent;color:#888;width:100%;margin-top:8px}</style></head>
<body><div class="card">
<h1>Connect ${clientName}</h1>
<p><strong>${clientName}</strong> wants to use your Docs2Video / Text2Art tools — create commercials, presentations, and slide decks on your behalf.</p>
<div class="who">Signed in as ${(user.email || 'your account').replace(/[<>&"]/g, '')}</div>
<div class="perm">✓ Generate videos, presentations & decks<br>✓ Read the status of what it created</div>
<form method="POST" action="${BASE}/api/mcp/oauth/approve">
${hidden('client_id', clientId)}${hidden('redirect_uri', redirectUri)}${hidden('code_challenge', challenge)}${hidden('state', state || '')}${hidden('scope', scope)}${hidden('resource', resource)}
<button class="approve" type="submit" name="decision" value="approve">Allow</button>
<button class="deny" type="submit" name="decision" value="deny">Cancel</button>
</form></div></body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
