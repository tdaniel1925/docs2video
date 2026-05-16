import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const THEME_PROMPT = `You are an expert web designer analyzing a website's visual identity. Based on the HTML/CSS below, create a slide presentation style prompt that captures this website's look and feel.

Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "string — a short creative name for this style (2-3 words)",
  "description": "string — one sentence describing the visual style",
  "colors": {
    "primary": "hex color",
    "secondary": "hex color",
    "accent": "hex color",
    "background": "hex color",
    "text": "hex color"
  },
  "prompt": "string — A detailed visual style prompt for generating presentation slides that match this website's aesthetic. Describe: background treatment, color palette, typography style, layout approach, visual effects, mood/tone. Be specific about colors, gradients, textures, and spacing. This prompt will be used by an image generation AI to create branded slides."
}

Rules:
- Extract ACTUAL colors from the CSS/HTML — don't guess
- The prompt should be 2-4 sentences, highly specific and visual
- Focus on what makes this site's design unique
- The style should work on a 16:9 presentation slide`

const EXTRACTION_PROMPT = `You are an expert content analyst. You will receive raw text extracted from a web page.

Your job is to analyze the text and extract the most important information into a structured format.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "title": "string — a clear, concise title summarizing the content",
  "subtitle": "string or null — a supporting subtitle if appropriate",
  "source": "string or null — the source or origin of the content if identifiable",
  "keyMetrics": [
    { "label": "string", "value": "string", "highlight": true/false }
  ],
  "sections": [
    { "title": "string", "content": "string" }
  ],
  "bulletPoints": ["string"],
  "additionalNotes": ["string"]
}

Rules:
- Extract any numbers, percentages, dollar amounts, dates, or quantifiable data as keyMetrics
- Mark the 2-3 most important metrics with "highlight": true
- Break the content into logical sections with clear titles
- Pull out key takeaways or action items as bulletPoints
- Include any caveats, disclaimers, or supplementary info in additionalNotes
- If the text is short, still create a meaningful structure
- Be smart about understanding context — infer the topic and purpose
- keyMetrics should have concise labels and values (e.g. label: "Revenue", value: "$1.2M")
- Aim for 3-8 keyMetrics, 2-5 sections, and 3-10 bulletPoints`

function stripHtml(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_beta, credits_remaining')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_beta && (!profile || profile.credits_remaining <= 0)) {
    return NextResponse.json({ error: 'No credits remaining' }, { status: 403 })
  }

  const body = await request.json()
  const { url } = body as { url: string }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
  }

  // Basic URL validation
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL. Please provide a valid http or https URL.' }, { status: 400 })
  }

  try {
    // Fetch the page with comprehensive browser-like headers
    let fetchRes = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })

    // Retry with simpler headers if blocked
    if (!fetchRes.ok && (fetchRes.status === 403 || fetchRes.status === 406)) {
      fetchRes = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
          'Accept': 'text/html',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      })
    }

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `Failed to fetch URL (status ${fetchRes.status})` }, { status: 400 })
    }

    const html = await fetchRes.text()
    const textContent = stripHtml(html)

    if (textContent.length < 50) {
      return NextResponse.json({ error: 'Could not extract meaningful content from this URL' }, { status: 400 })
    }

    // Truncate text for content extraction
    const truncated = textContent.slice(0, 50000)
    // Extract a chunk of HTML with CSS for theme analysis (first 30k chars has most styling)
    const htmlForTheme = html.slice(0, 30000)

    // Run content extraction and theme analysis in parallel
    const [contentResponse, themeResponse] = await Promise.all([
      genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: EXTRACTION_PROMPT },
              { text: `\n\nHere is the text extracted from ${parsedUrl.hostname}:\n\n${truncated}` },
            ],
          },
        ],
      }),
      genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: THEME_PROMPT },
              { text: `\n\nHere is the HTML/CSS from ${parsedUrl.hostname}:\n\n${htmlForTheme}` },
            ],
          },
        ],
      }),
    ])

    const raw = contentResponse.text?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    const data: ExtractedData = JSON.parse(cleaned)
    if (!data.source) {
      data.source = parsedUrl.hostname
    }

    // Parse theme suggestion
    let suggestedTheme = null
    try {
      const themeRaw = themeResponse.text?.trim() ?? ''
      const themeCleaned = themeRaw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
      suggestedTheme = JSON.parse(themeCleaned)
    } catch {
      console.error('[extract-url] Failed to parse theme suggestion')
    }

    return NextResponse.json({ ...data, suggestedTheme })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'URL extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
