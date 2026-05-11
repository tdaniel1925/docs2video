import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import type { ExtractedData } from '../../_lib/extract-types'

export const runtime = 'nodejs'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

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
    .select('credits_remaining')
    .eq('id', user.id)
    .single()

  if (!profile || profile.credits_remaining <= 0) {
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
    // Fetch the page with browser-like headers
    const fetchRes = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `Failed to fetch URL (status ${fetchRes.status})` }, { status: 400 })
    }

    const html = await fetchRes.text()
    const textContent = stripHtml(html)

    if (textContent.length < 50) {
      return NextResponse.json({ error: 'Could not extract meaningful content from this URL' }, { status: 400 })
    }

    // Truncate to 50k characters
    const truncated = textContent.slice(0, 50000)

    // Send to Gemini for structuring
    const response = await genai.models.generateContent({
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
    })

    const raw = response.text?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    const data: ExtractedData = JSON.parse(cleaned)
    // Set source to the URL if not already set
    if (!data.source) {
      data.source = parsedUrl.hostname
    }
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'URL extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
