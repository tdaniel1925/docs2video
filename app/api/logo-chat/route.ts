import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { deductCredits } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const CHAT_SYSTEM_PROMPT = `You are Marcus, a senior logo designer with 15 years of experience. You run this design session like a creative director — confident, opinionated, warm, and efficient. You LEAD the conversation.

YOUR PERSONALITY:
- You are the expert. You make design decisions, not the client.
- You interview the client with quick, targeted questions — never more than one question at a time.
- After each answer, acknowledge it briefly and immediately ask the next question OR announce you're ready to design.
- You are enthusiastic but not cheesy. Professional but friendly.

YOUR PROCESS (follow this exact flow):
1. FIRST MESSAGE: Greet them warmly, ask what company/brand name the logo is for.
2. SECOND: Ask what they do (industry/business type) in one sentence.
3. THIRD: Ask about the vibe — "Are we going bold and modern, or elegant and refined?" Give 2-3 quick options.
4. FOURTH: Say something like "Perfect — I have a clear vision. I'm going to design 4 concepts for you with [describe your creative direction in 1 sentence]. Ready?" Then set readyToGenerate to true.

That's it — 3-4 exchanges MAX before generating. No more questions needed.

DESIGN DECISIONS YOU MAKE (never ask the client):
- Font choice (pick a specific Google Font)
- Exact hex colors with reasoning
- Logo type (wordmark, lettermark, icon+text, emblem)
- Layout and composition approach

WHEN USER PASTES/UPLOADS A REFERENCE IMAGE:
- Acknowledge it in 1 sentence: "Love this — I see [specific element]. I'll pull from that energy."
- Incorporate the style into your design direction.

RESPONSE FORMAT — respond with ONLY valid JSON, no markdown, no code fences, no extra text:
{"reply":"your conversational message","designBrief":null,"readyToGenerate":false}

When ready to generate, include the full brief:
{"reply":"your ready message","designBrief":{"name":"...","industry":"...","style":"...","logoType":"...","colors":"Primary: #hex, Accent: #hex","font":"Font Name weight"},"readyToGenerate":true}

CRITICAL: The "reply" field is the ONLY thing shown to the user. Keep it natural and conversational. Never include JSON, technical details, hex codes, or font names in the reply text — save those for the designBrief object only.`

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
  const { messages, designBrief, action, feedback, currentLogo, referenceImages } = body as {
    messages: MessagePayload[]
    designBrief: Record<string, string> | null
    action: 'chat' | 'generate' | 'refine'
    feedback?: string
    currentLogo?: string
    referenceImages?: string[]
  }

  // ── CHAT ──────────────────────────────────────────────────────
  if (action === 'chat') {
    try {
      const contents: { role: string; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }[] = []

      // System prompt as first user message (Gemini doesn't have a system role in multi-turn)
      contents.push({
        role: 'user',
        parts: [{ text: CHAT_SYSTEM_PROMPT + (designBrief ? `\n\nCurrent design brief so far: ${JSON.stringify(designBrief)}` : '') }],
      })
      contents.push({
        role: 'model',
        parts: [{ text: '{"reply": "Understood. I\'m ready to design.", "designBrief": null, "readyToGenerate": false}' }],
      })

      // Add conversation history
      for (const msg of messages) {
        const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = []
        if (msg.content) parts.push({ text: msg.content })
        if (msg.referenceImage) {
          const base64Match = msg.referenceImage.match(/^data:image\/(\w+);base64,(.+)$/)
          if (base64Match) {
            parts.push({
              inlineData: {
                mimeType: `image/${base64Match[1]}`,
                data: base64Match[2],
              },
            })
            parts.push({ text: '(The user uploaded a reference image above. Analyze it and describe what you see — style, colors, typography feel, mood — and explain how you will incorporate this into the logo design.)' })
          }
        }
        if (parts.length > 0) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts,
          })
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
          readyToGenerate: parsed.readyToGenerate || false,
        })
      } catch {
        // Strip any JSON from the response so user never sees raw JSON
        let cleanReply = text
          .replace(/\{[\s\S]*\}/g, '') // remove JSON objects
          .replace(/```[\s\S]*```/g, '') // remove code blocks
          .trim()
        if (!cleanReply) cleanReply = "Let me think about that — what's the name of the brand we're designing for?"
        return NextResponse.json({
          reply: cleanReply,
          designBrief: designBrief,
          readyToGenerate: false,
        })
      }
    } catch (err) {
      console.error('[logo-chat] Chat error:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Chat failed' }, { status: 500 })
    }
  }

  // ── GENERATE ──────────────────────────────────────────────────
  if (action === 'generate') {
    if (!designBrief) {
      return NextResponse.json({ error: 'Design brief is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ok = await deductCredits(admin, user.id, 2)
    if (!ok) return NextResponse.json({ error: 'Insufficient credits (need 2)' }, { status: 403 })

    // Analyze reference images if any
    let referenceDescription = ''
    if (referenceImages && referenceImages.length > 0) {
      try {
        const refParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
          { text: 'Briefly describe the visual style, colors, typography feel, and mood of these reference images in 2-3 sentences. Focus on design elements that could inform a logo design.' },
        ]
        for (const ref of referenceImages) {
          const match = ref.match(/^data:image\/(\w+);base64,(.+)$/)
          if (match) {
            refParts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } })
          }
        }
        const refResponse = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: refParts }],
        })
        referenceDescription = refResponse.text?.trim() ?? ''
      } catch {
        console.log('[logo-chat] Could not analyze reference images, proceeding without')
      }
    }

    const images: string[] = []
    const variations = ['clean and minimal', 'bold and dynamic', 'elegant and refined', 'playful and modern']

    for (let i = 0; i < 4; i++) {
      const promptText = `Create a professional logo for "${designBrief.name}", a ${designBrief.industry} company.

LOGO TYPE: ${designBrief.logoType}
STYLE: ${designBrief.style}
TYPOGRAPHY: ${designBrief.font}
COLORS: ${designBrief.colors}

VARIATION: Make this version ${variations[i]}.

${referenceDescription ? `The client provided reference images showing: ${referenceDescription}\nIncorporate the aesthetic elements from their references, but create an ORIGINAL logo — do not copy the reference.` : ''}

MARK DESIGN:
- The design must be instantly recognizable and memorable
- Use negative space creatively where possible
- Must work perfectly at both 16px favicon size and 500px+ display size
- Lines and shapes must be crisp and precise with vector-quality edges

TYPOGRAPHY:
- Company name "${designBrief.name}" rendered in ${designBrief.font} typeface
- Medium to semibold weight for maximum legibility
- Slightly increased letter-spacing for an open, modern feel

COMPOSITION:
- Horizontal lockup preferred — icon (if any) on the left, text on the right, vertically centered
- Generous padding around all elements
- Perfect visual balance between mark and text

AVOID: clip art, stock icons, gradients, drop shadows, 3D effects, generic swooshes, literal/cliche imagery, busy details, outlines that break at small sizes.

OUTPUT: Pure white background (#FFFFFF), centered composition, high resolution, crisp vector-quality edges. Square format.`

      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: promptText },
      ]

      // Include reference images inline
      if (referenceImages) {
        for (const ref of referenceImages) {
          const match = ref.match(/^data:image\/(\w+);base64,(.+)$/)
          if (match) {
            parts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } })
          }
        }
      }

      try {
        const response = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts }],
          config: {
            responseFormat: {
              image: {
                aspectRatio: '1:1',
                imageSize: '1024',
              },
            },
          } as any,
        })

        const responseParts = response.candidates?.[0]?.content?.parts ?? []
        for (const rp of responseParts) {
          if (rp.inlineData) {
            images.push(`data:image/png;base64,${rp.inlineData.data}`)
            break
          }
        }
      } catch (err) {
        console.error(`[logo-chat] Logo generation ${i + 1} failed:`, err)
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'All logo generations failed. Please try again.' }, { status: 500 })
    }

    // Log creation
    try {
      await admin.from('creations').insert({
        user_id: user.id,
        type: 'logo',
        title: `Logo: ${designBrief.name}`,
        credits_used: 2,
      })
    } catch { /* ignore */ }

    return NextResponse.json({ images })
  }

  // ── REFINE ────────────────────────────────────────────────────
  if (action === 'refine') {
    if (!currentLogo || !feedback) {
      return NextResponse.json({ error: 'Current logo and feedback required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ok = await deductCredits(admin, user.id, 1)
    if (!ok) return NextResponse.json({ error: 'Insufficient credits (need 1)' }, { status: 403 })

    // Generate a conversational reply about the refinement
    let refinementReply = ''
    try {
      const chatRes = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: `You are a senior logo designer. The client wants this change to their logo: "${feedback}". Respond in 1-2 sentences acknowledging the change and what you'll do. Be conversational and confident. Return ONLY the reply text, no JSON.` },
          ],
        }],
      })
      refinementReply = chatRes.text?.trim() ?? "Making those adjustments now."
    } catch {
      refinementReply = "Making those adjustments now."
    }

    const logoMatch = currentLogo.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!logoMatch) {
      return NextResponse.json({ error: 'Invalid logo data' }, { status: 400 })
    }

    const promptText = `Refine this logo based on the client's feedback.

FEEDBACK: "${feedback}"
${designBrief ? `COMPANY: ${designBrief.name}\nINDUSTRY: ${designBrief.industry}\nTYPOGRAPHY: ${designBrief.font}\nCOLORS: ${designBrief.colors}` : ''}

Apply the requested changes while maintaining the overall brand identity and composition.

STRICT RULES:
- Output a LOGO on a clean white background (#FFFFFF)
- The logo should be centered with generous padding
- Text must be crisp, perfectly spelled, and legible
- Professional, vector-quality appearance
- NO mockups, NO business cards, NO background scenes — JUST the logo
- Square format, 1:1 aspect ratio`

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      { text: promptText },
      { inlineData: { mimeType: `image/${logoMatch[1]}`, data: logoMatch[2] } },
    ]

    // Include reference images if available
    if (referenceImages) {
      for (const ref of referenceImages) {
        const match = ref.match(/^data:image\/(\w+);base64,(.+)$/)
        if (match) {
          parts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } })
        }
      }
    }

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts }],
        config: {
          responseFormat: {
            image: {
              aspectRatio: '1:1',
              imageSize: '1024',
            },
          },
        } as any,
      })

      const responseParts = response.candidates?.[0]?.content?.parts ?? []
      for (const rp of responseParts) {
        if (rp.inlineData) {
          const image = `data:image/png;base64,${rp.inlineData.data}`

          try {
            await admin.from('creations').insert({
              user_id: user.id,
              type: 'logo',
              title: `Logo refine: ${designBrief?.name ?? 'logo'}`,
              credits_used: 1,
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

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
