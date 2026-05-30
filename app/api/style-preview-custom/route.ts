import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import { checkCredits, deductCredits } from '../../_lib/credits'
import { isAdmin } from '../../_lib/admin'

export const runtime = 'nodejs'
export const maxDuration = 120

const PREVIEW_COST = 50 // credits for 2 AI-generated preview slides

/**
 * POST /api/style-preview-custom
 * User uploads a reference image, system generates cover + content preview
 * in that visual style using Gemini 3.1 Flash.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Credit check (skip for admin)
  if (!isAdmin(user.email)) {
    const creditCheck = await checkCredits(user.id, PREVIEW_COST)
    if (!creditCheck.allowed) {
      return NextResponse.json({
        error: `Style preview costs ${PREVIEW_COST} credits. You have ${creditCheck.remaining}.`,
      }, { status: 402 })
    }
  }

  const body = await request.json()
  const { referenceImageBase64, companyName, videoTitle } = body as {
    referenceImageBase64: string
    companyName?: string
    videoTitle?: string
  }

  if (!referenceImageBase64) {
    return NextResponse.json({ error: 'No reference image provided' }, { status: 400 })
  }

  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  try {
    // Step 1: Analyze the reference image style
    const analysisRes = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: 'Describe the visual style of this image in detail for recreating it. Include: color palette (exact hex codes if possible), typography style, layout approach, textures, mood, artistic technique. Be specific — this description will be used to generate new slides in the same style. 3-5 sentences.' },
          { inlineData: { mimeType: 'image/png', data: referenceImageBase64 } },
        ],
      }],
    })
    const styleDescription = analysisRes.candidates?.[0]?.content?.parts?.[0]?.text || 'Modern professional illustration style'
    console.log('[style-preview-custom] Style analyzed:', styleDescription.slice(0, 200))

    // Step 2: Generate cover preview
    const coverRes = await genai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: 'Generate this image: ' + styleDescription + ' 1920x1080 landscape. VIDEO COVER SLIDE. Display: Company name "' + (companyName || 'YOUR COMPANY').toUpperCase() + '" large, bold, centered, prominent. Title: "' + (videoTitle || 'Professional Video Presentation') + '" below. Subtitle: "A Personalized Video Presentation" smaller. Beautiful typography integrated into the artwork. No logos.',
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    let coverImage: string | null = null
    for (const part of coverRes.candidates![0].content!.parts!) {
      if (part.inlineData) {
        coverImage = `data:image/png;base64,${part.inlineData.data}`
        break
      }
    }

    // Step 3: Generate content preview
    const contentRes = await genai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: 'Generate this image: ' + styleDescription + ' 1920x1080 landscape. HEADLINE: "Key Highlights". Create a professional infographic showing: headline at top, a large key metric "$250,000" prominently displayed, three stat boxes at bottom: "10-Year Plan" | "$99/month" | "Guaranteed". Visual elements matching the style. Icons and data visualization.',
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    })

    let contentImage: string | null = null
    for (const part of contentRes.candidates![0].content!.parts!) {
      if (part.inlineData) {
        contentImage = `data:image/png;base64,${part.inlineData.data}`
        break
      }
    }

    if (!coverImage && !contentImage) {
      return NextResponse.json({ error: 'Failed to generate preview images' }, { status: 500 })
    }

    // Deduct credits (skip for admin)
    if (!isAdmin(user.email)) {
      await deductCredits(user.id, PREVIEW_COST, 'style_preview', undefined)
    }

    return NextResponse.json({
      previews: [coverImage, contentImage].filter(Boolean),
      styleDescription,
      creditsCost: PREVIEW_COST,
    })
  } catch (err) {
    console.error('[style-preview-custom] Error:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Preview generation failed',
    }, { status: 500 })
  }
}
