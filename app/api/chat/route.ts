import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  return new Anthropic({ apiKey: key })
}

// Simple in-memory IP rate limiter (resets on redeploy)
const ipCounts = new Map<string, { count: number; resetAt: number }>()
const IP_LIMIT = 30 // max messages per IP per hour
const IP_WINDOW = 60 * 60 * 1000 // 1 hour

export async function POST(request: Request) {
  try {
    // IP-based rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const now = Date.now()
    const ipData = ipCounts.get(ip)
    if (ipData && ipData.resetAt > now) {
      if (ipData.count >= IP_LIMIT) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
      }
      ipData.count++
    } else {
      ipCounts.set(ip, { count: 1, resetAt: now + IP_WINDOW })
    }

    const { videoId, message } = (await request.json()) as { videoId: string; message: string }
    if (!videoId || !message || message.length > 2000) {
      return NextResponse.json({ error: 'Missing videoId or message (max 2000 chars)' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Load video with brand
    const { data: video } = await supabase
      .from('videos')
      .select('title, script, status')
      .eq('id', videoId)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.status !== 'completed') {
      return NextResponse.json({ error: 'Video is not yet available' }, { status: 400 })
    }

    // Try to get company_context (column may not exist)
    let companyContext = ''
    try {
      const { data: ctxData } = await supabase
        .from('videos')
        .select('company_context')
        .eq('id', videoId)
        .single()
      companyContext = (ctxData as any)?.company_context ?? ''
    } catch { /* column may not exist */ }

    // Rate limiting
    const { count: messageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId)

    if (messageCount !== null && messageCount >= 50) {
      return NextResponse.json({ error: 'Chat limit reached for this video.' }, { status: 429 })
    }

    // Load chat history (last 15)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, message')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true })
      .limit(15)

    // Build video content context
    const scriptData = video.script as any
    let scriptContext = 'No script available.'
    if (Array.isArray(scriptData)) {
      scriptContext = scriptData
        .map((s: any) => `${s.title || s.scene}: ${s.narration}`)
        .join('\n\n')
    } else if (scriptData?._pipeline_input) {
      const input = scriptData._pipeline_input
      if (input.policyData) {
        const pd = input.policyData
        scriptContext = `Document: ${pd.title || pd.policyType || 'Untitled'}\n`
        if (pd.sections) {
          scriptContext += pd.sections.map((s: any) => `${s.title}: ${s.content}`).join('\n')
        }
        if (pd.keyMetrics) {
          scriptContext += '\nKey metrics: ' + pd.keyMetrics.map((m: any) => `${m.label}: ${m.value}`).join(', ')
        }
      }
    }

    // Determine the document's topic domain for focus enforcement
    const topicDomain = video.title?.replace(/explainer$/i, '').trim() ?? 'this document'

    const systemPrompt = `You are a knowledgeable expert on the specific document content presented in this video. You have deep understanding of every detail in this document and can answer questions about it thoroughly.

## YOUR IDENTITY
- You are a document content expert — you know this material inside and out
- You speak confidently, clearly, and professionally
- You ONLY discuss the content of this document and closely related concepts needed to understand it

## STRICT PRIVACY RULES — NEVER VIOLATE THESE
- NEVER reveal the name, email, phone number, or any personal information of the video creator or anyone associated with this content
- NEVER suggest contacting anyone by name or email
- NEVER say things like "contact [person]" or "reach out to [person]"
- NEVER say "I can't edit the video" or similar — you are not a video editor, you are a document expert
- If asked who created the video or for contact info, say: "I'm here to help you understand the document content. I don't have information about the creator."

## SOURCE DOCUMENT CONTENT
This is the full content from the document. You know this material completely:

${scriptContext}

${companyContext ? `## ADDITIONAL CONTEXT
${companyContext}` : ''}

## HOW TO RESPOND

### For questions about the document content:
- Reference SPECIFIC data points, metrics, and facts from the source content
- Quote exact numbers when available
- Explain complex concepts simply
- Connect different sections of the document when relevant

### For questions that help understand the document:
- You CAN briefly explain general concepts that help the viewer understand the document content better
- Always anchor back to the document: "As covered in the presentation, [specific point]..."
- Keep general knowledge minimal — only enough to clarify what's in the document

### For questions outside the document scope:
- Say: "I can only discuss the content presented in this video. Is there something about the document I can help you understand?"
- NEVER make up numbers, rates, dates, or details not found in the document
- NEVER speculate about information not contained in the document

## FORMAT
- 2-4 sentences for simple questions
- Up to a short paragraph for complex explanations
- Use clear language, avoid jargon unless explaining it
- No markdown formatting (this renders as plain text in chat)`

    // Build messages for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    for (const m of (history ?? [])) {
      messages.push({
        role: m.role === 'client' ? 'user' : 'assistant',
        content: m.message,
      })
    }
    messages.push({ role: 'user', content: message })

    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const aiResponse = response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : 'I apologize, I was unable to generate a response.'

    // Save both messages (non-blocking)
    supabase.from('chat_messages').insert([
      { video_id: videoId, role: 'client', message },
      { video_id: videoId, role: 'assistant', message: aiResponse },
    ]).then(({ error }) => {
      if (error) console.error('[chat] Failed to save messages:', error.message)
    })

    return NextResponse.json({ response: aiResponse })
  } catch (err: unknown) {
    console.error('[chat] Error:', err)
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[chat] Details:', JSON.stringify({ message: errMsg, stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined }))
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
