import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { getTopGoogleFonts } from '../../_lib/google-fonts'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// ── System prompt for Marcus ──

const MARCUS_SYSTEM_PROMPT = `You are Marcus, a senior logo designer with 15 years at Pentagram and Collins. You are conducting a discovery session. You ask ONE question at a time. You are specific, opinionated, and reference real design.

YOUR FLOW (follow exactly):
1. The user just told you their company name and what they do. Respond acknowledging it — reference a real brand in their space as a benchmark. Then ask: "Who's your ideal customer? Paint me a picture of them."
2. After they describe the audience, acknowledge and ask: "Drop me 2-3 logos you love — from any industry. I want to see your taste." (They may paste/upload images or describe them in text.)
3. After they share references (or skip), acknowledge what you see in the references. Then ask: "What feeling should your logo trigger? Pick two:" and set showMoodChips to true in your response.
4. After they pick moods, summarize everything: "Here's what I'm hearing: [2-3 sentence summary of brand, audience, personality, aesthetic direction]. I have 3 creative directions in mind. Let me show you." Then set readyForDirection to true and populate the full designBrief.

That is 4-5 exchanges total. No more.

WHEN USER UPLOADS A REFERENCE IMAGE:
- Analyze it like a designer: identify typeface style, color palette, spacing, mood
- Be specific about what you will draw from it

RESPONSE FORMAT — respond with ONLY valid JSON, no markdown, no code fences:
{"reply":"your message","designBrief":null,"readyForDirection":false,"showMoodChips":false}

When ready (final exchange):
{"reply":"your summary","designBrief":{"name":"...","industry":"...","audience":"...","personality":"...","moodWords":["word1","word2"],"referenceNotes":"...","colorPrefs":"Primary: #hex, Accent: #hex"},"readyForDirection":true,"showMoodChips":false}

CRITICAL: The "reply" field is shown to the user. Keep it natural and conversational. Never expose JSON, hex codes, or technical details in the reply. Those go in designBrief only.`

// ── Direction generation prompt ──

function buildDirectionPrompt(brief: Record<string, any>) {
  return `You are a senior logo designer. Given this brand brief, suggest specific design details for 3 creative directions.

BRAND BRIEF:
${JSON.stringify(brief, null, 2)}

For each direction, suggest:
1. WORDMARK: A specific Google Font (from the list below), weight, letter-spacing value, a specific letter modification, and 2 hex colors.
2. SYMBOL: A specific geometric shape description tied to the brand, a Google Font for the name, and 2 hex colors.
3. COMBINATION: A specific icon description, a Google Font, and 2 hex colors.

Each direction should have DIFFERENT fonts and DIFFERENT color palettes. Colors should match the brand personality.

AVAILABLE GOOGLE FONTS:
%%GOOGLE_FONTS_LIST%%

Respond with ONLY valid JSON:
{
  "wordmark": { "font": "Font Name", "weight": "600", "letterSpacing": "+3%", "letterMod": "The letter 'a' has a...", "primaryColor": "#hex", "accentColor": "#hex" },
  "symbol": { "shapeDescription": "A...", "font": "Font Name", "weight": "500", "primaryColor": "#hex", "accentColor": "#hex" },
  "combination": { "iconDescription": "A...", "font": "Font Name", "weight": "500", "primaryColor": "#hex", "accentColor": "#hex" }
}`
}

// ── Concept prompt builders ──

type DirectionType = 'wordmark' | 'symbol' | 'combination'

const CONCEPT_VARIATIONS = [
  { style: 'refined and minimal', fontWeight: '500', spacing: 'generous' },
  { style: 'bold and confident', fontWeight: '700', spacing: 'tight' },
  { style: 'elegant and distinctive', fontWeight: '400', spacing: 'wide' },
  { style: 'modern and geometric', fontWeight: '600', spacing: 'balanced' },
]

function buildWordmarkPrompt(
  name: string,
  brief: Record<string, any>,
  directions: any,
  variation: typeof CONCEPT_VARIATIONS[number],
  variationIndex: number,
) {
  const d = directions.wordmark
  // Vary the font weight and colors slightly per concept
  const colorShifts = ['', ' with slightly warmer tones', ' with cooler undertones', ' with deeper saturation']

  return `Create a wordmark logo for "${name}". Typography only, no icon, no symbol, no graphic element whatsoever.

FONT: ${d.font} in weight ${variation.fontWeight}.
LETTER-SPACING: ${variation.spacing} tracking.
CUSTOM TOUCH: ${d.letterMod}
PRIMARY COLOR: ${d.primaryColor}${colorShifts[variationIndex]}
BACKGROUND: Pure white (#FFFFFF).

STYLE: ${variation.style}

RULES:
- The word "${name}" is the ONLY element. Nothing else.
- Centered horizontally and vertically on a square canvas.
- High resolution, crisp vector-quality edges.
- No decoration, no tagline, no additional elements, no icon, no underlines, no borders.
- No gradients, no shadows, no 3D effects.
- Must be legible at 16px width.
- Square format, 1:1 aspect ratio.`
}

function buildSymbolPrompt(
  name: string,
  brief: Record<string, any>,
  directions: any,
  variation: typeof CONCEPT_VARIATIONS[number],
  variationIndex: number,
) {
  const d = directions.symbol
  const geometryVariations = [
    d.shapeDescription,
    `A simplified version of ${d.shapeDescription} using only straight lines`,
    `${d.shapeDescription} constructed from overlapping circles`,
    `A negative-space interpretation of ${d.shapeDescription}`,
  ]

  return `Create a logo with an abstract geometric symbol for "${name}".

SYMBOL: ${geometryVariations[variationIndex]}
The symbol must be simple enough to work at 16px.

BELOW THE SYMBOL: The company name "${name}" in ${d.font} weight ${variation.fontWeight}.

SYMBOL COLOR: ${d.primaryColor}
TEXT COLOR: ${d.accentColor}
BACKGROUND: Pure white (#FFFFFF).

STYLE: ${variation.style}

RULES:
- Symbol above, text below, both centered.
- Generous spacing between symbol and text.
- Clean, minimal — no gradients, no shadows, no outlines.
- High resolution, crisp vector-quality edges.
- Square format, 1:1 aspect ratio.
- No tagline, no additional elements.`
}

function buildCombinationPrompt(
  name: string,
  brief: Record<string, any>,
  directions: any,
  variation: typeof CONCEPT_VARIATIONS[number],
  variationIndex: number,
) {
  const d = directions.combination
  const iconVariations = [
    d.iconDescription,
    `A simplified outline version of ${d.iconDescription}`,
    `${d.iconDescription} using bold filled shapes`,
    `A minimal single-stroke interpretation of ${d.iconDescription}`,
  ]

  return `Create a combination logo for "${name}".

LEFT SIDE: ${iconVariations[variationIndex]} in ${d.primaryColor}.
RIGHT SIDE: Company name "${name}" in ${d.font} weight ${variation.fontWeight} in ${d.accentColor}.

The icon and text are vertically centered with generous spacing between them.
BACKGROUND: Pure white (#FFFFFF).

STYLE: ${variation.style}

RULES:
- Horizontal lockup: icon left, text right.
- Icon should be roughly the same height as the text.
- Clean, minimal — no gradients, no shadows, no outlines.
- High resolution, crisp vector-quality edges.
- Square format, 1:1 aspect ratio.
- No tagline, no additional elements, no borders.`
}

// ── Concept description generator ──

function buildDescriptionPrompt(direction: DirectionType, variationIndex: number) {
  return `You are a senior logo designer. In 1-2 sentences, describe what makes this logo concept unique. Be specific about the design choices. This is concept ${variationIndex + 1} of 4 in the "${direction}" style direction. Return ONLY the description text, no JSON.`
}

// ── Helper: upload base64 image to Supabase ──

async function uploadToSupabase(admin: any, base64Data: string, userId: string, filename: string): Promise<string | null> {
  try {
    const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!match) return null

    const buffer = Buffer.from(match[2], 'base64')
    const path = `logos/${userId}/${filename}`

    const { error } = await admin.storage.from('creations').upload(path, buffer, {
      contentType: `image/${match[1]}`,
      upsert: true,
    })
    if (error) return null

    const { data: urlData } = admin.storage.from('creations').getPublicUrl(path)
    return urlData?.publicUrl ?? null
  } catch {
    return null
  }
}

// ── Route handler ──

type MessagePayload = {
  role: 'user' | 'assistant'
  content: string
  referenceImage?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { action } = body as { action: string }

  // ═══════════════════════════════════════════════════════════════
  // ACTION: chat
  // ═══════════════════════════════════════════════════════════════
  if (action === 'chat') {
    const { messages, designBrief, referenceImages, selectedMoods } = body as {
      messages: MessagePayload[]
      designBrief: Record<string, any> | null
      referenceImages?: string[]
      selectedMoods?: string[]
    }

    try {
      const googleFonts = await getTopGoogleFonts(300)
      const systemPrompt = MARCUS_SYSTEM_PROMPT + `\n\nAvailable Google Fonts: ${googleFonts.join(', ')}`

      const contents: any[] = []

      // System as first user turn
      contents.push({
        role: 'user',
        parts: [{
          text: systemPrompt
            + (designBrief ? `\n\nCurrent design brief so far: ${JSON.stringify(designBrief)}` : '')
            + (selectedMoods?.length ? `\n\nUser selected mood words: ${selectedMoods.join(', ')}` : ''),
        }],
      })
      contents.push({
        role: 'model',
        parts: [{ text: '{"reply":"Understood. Ready to design.","designBrief":null,"readyForDirection":false,"showMoodChips":false}' }],
      })

      // Conversation history
      for (const msg of messages) {
        const parts: any[] = []
        if (msg.content) parts.push({ text: msg.content })
        if (msg.referenceImage) {
          const base64Match = msg.referenceImage.match(/^data:image\/(\w+);base64,(.+)$/)
          if (base64Match) {
            parts.push({ inlineData: { mimeType: `image/${base64Match[1]}`, data: base64Match[2] } })
            parts.push({ text: '(User uploaded a reference image. Analyze its style, colors, typography, mood — and explain what you will draw from it.)' })
          }
        }
        if (parts.length > 0) {
          contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts })
        }
      }

      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
      })

      const text = response.text?.trim() ?? ''
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

      try {
        const parsed = JSON.parse(cleaned)
        return NextResponse.json({
          reply: parsed.reply,
          designBrief: parsed.designBrief || designBrief,
          readyForDirection: parsed.readyForDirection || false,
          showMoodChips: parsed.showMoodChips || false,
        })
      } catch {
        let cleanReply = text.replace(/\{[\s\S]*\}/g, '').replace(/```[\s\S]*```/g, '').trim()
        if (!cleanReply) cleanReply = "Let me think about that — tell me more about your brand."
        return NextResponse.json({
          reply: cleanReply,
          designBrief,
          readyForDirection: false,
          showMoodChips: false,
        })
      }
    } catch (err) {
      console.error('[logo-chat] Chat error:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Chat failed' }, { status: 500 })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION: generate-directions
  // ═══════════════════════════════════════════════════════════════
  if (action === 'generate-directions') {
    const { designBrief } = body as { designBrief: Record<string, any> }
    if (!designBrief) return NextResponse.json({ error: 'Design brief required' }, { status: 400 })

    try {
      const googleFonts = await getTopGoogleFonts(300)
      const prompt = buildDirectionPrompt(designBrief).replace('%%GOOGLE_FONTS_LIST%%', googleFonts.join(', '))

      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })

      const text = response.text?.trim() ?? ''
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      const directions = JSON.parse(cleaned)

      return NextResponse.json({ directions })
    } catch (err) {
      console.error('[logo-chat] Direction generation error:', err)
      return NextResponse.json({ error: 'Failed to generate directions' }, { status: 500 })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION: generate-concepts (one at a time)
  // ═══════════════════════════════════════════════════════════════
  if (action === 'generate-concepts') {
    const { designBrief, direction, conceptIndex, referenceImages } = body as {
      designBrief: Record<string, any>
      direction: DirectionType
      conceptIndex: number
      referenceImages?: string[]
    }

    if (!designBrief || !direction || conceptIndex === undefined) {
      return NextResponse.json({ error: 'designBrief, direction, and conceptIndex required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const name = designBrief.name || 'Brand'
    const variation = CONCEPT_VARIATIONS[conceptIndex] || CONCEPT_VARIATIONS[0]

    // First, get direction-specific details from Gemini
    let directions: any
    try {
      const googleFonts = await getTopGoogleFonts(300)
      const dirPrompt = buildDirectionPrompt(designBrief).replace('%%GOOGLE_FONTS_LIST%%', googleFonts.join(', '))

      const dirResponse = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: dirPrompt }] }],
      })

      const dirText = dirResponse.text?.trim() ?? ''
      const dirCleaned = dirText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      directions = JSON.parse(dirCleaned)
    } catch {
      // Fallback directions
      directions = {
        wordmark: { font: 'Inter', weight: '600', letterSpacing: '+3%', letterMod: "The letter 'a' has an open counter", primaryColor: '#1a1a2e', accentColor: '#4a7c59' },
        symbol: { shapeDescription: 'An abstract geometric form', font: 'DM Sans', weight: '500', primaryColor: '#2563eb', accentColor: '#1a1a2e' },
        combination: { iconDescription: 'A minimal abstract shape', font: 'Plus Jakarta Sans', weight: '500', primaryColor: '#2563eb', accentColor: '#1a1a2e' },
      }
    }

    // Build the prompt based on direction type
    let prompt: string
    if (direction === 'wordmark') {
      prompt = buildWordmarkPrompt(name, designBrief, directions, variation, conceptIndex)
    } else if (direction === 'symbol') {
      prompt = buildSymbolPrompt(name, designBrief, directions, variation, conceptIndex)
    } else {
      prompt = buildCombinationPrompt(name, designBrief, directions, variation, conceptIndex)
    }

    // Analyze references if available
    if (referenceImages && referenceImages.length > 0) {
      try {
        const refParts: any[] = [
          { text: 'Briefly describe the visual style, colors, typography, and mood of these reference images in 2 sentences.' },
        ]
        for (const ref of referenceImages) {
          const match = ref.match(/^data:image\/(\w+);base64,(.+)$/)
          if (match) refParts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } })
        }
        const refRes = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: refParts }],
        })
        const refDesc = refRes.text?.trim() ?? ''
        if (refDesc) {
          prompt += `\n\nThe client provided reference images showing: ${refDesc}\nIncorporate the aesthetic but create an ORIGINAL logo.`
        }
      } catch {
        // Continue without reference analysis
      }
    }

    // Generate the logo image
    const parts: any[] = [{ text: prompt }]
    if (referenceImages) {
      for (const ref of referenceImages) {
        const match = ref.match(/^data:image\/(\w+);base64,(.+)$/)
        if (match) parts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } })
      }
    }

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts }],
        config: {
          responseFormat: {
            image: { aspectRatio: '1:1', imageSize: '1024' },
          },
        } as any,
      })

      const responseParts = response.candidates?.[0]?.content?.parts ?? []
      let imageData: string | null = null

      for (const rp of responseParts) {
        if (rp.inlineData) {
          imageData = `data:image/png;base64,${rp.inlineData.data}`
          break
        }
      }

      if (!imageData) throw new Error('No image returned')

      // Generate description
      let description = `Concept ${conceptIndex + 1}: ${variation.style} approach.`
      try {
        const descRes = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [
              { text: buildDescriptionPrompt(direction, conceptIndex) },
              { inlineData: { mimeType: 'image/png', data: imageData.replace(/^data:image\/\w+;base64,/, '') } },
            ],
          }],
        })
        description = descRes.text?.trim() ?? description
      } catch {
        // Use fallback description
      }

      // Upload to Supabase
      const timestamp = Date.now()
      await uploadToSupabase(admin, imageData, user.id, `concept-${conceptIndex}-${timestamp}.png`)

      // Log creation on first concept
      if (conceptIndex === 0) {
        try {
          await admin.from('creations').insert({
            user_id: user.id,
            type: 'logo',
            title: `Logo: ${name}`,
          })
        } catch { /* ignore */ }
      }

      return NextResponse.json({ image: imageData, description })
    } catch (err) {
      console.error(`[logo-chat] Concept ${conceptIndex + 1} generation failed:`, err)
      return NextResponse.json({ error: `Concept generation failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 500 })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION: refine
  // ═══════════════════════════════════════════════════════════════
  if (action === 'refine') {
    const { designBrief, direction, feedback, currentLogo, referenceImages } = body as {
      designBrief: Record<string, any>
      direction: string
      feedback: string
      currentLogo: string
      referenceImages?: string[]
    }

    if (!currentLogo || !feedback) {
      return NextResponse.json({ error: 'Current logo and feedback required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Generate conversational reply
    let refinementReply = 'Making those adjustments now.'
    try {
      const chatRes = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `You are Marcus, a senior logo designer. The client wants this change: "${feedback}". Respond in 1-2 sentences acknowledging the change and what you did. Be conversational and confident. Return ONLY the reply text, no JSON.` }],
        }],
      })
      refinementReply = chatRes.text?.trim() ?? refinementReply
    } catch {
      // Use fallback
    }

    const logoMatch = currentLogo.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!logoMatch) {
      return NextResponse.json({ error: 'Invalid logo data' }, { status: 400 })
    }

    const promptText = `This is the current logo. The client wants this change: "${feedback}".

Modify ONLY what was requested. Keep everything else identical. Same composition, same style, same colors unless specifically asked to change them.

${designBrief ? `COMPANY: ${designBrief.name}\nINDUSTRY: ${designBrief.industry}` : ''}

STRICT RULES:
- Output the modified logo on a clean white background (#FFFFFF).
- Centered with generous padding.
- Text must be crisp, perfectly spelled, and legible.
- Professional vector-quality appearance.
- NO mockups, NO business cards, NO background scenes — JUST the logo.
- Square format, 1:1 aspect ratio.`

    const parts: any[] = [
      { text: promptText },
      { inlineData: { mimeType: `image/${logoMatch[1]}`, data: logoMatch[2] } },
    ]

    if (referenceImages) {
      for (const ref of referenceImages) {
        const match = ref.match(/^data:image\/(\w+);base64,(.+)$/)
        if (match) parts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } })
      }
    }

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts }],
        config: {
          responseFormat: {
            image: { aspectRatio: '1:1', imageSize: '1024' },
          },
        } as any,
      })

      const responseParts = response.candidates?.[0]?.content?.parts ?? []
      for (const rp of responseParts) {
        if (rp.inlineData) {
          const image = `data:image/png;base64,${rp.inlineData.data}`

          // Upload to Supabase
          const timestamp = Date.now()
          await uploadToSupabase(admin, image, user.id, `refine-${timestamp}.png`)

          try {
            await admin.from('creations').insert({
              user_id: user.id,
              type: 'logo',
              title: `Logo refine: ${designBrief?.name ?? 'logo'}`,
            })
          } catch { /* ignore */ }

          return NextResponse.json({ image, reply: refinementReply })
        }
      }

      throw new Error('No image returned from refinement')
    } catch (err) {
      console.error('[logo-chat] Refinement failed:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Refinement failed' }, { status: 500 })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTION: generate-dark-version
  // ═══════════════════════════════════════════════════════════════
  if (action === 'generate-dark-version') {
    const { currentLogo, designBrief } = body as {
      currentLogo: string
      designBrief: Record<string, any>
    }

    if (!currentLogo) {
      return NextResponse.json({ error: 'Current logo required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const logoMatch = currentLogo.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!logoMatch) {
      return NextResponse.json({ error: 'Invalid logo data' }, { status: 400 })
    }

    const promptText = `This is a logo on a white background. Generate the EXACT same logo but on a dark background (#1a1a2e).

Adjust the logo colors so it is clearly visible on the dark background:
- If the logo has dark text, make the text white or light.
- If the logo has dark-colored elements, lighten them appropriately.
- Keep the same composition, same layout, same proportions.
- The logo should look just as polished on dark as on white.

${designBrief ? `COMPANY: ${designBrief.name}` : ''}

RULES:
- Background: dark navy (#1a1a2e)
- Centered with generous padding
- Square format, 1:1 aspect ratio
- Same size and position as the original
- Crisp, vector-quality`

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{
          role: 'user',
          parts: [
            { text: promptText },
            { inlineData: { mimeType: `image/${logoMatch[1]}`, data: logoMatch[2] } },
          ],
        }],
        config: {
          responseFormat: {
            image: { aspectRatio: '1:1', imageSize: '1024' },
          },
        } as any,
      })

      const responseParts = response.candidates?.[0]?.content?.parts ?? []
      for (const rp of responseParts) {
        if (rp.inlineData) {
          const image = `data:image/png;base64,${rp.inlineData.data}`

          const timestamp = Date.now()
          await uploadToSupabase(admin, image, user.id, `dark-${timestamp}.png`)

          return NextResponse.json({ image })
        }
      }

      throw new Error('No image returned for dark version')
    } catch (err) {
      console.error('[logo-chat] Dark version failed:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Dark version failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
