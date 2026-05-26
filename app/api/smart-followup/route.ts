import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId, clientEmail, viewData } = await request.json()
  if (!videoId || !clientEmail) {
    return NextResponse.json({ error: 'Missing videoId or clientEmail' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get video info
  const { data: video } = await admin
    .from('videos')
    .select('title, user_id')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  // Get agent profile
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .single()

  // Get quote info if exists
  const { data: quote } = await admin
    .from('quotes')
    .select('client_name, status, total')
    .eq('video_id', videoId)
    .eq('client_email', clientEmail)
    .single()

  // Get view analytics for this client/video
  const { data: analytics } = await admin
    .from('video_analytics')
    .select('event_type, metadata, created_at')
    .eq('video_id', videoId)
    .order('created_at', { ascending: true })
    .limit(50)

  const clientName = quote?.client_name ?? clientEmail.split('@')[0]
  const agentName = profile?.full_name ?? 'Your advisor'
  const companyName = profile?.company_name ?? ''
  const videoTitle = video.title ?? 'your presentation'
  const quoteOpened = quote?.status && quote.status !== 'draft'

  // Build context for Gemini
  const viewContext = viewData ? JSON.stringify(viewData) : JSON.stringify(analytics ?? [])

  const prompt = `You are writing a short, personalized follow-up email from a professional (${agentName}${companyName ? ` at ${companyName}` : ''}) to their client (${clientName}).

Context:
- The video/presentation title: "${videoTitle}"
- Client email: ${clientEmail}
- Quote opened: ${quoteOpened ? 'Yes' : 'No'}
- Quote status: ${quote?.status ?? 'none'}
- View data/analytics: ${viewContext}

Write a brief, warm, professional follow-up email. Keep it to 3-4 sentences max. Be specific about what they viewed if the data shows it. Don't be pushy.

Return ONLY valid JSON (no markdown, no code fences):
{
  "subject": "email subject line",
  "body": "the email body as plain text"
}`

  try {
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const text = response.text?.trim() ?? ''
    // Strip code fences if present
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    const result = JSON.parse(cleaned)

    return NextResponse.json({
      subject: result.subject,
      body: result.body,
    })
  } catch (err) {
    console.error('[smart-followup] Gemini error:', err)
    // Fallback generic email
    return NextResponse.json({
      subject: `Following up: ${videoTitle}`,
      body: `Hi ${clientName},\n\nI wanted to follow up on the presentation I shared with you: "${videoTitle}". If you have any questions or would like to discuss, I'm happy to help.\n\nBest,\n${agentName}`,
    })
  }
}
