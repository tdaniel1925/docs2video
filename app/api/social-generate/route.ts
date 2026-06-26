import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, CREDIT_COSTS } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * AI Social content engine. From a short brief/topic (+ optional platforms),
 * generate a caption (Claude) and a branded social IMAGE (Gemini) the user can
 * then post via /api/social-media/post. Generation uses NORMAL credits (the $50
 * add-on only covers posting). Image cost = the existing infographic rate.
 *
 * Body: { topic, platforms?: string[], wantImage?: boolean, brandId?, videoUrl? }
 * Returns: { caption, hashtags, imageUrl?, videoUrl? }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { topic, platforms, wantImage, brandId, videoUrl } = await request.json() as {
    topic: string; platforms?: string[]; wantImage?: boolean; brandId?: string; videoUrl?: string
  }
  if (!topic?.trim()) return NextResponse.json({ error: 'Tell us what the post is about.' }, { status: 400 })

  // Add-on gate.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('social_addon_active').eq('id', user.id).single()
  if (!profile?.social_addon_active) {
    return NextResponse.json({ error: 'The Social add-on is not active on your account.', code: 'addon_required' }, { status: 402 })
  }

  // Charge for the image up front (caption is cheap; bundle it into the image cost).
  const COST = wantImage ? CREDIT_COSTS.infographic : 50
  const credit = await checkCredits(user.id, COST)
  if (!credit.allowed) return NextResponse.json({ error: `Not enough credits. Need ${COST}.` }, { status: 402 })
  if (!(await deductCredits(user.id, COST, 'social_generate'))) {
    return NextResponse.json({ error: 'Credit deduction failed.' }, { status: 402 })
  }

  try {
    // 1) Caption + hashtags via Claude (platform-aware).
    const key = process.env.ANTHROPIC_API_KEY
    let caption = topic.trim()
    let hashtags: string[] = []
    if (key) {
      const anthropic = new Anthropic({ apiKey: key })
      const sys = `You write punchy, on-brand SOCIAL MEDIA captions. Given a topic, produce ONE engaging caption (1-3 short sentences, a hook + value + soft CTA) plus 3-6 relevant hashtags. Match the platforms if given. Return ONLY JSON: {"caption":"...","hashtags":["..."]}. No markdown.`
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 500, system: sys,
        messages: [{ role: 'user', content: `Topic: ${topic}\nPlatforms: ${(platforms || []).join(', ') || 'general'}` }],
      })
      const text = r.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('')
      try {
        const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
        if (j.caption) caption = String(j.caption)
        if (Array.isArray(j.hashtags)) hashtags = j.hashtags.map((h: any) => String(h))
      } catch { /* keep fallback caption */ }
    }

    // 2) Optional branded social image via Gemini (reuses the flyer flat-art approach).
    let imageUrl: string | undefined
    if (wantImage) {
      let colors = ''
      if (brandId) {
        const { data: brand } = await admin.from('brands').select('primary_color,secondary_color,accent_color,name').eq('id', brandId).single()
        if (brand) colors = `Brand colors — primary ${brand.primary_color}, secondary ${brand.secondary_color}, accent ${brand.accent_color}.${brand.name ? ` Brand: ${brand.name}.` : ''}`
      }
      const prompt = `Design a FLAT, full-bleed social media graphic (square 1:1) about: "${topic}". This is the artwork ITSELF — NO mockup, device frame, desk, shadow, or perspective. Bold, scroll-stopping, modern editorial design with a clear focal point and strong typography. ${colors} Real legible text only, no lorem ipsum.`
      try {
        const resp = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { responseFormat: { image: { aspectRatio: '1:1', imageSize: '2K' } } } as any,
        })
        const part = (resp.candidates?.[0]?.content?.parts || []).find((p: any) => p.inlineData?.data)
        if (part?.inlineData?.data) {
          const buf = Buffer.from(part.inlineData.data, 'base64')
          const path = `${user.id}/social/${Date.now()}.png`
          await admin.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
          imageUrl = admin.storage.from('videos').getPublicUrl(path).data.publicUrl
        }
      } catch (e) {
        console.error('[social-generate] image gen failed (non-fatal):', e)
      }
    }

    return NextResponse.json({ caption, hashtags, imageUrl, videoUrl })
  } catch (err) {
    await deductCredits(user.id, -COST, 'social_generate_refund').catch(() => {})
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 })
  }
}
