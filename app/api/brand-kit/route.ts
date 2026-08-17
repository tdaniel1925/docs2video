import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, addTopupCredits, CREDIT_COSTS } from '../../_lib/credits'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { sendNotification, createJob, updateJobProgress } from '../../_lib/notify'
import { safeFetch } from '../../_lib/brand-scraper'

export const runtime = 'nodejs'
export const maxDuration = 600

let _anthropic: Anthropic | null = null
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _anthropic
}
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// ── Types ──────────────────────────────────────────────────────────
type ChatMessage = { role: 'user' | 'assistant'; content: string }

type BrandBrief = {
  companyName: string
  industry: string
  audience: string
  personality: string
  colorPrefs: string
  notes: string
}

type Palette = {
  name: string
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
}

// ── Sofia System Prompt ────────────────────────────────────────────
const SOFIA_PROMPT = `You are Sofia, a world-class brand director with 20 years of experience building iconic brand identities for companies ranging from startups to Fortune 500s. You have a warm, confident, and creative personality.

YOUR PERSONALITY:
- Warm but sharp. You make the client feel like they're in expert hands.
- You ask ONE question at a time. Keep it conversational and natural.
- You give brief, insightful reactions to their answers before moving on.
- You reference real-world design trends and brands when relevant.

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
{"reply":"your ready message — summarize the direction and express excitement about the palette exploration coming next","readyToBuild":true,"brandBrief":{"companyName":"...","industry":"...","audience":"...","personality":"...","colorPrefs":"...","notes":"any other relevant details gathered"}}

CRITICAL: The "reply" field is the ONLY thing shown to the user. Keep it natural and conversational. Never include JSON or technical details in the reply text.`

// ── Helper: extract image from Gemini response ────────────────────
function extractImageBuffer(response: any): Buffer | null {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const rp of parts) {
    if (rp.inlineData?.data) {
      return Buffer.from(rp.inlineData.data, 'base64')
    }
  }
  return null
}

// ── Helper: upload buffer to Supabase ─────────────────────────────
async function uploadToStorage(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
  buffer: Buffer,
  contentType = 'image/png'
): Promise<string> {
  await admin.storage.from('videos').upload(path, buffer, { contentType, upsert: true })
  const { data } = admin.storage.from('videos').getPublicUrl(path)
  return data.publicUrl
}

// ── Helper: download image as buffer ──────────────────────────────
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    // safeFetch, not fetch: url is user-supplied (logoUrl from the request), so
    // it must clear the SSRF guard — including every redirect — before we pull
    // it server-side. Both callers of downloadImage pass user input here.
    const res = await safeFetch(url)
    if (!res || !res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { action } = body as { action: string }

  // ── Cost controls: gate the PAID image-generation actions only. The 'chat'
  // and 'generate-palettes' actions use the cheap text model and stay free.
  if (action === 'generate' || action === 'refine' || action === 'generate-assets') {
    const rl = rateLimit(getRateLimitKey(user.id, 'brand-kit'), LIMITS.generation.limit, LIMITS.generation.windowMs)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a bit before generating again.' }, { status: 429 })
    }

    const COST = CREDIT_COSTS['brand-kit']
    const credit = await checkCredits(user.id, COST)
    if (!credit.allowed) {
      return NextResponse.json({ error: `Not enough credits. Need ${COST}, have ${credit.remaining}.` }, { status: 402 })
    }
    if (!(await deductCredits(user.id, COST, 'brand-kit'))) {
      return NextResponse.json({ error: 'Failed to deduct credits.' }, { status: 402 })
    }
  }

  // ── CHAT ─────────────────────────────────────────────────────────
  if (action === 'chat') {
    const { messages } = body as { messages: ChatMessage[] }

    try {
      const anthropicMessages = (messages ?? []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const response = await getAnthropic().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SOFIA_PROMPT,
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
        let cleanReply = text
          .replace(/\{[\s\S]*\}/g, '')
          .replace(/```[\s\S]*```/g, '')
          .trim()
        if (!cleanReply) cleanReply = "Tell me more about your brand — what's the company name?"
        return NextResponse.json({ reply: cleanReply, readyToBuild: false, brandBrief: null })
      }
    } catch (err) {
      console.error('[brand-kit] Chat error:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Chat failed' },
        { status: 500 }
      )
    }
  }

  // ── GENERATE PALETTES ────────────────────────────────────────────
  if (action === 'generate-palettes') {
    const { brandBrief } = body as { brandBrief: BrandBrief }
    if (!brandBrief) return NextResponse.json({ error: 'Brand brief required' }, { status: 400 })

    try {
      const prompt = `You are an expert brand color strategist. Based on the following brand brief, generate exactly 3 distinct color palette options. Each palette should evoke a different mood/personality while staying true to the brand.

BRAND BRIEF:
- Company: "${brandBrief.companyName}"
- Industry: ${brandBrief.industry}
- Audience: ${brandBrief.audience}
- Personality: ${brandBrief.personality}
- Color Preferences: ${brandBrief.colorPrefs || 'No specific preferences — surprise me'}
- Notes: ${brandBrief.notes || 'None'}

For each palette, provide:
1. A short evocative name (2-3 words, like "Bold & Confident" or "Soft & Refined")
2. Five hex colors: primary, secondary, accent, background, text

Return ONLY valid JSON, no markdown:
{"palettes":[{"name":"...","primary":"#hex","secondary":"#hex","accent":"#hex","background":"#hex","text":"#hex"},{"name":"...","primary":"#hex","secondary":"#hex","accent":"#hex","background":"#hex","text":"#hex"},{"name":"...","primary":"#hex","secondary":"#hex","accent":"#hex","background":"#hex","text":"#hex"}]}

RULES:
- Colors must be visually harmonious and professional
- Each palette must feel distinctly different
- Background should be light/neutral, text should be dark and readable
- Primary and accent should be bold enough for buttons and CTAs
- Think like a top agency — these must be production-ready brand colors`

      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })

      const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const jsonStr = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      const parsed = JSON.parse(jsonStr)

      return NextResponse.json({ palettes: parsed.palettes })
    } catch (err) {
      console.error('[brand-kit] Palette generation error:', err)
      // Fallback palettes
      return NextResponse.json({
        palettes: [
          { name: 'Bold & Modern', primary: '#2563EB', secondary: '#1E40AF', accent: '#F59E0B', background: '#F8FAFC', text: '#1E293B' },
          { name: 'Warm & Inviting', primary: '#DC2626', secondary: '#7C2D12', accent: '#FCD34D', background: '#FFFBEB', text: '#1C1917' },
          { name: 'Clean & Minimal', primary: '#0F172A', secondary: '#334155', accent: '#A8F0D4', background: '#FFFFFF', text: '#0F172A' },
        ],
      })
    }
  }

  // ── GENERATE LOGOS ───────────────────────────────────────────────
  if (action === 'generate') {
    const { brandBrief, palette } = body as { brandBrief: BrandBrief; palette?: Palette }
    if (!brandBrief) return NextResponse.json({ error: 'Brand brief required' }, { status: 400 })

    const admin = createAdminClient()
    const jobId = await createJob(admin, user.id, {
      type: 'brand-kit',
      title: `Logo Concepts: ${brandBrief.companyName}`,
      metadata: { brandBrief },
    })
    if (jobId) await updateJobProgress(admin, jobId, 5, 'running')

    const timestamp = Date.now()
    const basePath = `${user.id}/brand-kit/${timestamp}`
    const images: string[] = []

    const colorInstruction = palette
      ? `PRIMARY COLOR: ${palette.primary}\nSECONDARY COLOR: ${palette.secondary}\nACCENT COLOR: ${palette.accent}\nUse these exact brand colors in the logo design.`
      : `COLOR PREFERENCES: ${brandBrief.colorPrefs}`

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
${colorInstruction}

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
            responseFormat: { image: { aspectRatio: '1:1', imageSize: '1024' } },
          } as any,
        })

        const buffer = extractImageBuffer(response)
        if (buffer) {
          const url = await uploadToStorage(admin, `${basePath}/logo-${i + 1}.png`, buffer)
          images.push(url)
        }
      } catch (err) {
        console.error(`[brand-kit] Logo ${i + 1} failed:`, err)
      }
      if (jobId) await updateJobProgress(admin, jobId, 10 + i * 20, 'running')
    }

    // Every logo attempt failed — customer got nothing. Refund the charge
    // (no video row: NULL videoId + string idempotency key) and return an error.
    if (images.length === 0) {
      await addTopupCredits(user.id, CREDIT_COSTS['brand-kit'], 'refund:brandkit', {
        idempotencyKey: `refund:brandkit:${user.id}:${timestamp}`,
        action: 'refund_brandkit',
        videoId: null as any,
      })
      if (jobId) await updateJobProgress(admin, jobId, 100, 'failed')
      return NextResponse.json({ error: 'Logo generation failed. Your credits were not charged.' }, { status: 500 })
    }

    if (jobId) await updateJobProgress(admin, jobId, 100, 'completed')

    return NextResponse.json({ images })
  }

  // ── REFINE LOGO ──────────────────────────────────────────────────
  if (action === 'refine') {
    const { brandBrief, palette, logoUrl, feedback } = body as {
      brandBrief: BrandBrief
      palette?: Palette
      logoUrl: string
      feedback: string
    }
    if (!brandBrief || !logoUrl || !feedback) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = createAdminClient()
    const timestamp = Date.now()
    const basePath = `${user.id}/brand-kit/${timestamp}`

    const logoBuffer = await downloadImage(logoUrl)
    const colorInstruction = palette
      ? `Use these brand colors: primary ${palette.primary}, secondary ${palette.secondary}, accent ${palette.accent}.`
      : `Color preferences: ${brandBrief.colorPrefs}`

    try {
      const refinePrompt = `Refine this logo for "${brandBrief.companyName}" based on this feedback: "${feedback}"

BRAND: ${brandBrief.companyName} | ${brandBrief.industry}
PERSONALITY: ${brandBrief.personality}
${colorInstruction}

Keep the overall concept but apply the requested changes. Maintain professional quality.
OUTPUT: Pure white background (#FFFFFF), centered, high resolution, square format.`

      const parts: any[] = [{ text: refinePrompt }]
      if (logoBuffer) {
        parts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
      }

      const response = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts }],
        config: {
          responseFormat: { image: { aspectRatio: '1:1', imageSize: '1024' } },
        } as any,
      })

      const buffer = extractImageBuffer(response)
      if (buffer) {
        const url = await uploadToStorage(admin, `${basePath}/logo-refined.png`, buffer)
        return NextResponse.json({ images: [url] })
      }

      // No image — refund the charge (no video row: NULL videoId + string key).
      await addTopupCredits(user.id, CREDIT_COSTS['brand-kit'], 'refund:brandkit', {
        idempotencyKey: `refund:brandkit:${user.id}:${timestamp}`,
        action: 'refund_brandkit',
        videoId: null as any,
      })
      return NextResponse.json({ error: 'No image generated' }, { status: 500 })
    } catch (err) {
      console.error('[brand-kit] Refine error:', err)
      // Refund on failure. Idempotent on the same string key, so the no-image
      // path above and this catch never double-refund.
      await addTopupCredits(user.id, CREDIT_COSTS['brand-kit'], 'refund:brandkit', {
        idempotencyKey: `refund:brandkit:${user.id}:${timestamp}`,
        action: 'refund_brandkit',
        videoId: null as any,
      })
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Refine failed' },
        { status: 500 }
      )
    }
  }

  // ── GENERATE ASSETS ──────────────────────────────────────────────
  if (action === 'generate-assets') {
    const { brandBrief, palette, logoUrl } = body as {
      brandBrief: BrandBrief
      palette: Palette
      logoUrl: string
    }
    if (!brandBrief || !palette || !logoUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = createAdminClient()
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

    // Download logo for embedding
    const logoBuffer = await downloadImage(logoUrl)

    const colorInstruction = `Use these exact brand colors throughout:
PRIMARY: ${palette.primary}
SECONDARY: ${palette.secondary}
ACCENT: ${palette.accent}
BACKGROUND: ${palette.background}
TEXT: ${palette.text}`

    const cardWidth = 1050
    const cardHeight = 600

    // ─── 1. BUSINESS CARDS ─────────────────────────────────────
    let cardFront = ''
    let cardBack = ''

    try {
      const frontPrompt = `Create a professional BUSINESS CARD FRONT for high-quality print at 300 DPI.

COMPANY: "${brandBrief.companyName}"
INDUSTRY: ${brandBrief.industry}
BRAND PERSONALITY: ${brandBrief.personality}

CARD CONTENT:
- COMPANY NAME (prominent): "${brandBrief.companyName}"
- Display "Your Name" as the person's name — largest text
- Display "Your Title" as the job title
${logoBuffer ? '- The brand logo is provided — integrate it prominently.' : ''}

${colorInstruction}

STRICT RULES:
- NO human faces, NO photos of people
- All text must be crisp, legible, and correctly spelled at 300 DPI
- Clean, minimal, premium feel — this is a SMALL 3.5 x 2.0 inch card
- Professional, polished, ready to print
- Design dimensions: ${cardWidth}x${cardHeight} pixels (300 DPI)`

      const frontParts: any[] = [{ text: frontPrompt }]
      if (logoBuffer) {
        frontParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
      }

      const frontResponse = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: frontParts }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } } as any,
      })

      const frontBuf = extractImageBuffer(frontResponse)
      if (frontBuf) {
        const resized = await sharp(frontBuf)
          .resize(cardWidth, cardHeight, { fit: 'cover' })
          .withMetadata({ density: 300 })
          .png({ quality: 100 })
          .toBuffer() as Buffer<ArrayBuffer>
        cardFront = await uploadToStorage(admin, `${basePath}/card-front.png`, resized)
      }
    } catch (err) {
      console.error('[brand-kit] Card front failed:', err)
    }

    try {
      const backPrompt = `Create a professional BUSINESS CARD BACK for high-quality print at 300 DPI. This is the reverse side.

COMPANY: "${brandBrief.companyName}"
INDUSTRY: ${brandBrief.industry}

CARD CONTENT:
- COMPANY NAME: "${brandBrief.companyName}"
- EMAIL: "hello@${brandBrief.companyName.toLowerCase().replace(/\s+/g, '')}.com"
- WEBSITE: "www.${brandBrief.companyName.toLowerCase().replace(/\s+/g, '')}.com"
- PHONE: "(555) 000-0000"
${logoBuffer ? '- Feature the brand logo prominently.' : ''}

${colorInstruction}

STRICT RULES:
- NO human faces, NO photos of people
- Contact info must be clearly readable and organized
- All text crisp and legible at 300 DPI
- Clean, minimal, premium feel — SMALL 3.5 x 2.0 inch card
- Design dimensions: ${cardWidth}x${cardHeight} pixels (300 DPI)`

      const backParts: any[] = [{ text: backPrompt }]
      if (logoBuffer) {
        backParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
      }

      const backResponse = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: backParts }],
        config: { responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } } } as any,
      })

      const backBuf = extractImageBuffer(backResponse)
      if (backBuf) {
        const resized = await sharp(backBuf)
          .resize(cardWidth, cardHeight, { fit: 'cover' })
          .withMetadata({ density: 300 })
          .png({ quality: 100 })
          .toBuffer() as Buffer<ArrayBuffer>
        cardBack = await uploadToStorage(admin, `${basePath}/card-back.png`, resized)
      }
    } catch (err) {
      console.error('[brand-kit] Card back failed:', err)
    }

    if (jobId) await updateJobProgress(admin, jobId, 35, 'running')

    // ─── 2. SOCIAL MEDIA KIT ──────────────────────────────────
    const socialImages: { type: string; url: string }[] = []
    const socialSpecs = [
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

${colorInstruction}

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

        const socialParts: any[] = [{ text: socialPrompt }]
        if (logoBuffer) {
          socialParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
        }

        const socialResponse = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts: socialParts }],
          config: { responseFormat: { image: { aspectRatio: spec.aspect, imageSize: '4K' } } } as any,
        })

        const buf = extractImageBuffer(socialResponse)
        if (buf) {
          const url = await uploadToStorage(admin, `${basePath}/social-${spec.type}.png`, buf)
          socialImages.push({ type: spec.type, url })
        }
      } catch (err) {
        console.error(`[brand-kit] Social ${spec.type} failed:`, err)
      }
    }

    if (jobId) await updateJobProgress(admin, jobId, 65, 'running')

    // ─── 3. EMAIL SIGNATURE (HTML — no Gemini needed) ─────────
    const domain = brandBrief.companyName.toLowerCase().replace(/\s+/g, '')
    const emailSignatureHtml = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: ${palette.text}; font-size: 14px; line-height: 1.5;">
  <tr>
    <td style="padding-right: 20px; vertical-align: top; border-right: 3px solid ${palette.primary};">
      ${logoUrl ? `<img src="${logoUrl}" alt="${brandBrief.companyName}" width="80" height="80" style="border-radius: 8px; display: block;" />` : ''}
    </td>
    <td style="padding-left: 20px; vertical-align: top;">
      <div style="font-size: 18px; font-weight: 700; color: ${palette.text}; margin-bottom: 2px;">Your Name</div>
      <div style="font-size: 13px; color: ${palette.secondary}; margin-bottom: 10px;">Your Title</div>
      <div style="font-size: 16px; font-weight: 600; color: ${palette.primary}; margin-bottom: 8px;">${brandBrief.companyName}</div>
      <div style="font-size: 12px; color: #666;">
        <span>hello@${domain}.com</span>
        <span style="margin: 0 8px; color: #ccc;">|</span>
        <span>(555) 000-0000</span>
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 2px;">
        <a href="https://www.${domain}.com" style="color: ${palette.primary}; text-decoration: none;">www.${domain}.com</a>
      </div>
      <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right: 6px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${palette.primary}; display: inline-block;"></div>
            </td>
            <td style="padding-right: 6px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${palette.secondary}; display: inline-block;"></div>
            </td>
            <td style="padding-right: 6px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${palette.accent}; display: inline-block;"></div>
            </td>
          </tr>
        </table>
      </div>
    </td>
  </tr>
</table>`

    if (jobId) await updateJobProgress(admin, jobId, 75, 'running')

    // ─── 4. BRAND GUIDE ───────────────────────────────────────
    let guideUrl = ''

    try {
      const guidePrompt = `Create a professional BRAND GUIDE summary page — a single, beautifully designed reference image that captures the complete brand identity.

BRAND:
- Company: "${brandBrief.companyName}"
- Industry: ${brandBrief.industry}
- Audience: ${brandBrief.audience}
- Personality: ${brandBrief.personality}

${colorInstruction}

INCLUDE THESE SECTIONS (laid out like a professional brand guidelines page):

1. LOGO USAGE: Show the logo (or company name in brand typography) with clear space guidelines, "Do" and "Don't" examples
2. COLOR PALETTE: Display the 5 brand colors as large swatches with hex codes: ${palette.primary}, ${palette.secondary}, ${palette.accent}, ${palette.background}, ${palette.text}
3. TYPOGRAPHY: Show the primary heading font and body font with sample text, font name, and weight
4. BRAND VOICE: 3-4 keywords that capture the brand personality
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

      const guideParts: any[] = [{ text: guidePrompt }]
      if (logoBuffer) {
        guideParts.push({ inlineData: { mimeType: 'image/png', data: logoBuffer.toString('base64') } })
      }

      const guideResponse = await genai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [{ role: 'user', parts: guideParts }],
        config: { responseFormat: { image: { aspectRatio: '3:4', imageSize: '4K' } } } as any,
      })

      const guideBuf = extractImageBuffer(guideResponse)
      if (guideBuf) {
        guideUrl = await uploadToStorage(admin, `${basePath}/brand-guide.png`, guideBuf)
      }
    } catch (err) {
      console.error('[brand-kit] Brand guide failed:', err)
    }

    // If every Gemini asset failed (cards + all socials + guide empty), the
    // customer got nothing but the emailSignatureHtml (which is free/static).
    // Refund the charge (no video row: NULL videoId + string key) and error out.
    if (!cardFront && !cardBack && socialImages.length === 0 && !guideUrl) {
      await addTopupCredits(user.id, CREDIT_COSTS['brand-kit'], 'refund:brandkit', {
        idempotencyKey: `refund:brandkit:${user.id}:${timestamp}`,
        action: 'refund_brandkit',
        videoId: null as any,
      })
      if (jobId) await updateJobProgress(admin, jobId, 100, 'failed')
      return NextResponse.json({ error: 'Brand kit asset generation failed. Your credits were not charged.' }, { status: 500 })
    }

    if (jobId) await updateJobProgress(admin, jobId, 95, 'running')

    // ─── Log to creations ─────────────────────────────────────
    try {
      await admin.from('creations').insert({
        user_id: user.id,
        type: 'brand-kit',
        title: `Brand Kit: ${brandBrief.companyName}`,
        thumbnail_url: logoUrl || cardFront || '',
        file_url: logoUrl || cardFront || '',
      })
    } catch { /* ignore */ }

    // Complete job & notify
    if (jobId) await updateJobProgress(admin, jobId, 100, 'completed')

    await sendNotification(admin, user.id, {
      type: 'brand-kit',
      title: `Brand Kit Ready: ${brandBrief.companyName}`,
      message: `Your complete brand kit with business cards, social media kit, email signature, and brand guide is ready.`,
      link: '/brand-kit',
    })

    return NextResponse.json({
      cardFront,
      cardBack,
      socialImages,
      emailSignatureHtml,
      guideUrl,
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
