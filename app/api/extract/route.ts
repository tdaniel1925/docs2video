import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { extractDocumentData } from '../../_lib/gemini'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'

export async function POST(request: Request & { nextUrl?: URL }) {
  const url = new URL(request.url)
  const uploadMode = url.searchParams.get('mode') || 'summarize'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = rateLimit(getRateLimitKey(user.id, 'extraction'), LIMITS.extraction.limit, LIMITS.extraction.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  // Check credits (skip for admin/beta users)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_beta, credits_remaining')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_beta && (!profile || profile.credits_remaining <= 0)) {
    return NextResponse.json({ error: 'No credits remaining' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
  ]
  const isPptx = file.name?.toLowerCase().endsWith('.pptx') || file.name?.toLowerCase().endsWith('.ppt')
  if (!ACCEPTED_TYPES.includes(file.type) && !isPptx) {
    return NextResponse.json({ error: 'File must be a PDF or PowerPoint file' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    let base64 = Buffer.from(arrayBuffer).toString('base64')

    // PPTX files must be converted to PDF first — Gemini can't read PPTX directly
    if (isPptx) {
      const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
      const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

      const convertRes = await fetch(`${VIDEO_ASSEMBLY_URL}/convert-to-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
        body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
        signal: AbortSignal.timeout(90000),
      })

      if (!convertRes.ok) {
        const err = await convertRes.json().catch(() => ({ error: 'Conversion failed' }))
        return NextResponse.json({ error: `PPTX conversion failed: ${err.error}` }, { status: 500 })
      }

      const convertData = await convertRes.json()
      base64 = convertData.pdfBase64
    }

    const preserveAllPages = uploadMode === 'narrate' || uploadMode === 'redesign'
    const result = await extractDocumentData(base64, 'application/pdf', preserveAllPages)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    // Detect common error patterns
    if (message.includes('password') || message.includes('encrypted') || message.includes('protected')) {
      return NextResponse.json({ error: 'This PDF appears to be password-protected. Please upload an unprotected version.' }, { status: 400 })
    }
    if (message.includes('too large') || message.includes('token') || message.includes('limit')) {
      return NextResponse.json({ error: 'This document is too large to process. Try uploading a shorter version or pasting the key sections.' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
