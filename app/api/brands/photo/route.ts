import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 6 * 1024 * 1024 // 6MB

/**
 * Upload a PRESENTER headshot for a Person profile. Stores it in the
 * `agent-photos` bucket and returns the public URL — the brand/profile form
 * keeps it in a hidden field and persists it as `photo_url` via the brand action.
 * Unlike /api/upload-photo, this does NOT touch the account `profiles` table.
 *
 * POST /api/brands/photo  (multipart: file)
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Photo must be a JPG, PNG, or WebP image.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `Photo too large (max ${MAX_BYTES / 1024 / 1024}MB).` }, { status: 413 })

  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    // Unique per upload so a re-upload busts any CDN cache.
    const path = `${user.id}/presenter-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const admin = createAdminClient()
    const { error } = await admin.storage.from('agent-photos').upload(path, buffer, { contentType: file.type, upsert: true })
    if (error) throw error
    const { data } = admin.storage.from('agent-photos').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
