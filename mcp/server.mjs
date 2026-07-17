#!/usr/bin/env node
/**
 * docs2video MCP server (agency single-key edition).
 *
 * Exposes the docs2video product to an MCP client (Claude Desktop, Claude Code,
 * etc.) as tools that wrap the public v1 REST API:
 *   • create_video      — explainer video / slide deck / PDF from text, a URL, an
 *                         uploaded file, or an AI-generated idea.
 *   • create_commercial — brand-matched ~30-40s commercial from a URL.
 *   • check_video       — status + result URL for ANY job (video or commercial).
 *   • check_commercial  — alias of check_video for commercial jobs.
 *   • list_videos       — the account's recent videos.
 *   • get_credits       — the account's metered API credit balance.
 *
 * Auth is a SINGLE docs2video API key (your agency account). Everything is
 * generated on — and billed to — that one account's metered API credit pool.
 *
 * Config via env:
 *   DOCS2VIDEO_API_KEY   (required)  your agency API key (Bearer)
 *   DOCS2VIDEO_BASE_URL  (optional)  defaults to https://docs2video.com
 *
 * Run:  DOCS2VIDEO_API_KEY=sk_... node server.mjs
 * Wire it into an MCP client's config (see mcp/README.md).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const API_KEY = (process.env.DOCS2VIDEO_API_KEY || '').trim()
const BASE_URL = (process.env.DOCS2VIDEO_BASE_URL || 'https://docs2video.com').replace(/\/$/, '')
const STYLES = ['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean']

if (!API_KEY) {
  console.error('docs2video-mcp: DOCS2VIDEO_API_KEY is not set — the server cannot authenticate. Set it and restart.')
  process.exit(1)
}

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await r.text()
  let json
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!r.ok) throw new Error(json.error || `HTTP ${r.status}: ${text.slice(0, 160)}`)
  return json
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

// Poll GET /api/v1/videos/{id} until terminal or timeout. Works for BOTH videos
// and commercials (same job store). Cap the wait so the tool can't hang forever.
async function waitForJob(jobId, { timeoutMs = 8 * 60 * 1000, everyMs = 6000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const s = await api(`/api/v1/videos/${jobId}`)
    if (s.status === 'completed') return s
    if (s.status === 'failed') throw new Error(s.error || 'Generation failed')
    await sleep(everyMs)
  }
  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s (job ${jobId} still rendering — use check_commercial to keep polling)`)
}

const server = new Server({ name: 'docs2video', version: '1.0.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'create_video',
      description:
        'Generate a narrated EXPLAINER video (or a slide deck / PDF) from your content. The pipeline reads the source, writes a script + voiceover, builds animated slides, and renders an MP4. Source can be pasted text, a website URL, an uploaded file (base64), or just an idea/topic for AI to build from. Bills the agency account.',
      inputSchema: {
        type: 'object',
        properties: {
          source_type: { type: 'string', enum: ['text', 'url', 'file', 'idea'], description: 'How the content is provided.' },
          text: { type: 'string', description: 'For source_type "text": the content to turn into a video.' },
          url: { type: 'string', description: 'For source_type "url": a website to read and summarize.' },
          file_base64: { type: 'string', description: 'For source_type "file": base64 of a PDF/DOCX/PPTX/TXT/CSV.' },
          filename: { type: 'string', description: 'For source_type "file": the original filename (with extension).' },
          topic: { type: 'string', description: 'For source_type "idea": the topic to build a video about.' },
          purpose: { type: 'string', description: 'REQUIRED. What this video is for / the goal (e.g. "explain our onboarding to new clients").' },
          output_type: { type: 'string', enum: ['video', 'pptx', 'pdf'], description: 'video (default) = narrated MP4; pptx / pdf = downloadable slides.', default: 'video' },
          detail_level: { type: 'string', enum: ['quick', 'standard', 'detailed'], description: 'Length: quick (~1min) / standard (~2-3min, default) / detailed (~5-7min).', default: 'standard' },
          recipient_name: { type: 'string', description: 'Optional. The client this is prepared FOR — appears on the cover + share page.' },
          wait: { type: 'boolean', description: 'If true (default), wait for the render and return the video URL. If false, return a job_id to poll with check_video.', default: true },
        },
        required: ['source_type', 'purpose'],
      },
    },
    {
      name: 'check_video',
      description: 'Check the status of ANY job (video or commercial) started earlier. Returns status, progress, and — when done — the video + thumbnail URLs.',
      inputSchema: {
        type: 'object',
        properties: { job_id: { type: 'string', description: 'The job_id returned by create_video or create_commercial.' } },
        required: ['job_id'],
      },
    },
    {
      name: 'list_videos',
      description: 'List the account\'s recent videos (read-only, no charge). Optionally filter by status.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'How many to return (1-50, default 20).', default: 20 },
          status: { type: 'string', enum: ['completed', 'processing', 'failed', 'queued'], description: 'Optional status filter.' },
        },
        required: [],
      },
    },
    {
      name: 'get_credits',
      description: 'Get the account\'s remaining metered API credit balance.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'create_commercial',
      description:
        'Generate a brand-matched, fully-produced ~30-40s commercial video from a website URL. The pipeline crawls the site, understands the brand, writes the script + voiceover, extracts brand colors, and generates its own voice, imagery, and custom music — the user only needs to supply a URL. Bills the agency account.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: "The website to make a commercial for, e.g. 'https://acme.com'. Required (unless `text` is given)." },
          text: { type: 'string', description: 'Alternative to url: paste raw brand/product text to base the commercial on.' },
          brandName: { type: 'string', description: 'Optional. Force the brand name shown on screen (otherwise derived from the site).' },
          style: { type: 'string', enum: STYLES, description: 'Optional. Force one of the 10 visual styles. Omit to let the director pick the best fit for the brand.' },
          wait: { type: 'boolean', description: 'If true (default), wait for the render (~2-3 min) and return the finished video URL. If false, return immediately with a job_id to poll via check_commercial.', default: true },
        },
        required: [],
      },
    },
    {
      name: 'check_commercial',
      description: 'Check the status of a commercial started earlier with create_commercial (wait:false, or after a timeout). Returns status and, when done, the video URL.',
      inputSchema: {
        type: 'object',
        properties: { job_id: { type: 'string', description: 'The job_id returned by create_commercial.' } },
        required: ['job_id'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params
  try {
    if (name === 'create_video') {
      if (!args.source_type) return toolErr('Provide a `source_type` (text | url | file | idea).')
      if (!args.purpose?.trim?.()) return toolErr('Provide a `purpose` (what the video is for).')
      // Map friendly args → the v1 input shape.
      const input = { type: args.source_type }
      if (args.source_type === 'text') { if (!args.text) return toolErr('`text` is required for source_type "text".'); input.text = args.text }
      else if (args.source_type === 'url') { if (!args.url) return toolErr('`url` is required for source_type "url".'); input.url = args.url }
      else if (args.source_type === 'file') { if (!args.file_base64) return toolErr('`file_base64` is required for source_type "file".'); input.file_base64 = args.file_base64; input.filename = args.filename }
      else if (args.source_type === 'idea') { input.topic = args.topic || args.purpose }
      const started = await api('/api/v1/videos', {
        method: 'POST',
        body: {
          input, purpose: args.purpose,
          outputType: args.output_type || 'video',
          detailLevel: args.detail_level || 'standard',
          recipientName: args.recipient_name,
        },
      })
      const jobId = started.job_id || started.id
      const wait = args.wait !== false
      if (!wait) {
        return toolOk(`Video started.\n\njob_id: ${jobId}\nstatus: queued\ncredits: ${started.credits_charged ?? '—'}\n\nUse check_video with this job_id to get the result when it's ready.`)
      }
      const done = await waitForJob(jobId)
      return toolOk(`✅ Video ready.\n\nvideo: ${done.video_url}\n${done.thumbnail_url ? `thumbnail: ${done.thumbnail_url}\n` : ''}job_id: ${jobId}`)
    }

    if (name === 'check_video') {
      if (!args.job_id) return toolErr('Provide a `job_id`.')
      const s = await api(`/api/v1/videos/${args.job_id}`)
      if (s.status === 'completed') return toolOk(`✅ Ready.\n\nvideo: ${s.video_url}\n${s.thumbnail_url ? `thumbnail: ${s.thumbnail_url}\n` : ''}job_id: ${args.job_id}`)
      if (s.status === 'failed') return toolErr(`Generation failed: ${s.error || 'unknown error'}`)
      return toolOk(`Still working — status: ${s.status}, ${s.progress_pct ?? 0}% done. Check again shortly.`)
    }

    if (name === 'list_videos') {
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50)
      const qs = new URLSearchParams({ limit: String(limit) })
      if (args.status) qs.set('status', args.status)
      const r = await api(`/api/v1/videos?${qs.toString()}`)
      const rows = r.videos || []
      if (!rows.length) return toolOk('No videos found.')
      const lines = rows.map((v) => `• ${v.title || '(untitled)'} — ${v.status}${v.video_url ? ` — ${v.video_url}` : ''}  [${v.id}]`)
      return toolOk(`${rows.length} video(s):\n\n${lines.join('\n')}`)
    }

    if (name === 'get_credits') {
      const r = await api('/api/v1/credits')
      return toolOk(`API credit balance: ${r.balance ?? 0}`)
    }

    if (name === 'create_commercial') {
      if (!args.url && !args.text) return toolErr('Provide a `url` (or `text`).')
      const started = await api('/api/v1/commercials', {
        method: 'POST',
        body: { url: args.url, text: args.text, brandName: args.brandName, style: args.style },
      })
      const jobId = started.job_id
      const wait = args.wait !== false
      if (!wait) {
        return toolOk(`Commercial started.\n\njob_id: ${jobId}\nstatus: queued\ncredits: ${started.credits_charged}\n\nUse check_commercial with this job_id to get the video when it's ready (~2-3 min).`)
      }
      const done = await waitForJob(jobId)
      return toolOk(`✅ Commercial ready.\n\nvideo: ${done.video_url}\n${done.thumbnail_url ? `thumbnail: ${done.thumbnail_url}\n` : ''}job_id: ${jobId}`)
    }

    if (name === 'check_commercial') {
      if (!args.job_id) return toolErr('Provide a `job_id`.')
      const s = await api(`/api/v1/videos/${args.job_id}`)
      if (s.status === 'completed') return toolOk(`✅ Ready.\n\nvideo: ${s.video_url}\n${s.thumbnail_url ? `thumbnail: ${s.thumbnail_url}\n` : ''}job_id: ${args.job_id}`)
      if (s.status === 'failed') return toolErr(`Generation failed: ${s.error || 'unknown error'}`)
      return toolOk(`Still working — status: ${s.status}, ${s.progress_pct ?? 0}% done. Check again shortly.`)
    }

    return toolErr(`Unknown tool: ${name}`)
  } catch (e) {
    return toolErr(e instanceof Error ? e.message : String(e))
  }
})

const toolOk = (text) => ({ content: [{ type: 'text', text }] })
const toolErr = (text) => ({ content: [{ type: 'text', text: `Error: ${text}` }], isError: true })

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('docs2video MCP server running (stdio).')
