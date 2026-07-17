import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * DISABLED. The public "instant demo from a URL" feature is parked — its entry
 * point (DemoButton) was removed from the landing page. This route stays as a
 * clean 503 so any stale client (an old DemoForm still in someone's cache) gets a
 * clear message instead of a 404.
 *
 * The former implementation (brand scrape → script → local FFmpeg assemble) was
 * deleted: it had no auth and its STATIC imports (ffmpeg-static + native deps)
 * bloated the Vercel bundle. If rebuilt, do it on the VPS assembly pipeline with
 * auth — see git history for the old body.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Demo video generation is disabled. Please sign up to create videos.' },
    { status: 503 },
  )
}
