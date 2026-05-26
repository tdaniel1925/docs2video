import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'File must be JPG, PNG, WebP, or SVG' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })

  try {
    const ext = file.name.split('.').pop() ?? 'png'
    const storagePath = `${user.id}/logo.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const admin = createAdminClient()
    await admin.storage.from('logos').remove([storagePath]).catch(() => {})

    const { error: uploadError } = await admin.storage
      .from('logos')
      .upload(storagePath, buffer, { contentType: file.type, upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData } = admin.storage.from('logos').getPublicUrl(storagePath)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
