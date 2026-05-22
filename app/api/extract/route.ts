import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 120

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
          content: `Extract and structure content into JSON. Return:
{
  "title": "Main title",
  "subtitle": "Subtitle or tagline",
  "sections": [{ "title": "Section name", "content": "Section content" }],
  "keyMetrics": [{ "value": "stat value", "label": "stat label" }],
  "contactInfo": { "phone": null, "email": null, "website": null },
  "companyName": "Company name if mentioned"
}
Only include real data found in the content. Never invent contact info.`,
        }, {
          role: 'user',
          content: `${purpose ? `Purpose: ${purpose}\n\n` : ''}Content:\n${contentToStructure.slice(0, 15000)}`,
        }],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      })

      const structured = JSON.parse(structureRes.choices[0]?.message?.content || '{}')
      return NextResponse.json(structured)
    } catch (err) {
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
          content: `Extract and structure content into JSON. Return:
{
  "title": "Main title",
  "subtitle": "Subtitle or tagline",
  "sections": [{ "title": "Section name", "content": "Section content" }],
  "keyMetrics": [{ "value": "stat value", "label": "stat label" }],
  "contactInfo": { "phone": null, "email": null, "website": null },
  "companyName": "Company name if mentioned"
}
Only include real data found in the content. Never invent contact info.`,
        }, {
          role: 'user',
          content: `${purposeField ? `Purpose: ${purposeField}\n\n` : ''}Content:\n${text.slice(0, 15000)}`,
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
    const buffer = Buffer.from(arrayBuffer)
    const openai = getOpenAI()

    // Upload file to OpenAI for extraction
    const uploadedFile = await openai.files.create({
      file: new File([buffer], file.name || 'document.pdf', { type: file.type || 'application/pdf' }),
      purpose: 'assistants',
    })

    // Extract and structure using OpenAI with file attachment
    const purposeField = formData.get('purpose') as string | null
    const response = await (openai as any).responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'file', file: { file_id: uploadedFile.id } },
            {
              type: 'input_text',
              text: `${purposeField ? `Purpose: ${purposeField}\n\n` : ''}Extract and structure ALL content from this document into JSON. Return:
{
  "title": "Main title or document name",
  "subtitle": "Subtitle or tagline if any",
  "sections": [{ "title": "Section name", "content": "Full section content — do not summarize" }],
  "keyMetrics": [{ "value": "stat value", "label": "stat label" }],
  "contactInfo": { "phone": "phone if found or null", "email": "email if found or null", "website": "website if found or null" },
  "companyName": "Company name if mentioned or null"
}
Include ALL content. Do not skip sections. Never invent contact info. Return ONLY valid JSON.`,
            },
          ],
        },
      ],
      text: { format: { type: 'json_object' } },
    })

    const respText = response.output_text || ''
    const cleaned = respText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
    const structured = JSON.parse(cleaned)

    // Clean up uploaded file
    await openai.files.delete(uploadedFile.id).catch(() => {})

    return NextResponse.json(structured)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    if (message.includes('password') || message.includes('encrypted') || message.includes('protected')) {
      return NextResponse.json({ error: 'This PDF appears to be password-protected. Please upload an unprotected version.' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
