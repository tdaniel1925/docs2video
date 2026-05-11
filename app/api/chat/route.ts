import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createAdminClient } from '../../_lib/supabase/admin'

export const runtime = 'nodejs'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  try {
    const { videoId, message } = (await request.json()) as { videoId: string; message: string }
    if (!videoId || !message) {
      return NextResponse.json({ error: 'Missing videoId or message' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Load video with brand, company context, and agent profile
    const { data: video } = await supabase
      .from('videos')
      .select('title, script, status, company_context, user_id, brand:brands(name, primary_color, secondary_color, brand_guide_data)')
      .eq('id', videoId)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.status !== 'completed') {
      return NextResponse.json({ error: 'Video is not yet available' }, { status: 400 })
    }

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
      // Script hasn't been replaced yet — use pipeline input data
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

    // Build contact info block
    const contactLines: string[] = []
    if (agentName) contactLines.push(`Agent: ${agentName}`)
    if (agentEmail) contactLines.push(`Email: ${agentEmail}`)
    if (agentPhone) contactLines.push(`Phone: ${agentPhone}`)
    if (calendlyUrl) contactLines.push(`Book a meeting: ${calendlyUrl}`)
    if (brandGuide?.website) contactLines.push(`Website: ${brandGuide.website}`)
    if (brandGuide?.phone) contactLines.push(`Company phone: ${brandGuide.phone}`)

    // Company context from web scraping
    const companyContext = (video.company_context as string) ?? ''

    const systemPrompt = `You are a knowledgeable AI assistant on a client share page for ${brandName}. You represent ${agentName} and their company.

YOUR ROLE:
- Help the client understand the video content and the company's services
- Answer questions confidently using ALL available knowledge
- Guide clients toward next steps (booking a meeting, asking for a quote, contacting the agent)
- Be warm, professional, and helpful — like a well-informed receptionist

VIDEO CONTENT (from the presentation the client is watching):
${scriptContext}

${companyContext ? `COMPANY INFORMATION (from ${brandName}'s website — use this to answer general company questions):
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

    const chatHistory = (history ?? []).map((m) => ({
      role: m.role === 'client' ? 'user' as const : 'model' as const,
      parts: [{ text: m.message }],
    }))

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: `I understand. I'm the AI assistant for ${brandName}, ready to help clients with questions about the video and the company's services.` }] },
        ...chatHistory,
        { role: 'user', parts: [{ text: message }] },
      ],
    })

    const aiResponse = response.text?.trim() ?? 'I apologize, I was unable to generate a response.'

    // Save both messages
    await supabase.from('chat_messages').insert([
      { video_id: videoId, role: 'client', message },
      { video_id: videoId, role: 'assistant', message: aiResponse },
    ])

    return NextResponse.json({ response: aiResponse })
  } catch (err: unknown) {
    console.error('[chat] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
