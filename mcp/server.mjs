#!/usr/bin/env node
/**
 * docs2video MCP server (agency single-key edition).
 *
 * Exposes two tools to an MCP client (Claude Desktop, Claude Code, etc.):
 *   • create_commercial — turn a URL into a brand-matched, custom-scored
 *     commercial video. Optionally waits for the render and returns the video URL.
 *   • check_commercial  — poll a job started earlier and get its status/URL.
 *
 * Auth is a SINGLE docs2video API key (your agency account). All commercials are
 * generated on — and billed to — that one account's metered API credit pool. A
 * per-customer version (each user's own key) comes later.
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

// Poll GET /api/v1/videos/{id} until terminal or timeout. Commercials render in
// ~2-3 min; cap the wait so the tool call can't hang forever.
async function waitForJob(jobId, { timeoutMs = 6 * 60 * 1000, everyMs = 6000 } = {}) {
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
