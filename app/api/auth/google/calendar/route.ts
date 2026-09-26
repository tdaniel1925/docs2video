import { NextResponse } from 'next/server'
export const maxDuration = 30

// Google Calendar booking was never finished: this flow sent the user through
// Google and then saved nothing (the old callback treated "<id>:calendar" as a
// user id). Until it exists, send the user back to paste a booking-page link,
// which the share page already supports.
export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'
  return NextResponse.redirect(`${siteUrl}/settings?tab=integrations&email_error=calendar_link_only`)
}
