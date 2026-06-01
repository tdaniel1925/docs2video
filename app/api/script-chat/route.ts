import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import FirecrawlApp from '@mendable/firecrawl-js'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { buildScriptChatSystemPrompt, DEFAULT_PROMPT_VERSIONS } from '../../_lib/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  return _claude
}

let _firecrawl: InstanceType<typeof FirecrawlApp> | null = null
function getFirecrawl() {
  if (!_firecrawl) _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  return _firecrawl
}

// Detect if message contains a URL to scrape
function needsWebSearch(msg: string): string | null {
  // Match full URLs
  const fullUrl = msg.match(/https?:\/\/[^\s,)]+/)
  if (fullUrl) return fullUrl[0]
  // Match domain-like strings (word.tld)
  const domainMatch = msg.match(/\b([\w-]+\.(?:com|io|ai|org|net|co|dev|app|xyz|us|uk|ca|edu|gov)(?:\/\S*)?)\b/i)
  if (domainMatch) return `https://${domainMatch[1]}`
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { message, scenes, purpose, sourceData, history, videoId } = await request.json()

  if (!message || !scenes) {
    return NextResponse.json({ error: 'Missing message or scenes' }, { status: 400 })
  }

  // Build source reference for the AI
  const sourceRef = sourceData ? JSON.stringify(sourceData).slice(0, 15000) : ''

  // Check if message needs web lookup
  let webContent = ''
  const urlToScrape = needsWebSearch(message)
  if (urlToScrape) {
    try {
      console.log(`[script-chat] Scraping URL: ${urlToScrape}`)
      const result = await getFirecrawl().scrape(urlToScrape, { formats: ['markdown'] }) as any
      const md = result?.markdown || result?.data?.markdown || ''
      if (md.length > 50) {
        webContent = md.slice(0, 10000)
        console.log(`[script-chat] Got ${webContent.length} chars from ${urlToScrape}`)
      }
    } catch (err) {
      console.log(`[script-chat] Web scrape failed:`, err instanceof Error ? err.message : 'unknown')
    }
  }

  const response = await getClaude().messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 8192,
    system: buildScriptChatSystemPrompt(scenes.length, purpose, sourceRef, webContent, urlToScrape),
    messages: [
      // Include conversation history for context
      ...((history || []) as { role: string; text: string }[]).map((h: { role: string; text: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.text,
      })),
      {
        role: 'user' as const,
        content: `Current script:\n${JSON.stringify(scenes, null, 2)}\n\nUser request: ${message}`,
      },
    ],
  })

  const text = (response.content[0]?.type === 'text' ? response.content[0].text : '').trim()
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  // Helper: save a script revision (non-blocking, best-effort)
  async function saveRevision(updatedScenes: any[]) {
    if (!videoId) return
    try {
      const admin = createAdminClient()
      const { data: latestRevision } = await admin
        .from('script_revisions')
        .select('revision_number')
        .eq('video_id', videoId)
        .order('revision_number', { ascending: false })
        .limit(1)
        .single()

      const revisionNumber = (latestRevision?.revision_number ?? 0) + 1

      await admin.from('script_revisions').insert({
        video_id: videoId,
        revision_number: revisionNumber,
        scenes: updatedScenes,
        prompt_versions: DEFAULT_PROMPT_VERSIONS,
      })
      console.log(`[script-chat] Saved revision #${revisionNumber} for video ${videoId}`)
    } catch (err) {
      console.warn(`[script-chat] Failed to save revision:`, err instanceof Error ? err.message : 'unknown')
    }
  }

  try {
    const parsed = JSON.parse(cleaned)

    // Format 1: Diff-based changes
    if (parsed.changes && Array.isArray(parsed.changes) && parsed.changes.length > 0) {
      // Don't await — fire and forget so we don't slow the response
      // Changes are diffs, not full scenes, so we skip revision for diff-based edits
      return NextResponse.json({
        changes: parsed.changes,
        reply: parsed.summary || `Applied ${parsed.changes.length} change${parsed.changes.length > 1 ? 's' : ''}.`,
        suggestion: parsed.suggestion || null,
        options: parsed.options || null,
      })
    }

    // Format 1B: Full scenes replacement (add/delete/reorder)
    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      await saveRevision(parsed.scenes)
      return NextResponse.json({
        scenes: parsed.scenes,
        reply: parsed.summary || `Updated ${parsed.scenes.length} scenes.`,
        suggestion: parsed.suggestion || null,
        options: parsed.options || null,
      })
    }

    // Format 2/3: Reply with optional options
    if (parsed.reply) {
      return NextResponse.json({
        reply: parsed.reply,
        options: parsed.options || null,
      })
    }

    // Legacy: raw array
    if (Array.isArray(parsed)) {
      await saveRevision(parsed)
      return NextResponse.json({ scenes: parsed, reply: `Updated ${parsed.length} scenes.` })
    }

    return NextResponse.json({ reply: 'I couldn\'t process that. Try being more specific about what you want to change.' })
  } catch {
    // If JSON parse fails, treat it as a text reply
    return NextResponse.json({ reply: cleaned.slice(0, 500) })
  }
}
