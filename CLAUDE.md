@AGENTS.md

# Project: Docs2Video (docs2video.com)

## CRITICAL RULES

### 1. Read before writing
- ALWAYS read the actual source code before suggesting changes or features
- NEVER assume what exists — grep/read the file first
- NEVER suggest features that already exist in the codebase
- NEVER mention Paddle — this project uses Stripe only

### 2. Keep BUILD-STATE.md updated
- After ANY significant change (new feature, new API route, new page, config change), update `BUILD-STATE.md`
- After fixing bugs, update the "Known Issues" section
- After adding env vars, update the "External Services" table
- This file is the source of truth for project state across sessions

### 3. Payments — Stripe ONLY
- User subscriptions: Stripe (5 tiers from Free to Enterprise — see pricing.ts)
- Client payments: Agent's own Stripe via OAuth Connect
- Per-project charges: Stripe
- NO Paddle, NO other payment processors

### 4. Logo generation — images only, never from text
- OpenAI GPT Image (`logo-styler.ts`) styles existing uploaded logos
- NEVER generate logos from a brand name or text
- If no logo image is uploaded, skip logo kit entirely
- Gemini slides must NEVER render brand names or fake logos

### 5. Default voice is female
- Default voice: Sarah (nova) — first in VOICE_OPTIONS array
- Only change if user explicitly selects a different voice

### 6. Code style
- All border-radius: max 10px (never 100px pills, never >10px)
- Use CSS classes from globals.css, not inline Tailwind
- Design system: warm cream (#F4F1EC) + mint (#C7E8A8) palette
- Font: Plus Jakarta Sans + Instrument Serif

### 7. No unnecessary suggestions
- Don't suggest "what to build next" unless asked
- Don't propose new payment processors
- Don't propose alternative AI services unless current ones are broken
- Focus on fixing what's broken, not adding more

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.6 (Turbopack) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI Images | Gemini 3 Pro Image |
| AI Text | Gemini 2.5 Pro/Flash + Anthropic Claude |
| AI Voice | OpenAI TTS-HD |
| AI Music | Suno via Kie.ai |
| AI Logos | OpenAI GPT Image |
| Video | FFmpeg (Hetzner VPS: VIDEO_ASSEMBLY_URL) |
| Payments | Stripe |
| Email | Gmail API, Microsoft Graph, SMTP, Resend |
| SMS | Twilio |
| Hosting | Vercel |

---

## Key Files

| File | Purpose |
|------|---------|
| `BUILD-STATE.md` | Full project state — update after every change |
| `app/_lib/pricing.ts` | Pricing tiers and limits |
| `app/_lib/stripe.ts` | Stripe config |
| `app/_lib/types.ts` | All TypeScript interfaces |
| `app/_lib/gemini.ts` | Image gen + extraction |
| `app/_lib/script-generator.ts` | Video script generation |
| `app/_lib/tts.ts` | OpenAI voice synthesis |
| `app/_lib/music-generator.ts` | Suno/Kie.ai music |
| `app/_lib/logo-styler.ts` | OpenAI logo styling |
| `app/_lib/composite.ts` | Photo/logo overlay on slides |
| `app/_lib/brand-scraper.ts` | Website brand extraction |
| `app/_lib/video.ts` | FFmpeg video assembly |
| `app/_lib/industries.ts` | 12 industry configurations |
| `app/_lib/email.ts` | Email sending (3 providers) |

---

## Pricing (5 tiers — source of truth: `app/_lib/pricing.ts`)

| Tier | Price | Videos/mo |
|------|-------|-----------|
| Free | $0/mo | 2 (trial) |
| Starter | $29/mo | 5 |
| Pro | $79/mo | 20 (25k credits) |
| Business | $199/mo | 75 |
| Enterprise | $499/mo | 200 |

Extra videos $5 each on paid tiers ($10 on Free). These tiers map 1:1 to the
Apex integration products (`d2v-starter/pro/business/enterprise`).

---

# Help System Maintenance

When adding, removing, or significantly changing any user-facing feature:
1. Update the corresponding help article in `app/(dashboard)/help/` to reflect the change
2. If a new feature is added, create a new help article for it
3. Help articles should include step-by-step instructions with descriptions of what the user sees at each step
4. Keep the help index page (`app/(dashboard)/help/page.tsx`) up to date with links to all articles
5. Use clear, non-technical language suitable for non-developers

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Talk like a normal person — MANDATORY

Write so a smart 10-year-old could follow it. The user is not a programmer and
should never have to decode jargon to know what is going on.

- Short sentences. Plain words. No wall of text.
- Say what a thing DOES, not what it is called. "The page that plays the video"
  beats "the client-side render surface".
- No jargon unless you explain it in the same breath. Banned unless defined:
  blast radius, idempotent, seam, surface, wire up, thread through, composition,
  instrumentation, root-cause (say "find out why"), invalidate, gate.
- No file paths, line numbers, hex colors, or code in normal conversation.
  Those go in the code, not in the answer. Only show them if asked.
- Tables are for short lists of choices, not for explaining ideas.
- When something breaks, say: what broke, what it means for the user, what you
  will do. Three sentences. Not a debugging diary.
- Lead with the answer. Details after, and only if they change a decision.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
