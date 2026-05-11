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

    // Load video data for context
    const { data: video } = await supabase
      .from('videos')
      .select('title, script, status, brand:brands(name)')
      .eq('id', videoId)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    if (video.status !== 'completed') {
      return NextResponse.json({ error: 'Video is not yet available' }, { status: 400 })
    }

    // Rate limiting: check total message count for this video
    const { count: messageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', videoId)

    if (messageCount !== null && messageCount >= 20) {
      return NextResponse.json({ error: 'Chat limit reached for this video. Please contact the agent directly.' }, { status: 429 })
    }

    // Load previous chat messages for context (last 10)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, message')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true })
      .limit(10)

    // Build context from video script
    const scriptContext = video.script
      ? (video.script as { narration: string; title: string }[])
          .map((s) => `${s.title}: ${s.narration}`)
          .join('\n\n')
      : 'No script available.'

    const brandArr = video.brand as { name: string }[] | { name: string } | null
    const brandName = (Array.isArray(brandArr) ? brandArr[0]?.name : brandArr?.name) ?? 'the agent'

    const systemPrompt = `You are a helpful AI assistant on a client share page for ${brandName}.
The client is viewing a personalized video titled "${video.title ?? 'Untitled'}".

Here is the content of the video for reference:
${scriptContext}

Answer the client's questions based on this content. Be concise, friendly, and professional.
If you don't know something that isn't in the content, say so honestly.
Do not make up policy numbers, rates, or financial details that aren't in the content.`

    const chatHistory = (history ?? []).map((m) => ({
      role: m.role === 'client' ? 'user' as const : 'model' as const,
      parts: [{ text: m.message }],
    }))

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I will help answer questions about this video content.' }] },
        ...chatHistory,
        { role: 'user', parts: [{ text: message }] },
      ],
    })

    const aiResponse = response.text?.trim() ?? 'I apologize, I was unable to generate a response.'

    // Save both messages to database
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
