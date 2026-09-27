import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { sniffImage } from '../../_lib/image-sniff'

export const runtime = 'nodejs'
export const maxDuration = 30

const BUCKET = 'agent-photos'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// 4MB — must stay UNDER the host's ~4.5MB request-body cap, which would
// otherwise reject the upload with a plaintext error before this handler runs.
const MAX_SIZE = 4 * 1024 * 1024
const VALID_PHOTO_TYPES = ['headshot', 'midlevel', 'standing'] as const
type PhotoType = typeof VALID_PHOTO_TYPES[number]

const PHOTO_COLUMN_MAP: Record<PhotoType, string> = {
  headshot: 'photo_url',
  midlevel: 'photo_midlevel_url',
  standing: 'photo_standing_url',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const typeField = (formData.get('type') as string) || 'headshot'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'File must be JPG, PNG, or WebP' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File must be under 4MB' }, { status: 400 })
  if (!VALID_PHOTO_TYPES.includes(typeField as PhotoType)) {
    return NextResponse.json({ error: 'Invalid photo type. Must be headshot, midlevel, or standing.' }, { status: 400 })
  }

  const photoType = typeField as PhotoType

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    // The stored type and extension come from the file's actual bytes, not
    // from the name or the type the browser claimed.
    const kind = sniffImage(buffer)
    if (!kind) return NextResponse.json({ error: 'File must be a real JPG, PNG, or WebP image.' }, { status: 400 })

    // A NEW path every time. Re-using "<id>/headshot.jpg" meant browsers,
    // the CDN and already-rendered pages kept showing the old photo.
    const storagePath = `${user.id}/${photoType}-${randomUUID()}.${kind.ext}`

    const admin = createAdminClient()
    const column = PHOTO_COLUMN_MAP[photoType]

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: kind.mime, upsert: false })
    if (uploadError) throw uploadError

    const photoUrl = admin.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl

    // Update profile with the correct column
    const { error: updErr } = await admin.from('profiles').update({ [column]: photoUrl }).eq('id', user.id)
    if (updErr) {
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {})
      throw new Error('Could not save the photo to your profile')
    }

    // The previous file is deliberately KEPT: videos and share pages made
    // earlier may have saved its link, and deleting it would break them.

    return NextResponse.json({ url: photoUrl })
  } catch (err) {
    console.error('[upload-photo] failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
