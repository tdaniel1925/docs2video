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

export async function POST(request: Request) {
  try {
    const { videoId, message } = (await request.json()) as { videoId: string; message: string }
    if (!videoId || !message) {
      return NextResponse.json({ error: 'Missing videoId or message' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Load video with brand
    const { data: video } = await supabase
      .from('videos')
      .select('title, script, status, user_id, brand:brands(name, primary_color, secondary_color, brand_guide_data)')
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

    // Load agent profile
    const { data: agent } = await supabase
      .from('profiles')
      .select('full_name, company_name, email, phone, calendly_url')
      .eq('id', video.user_id)
      .single()

    // Rate limiting
    const { count: messageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId)

    if (messageCount !== null && messageCount >= 50) {
      return NextResponse.json({ error: 'Chat limit reached. Please contact the agent directly.' }, { status: 429 })
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

    const brandArr = video.brand as any
    const brand = Array.isArray(brandArr) ? brandArr[0] : brandArr
    const brandName = brand?.name ?? agent?.company_name ?? 'the company'
    const brandGuide = brand?.brand_guide_data as Record<string, string> | null

    const agentName = agent?.full_name ?? 'the agent'
    const agentEmail = agent?.email ?? ''
    const agentPhone = agent?.phone ?? ''
    const calendlyUrl = agent?.calendly_url ?? ''

    const contactLines: string[] = []
    if (agentName) contactLines.push(`Agent: ${agentName}`)
    if (agentEmail) contactLines.push(`Email: ${agentEmail}`)
    if (agentPhone) contactLines.push(`Phone: ${agentPhone}`)
    if (calendlyUrl) contactLines.push(`Book a meeting: ${calendlyUrl}`)
    if (brandGuide?.website) contactLines.push(`Website: ${brandGuide.website}`)

    // Determine the document's topic domain for focus enforcement
    const topicDomain = video.title?.replace(/explainer$/i, '').trim() ?? brandName

    const systemPrompt = `You are an expert AI assistant for ${brandName}, specialized in the topic of "${topicDomain}". You are embedded on a client-facing page where a viewer is watching a presentation about this topic.

## YOUR IDENTITY
- You represent ${agentName} at ${brandName}
- You are deeply knowledgeable about ${topicDomain} and ${brandName}'s services
- You speak confidently, warmly, and professionally
- You are like a senior consultant who has reviewed the entire document and can discuss it intelligently

## SOURCE DOCUMENT CONTENT
This is the full content from the presentation. You know this material inside and out:

${scriptContext}

${companyContext ? `## COMPANY KNOWLEDGE (from ${brandName}'s website)
${companyContext}` : ''}

## CONTACT INFORMATION
${contactLines.join('\n')}
${calendlyUrl ? `\nThe client can book a meeting directly at: ${calendlyUrl}` : ''}

## HOW TO RESPOND

### For questions about the document/video:
- Reference SPECIFIC data points, metrics, and facts from the source content
- Quote exact numbers when available
- Explain complex concepts simply
- Connect different sections of the document when relevant

### For related topic questions:
- You CAN discuss general knowledge related to ${topicDomain} — industry trends, common concepts, best practices, terminology
- Always anchor back to the source document: "As shown in the presentation, [specific point]..."
- Use your general knowledge to ENHANCE understanding of the document, not replace it

### For questions you can't answer:
- If asked about specific pricing, contract terms, or details NOT in the document: "That's a great question — ${agentName} would be the best person to discuss specifics. You can reach them at ${agentEmail}${calendlyUrl ? ' or book a meeting directly.' : '.'}"
- NEVER make up numbers, rates, dates, or policy details

### STAY ON TOPIC:
- Your expertise is ${topicDomain} and ${brandName}'s services
- If asked about completely unrelated topics (politics, recipes, coding, etc.): "I'm here to help with questions about ${topicDomain} and ${brandName}'s services. Is there anything about that I can help with?"
- Brief friendly redirects, never rude

### GUIDE TOWARD ACTION:
- When appropriate, suggest next steps: booking a meeting, contacting ${agentName}, reviewing specific sections
- Be proactive: "Would you like me to explain the [specific section] in more detail?"
- If the client seems interested: "If you'd like to discuss this further, ${agentName} would love to connect${calendlyUrl ? ' — you can book a time directly on this page' : ''}."

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
