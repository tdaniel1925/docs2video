import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
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
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
  if (!VALID_PHOTO_TYPES.includes(typeField as PhotoType)) {
    return NextResponse.json({ error: 'Invalid photo type. Must be headshot, midlevel, or standing.' }, { status: 400 })
  }

  const photoType = typeField as PhotoType

  try {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${user.id}/${photoType}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const admin = createAdminClient()
    // Delete old photo if exists
    await admin.storage.from('agent-photos').remove([storagePath]).catch(() => {})

    const { error: uploadError } = await admin.storage
      .from('agent-photos')
      .upload(storagePath, buffer, { contentType: file.type, upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = admin.storage.from('agent-photos').getPublicUrl(storagePath)
    const photoUrl = urlData.publicUrl

    // Update profile with the correct column
    const column = PHOTO_COLUMN_MAP[photoType]
    await admin.from('profiles').update({ [column]: photoUrl }).eq('id', user.id)

    return NextResponse.json({ url: photoUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
