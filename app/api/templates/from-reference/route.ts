import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'

export const runtime = 'nodejs'
export const maxDuration = 60

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * Analyzes a reference image and generates a detailed style prompt
 * that can be used to create infographic-style designs matching
 * the reference aesthetic.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { referenceImage, description } = await request.json() as {
    referenceImage: string
    description?: string
  }

  if (!referenceImage) {
    return NextResponse.json({ error: 'Reference image required' }, { status: 400 })
  }

  try {
    const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: `You are a design system analyst. Analyze this reference image and create a detailed STYLE PROMPT that can be used to generate new infographic-style designs matching this aesthetic.

${description ? `User's description: "${description}"` : ''}

Analyze the image for:
1. Color palette (specific hex codes)
2. Typography style (serif/sans-serif, weight, tracking)
3. Layout approach (grid, asymmetric, centered, etc.)
4. Visual elements (shapes, patterns, icons, gradients, textures)
5. Overall mood and energy
6. Spacing and hierarchy approach

Return ONLY valid JSON (no markdown, no code fences):
{
  "stylePrompt": "A detailed 3-4 sentence prompt describing the exact visual style, layout approach, typography, color usage, and design elements to recreate this aesthetic. Be very specific — mention exact techniques like 'large bold sans-serif headlines in #1a1a2e with 5% letter-spacing' or 'rounded rectangle cards with 12px radius and subtle drop shadow'. This prompt will be fed to an AI image generator.",
  "name": "A short 2-3 word name for this style (e.g., 'Bold Corporate', 'Minimal Tech', 'Warm Editorial')",
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex"
  }
}` },
          { inlineData: { mimeType: match[1], data: match[2] } },
        ],
      }],
    })

    const text = response.text?.trim() ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    try {
      const data = JSON.parse(cleaned)
      return NextResponse.json({
        stylePrompt: data.stylePrompt,
        name: data.name,
        colors: data.colors,
      })
    } catch {
      return NextResponse.json({ error: 'Failed to analyze reference' }, { status: 500 })
    }
  } catch (err) {
    console.error('[templates/from-reference] Error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
