# docs2video MCP server

Lets an AI assistant (Claude Desktop, Claude Code, etc.) drive docs2video — make
explainer videos, slide decks, and brand-matched commercials, and check on them —
in natural language: *"make a video that explains this PDF to new clients"* or
*"make a commercial for acme.com."*

Use **your own** docs2video API key (generate one in **Settings → API & MCP**).
Everything runs on your account and spends your normal subscription credits — the
same pool the web app uses. No separate top-up needed.

## Tools

| Tool | What it does |
|------|--------------|
| `create_video` | Make an **explainer video** (or `pptx`/`pdf` deck) from `text`, a `url`, a `file_base64`, or an `idea`. Requires `purpose`. Accepts the user's choices: `recipient_name`, `brief` (from `preview_brief`), `style`, `voice_id`, `brand_id`, `output_type`, `detail_level`. Returns a **client share-page link** + the MP4. |
| `preview_brief` | Preview what the video WILL cover (summary, angle, key points, figures) from `text`/`url`/`idea` before making it. Show it to the user, let them adjust, then pass the approved brief to `create_video`. No charge. |
| `list_brands` | The account's brand/presenter profiles — ask the user which to use. |
| `list_options` | The available voices, styles, output types, detail levels. |
| `create_commercial` | Turn a `url` (or `text`) into a finished ~30-40s **commercial**. Optional `brandName`, `style`. Returns **download + usage options** (it's an ad, not a client page). |
| `check_video` / `check_commercial` | Poll ANY `job_id`. `check_video` returns the share-page link; `check_commercial` returns download options. |
| `list_videos` | The account's recent videos (read-only). Optional `limit`, `status`. |
| `get_credits` | The account's metered API credit balance. |

### The guided flow (mirrors the web wizard)

`create_video`'s description tells the assistant to **interview** the user before
generating — it will ask for the client name, run `preview_brief` for you to
confirm the angle + key points, and offer style/voice/brand choices — so an
MCP-made video matches what you'd get in the app. Say *"just make it"* and it
falls back to sensible defaults (slides style, Sarah voice, default brand).

**Two result shapes, by design:**
- **Video** → a `docs2video.com/watch/[id]` **share page** to send your client
  (personalized banner, downloads, booking) + the MP4.
- **Commercial** → **download/usage options** (it's an ad — run it or post it; no
  client share page).

Commercial `style` (optional): `fintech, luxury, tech, upbeat, emerald,
redblueprint, data, playful, casino, clean`. Explainer `style`: `slides, aurora,
cinematic, editorial, explainer`. Omit to use the default.

## Setup

1. **Get your API key** — generate one in docs2video under **Settings → API & MCP**.
   It spends your normal subscription credits (a commercial is 600, an explainer
   video 500–1,500 by length) — no separate funding step.

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
