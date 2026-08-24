import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { requireAdmin } from '../../../_lib/admin'
import { logAdminAction } from '../../../_lib/audit'

export const runtime = 'nodejs'
export const maxDuration = 30

const IMP_COOKIE = 'd2v_impersonating'

/**
 * POST /api/admin/impersonate
 *  { action: 'start', userId }  → generate a magic link so the admin's browser
 *      becomes a real session as that user. Audit-logged. Cannot target admins.
 *  { action: 'exit' }           → clear the impersonation cookie (the client
 *      then signs out, returning the admin to their own login).
 */
export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { action?: string; userId?: string }

  if (body.action === 'exit') {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(IMP_COOKIE, '', { maxAge: 0, path: '/' })
    return res
  }

  if (body.action !== 'start' || !body.userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }
  if (body.userId === user.id) {
    return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up the target + block impersonating other admins (privilege guard).
  const { data: target } = await admin
    .from('profiles')
    .select('id, email, is_admin')
    .eq('id', body.userId)
    .single()
  if (!target?.email) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (target.is_admin) {
    return NextResponse.json({ error: 'Cannot impersonate another admin' }, { status: 403 })
  }

  // Audit BEFORE issuing the link.
  await logAdminAction(user.id, 'impersonate', target.id, { email: target.email })

  const origin = request.headers.get('origin') || (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com')
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: target.email,
    options: { redirectTo: `${origin}/dashboard` },
  })
  if (error || !link?.properties?.action_link) {
    console.error('[admin/impersonate] generateLink failed:', error?.message)
    return NextResponse.json({ error: 'Could not start impersonation' }, { status: 500 })
  }

  const res = NextResponse.json({ ok: true, actionLink: link.properties.action_link })
  // Mark the session as impersonated so the banner shows. Readable client-side.
  res.cookies.set(IMP_COOKIE, encodeURIComponent(target.email), {
    maxAge: 60 * 60 * 4, // 4h
    httpOnly: false,     // the banner reads it client-side
    secure: process.env.NODE_ENV === 'production', // HTTPS-only in prod
    sameSite: 'lax',
    path: '/',
  })
  return res
}
