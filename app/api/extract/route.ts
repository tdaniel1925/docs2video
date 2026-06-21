import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { resolveRequestUser } from '../../_lib/api-auth'
import { checkCredits } from '../../_lib/credits'
import { logError } from '../../_lib/error-logger'
import { videoServiceUrl } from '../../_lib/video-service'
import Anthropic from '@anthropic-ai/sdk'
import { CONTENT_STRUCTURING_SYSTEM_PROMPT } from '../../_lib/prompts'
import { sanitizeSourceData, wrapUserData } from '../../_lib/prompt-safety'
import { classifyFromText } from '../../_lib/document-classifier'

export const runtime = 'nodejs'
export const maxDuration = 300

function getClaude() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
}

export async function POST(request: Request & { nextUrl?: URL }) {
  const url = new URL(request.url)
  const uploadMode = url.searchParams.get('mode') || 'summarize'
  const supabase = await createClient()
  const resolved = await resolveRequestUser(request, async () => (await supabase.auth.getUser()).data.user)
  if (!resolved) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const user = { id: resolved.userId }

  const rl = rateLimit(getRateLimitKey(user.id, 'extraction'), LIMITS.extraction.limit, LIMITS.extraction.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  // Availability gate against the REAL wallet (credit_balances), not the dead
  // legacy profiles.credits_remaining. checkCredits handles admin/beta bypass
  // and past_due. Internal API calls are metered at the API layer — skip.
  if (!resolved.isInternal) {
    const credit = await checkCredits(user.id, 1)
    if (!credit.allowed) {
      return NextResponse.json({ error: 'No credits remaining' }, { status: 403 })
    }
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

      const claude = getClaude()

      let contentToStructure = ''
      if (text) {
        contentToStructure = text
      } else if (idea) {
        // Generate content from idea using AI
        const ideaRes = await claude.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Write comprehensive content about: "${idea}"${audience ? ` for audience: ${audience}` : ''}${purpose ? `. Purpose: ${purpose}` : ''}.
Include: overview, key points, benefits, relevant statistics or examples, and a conclusion. Write 500-1000 words of factual, useful content.`,
          }],
        })
        contentToStructure = ideaRes.content[0]?.type === 'text' ? ideaRes.content[0].text : idea
      }

      // Structure the content using AI
      const isTextTruncated = contentToStructure.length > 15000
      const truncatedContent = isTextTruncated
        ? `${contentToStructure.slice(0, 12000)}\n\n[... TRUNCATED: chars 12001–${contentToStructure.length - 3000} omitted (${contentToStructure.length - 15000} chars). Data tables in the middle section may be missing. ...]\n\n${contentToStructure.slice(-3000)}`
        : contentToStructure
      const structureRes = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: CONTENT_STRUCTURING_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `${purpose ? `Purpose: ${purpose}\n\n` : ''}Content:\n${wrapUserData(truncatedContent)}\n\nReturn ONLY valid JSON, no markdown code fences.`,
        }],
      })

      const rawText = structureRes.content[0]?.type === 'text' ? structureRes.content[0].text : '{}'
      const structured = JSON.parse(rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim())
      if (isTextTruncated) structured.truncated = true

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
      const isFileTruncated = text.length > 15000
      const truncatedText = isFileTruncated
        ? `${text.slice(0, 12000)}\n\n[... TRUNCATED: chars 12001–${text.length - 3000} omitted (${text.length - 15000} chars). Data tables in the middle section may be missing. ...]\n\n${text.slice(-3000)}`
        : text
      const claude = getClaude()
      const structureRes = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: CONTENT_STRUCTURING_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `${purposeField ? `Purpose: ${purposeField}\n\n` : ''}Content:\n${wrapUserData(truncatedText)}\n\nReturn ONLY valid JSON, no markdown code fences.`,
        }],
      })
      const rawText = structureRes.content[0]?.type === 'text' ? structureRes.content[0].text : '{}'
      const structured = JSON.parse(rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim())
      if (isFileTruncated) structured.truncated = true
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

    // PDFs: extract in-app with Claude (native PDF support, ~100 pages/32MB).
    // Keeps documents off OpenAI's Files API (the VPS path uploads them there).
    if (isPdf && arrayBuffer.byteLength <= 30 * 1024 * 1024) {
      try {
        const claude = getClaude()
        const structureRes = await claude.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: CONTENT_STRUCTURING_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: `${purposeField ? `Purpose: ${purposeField}\n\n` : ''}Extract and structure the content of this document. Return ONLY valid JSON, no markdown code fences.` },
            ],
          }],
        })
        const rawText = structureRes.content[0]?.type === 'text' ? structureRes.content[0].text : '{}'
        const structured = JSON.parse(rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim())
        return NextResponse.json(structured)
      } catch (claudeErr) {
        // Too many pages, parse failure, etc. — fall through to the VPS path
        console.warn('[extract] Claude PDF extraction failed, falling back to VPS:', claudeErr instanceof Error ? claudeErr.message : claudeErr)
      }
    }

    // DOCX/PPTX: extract text in-app (jszip) and structure with Claude —
    // keeps documents off OpenAI entirely (the VPS path uploaded them).
    if (isDocx || isPptx) {
      try {
        const { extractDocxText, extractPptxText } = await import('../../_lib/office-text')
        const buf = Buffer.from(arrayBuffer)
        const rawDocText = isDocx ? await extractDocxText(buf) : await extractPptxText(buf)
        if (!rawDocText || rawDocText.trim().length < 10) {
          throw new Error('Document appears to be empty or image-only')
        }
        const isTruncated = rawDocText.length > 15000
        const docText = isTruncated
          ? `${rawDocText.slice(0, 12000)}\n\n[... TRUNCATED ...]\n\n${rawDocText.slice(-3000)}`
          : rawDocText
        const claude = getClaude()
        const structureRes = await claude.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: CONTENT_STRUCTURING_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `${purposeField ? `Purpose: ${purposeField}\n\n` : ''}Content:\n${docText}\n\nReturn ONLY valid JSON, no markdown code fences.`,
          }],
        })
        const rawText = structureRes.content[0]?.type === 'text' ? structureRes.content[0].text : '{}'
        const structured = JSON.parse(rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim())
        if (isTruncated) structured.truncated = true
        return NextResponse.json(structured)
      } catch (officeErr) {
        // Parse failure / unusual file — fall through to the VPS path
        console.warn('[extract] In-app Office extraction failed, falling back to VPS:', officeErr instanceof Error ? officeErr.message : officeErr)
      }
    }

    const VIDEO_ASSEMBLY_URL = videoServiceUrl()
    const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

    // Last-resort fallback (oversized PDF, odd Office file): VPS extraction —
    // this uploads the document to OpenAI's Files API on the VPS side
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
