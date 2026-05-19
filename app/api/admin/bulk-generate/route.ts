import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin } from '../../../_lib/admin'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await request.json()
  const { items } = body as {
    items: { name: string; email: string; documentUrl?: string; documentText?: string }[]
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const results: { index: number; status: string; videoId?: string; error?: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      // Find or create user profile for the email
      let targetUserId = user.id // default to admin's own account

      // Check if a profile exists for this email
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', item.email)
        .single()

      if (existingProfile) {
        targetUserId = existingProfile.id
      }

      // Create video record
      const { data: video, error: videoError } = await admin
        .from('videos')
        .insert({
          user_id: targetUserId,
          title: item.name || `Bulk Video ${i + 1}`,
          status: 'pending',
          voice_id: 'Kore',
          is_trial: false,
          script: {
            _pipeline_input: {
              policyData: { rawText: item.documentText ?? '', sourceUrl: item.documentUrl ?? '' },
              brandId: null,
              voiceId: 'Kore',
              styleId: 'executive',
            },
          },
        })
        .select()
        .single()

      if (videoError || !video) {
        results.push({ index: i, status: 'failed', error: videoError?.message ?? 'Failed to create video record' })
        continue
      }

      // Trigger the generation pipeline
      const baseUrl = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      const genRes = await fetch(`${baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          policyData: { rawText: item.documentText ?? '', sourceUrl: item.documentUrl ?? '' },
          voiceId: 'Kore',
          styleId: 'executive',
        }),
      })

      if (!genRes.ok) {
        results.push({ index: i, status: 'queued', videoId: video.id })
      } else {
        results.push({ index: i, status: 'started', videoId: video.id })
      }
    } catch (err) {
      results.push({ index: i, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ results, total: items.length })
}
