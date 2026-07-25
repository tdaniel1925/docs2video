import { NextResponse } from 'next/server'

/**
 * PUBLIC (remote) MCP endpoint — Streamable HTTP transport.
 *
 * A hosted MCP server anyone can add in Claude via Settings → Connectors → Add
 * custom connector → https://docs2video.com/api/mcp. Exposes two tools that turn
 * a URL into a brand-matched commercial. This is the SHARED-AGENCY-KEY edition:
 * all commercials are generated on, and billed to, the single account whose API
 * key is held server-side in MCP_AGENCY_API_KEY. (A per-user OAuth edition —
 * each customer's own account — is a separate, larger build.)
 *
 * We implement the small JSON-RPC surface directly (initialize / tools/list /
 * tools/call) rather than pulling the MCP SDK's Node-oriented HTTP transport
 * into a Next route — it's only two tools and keeps this dependency-free.
 *
 * Env:
 *   MCP_AGENCY_API_KEY  (required) the docs2video API key commercials bill to
 *   NEXT_PUBLIC_SITE_URL (optional) base for the internal API call
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/$/, '')
const AGENCY_KEY = (process.env.MCP_AGENCY_API_KEY || '').trim()
const STYLES = ['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean', 'glitchcore', 'cinematic', 'noir', 'retro', 'vibrant', 'editorial', 'brutalist', 'aurora', 'sport', 'corporate', 'neon', 'organic']
const PROTOCOL_VERSION = '2025-06-18'
const PRES_TEMPLATES = ['heritage', 'warm', 'bold', 'midnight', 'mint', 'certificate']

const TOOLS = [
  {
    name: 'create_commercial',
    description:
      'Generate a brand-matched, fully-produced ~30-40s commercial video from a website URL (or pasted text). The pipeline understands the brand, writes the script + voiceover, extracts brand colors + logo, and generates voice, imagery, and custom music. IMPORTANT: if the user has a specific goal for the video (e.g. "show the product AND how reps earn from it", "recruit new agents", "drive sign-ups"), pass it in `goal` — that drives the whole video, and the source is used only for facts. Returns a job_id immediately; use check_commercial to get the finished video (~2-3 min).',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: "Website to make a commercial for, e.g. 'https://acme.com'. Required unless `text` is given." },
        text: { type: 'string', description: 'Alternative to url: raw brand/product text.' },
        goal: { type: 'string', description: "Optional but POWERFUL. A plain-English brief of what this video should accomplish and emphasize — the PRIMARY driver of the video's angle/structure. Use it whenever the user wants something specific or different from what the page emphasizes, e.g. 'Showcase SmartViewz AND show how Apex reps earn recurring income selling it.' The source is then used only for accurate facts." },
        brandName: { type: 'string', description: 'Optional. Force the brand name shown (else derived from the site).' },
        style: { type: 'string', enum: STYLES, description: 'Optional. Force one of the visual/motion styles; omit to auto-pick.' },
        logoUrl: { type: 'string', description: "Optional. URL of a logo image to use (else auto-scraped from the site). Backgrounds are auto-removed." },
      },
    },
  },
  {
    name: 'check_commercial',
    description: 'Check the status of a commercial started with create_commercial. Returns status and, when done, the video URL.',
    inputSchema: {
      type: 'object',
      properties: { job_id: { type: 'string', description: 'The job_id from create_commercial.' } },
      required: ['job_id'],
    },
  },
  {
    name: 'create_presentation',
    description:
      'Generate a PERSONALIZED INTERACTIVE PRESENTATION — a narrated, click-through HTML deck hosted on a share page the recipient opens in their browser (with play-through narration, PDF/deck downloads, and contact actions on the closing slide). Perfect for sending to a specific client or prospect, or for nurture campaigns. Give it a source (url or text), a purpose ("show how Jordyn benefits their business"), and optionally recipient_name to personalize the cover + greeting. Returns a job_id and the future share_url; use check_presentation until it completes (~2-4 min), then send the share_url to the recipient.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Website or page to build the presentation from. Required unless `text` is given.' },
        text: { type: 'string', description: 'Alternative to url: raw source text (a document, notes, product info).' },
        purpose: { type: 'string', description: "REQUIRED. What this presentation should accomplish, e.g. 'Show Bill Propper how Jordyn saves his agency hours every week and books him a demo.'" },
        recipient_name: { type: 'string', description: "Personalize for this person — their name appears on the cover ('Prepared for …') and in the narrated greeting." },
        template: { type: 'string', enum: PRES_TEMPLATES, description: 'Visual template. Default heritage (engraved cream/navy/gold).' },
        output_type: { type: 'string', enum: ['interactive', 'deck'], description: "Default 'interactive' (narrated share page). 'deck' = silent slide deck for PDF/PPTX download." },
        contact_name: { type: 'string', description: 'Presenter name for the closing card.' },
        contact_phone: { type: 'string', description: 'Presenter phone for the closing card + spoken outro.' },
        contact_email: { type: 'string', description: 'Presenter email for the closing card.' },
        partner_user_id: { type: 'string', description: 'Optional attribution id (e.g. the calling platform user).' },
      },
      required: ['purpose'],
    },
  },
  {
    name: 'check_presentation',
    description: 'Check the status of a presentation started with create_presentation. When completed, returns the share_url to send to the recipient (and a client deck-PDF link for interactive presentations).',
    inputSchema: {
      type: 'object',
      properties: { job_id: { type: 'string', description: 'The job_id from create_presentation.' } },
      required: ['job_id'],
    },
  },
]

// --- call our own public API v1 with the agency key ---
async function apiV1(path: string, init: { method?: string; body?: unknown } = {}) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${AGENCY_KEY}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const text = await r.text()
  let json: any
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
  return json
}

async function runTool(name: string, args: any) {
  if (name === 'create_commercial') {
    if (!args?.url && !args?.text) throw new Error('Provide a `url` (or `text`).')
    const style = args.style && STYLES.includes(args.style) ? args.style : undefined
    const started = await apiV1('/api/v1/commercials', { method: 'POST', body: { url: args.url, text: args.text, brandName: args.brandName, style, logoUrl: args.logoUrl, goal: args.goal } })
    return `Commercial started.\n\njob_id: ${started.job_id}\nstatus: ${started.status}\ncredits: ${started.credits_charged}\n\nUse check_commercial with this job_id to get the video when it's ready (~2-3 min).`
  }
  if (name === 'check_commercial') {
    if (!args?.job_id) throw new Error('Provide a `job_id`.')
    const s = await apiV1(`/api/v1/videos/${args.job_id}`)
    if (s.status === 'completed') return `✅ Ready.\n\nvideo: ${s.video_url}\n${s.thumbnail_url ? `thumbnail: ${s.thumbnail_url}\n` : ''}job_id: ${args.job_id}`
    if (s.status === 'failed') throw new Error(`Generation failed: ${s.error || 'unknown error'}`)
    return `Still working — status: ${s.status}, ${s.progress_pct ?? 0}% done. Check again shortly.`
  }
  if (name === 'create_presentation') {
    if (!args?.purpose) throw new Error('Provide a `purpose`.')
    if (!args?.url && !args?.text) throw new Error('Provide a `url` (or `text`).')
    const started = await apiV1('/api/v1/presentations', {
      method: 'POST',
      body: {
        input: args.url ? { type: 'url', url: args.url } : { type: 'text', text: args.text },
        purpose: args.purpose,
        recipient_name: args.recipient_name,
        template: PRES_TEMPLATES.includes(args.template) ? args.template : undefined,
        output_type: args.output_type === 'deck' ? 'deck' : 'interactive',
        contact: { name: args.contact_name, phone: args.contact_phone, email: args.contact_email },
        partner_user_id: args.partner_user_id,
      },
    })
    return `Presentation started.\n\njob_id: ${started.job_id}\nstatus: ${started.status}\ncredits: ${started.credits_charged}\nshare_url (live once completed): ${started.share_url}\n\nUse check_presentation with this job_id (~2-4 min).`
  }
  if (name === 'check_presentation') {
    if (!args?.job_id) throw new Error('Provide a `job_id`.')
    const s = await apiV1(`/api/v1/videos/${args.job_id}`)
    if (s.status === 'completed') {
      return `✅ Ready.\n\nshare_url: ${s.share_url}\n${s.deck_pdf_url ? `client deck PDF: ${s.deck_pdf_url}\n` : ''}title: ${s.title || 'Presentation'}\njob_id: ${args.job_id}\n\nSend the share_url to the recipient — it opens the narrated interactive presentation in their browser.`
    }
    if (s.status === 'failed') throw new Error(`Generation failed: ${s.error || 'unknown error'}`)
    return `Still working — status: ${s.status}, ${s.progress_pct ?? 0}% done. Check again shortly.`
  }
  throw new Error(`Unknown tool: ${name}`)
}

// --- JSON-RPC dispatch (MCP core methods) ---
async function handleRpc(msg: any): Promise<any | null> {
  const { id, method, params } = msg || {}
  const reply = (result: any) => ({ jsonrpc: '2.0', id, result })
  const err = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })

  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'docs2video', version: '1.0.0' },
        instructions: 'Generate brand-matched commercial videos (create_commercial → check_commercial) and personalized interactive presentations with narrated share pages (create_presentation → check_presentation → send the share_url to the recipient).',
      })
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null // notifications get no response
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      if (!AGENCY_KEY) return reply({ content: [{ type: 'text', text: 'Error: MCP_AGENCY_API_KEY is not configured on the server.' }], isError: true })
      try {
        const text = await runTool(params?.name, params?.arguments || {})
        return reply({ content: [{ type: 'text', text }] })
      } catch (e: any) {
        return reply({ content: [{ type: 'text', text: `Error: ${e?.message || String(e)}` }], isError: true })
      }
    }
    default:
      return id !== undefined ? err(-32601, `Method not found: ${method}`) : null
  }
}

export async function POST(request: Request) {
  let payload: any
  try { payload = await request.json() } catch { return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 }) }

  // MCP allows single messages or a batch array.
  if (Array.isArray(payload)) {
    const out = (await Promise.all(payload.map(handleRpc))).filter((x) => x !== null)
    return NextResponse.json(out)
  }
  const res = await handleRpc(payload)
  if (res === null) return new NextResponse(null, { status: 202 }) // notification: no body
  return NextResponse.json(res)
}

// Some clients probe with GET; advertise the endpoint is alive (no SSE stream needed
// for our request/response tools).
export async function GET() {
  return NextResponse.json({ name: 'docs2video', transport: 'streamable-http', tools: TOOLS.map((t) => t.name) })
}
