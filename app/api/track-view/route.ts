import { NextResponse } from 'next/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { videoId } = (await request.json()) as { videoId: string }
    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get viewer info from headers
    const viewerIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const viewerDevice = request.headers.get('user-agent') ?? 'unknown'

    // Insert view record
    await supabase.from('video_views').insert({
      video_id: videoId,
      viewer_ip: viewerIp,
      viewer_device: viewerDevice,
    })

    // Send notification email to video owner
    try {
      const { data: video } = await supabase
        .from('videos')
        .select('title, user_id')
        .eq('id', videoId)
        .single()

      if (video) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', video.user_id)
          .single()

        if (profile?.email) {
          // Find a default email connection for this user
          const { data: connection } = await supabase
            .from('email_connections')
            .select('*')
            .eq('user_id', video.user_id)
            .eq('is_default', true)
            .single()

          if (connection) {
            const { sendViaSMTP, sendViaGoogle, sendViaMicrosoft } = await import('../../_lib/email')
            const subject = `Someone viewed your video: ${video.title ?? 'Untitled'}`
            const html = `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                <h2 style="color:#0F1A12;margin:0 0 12px;">New Video View</h2>
                <p style="color:#4B574F;font-size:14px;line-height:1.6;">
                  Someone just opened your video <strong>"${video.title ?? 'Untitled'}"</strong>.
                </p>
                <p style="color:#8A968D;font-size:12px;margin-top:16px;">
                  Viewer IP: ${viewerIp}<br/>
                  Device: ${viewerDevice.slice(0, 100)}
                </p>
                <p style="color:#8A968D;font-size:11px;margin-top:20px;">Powered by Docs2Video</p>
              </div>
            `

            if (connection.provider === 'smtp') {
              await sendViaSMTP(connection, profile.email, subject, html)
            } else if (connection.provider === 'google') {
              await sendViaGoogle(connection, profile.email, subject, html)
            } else if (connection.provider === 'microsoft') {
              await sendViaMicrosoft(connection, profile.email, subject, html)
            }
          }
        }
      }
    } catch (emailErr) {
      // Don't fail the view tracking if notification fails
      console.error('[track-view] Email notification error:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('[track-view] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
