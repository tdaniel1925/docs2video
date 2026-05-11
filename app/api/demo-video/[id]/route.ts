import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing demo ID' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('demo_videos')
    .select('id, domain, status, video_url, thumbnail_url, brand_data, error_message')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Demo not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    domain: data.domain,
    status: data.status,
    videoUrl: data.video_url,
    thumbnailUrl: data.thumbnail_url,
    brandData: data.brand_data,
    errorMessage: data.error_message,
  })
}
