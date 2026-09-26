import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { randomUUID } from 'crypto'
import { sniffImage } from '../../_lib/image-sniff'

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_TAGS = ['product', 'logo', 'lifestyle', 'background']
const BUCKET = 'creation-assets' // PRIVATE bucket
const SIGNED_URL_TTL = 60 * 60 * 24 * 7 // 7 days

// Uploaded assets live in the PRIVATE 'creation-assets' bucket. This route used
// to hand back (and save) a *public* link into that bucket, which never loads.
// Now the STORAGE PATH is what gets saved (creation_assets.file_url holds the
// path), and callers get a signed link that works for a week; mint a fresh one
// from the path when it's needed again.

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
    const buffer = Buffer.from(await file.arrayBuffer())
    // Type and extension from the file's real bytes, not the browser's claim.
    const kind = sniffImage(buffer)
    if (!kind) return NextResponse.json({ error: 'Invalid file type. Accepted: JPG, PNG, WebP' }, { status: 400 })
    const fileId = randomUUID()
    const storagePath = `${user.id}/${fileId}.${kind.ext}`

    const admin = createAdminClient()

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: kind.mime, upsert: false })

    if (uploadError) {
      console.error('[upload-asset] storage upload failed:', uploadError.message)
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
    }

    const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL)
    if (signErr || !signed?.signedUrl) {
      console.error('[upload-asset] could not sign URL:', signErr?.message)
      return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
    }

    // Save to database — the PATH, not a link (links into a private bucket expire).
    const { data: asset, error: dbError } = await admin
      .from('creation_assets')
      .insert({
        user_id: user.id,
        file_url: storagePath,
        tag,
        display_name: file.name,
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('Failed to save asset record:', dbError)
      // Still return the link even if DB insert fails
      return NextResponse.json({ url: signed.signedUrl, path: storagePath, id: fileId })
    }

    return NextResponse.json({ url: signed.signedUrl, path: storagePath, id: asset.id })
  } catch (err) {
    console.error('[upload-asset] Error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
