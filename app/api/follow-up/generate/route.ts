import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { videoId } = (await request.json()) as { videoId: string }
  if (!videoId) return NextResponse.json({ error: 'videoId is required' }, { status: 400 })

  // Load video with optional infographic policy data
  const { data: video } = await supabase
    .from('videos')
    .select('*, infographic:infographics(policy_data)')
    .eq('id', videoId)
    .single()

  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

  const title = video.title ?? 'Policy Explainer'
  const policyData = (video as any).infographic?.policy_data
  const script = video.script

  // Build context for the AI prompt
  let context = `Video title: "${title}"\n`
  if (policyData) {
    context += `Policy type: ${policyData.policyType}\n`
    context += `Carrier: ${policyData.carrier}\n`
    context += `Death benefit: $${policyData.deathBenefit?.toLocaleString()}\n`
    context += `Annual premium: $${policyData.annualPremium?.toLocaleString()}\n`
    if (policyData.riders?.length) context += `Riders: ${policyData.riders.join(', ')}\n`
  }
  if (script && Array.isArray(script)) {
    const narrations = script.map((s: any) => s.narration).filter(Boolean).join(' ')
    if (narrations) context += `Script summary: ${narrations.slice(0, 500)}\n`
  }

  const prompt = `You are an expert insurance sales follow-up email writer. An insurance agent just shared a personalized video presentation with a client. Based on the following video details, generate a 3-email follow-up sequence.

${context}

Generate exactly 3 follow-up emails as a JSON array. Each email must have:
- dayOffset: number (3, 7, or 14)
- subject: string (compelling, short)
- body: string (2-3 paragraphs, personalized to the content)
- tone: one of "friendly", "professional", "educational", or "soft-close"

Rules:
- Email 1 (day 3, tone "friendly"): A warm reminder that their personalized presentation is ready. Reference the specific content.
- Email 2 (day 7, tone "educational"): Share an educational insight related to the policy type. Help them understand the value.
- Email 3 (day 14, tone "soft-close"): A gentle follow-up asking if they have questions, offering to schedule a call.
- Use {{share_link}} as a placeholder for the video link
- Use {{agent_name}} as a placeholder for the agent's name
- Use {{client_name}} as a placeholder for the client's name
- Keep emails professional but warm
- Each body should be 2-3 short paragraphs separated by newlines

Return ONLY a valid JSON array, no markdown fences or extra text.`

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      console.error('[follow-up] Gemini error:', err)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse JSON from response — strip markdown fences if present
    const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
    const suggestions = JSON.parse(cleaned)

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })
    }

    return NextResponse.json({ suggestions })
  } catch (err: any) {
    console.error('[follow-up] Error:', err)
    return NextResponse.json({ error: err.message ?? 'Generation failed' }, { status: 500 })
  }
}
