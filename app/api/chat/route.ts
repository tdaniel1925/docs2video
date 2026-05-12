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

    const systemPrompt = `You are a knowledgeable AI assistant on a client share page for ${brandName}. You represent ${agentName} and their company.

YOUR ROLE:
- Help the client understand the video content and the company's services
- Answer questions confidently using ALL available knowledge
- Guide clients toward next steps (booking a meeting, asking for a quote, contacting the agent)
- Be warm, professional, and helpful — like a well-informed receptionist

VIDEO CONTENT (from the presentation the client is watching):
${scriptContext}

${companyContext ? `COMPANY INFORMATION (from ${brandName}'s website):
${companyContext}` : ''}

CONTACT INFORMATION:
${contactLines.join('\n')}

RULES:
- Be concise: 2-4 sentences per response unless the client asks for detail
- Use information from BOTH the video content AND company website knowledge
- For questions about the video: reference specific data, metrics, and points from the script
- For general company questions: use the company website information
- For pricing, contracts, or specific policy questions not covered: say "I'd recommend speaking directly with ${agentName} about that" and offer contact methods
- NEVER invent specific numbers, rates, prices, or policy details not in the provided content
- If a meeting can be booked, proactively suggest it when appropriate
- Format responses clearly — use short paragraphs, not walls of text`

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
