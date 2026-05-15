import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { extractDocumentData } from '../../_lib/gemini'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'extraction'), LIMITS.extraction.limit, LIMITS.extraction.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  // Check credits
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_remaining')
    .eq('id', user.id)
    .single()

  if (!profile || profile.credits_remaining <= 0) {
    return NextResponse.json({ error: 'No credits remaining' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const result = await extractDocumentData(base64)
    // Return both general and insurance data so the client can decide which to show
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
