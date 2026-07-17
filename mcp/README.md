# docs2video MCP server (agency single-key)

Lets an AI assistant (Claude Desktop, Claude Code, etc.) drive docs2video — make
explainer videos, slide decks, and brand-matched commercials, and check on them —
in natural language: *"make a video that explains this PDF to new clients"* or
*"make a commercial for acme.com."*

Everything is generated on, and billed to, **one agency account** (a single
docs2video API key). A per-customer version (each user's own key) comes later.

## Tools

| Tool | What it does |
|------|--------------|
| `create_video` | Make an **explainer video** (or a `pptx`/`pdf` deck) from `text`, a `url`, an uploaded `file_base64`, or an `idea`/topic. Requires a `purpose`. Optional `output_type`, `detail_level`, `recipient_name`. Waits by default and returns the video URL; pass `wait:false` for an immediate `job_id`. |
| `create_commercial` | Turn a `url` (or `text`) into a finished ~30-40s **commercial**. Optional `brandName`, `style`. Same wait/job_id behavior. |
| `check_video` | Poll ANY `job_id` (video or commercial) for status / the finished URL. |
| `check_commercial` | Alias of `check_video` for commercial jobs. |
| `list_videos` | List the account's recent videos (read-only). Optional `limit`, `status`. |
| `get_credits` | The account's remaining metered API credit balance. |

For a **video**, provide the content (`text`/`url`/`file_base64`/`topic`) + a
`purpose`; the pipeline reads it, writes a script + voiceover, builds animated
slides, and renders an MP4. For a **commercial**, you only need a URL — it crawls
the site, understands the brand, and generates voice, imagery, colors, and music.

Commercial `style` (optional): `fintech, luxury, tech, upbeat, emerald,
redblueprint, data, playful, casino, clean`. Omit it to let the director pick.

## Setup

1. **Get an agency API key** — create one in docs2video (Settings → API keys).
   Fund its API credit pool; each commercial costs 600 credits.

2. **Install deps** (once):
   ```bash
   cd mcp && npm install
   ```

3. **Wire it into your MCP client.** For **Claude Desktop**, add to
   `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`,
   Windows: `%APPDATA%\Claude\`):
   ```json
   {
     "mcpServers": {
       "docs2video": {
         "command": "node",
         "args": ["C:\\dev\\1 - PrismGraphs\\mcp\\server.mjs"],
         "env": {
           "DOCS2VIDEO_API_KEY": "sk_your_agency_key_here"
         }
       }
     }
   }
   ```
   For **Claude Code**:
   ```bash
   claude mcp add docs2video -e DOCS2VIDEO_API_KEY=sk_your_key -- node "C:\dev\1 - PrismGraphs\mcp\server.mjs"
   ```

4. **Restart the client.** Then ask: *"Use docs2video to make a commercial for
   https://smartviewz.com."*

## Config (env)

| Var | Required | Default |
|-----|----------|---------|
| `DOCS2VIDEO_API_KEY` | ✅ | — |
| `DOCS2VIDEO_BASE_URL` | | `https://docs2video.com` |

## How it works

The server is a **thin wrapper** — it calls the same public v1 API the app uses
(Bearer key auth, metered API credit pool). No app code, no DB access:

```
create_video      → POST /api/v1/videos        → job_id → poll GET /api/v1/videos/{id}
create_commercial → POST /api/v1/commercials    → job_id → poll GET /api/v1/videos/{id}
check_video       → GET  /api/v1/videos/{id}
list_videos       → GET  /api/v1/videos?limit=&status=
get_credits       → GET  /api/v1/credits
```

All the heavy lifting (comprehend → script/direct → voiceover → images → render →
upload) happens on the VPS, exactly as in the web app. Videos honor the same
personalization + compliance rules (client-name cover, carrier/product scrub for
insurance, etc.).
