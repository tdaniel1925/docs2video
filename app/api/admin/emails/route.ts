import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
import { Resend } from 'resend'

export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !(await isAdminRequest(user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Fetch recent emails from Resend
    const { data: emailList, error } = await resend.emails.list()

    if (error) {
      console.error('[admin/emails] Resend list error:', error)
      return NextResponse.json({ error: 'Failed to fetch emails from Resend' }, { status: 500 })
    }

    const emails = emailList?.data ?? []

    // Compute stats
    const totalSent = emails.length
    const delivered = emails.filter((e: any) => e.last_event === 'delivered').length
    const bounced = emails.filter((e: any) => e.last_event === 'bounced').length
    const failed = emails.filter((e: any) =>
      e.last_event === 'failed' || e.last_event === 'complained'
    ).length

    return NextResponse.json({
      stats: {
        totalSent,
        delivered,
        bounced,
        failed,
      },
      recentEmails: emails.slice(0, 50).map((e: any) => ({
        id: e.id,
        to: e.to,
        subject: e.subject,
        status: e.last_event ?? 'unknown',
        createdAt: e.created_at,
      })),
    })
  } catch (err) {
    console.error('[admin/emails] Error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
