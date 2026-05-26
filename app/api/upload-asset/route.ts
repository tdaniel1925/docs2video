import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_TAGS = ['product', 'logo', 'lifestyle', 'background']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const tag = (formData.get('tag') as string) || 'product'

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Accepted: JPG, PNG, WebP' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
  }

  if (!VALID_TAGS.includes(tag)) {
    return NextResponse.json({ error: 'Invalid tag' }, { status: 400 })
  }

  try {
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
    const fileId = randomUUID()
    const storagePath = `${user.id}/${fileId}.${ext}`

    const admin = createAdminClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('creation-assets')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('creation-assets').getPublicUrl(storagePath)
    const publicUrl = urlData.publicUrl

    // Save to database
    const { data: asset, error: dbError } = await admin
      .from('creation_assets')
      .insert({
        user_id: user.id,
        file_url: publicUrl,
        tag,
        display_name: file.name,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Failed to save asset record:', dbError)
      // Still return the URL even if DB insert fails
      return NextResponse.json({ url: publicUrl, id: fileId })
    }

    return NextResponse.json({ url: publicUrl, id: asset.id })
  } catch (err) {
    console.error('[upload-asset] Error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
