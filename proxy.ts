import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isPublicPath, legacyRedirect } from './app/_lib/public-paths'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // MAINTENANCE: with MAINTENANCE_MODE=1 every page shows the maintenance notice.
  // Webhooks and other API calls keep working so payments and jobs are not lost.
  if (process.env.MAINTENANCE_MODE === '1' && pathname !== '/maintenance' && !pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL('/maintenance', request.url))
  }
  if (pathname === '/maintenance') return NextResponse.next()

  // Old campaign emails linked to /industries/{slug}; the pages live at /for.
  const legacy = legacyRedirect(pathname)
  if (legacy) {
    const url = request.nextUrl.clone()
    url.pathname = legacy
    return NextResponse.redirect(url, 308)
  }
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Machine-to-machine endpoints — these authenticate themselves (webhook
  // signatures, cron secrets, Inngest signing keys, Bearer API keys, the MCP
  // agency key) and must never be redirected to the login page.
  const machinePaths = ['/api/webhooks', '/api/cron', '/api/inngest', '/api/email-track', '/api/email-prefs', '/api/stripe/webhook', '/api/partner', '/api/v1', '/api/mcp', '/api/checkout/create',
    // The render service reports errors here with its own x-api-secret.
    '/api/internal',
    // MCP OAuth: discovery metadata + the token/register/approve endpoints are
    // machine-to-machine (an MCP client calls them, no browser session). The
    // /api/mcp/oauth/authorize route handles its OWN login redirect internally,
    // so it's safe to let through here too (it bounces to /login when needed).
    '/.well-known', '/api/well-known', '/api/mcp/oauth']
  if (machinePaths.some(p => pathname.startsWith(p))) {
    return response
  }

  // Server-to-server internal calls: the /api/v1 layer re-enters internal
  // routes (extract-url, generate-video, generate-presentation, …) with the
  // x-internal-service secret. The routes verify it again themselves — the
  // middleware must not bounce them to /login. Constant-time compare.
  const internalSecret = (process.env.INTERNAL_API_SECRET || '').trim()
  const reqInternal = (request.headers.get('x-internal-service') || '').trim()
  if (internalSecret && pathname.startsWith('/api/') && reqInternal.length === internalSecret.length) {
    let diff = 0
    for (let i = 0; i < internalSecret.length; i++) diff |= internalSecret.charCodeAt(i) ^ reqInternal.charCodeAt(i)
    if (diff === 0) return response
  }

  // Redirect unauthenticated users away from protected pages. The allow-list
  // (marketing pages, email links, share pages, public forms) lives in
  // app/_lib/public-paths.ts so it can be tested. Kept from before: '/r/' must
  // stay public — affiliate referral links are clicked by anonymous visitors;
  // redirecting them to /login drops the attribution. '/restylez' is the
  // Restylez marketing landing (its CTA leads to /remake, which needs login).
  if (!user && !isPublicPath(pathname)) {
    // An API call gets a plain 401 — a redirect to the login page would hand
    // fetch() an HTML page that then fails to parse as JSON.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // /pricing lives in the signed-in app (it starts checkout for the current
  // account). A logged-out visitor — from the sitemap, the homepage or a promo
  // email — is shown the public pricing page instead, at the same address and
  // with the same query string (?promo=… is carried through to signup).
  if (!user && pathname === '/pricing') {
    const url = request.nextUrl.clone()
    url.pathname = '/plans'
    return NextResponse.rewrite(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Files in public/ must be SERVED, not routed. The image extensions were
  // already excluded but .html was not, so a static page in public/ was handed
  // to the app instead — /logo-lab.html came back as the dashboard's HTML with
  // a 200, which looks like a working link right up until you open it.
  //
  // Everything listed here is a static asset that is public by definition;
  // nothing that needs a signed-in session lives at one of these extensions.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|txt|xml|pdf|css|js|woff2?)$).*)'],
}
