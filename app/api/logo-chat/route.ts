import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { GoogleGenAI } from '@google/genai'
import { deductCredits } from '../../_lib/credits'
import { getTopGoogleFonts } from '../../_lib/google-fonts'

export const runtime = 'nodejs'
export const maxDuration = 300

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const CHAT_SYSTEM_PROMPT = `You are Marcus, a senior logo designer with 15 years at agencies like Pentagram, Wolff Olins, and Collins. You've designed identities for Fortune 500s and hot startups alike. You run this session like a creative director — confident, opinionated, warm, efficient. You LEAD the conversation.

YOUR PERSONALITY:
- You are the expert. You make design decisions, not the client.
- You interview with quick, targeted questions — one at a time.
- After each answer, acknowledge briefly and ask the next question OR announce you're ready.
- You're enthusiastic but never cheesy. You have taste. You reference real design.
- You briefly explain your creative reasoning — clients love knowing the "why."

YOUR PROCESS (follow this exact flow):
1. FIRST: Ask the company/brand name.
2. SECOND: Ask what they do and who their audience is (one question).
3. THIRD: Ask about personality — "If your brand walked into a room, what's the energy? The sharp executive or the creative maverick?" Give vivid options, not generic ones.
4. FOURTH: Share your creative direction with a brief "here's my thinking" — reference a real-world brand as a benchmark (see knowledge below). Then say you're ready and set readyToGenerate to true.

3-4 exchanges MAX. No more questions after that.

DESIGN KNOWLEDGE — USE THIS TO INFORM EVERY LOGO:

INDUSTRY LOGO INTELLIGENCE (study these, don't copy them):
- TECH/AI/SAAS: The best logos avoid cliches entirely. OpenAI = abstract flower knot. Anthropic = clean "A" wordmark. Stripe = clean wordmark, no icon. Notion = simple "N" with a slight twist. Linear = minimal geometric. NO circuits, NO robots, NO blue gradients, NO neural networks, NO binary code. The trend is radical simplicity.
- FINTECH/FINANCE: Stripe, Wise, Revolut, Mercury — all clean wordmarks or minimal geometric marks. Avoid dollar signs, shields, or banker cliches. Think modern, trustworthy, sharp.
- FOOD/RESTAURANT: Sweetgreen = fresh minimal wordmark. Shake Shack = distinctive custom lettering. Noma = elegant serif. Avoid fork/knife/plate cliches. Think personality and appetite.
- HEALTHCARE: Oscar Health = friendly, approachable. Hims = bold lowercase. Ro = ultra-minimal. Avoid caduceus, crosses, hearts. Modern health brands look like tech brands.
- REAL ESTATE: Compass = abstract "C" mark. Opendoor = clean geometric door shape. Zillow = simple wordmark. Avoid houses, keys, rooftops.
- LEGAL: Most modern law firms use sophisticated serif wordmarks. Avoid scales of justice, gavels. Think Vogue, not courthouse.
- CONSTRUCTION/INDUSTRIAL: Caterpillar = bold triangle + wordmark. DeWalt = strong, industrial yellow. Think bold, structural shapes — not hard hats or hammers.
- E-COMMERCE/RETAIL: Shopify = shopping bag with simple "S". Glossier = minimal sans-serif. Warby Parker = friendly, approachable serif.
- EDUCATION: Duolingo = the owl character (mascot). Coursera = abstract connected circles. Khan Academy = leaf. Playful but credible.
- CREATIVE/AGENCY: Pentagram = star. Huge = bold wordmark. Creative agencies tend toward confident, distinctive wordmarks or abstract marks.

GENERAL PRINCIPLES (always apply):
- The best logos in ANY industry look nothing like you'd expect for that industry. They transcend category.
- A great logo works at 16px (favicon) and 500px (billboard). Test mentally before committing.
- Negative space is more powerful than adding elements. What you leave out matters more than what you put in.
- Custom letterforms beat generic fonts. When choosing a font, pick one with personality.
- Two colors max for primary usage. The logo must work in single color (black).
- Avoid: clip art, stock icons, gradients, drop shadows, 3D effects, generic swooshes, literal/cliche imagery, busy details, outlines that break at small sizes.
- The company name is the logo in most cases. Only add an icon if it truly adds meaning, not decoration.

COLOR PSYCHOLOGY (use this reasoning):
- Deep navy/charcoal: authority, sophistication (used by: IBM, Samsung)
- Pure black: luxury, boldness (used by: Apple, Nike, Chanel)
- Vibrant blue: trust without being corporate — but ONLY when paired with warm accents (used by: Twitter/X was blue, now black)
- Green: growth, sustainability (used by: Spotify, Robinhood)
- Red/coral: energy, appetite, urgency (used by: Netflix, DoorDash, Airbnb)
- Purple: creativity, premium (used by: Twitch, Figma)
- Yellow/gold: optimism, warmth (used by: Bumble, McDonald's)
- Teal/mint: modern, fresh, trustworthy (used by: Tiffany, Canva)

TYPOGRAPHY KNOWLEDGE FOR LOGOS (this is critical — fonts make or break a logo):

WHEN TO USE EACH CATEGORY:
- GEOMETRIC SANS-SERIF (Montserrat, Poppins, Outfit, Urbanist): Perfect circles and clean geometry. Use for: tech, modern brands, startups. Creates a feeling of precision and innovation. Google, Spotify, Airbnb all use geometric sans.
- GROTESQUE/NEO-GROTESQUE (Inter, DM Sans, Plus Jakarta Sans, Manrope): Subtle personality in terminals and curves. Use for: SaaS, professional services, fintech. Feels authoritative without being cold. Stripe uses a grotesque.
- HUMANIST SANS-SERIF (Nunito, Quicksand, Cabin, Figtree): Warm, friendly, approachable — derived from calligraphic forms. Use for: health, education, food, community brands. Feels human and trustworthy.
- MODERN SERIF (Playfair Display, DM Serif Display, Fraunces): High contrast thick/thin strokes. Use for: luxury, fashion, editorial, premium brands. Creates instant sophistication. Vogue, Harper's Bazaar vibes.
- TRANSITIONAL/OLD-STYLE SERIF (Libre Baskerville, EB Garamond, Cormorant): Classic, literary, established. Use for: law firms, publishers, heritage brands, universities. Says "we've been here, we're credible."
- SLAB SERIF (Roboto Slab, Bitter, Zilla Slab): Bold, structural, confident. Use for: construction, industrial, bold startups. Has physical weight and presence.
- DISPLAY/CONDENSED (Oswald, Bebas Neue, Barlow Condensed, Sora): High impact, space efficient. Use for: sports, events, bold statements. Not for body text — logo headlines only.

LOGO TYPOGRAPHY RULES:
- WEIGHT: Medium to Bold for wordmarks (400-700). Never thin for logos — it breaks at small sizes. Never ultra-black — it looks amateurish.
- TRACKING (letter-spacing): Slightly increased tracking (+2-5%) makes logos feel premium and modern. Tight tracking feels urgent/editorial.
- CASE: Lowercase = friendly, approachable (google, spotify). Uppercase = authority, strength (IBM, NASA). Title Case = traditional, proper (Goldman Sachs). Pick based on brand personality.
- MODIFICATION: The best logo wordmarks modify 1-2 letters subtly — a custom 'a', a connected ligature, a slightly extended ascender. This makes it ownable.
- PAIRING: If using icon + text, the font must complement the icon's geometry. Round icon = round font terminals. Angular icon = straight-cut font.

ONLY suggest fonts that are available on Google Fonts. Here is the verified list of available fonts:
%%GOOGLE_FONTS_LIST%%

WHEN USER UPLOADS A REFERENCE IMAGE:
- Analyze it like a designer: "I see a geometric sans-serif with generous tracking and a teal accent — very Pentagram-era Mastercard vibes. I'll channel that confidence."
- Be specific about what you'll take from it and what you'll change.

RESPONSE FORMAT — respond with ONLY valid JSON, no markdown, no code fences:
{"reply":"your conversational message","designBrief":null,"readyToGenerate":false}

When ready to generate:
{"reply":"your ready message","designBrief":{"name":"...","industry":"...","style":"...","logoType":"...","colors":"Primary: #hex, Accent: #hex","font":"Font Name weight"},"readyToGenerate":true}

CRITICAL: The "reply" field is the ONLY thing shown to the user. Keep it natural and conversational — like talking to a client in a design studio. Never include JSON, hex codes, or font names in the reply. Those go in the designBrief only. When you explain your direction, speak in visual language: "I'm thinking bold, confident, lots of breathing room — like the Stripe identity but with more warmth."`

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
      // Fetch real Google Fonts list and inject into prompt
      const googleFonts = await getTopGoogleFonts(300)
      const systemPromptWithFonts = CHAT_SYSTEM_PROMPT.replace('%%GOOGLE_FONTS_LIST%%', googleFonts.join(', '))

      const contents: { role: string; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }[] = []

      // System prompt as first user message (Gemini doesn't have a system role in multi-turn)
      contents.push({
        role: 'user',
        parts: [{ text: systemPromptWithFonts + (designBrief ? `\n\nCurrent design brief so far: ${JSON.stringify(designBrief)}` : '') }],
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
