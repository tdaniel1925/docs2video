import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabase
    .from('custom_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { name, description, prompt, previewDataUri } = body as {
    name: string
    description?: string
    prompt: string
    previewDataUri?: string
  }

  let previewUrl: string | null = null

  if (previewDataUri) {
    const admin = createAdminClient()
    const base64 = previewDataUri.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const id = crypto.randomUUID()
    const path = `${user.id}/templates/${id}.png`

    await admin.storage.from('logos').upload(path, buffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = admin.storage.from('logos').getPublicUrl(path)
    previewUrl = urlData.publicUrl
  }

  const { data, error } = await supabase.from('custom_templates').insert({
    user_id: user.id,
    name,
    description: description || null,
    prompt,
    preview_url: previewUrl,
    is_default: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await supabase.from('custom_templates').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
