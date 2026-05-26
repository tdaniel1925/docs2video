import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { logError } from '../../_lib/error-logger'
import OpenAI from 'openai'
import { CONTENT_STRUCTURING_SYSTEM_PROMPT } from '../../_lib/prompts'
import { sanitizeSourceData, wrapUserData } from '../../_lib/prompt-safety'
import { classifyFromText } from '../../_lib/document-classifier'

export const runtime = 'nodejs'
export const maxDuration = 300

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

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

  // Detect content type — JSON for text/idea, formData for file uploads
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    // Handle text paste and idea modes
    try {
      const body = await request.json()
      const { text, idea, audience, purpose } = body

      if (!text && !idea) {
        return NextResponse.json({ error: 'No content provided' }, { status: 400 })
      }

      const OpenAILib = (await import('openai')).default
      const openai = new OpenAILib({ apiKey: process.env.OPENAI_API_KEY! })

      let contentToStructure = ''
      if (text) {
        contentToStructure = text
      } else if (idea) {
        // Generate content from idea using AI
        const ideaRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Write comprehensive content about: "${idea}"${audience ? ` for audience: ${audience}` : ''}${purpose ? `. Purpose: ${purpose}` : ''}.
Include: overview, key points, benefits, relevant statistics or examples, and a conclusion. Write 500-1000 words of factual, useful content.`,
          }],
          temperature: 0.7,
          max_tokens: 2000,
        })
        contentToStructure = ideaRes.choices[0]?.message?.content || idea
      }

      // Structure the content using AI
      const structureRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: CONTENT_STRUCTURING_SYSTEM_PROMPT,
        }, {
          role: 'user',
          content: `${purpose ? `Purpose: ${purpose}\n\n` : ''}Content:\n${wrapUserData(contentToStructure.slice(0, 15000))}`,
        }],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      })

      const structured = JSON.parse(structureRes.choices[0]?.message?.content || '{}')

      // FIX 10: Validate AI output has required fields
      if (!structured.title) structured.title = purpose || idea || 'Untitled'
      if (!structured.sections && !structured.bulletPoints) {
        structured.sections = [{ heading: 'Overview', content: contentToStructure.slice(0, 500) }]
      }

      // FIX 5: Classify the content
      let classification = null
      try {
        classification = await classifyFromText(contentToStructure, purpose)
      } catch {
        // Classification is non-critical, continue without
      }

      return NextResponse.json({ ...structured, classification })
    } catch (err) {
      logError('extract-text', err, { userId: user.id })
      const message = err instanceof Error ? err.message : 'Extraction failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // File upload mode — formData
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 })
  }

  const fname = file.name?.toLowerCase() || ''
  const isTextFile = fname.endsWith('.txt') || fname.endsWith('.csv') ||
    file.type === 'text/plain' || file.type === 'text/csv'
  const isDocx = fname.endsWith('.docx') || fname.endsWith('.doc') ||
    file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  // For text-based files, read content and use AI structuring
  if (isTextFile) {
    try {
      const text = await file.text()
      if (!text || text.trim().length < 10) {
        return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 })
      }
      const purposeField = formData.get('purpose') as string | null
      const OpenAILib = (await import('openai')).default
      const openai = new OpenAILib({ apiKey: process.env.OPENAI_API_KEY! })
      const structureRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: CONTENT_STRUCTURING_SYSTEM_PROMPT,
        }, {
          role: 'user',
          content: `${purposeField ? `Purpose: ${purposeField}\n\n` : ''}Content:\n${wrapUserData(text.slice(0, 15000))}`,
        }],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      })
      const structured = JSON.parse(structureRes.choices[0]?.message?.content || '{}')
      return NextResponse.json(structured)
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to process text file' }, { status: 500 })
    }
  }

  const isPptx = fname.endsWith('.pptx') || fname.endsWith('.ppt')
  const isPdf = fname.endsWith('.pdf') || file.type === 'application/pdf'
  if (!isPdf && !isPptx && !isDocx) {
    return NextResponse.json({ error: 'Unsupported file type. Upload a PDF, PPTX, DOCX, TXT, or CSV.' }, { status: 400 })
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const purposeField = formData.get('purpose') as string | null
    const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
    const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

    // Send to VPS for extraction — no Vercel timeout limits
    const vpsRes = await fetch(`${VIDEO_ASSEMBLY_URL}/extract-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
      body: JSON.stringify({
        fileBase64: base64,
        fileName: file.name,
        purpose: purposeField || undefined,
        mimeType: file.type || 'application/pdf',
      }),
    })

    if (!vpsRes.ok) {
      const err = await vpsRes.json().catch(() => ({ error: 'VPS extraction failed' }))
      return NextResponse.json({ error: err.error || 'Document extraction failed' }, { status: vpsRes.status })
    }

    const structured = await vpsRes.json()
    return NextResponse.json(structured)
  } catch (err) {
    logError('extract-file', err, { userId: user.id, fileName: file.name })
    const message = err instanceof Error ? err.message : 'Extraction failed'
    if (message.includes('password') || message.includes('encrypted') || message.includes('protected')) {
      return NextResponse.json({ error: 'This PDF appears to be password-protected. Please upload an unprotected version.' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
