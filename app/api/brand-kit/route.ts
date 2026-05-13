import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import { deductCredits } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 600

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const BRAND_STRATEGIST_PROMPT = `You are a brand strategist with 20 years of experience building iconic brand identities for companies ranging from startups to Fortune 500s. Your job is to interview the client to build a complete brand identity — logo, business cards, social media kit, and brand guide.

YOUR PERSONALITY:
- Warm, confident, and strategic. You make the client feel like they're in expert hands.
- You ask ONE question at a time. Keep it conversational and natural.
- You give brief, insightful reactions to their answers before moving on.

YOUR PROCESS (follow this exact flow):
1. FIRST: Ask the company/brand name.
2. SECOND: Ask what they do, their industry, and who their target audience is.
3. THIRD: Ask about the brand personality — "If your brand were a person at a dinner party, who would they be? The sharp-dressed executive, the creative visionary, the approachable neighbor?" Give vivid options.
4. FOURTH: Ask about any color preferences or existing visual references they love.
5. FIFTH: Summarize your creative vision back to them. Say you have a clear direction and set readyToBuild to true.

4-5 exchanges MAX. Do not drag it out.

RESPONSE FORMAT — respond with ONLY valid JSON, no markdown, no code fences:
{"reply":"your conversational message","readyToBuild":false,"brandBrief":null}

When ready to build (after 4-5 exchanges):
{"reply":"your ready message — summarize the direction and express excitement","readyToBuild":true,"brandBrief":{"companyName":"...","industry":"...","audience":"...","personality":"...","colorPrefs":"...","notes":"any other relevant details gathered"}}

CRITICAL: The "reply" field is the ONLY thing shown to the user. Keep it natural and conversational. Never include JSON or technical details in the reply text.`

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type BrandBrief = {
  companyName: string
  industry: string
  audience: string
  personality: string
  colorPrefs: string
  notes: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { action, messages, brandBrief } = body as {
    action: 'chat' | 'generate'
    messages?: ChatMessage[]
    brandBrief?: BrandBrief
  }

  // ── CHAT ──────────────────────────────────────────────────────
  if (action === 'chat') {
    try {
      const anthropicMessages = (messages ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: BRAND_STRATEGIST_PROMPT,
        messages: anthropicMessages,
      })

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim()

      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

      try {
        const parsed = JSON.parse(cleaned)
        return NextResponse.json({
          reply: parsed.reply,
          readyToBuild: parsed.readyToBuild || false,
          brandBrief: parsed.brandBrief || null,
        })
      } catch {
        // If JSON parsing fails, return the raw text as the reply
        let cleanReply = text
          .replace(/\{[\s\S]*\}/g, '')
          .replace(/```[\s\S]*```/g, '')
          .trim()
        if (!cleanReply) cleanReply = "Tell me more about your brand — what's the company name?"
        return NextResponse.json({
          reply: cleanReply,
          readyToBuild: false,
          brandBrief: null,
        })
      }
    } catch (err) {
      console.error('[brand-kit] Chat error:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Chat failed' }, { status: 500 })
    }
  }

  // ── GENERATE ──────────────────────────────────────────────────
  if (action === 'generate') {
    if (!brandBrief) {
      return NextResponse.json({ error: 'Brand brief is required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Credit check — brand kit costs 8 credits total (2 logo + 1 card + 3 social + 2 guide)
    const TOTAL_CREDITS = 8
    const { data: profile } = await admin
      .from('profiles')
      .select('credits_remaining')
      .eq('id', user.id)
      .single()

    if (!profile || profile.credits_remaining < TOTAL_CREDITS) {
      return NextResponse.json(
        { error: `Insufficient credits. You need ${TOTAL_CREDITS} credits but have ${profile?.credits_remaining ?? 0}.` },
        { status: 402 }
      )
    }

    // Create job tracker
    const jobId = await createJob(admin, user.id, {
      type: 'brand-kit',
      title: `Brand Kit: ${brandBrief.companyName}`,
      metadata: { brandBrief },
    })

    if (jobId) await updateJobProgress(admin, jobId, 5, 'running')

    const timestamp = Date.now()
    const basePath = `${user.id}/brand-kit/${timestamp}`
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default ?? sharpMod

    // ─── 1. LOGOS (4 concepts) ─────────────────────────────────
    const logoImages: string[] = []
    const variations = [
      'Clean, minimal wordmark — think Stripe or Notion. Radical simplicity, perfect typography.',
      'Bold iconic mark with wordmark — think Airbnb or Spotify. A distinctive symbol that works at any size.',
      'Elegant, refined lettermark — think Chanel or IBM. Sophisticated, timeless, monogram-inspired.',
      'Modern and dynamic — think Figma or Linear. Geometric, fresh, with a creative twist.',
    ]

    for (let i = 0; i < 4; i++) {
      try {
        const logoPrompt = `Create a professional logo for "${brandBrief.companyName}".

INDUSTRY: ${brandBrief.industry}
TARGET AUDIENCE: ${brandBrief.audience}
BRAND PERSONALITY: ${brandBrief.personality}
COLOR PREFERENCES: ${brandBrief.colorPrefs}

VARIATION: ${variations[i]}

ADDITIONAL CONTEXT: ${brandBrief.notes}

MARK DESIGN:
- The design must be instantly recognizable and memorable
- Use negative space creatively where possible
- Must work perfectly at both 16px favicon size and 500px+ display size
- Lines and shapes must be crisp and precise with vector-quality edges

TYPOGRAPHY:
- Company name "${brandBrief.companyName}" must be prominent and perfectly spelled
- Medium to semibold weight for maximum legibility
- Slightly increased letter-spacing for an open, modern feel

COMPOSITION:
- Horizontal lockup preferred — icon (if any) on the left, text on the right, vertically centered
- Generous padding around all elements
- Perfect visual balance between mark and text

AVOID: clip art, stock icons, gradients, drop shadows, 3D effects, generic swooshes, literal/cliche imagery, busy details, outlines that break at small sizes, human faces.

OUTPUT: Pure white background (#FFFFFF), centered composition, high resolution, crisp vector-quality edges. Square format.`

        const response = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: [{ text: logoPrompt }] }],
          config: {
            responseFormat: {
              image: { aspectRatio: '1:1', imageSize: '1024' },
            },
          } as any,
        })

        const parts = response.candidates?.[0]?.content?.parts ?? []
        for (const rp of parts) {
          if (rp.inlineData) {
            const buffer = Buffer.from(rp.inlineData.data!, 'base64')
            const storagePath = `${basePath}/logo-${i + 1}.png`
            await admin.storage.from('videos').upload(storagePath, buffer, { contentType: 'image/png', upsert: true })
            const { data: urlData } = admin.storage.from('videos').getPublicUrl(storagePath)
            logoImages.push(urlData.publicUrl)
            break
          }
        }
      } catch (err) {
        console.error(`[brand-kit] Logo ${i + 1} generation failed:`, err)
      }

      if (jobId) await updateJobProgress(admin, jobId, 10 + i * 10, 'running')
    }

    // Deduct logo credits (2)
    await deductCredits(admin, user.id, 2)

    if (jobId) await updateJobProgress(admin, jobId, 50, 'running')

    // ─── 2. BUSINESS CARDS (front + back) ──────────────────────
    let cardFront = ''
    let cardBack = ''

    const cardWidth = 1050
    const cardHeight = 600

    // Download the first logo for use on cards
    let logoBuffer: Buffer | null = null
    if (logoImages.length > 0) {
      try {
        const logoRes = await fetch(logoImages[0], { signal: AbortSignal.timeout(8000) })
        if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
      } catch {
        console.log('[brand-kit] Could not download logo for cards, proceeding without')
      }
    }

    const cardColorInstruction = logoBuffer
      ? `Extract the dominant colors from the provided logo image and use them as the PRIMARY brand colors. Build a rich palette around the logo colors.`
      : `Use colors inspired by the brand preferences: ${brandBrief.colorPrefs}. Build a professional, cohesive palette.`

    try {
      // Front
      const frontPrompt = `Create a professional BUSINESS CARD FRONT for high-quality print at 300 DPI.

COMPANY: "${brandBrief.companyName}"
INDUSTRY: ${brandBrief.industry}
BRAND PERSONALITY: ${brandBrief.personality}

CARD CONTENT:
- COMPANY NAME (prominent): "${brandBrief.companyName}"
- Display "Your Name" as the person's name placeholder — largest text
- Display "Your Title" as the job title
${logoBuffer ? '- The brand logo is provided — integrate it prominently.' : ''}

${cardColorInstruction}

STRICT RULES:
- NO human faces, NO photos of people
- All text must be crisp, legible, and correctly spelled at 300 DPI
- Clean, minimal, premium feel — this is a SMALL 3.5 x 2.0 inch card
- Professional, polished, ready to print
- Design dimensions: ${cardWidth}x${cardHeight} pixels (300 DPI)`

      const frontParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: frontPrompt },
      ]
      if (logoBuffer) {
        frontParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
      }

      const frontResponse = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: frontParts }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } } as any,
      })

      const frontPts = frontResponse.candidates?.[0]?.content?.parts ?? []
      for (const rp of frontPts) {
        if (rp.inlineData) {
          const rawBuf = Buffer.from(rp.inlineData.data!, 'base64')
          const buf = await sharp(rawBuf).resize(cardWidth, cardHeight, { fit: 'cover' }).withMetadata({ density: 300 }).png({ quality: 100 }).toBuffer() as Buffer<ArrayBuffer>
          const path = `${basePath}/card-front.png`
          await admin.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
          const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)
          cardFront = urlData.publicUrl
          break
        }
      }
    } catch (err) {
      console.error('[brand-kit] Card front generation failed:', err)
    }

    try {
      // Back
      const backPrompt = `Create a professional BUSINESS CARD BACK for high-quality print at 300 DPI. This is the reverse side.

COMPANY: "${brandBrief.companyName}"
INDUSTRY: ${brandBrief.industry}

CARD CONTENT:
- COMPANY NAME: "${brandBrief.companyName}"
- EMAIL: "hello@${brandBrief.companyName.toLowerCase().replace(/\s+/g, '')}.com"
- WEBSITE: "www.${brandBrief.companyName.toLowerCase().replace(/\s+/g, '')}.com"
- PHONE: "(555) 000-0000"
${logoBuffer ? '- Feature the brand logo prominently.' : ''}

${cardColorInstruction}

STRICT RULES:
- NO human faces, NO photos of people
- Contact info must be clearly readable and organized
- All text crisp and legible at 300 DPI
- Clean, minimal, premium feel — SMALL 3.5 x 2.0 inch card
- Design dimensions: ${cardWidth}x${cardHeight} pixels (300 DPI)`

      const backParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: backPrompt },
      ]
      if (logoBuffer) {
        backParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
      }

      const backResponse = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: backParts }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } } as any,
      })

      const backPts = backResponse.candidates?.[0]?.content?.parts ?? []
      for (const rp of backPts) {
        if (rp.inlineData) {
          const rawBuf = Buffer.from(rp.inlineData.data!, 'base64')
          const buf = await sharp(rawBuf).resize(cardWidth, cardHeight, { fit: 'cover' }).withMetadata({ density: 300 }).png({ quality: 100 }).toBuffer() as Buffer<ArrayBuffer>
          const path = `${basePath}/card-back.png`
          await admin.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
          const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)
          cardBack = urlData.publicUrl
          break
        }
      }
    } catch (err) {
      console.error('[brand-kit] Card back generation failed:', err)
    }

    // Deduct card credits (1)
    await deductCredits(admin, user.id, 1)

    if (jobId) await updateJobProgress(admin, jobId, 65, 'running')

    // ─── 3. SOCIAL MEDIA KIT (3 master images) ────────────────
    const socialImages: { type: string; url: string }[] = []
    const socialSpecs: { type: string; aspect: string; desc: string }[] = [
      { type: 'landscape', aspect: '16:9', desc: 'wide landscape banner for Facebook/LinkedIn/YouTube covers' },
      { type: 'square', aspect: '1:1', desc: 'square post for Instagram/Facebook/Twitter posts' },
      { type: 'vertical', aspect: '9:16', desc: 'vertical story for Instagram/TikTok/Snapchat stories' },
    ]

    for (const spec of socialSpecs) {
      try {
        const socialPrompt = `Create a TRENDY, INFOGRAPHIC-STYLE ${spec.desc} social media graphic.

BRAND:
- Company: "${brandBrief.companyName}"
- Industry: ${brandBrief.industry}
- Audience: ${brandBrief.audience}
- Personality: ${brandBrief.personality}

COLOR DIRECTION: ${brandBrief.colorPrefs || 'Modern, trendy palette — think 2025 design trends.'}

DESIGN APPROACH:
- Professional infographic style — NOT a plain banner
- Include visual data elements: stat callouts, icon grids, metric badges
- Bold, trendy typography — mix large display text with clean body text
- Decorative elements: abstract shapes, geometric patterns, subtle grain textures
- The company name MUST be prominently featured
- Layer elements with depth: overlapping cards, subtle shadows, glassmorphism
${logoBuffer ? '- Integrate the provided brand logo naturally into the design.' : ''}

STRICT RULES:
- NO human faces, NO photos of people
- NO placeholder text beyond the company name and brief descriptive content
- All text must be crisp, legible, and correctly spelled
- Make it TRENDY: 2025 design standards`

        const socialParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
          { text: socialPrompt },
        ]
        if (logoBuffer) {
          socialParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
        }

        const socialResponse = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: socialParts }],
          config: { responseFormat: { image: { aspectRatio: spec.aspect, imageSize: '4K' } } } as any,
        })

        const socialPts = socialResponse.candidates?.[0]?.content?.parts ?? []
        for (const rp of socialPts) {
          if (rp.inlineData) {
            const buf = Buffer.from(rp.inlineData.data!, 'base64')
            const path = `${basePath}/social-${spec.type}.png`
            await admin.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
            const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)
            socialImages.push({ type: spec.type, url: urlData.publicUrl })
            break
          }
        }
      } catch (err) {
        console.error(`[brand-kit] Social ${spec.type} generation failed:`, err)
      }
    }

    // Deduct social credits (3)
    await deductCredits(admin, user.id, 3)

    if (jobId) await updateJobProgress(admin, jobId, 85, 'running')

    // ─── 4. BRAND GUIDE (summary image) ───────────────────────
    let guideUrl = ''

    try {
      const guidePrompt = `Create a professional BRAND GUIDE summary page — a single, beautifully designed reference image that captures the complete brand identity.

BRAND:
- Company: "${brandBrief.companyName}"
- Industry: ${brandBrief.industry}
- Audience: ${brandBrief.audience}
- Personality: ${brandBrief.personality}
- Color Direction: ${brandBrief.colorPrefs}

INCLUDE THESE SECTIONS (laid out like a professional brand guidelines page):

1. LOGO USAGE: Show the logo (or company name in brand typography) with clear space guidelines, "Do" and "Don't" examples
2. COLOR PALETTE: 4-6 brand colors displayed as large swatches with hex codes labeled beneath each
3. TYPOGRAPHY: Show the primary heading font and body font with sample text, font name, and weight
4. BRAND VOICE: 3-4 keywords that capture the brand personality (e.g., "Bold / Modern / Trustworthy / Human")
5. VISUAL STYLE: A brief note on imagery style, icon style, and overall aesthetic direction

LAYOUT:
- Clean, organized grid layout
- White or very light background
- Professional typography throughout
- Clear section headings
- Generous whitespace between sections
- Portrait/vertical orientation (like a printed guide page)
${logoBuffer ? '- Use the provided logo in the logo usage section.' : ''}

STRICT RULES:
- NO human faces, NO photos of people
- This must look like a real brand guidelines document from a top agency
- All text must be crisp, legible, and correctly spelled
- Professional, polished, authoritative design`

      const guideParts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: guidePrompt },
      ]
      if (logoBuffer) {
        guideParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
      }

      const guideResponse = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: guideParts }],
        config: { responseFormat: { image: { aspectRatio: '3:4', imageSize: '4K' } } } as any,
      })

      const guidePts = guideResponse.candidates?.[0]?.content?.parts ?? []
      for (const rp of guidePts) {
        if (rp.inlineData) {
          const buf = Buffer.from(rp.inlineData.data!, 'base64')
          const path = `${basePath}/brand-guide.png`
          await admin.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
          const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)
          guideUrl = urlData.publicUrl
          break
        }
      }
    } catch (err) {
      console.error('[brand-kit] Brand guide generation failed:', err)
    }

    // Deduct guide credits (2)
    await deductCredits(admin, user.id, 2)

    // Log to creations table
    try {
      await admin.from('creations').insert({
        user_id: user.id,
        type: 'brand-kit',
        title: `Brand Kit: ${brandBrief.companyName}`,
        thumbnail_url: logoImages[0] || cardFront || '',
        file_url: logoImages[0] || cardFront || '',
        credits_used: TOTAL_CREDITS,
      })
    } catch { /* ignore */ }

    // Complete job
    if (jobId) await updateJobProgress(admin, jobId, 100, 'completed')

    // Send notification
    await sendNotification(admin, user.id, {
      type: 'brand-kit',
      title: `Brand Kit Ready: ${brandBrief.companyName}`,
      message: `Your complete brand kit with ${logoImages.length} logo concepts, business cards, social media kit, and brand guide is ready.`,
      link: '/brand-kit',
    })

    return NextResponse.json({
      logoImages,
      cardFront,
      cardBack,
      socialImages,
      guideUrl,
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
