# docs2video MCP server (agency single-key)

Lets an AI assistant (Claude Desktop, Claude Code, etc.) generate brand-matched
commercials from a URL — you just say *"make a commercial for acme.com"*.

All commercials are generated on, and billed to, **one agency account** (a single
docs2video API key). A per-customer version (each user's own key) comes later.

## Tools

| Tool | What it does |
|------|--------------|
| `create_commercial` | Turn a `url` (or `text`) into a finished commercial. By default it waits ~2-3 min and returns the video URL. Pass `wait:false` to get a `job_id` immediately. Optional `brandName`, `style`. |
| `check_commercial` | Poll a `job_id` from `create_commercial` for status / the finished video URL. |

The user only supplies a **URL**. The pipeline does everything else — crawls the
site, understands the brand, writes the script + voiceover, extracts brand colors,
and generates its own voice, imagery, and custom music. No assets to upload.

`style` (optional) is one of: `fintech, luxury, tech, upbeat, emerald,
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

The server is a thin wrapper — it calls the same public API the app uses:

```
create_commercial → POST /api/v1/commercials  (Bearer key, charges API credits)
                  → returns job_id
                  → polls GET /api/v1/videos/{job_id} until done
                  → returns video_url
```

All the heavy lifting (comprehend → direct → VO → images → ElevenLabs Music →
render → upload) happens on the VPS, exactly as in the web app.
