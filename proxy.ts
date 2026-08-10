import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const publicPaths = ['/', '/login', '/signup', '/forgot-password']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
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
  const machinePaths = ['/api/webhooks', '/api/cron', '/api/inngest', '/api/email-track', '/api/email-prefs', '/api/stripe/webhook', '/api/partner', '/api/v1', '/api/mcp', '/api/checkout/create']
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

  // Redirect unauthenticated users away from protected pages
  // NOTE: '/r/' must stay public — affiliate referral links are clicked by
  // anonymous visitors; redirecting them to /login drops the attribution.
  if (!user && !publicPaths.includes(pathname) && !pathname.startsWith('/auth') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/public') && !pathname.startsWith('/api/track-view') && !pathname.startsWith('/api/quotes/pay') && !pathname.startsWith('/api/demo') && !pathname.startsWith('/api/try-demo') && !pathname.startsWith('/watch') && !pathname.startsWith('/for') && !pathname.startsWith('/try') && !pathname.startsWith('/demo') && !pathname.startsWith('/share-demo') && !pathname.startsWith('/demo-prezi') && !pathname.startsWith('/terms') && !pathname.startsWith('/privacy') && !pathname.startsWith('/cookies') && !pathname.startsWith('/r/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
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
