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
  // signatures, cron secrets, Inngest signing keys) and must never be
  // redirected to the login page.
  const machinePaths = ['/api/webhooks', '/api/cron', '/api/inngest', '/api/email-track', '/api/email-prefs', '/api/stripe/webhook']
  if (machinePaths.some(p => pathname.startsWith(p))) {
    return response
  }

  // Redirect unauthenticated users away from protected pages
  if (!user && !publicPaths.includes(pathname) && !pathname.startsWith('/auth') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/public') && !pathname.startsWith('/api/track-view') && !pathname.startsWith('/api/quotes/pay') && !pathname.startsWith('/api/demo') && !pathname.startsWith('/api/try-demo') && !pathname.startsWith('/watch') && !pathname.startsWith('/for') && !pathname.startsWith('/try') && !pathname.startsWith('/demo') && !pathname.startsWith('/share-demo') && !pathname.startsWith('/demo-prezi') && !pathname.startsWith('/terms') && !pathname.startsWith('/privacy') && !pathname.startsWith('/cookies')) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
