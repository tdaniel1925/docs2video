/**
 * Known-issue knowledge base for the admin Logs fix-advisor.
 *
 * Each entry maps an error signature (regex) to a PROVEN fix — these are real
 * issues we've diagnosed and resolved, so the recommendation is grounded, not a
 * guess. The advisor matches an error against these FIRST; only unmatched errors
 * fall through to the AI diagnoser. Add an entry here whenever a new root cause
 * is confirmed so it becomes an instant, deterministic answer next time.
 */

export interface KnownIssue {
  /** Matched (case-insensitive) against the error message/stack. */
  match: RegExp
  title: string
  /** Concrete, proven remediation steps. */
  fix: string
  /** Optional pointer to docs/runbook. */
  docs?: string
}

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    match: /cannot find module ['"]?sharp/i,
    title: "Sharp module missing on the VPS render container",
    fix: [
      "The `sharp` image library isn't installed in the running container, so every slide fails Gemini→sharp processing and falls back to the blank navy card (blue slides).",
      "Fix (permanent): on the VPS, `cd /root/video-service && npm install sharp --save && docker compose up -d --build`. This bakes sharp into package.json + the image so it survives rebuilds.",
      "Verify: `docker exec docs2video-service node -e \"require('sharp');console.log('ok')\"`.",
    ].join("\n"),
    docs: "vps/DEPLOY.md",
  },
  {
    match: /brandName is not defined|brandColors is not defined/i,
    title: "Brand vars not destructured in VPS /generate",
    fix: [
      "The slide compositing step references `brandName`/`brandColors` but they weren't destructured from req.body, so every branded slide throws and falls back to blue.",
      "Fix: in `vps/server.js` /generate, ensure `const { ..., brandName, brandColors } = req.body` and use a `safeBrandColors` fallback. Redeploy server.js to the VPS.",
    ].join("\n"),
    docs: "vps/DEPLOY.md",
  },
  {
    match: /EADDRINUSE.*:?4000|address already in use.*4000/i,
    title: "Port 4000 already bound (VPS)",
    fix: [
      "Something already holds port 4000 — normally the docs2video-service Docker container. The stale systemd unit `docs2video-assembler` will crash-loop trying to bind it.",
      "Fix: the real server is the Docker container, not systemd. `systemctl disable --now docs2video-assembler`. Confirm the container owns 4000: `ss -ltnp | grep :4000` should show docker-proxy.",
    ].join("\n"),
    docs: "vps/DEPLOY.md",
  },
  {
    match: /column .*slide_durations.* does not exist|slide_durations/i,
    title: "slide_durations column missing",
    fix: [
      "The render writes `slide_durations` but the column doesn't exist, so the entire 'completed' DB update is rejected and the video never finishes (share page shows 'no longer available').",
      "Fix: run `supabase-slide-durations-migration.sql` in the Supabase SQL editor (ALTER TABLE videos ADD COLUMN IF NOT EXISTS slide_durations jsonb).",
    ].join("\n"),
  },
  {
    match: /no image in gemini response|gemini.*(quota|rate|RESOURCE_EXHAUSTED|429)/i,
    title: "Gemini image generation failing / rate-limited",
    fix: [
      "Gemini returned no image or hit a quota/rate limit. Slides fall back to blank cards.",
      "Check: (1) GEMINI_API_KEY valid and has image-model access; (2) billing/quota in Google AI Studio; (3) reduce imageSize from 4K→2K (4K fails more often); (4) the blue-slide quality gate now fails+refunds renders with >30% fallback so customers don't get junk.",
    ].join("\n"),
  },
  {
    match: /(task timed out|FUNCTION_INVOCATION_TIMEOUT|maxDuration|504)/i,
    title: "Vercel function/gateway timeout",
    fix: [
      "A synchronous response ran past Vercel's ~60s gateway limit (independent of maxDuration). Long work must be backgrounded + polled.",
      "Pattern: return 202 immediately, do the work in waitUntil/background, write status to DB, poll from the client (see generate-script → script page). Raising maxDuration alone does NOT fix a long synchronous RESPONSE.",
    ].join("\n"),
  },
  {
    match: /TTS (returned \d+ bytes|failed)|audio\.speech\.create/i,
    title: "OpenAI TTS narration failure",
    fix: [
      "A narration TTS call failed or returned empty audio. The VPS now retries 3x with backoff and FAILS the job (refund + notify) rather than shipping a silent slide.",
      "Check OPENAI_API_KEY validity/quota. If persistent, inspect the narration text for content that may be rejected.",
    ].join("\n"),
  },
  {
    match: /401|Unauthorized.*cron|verifyCronAuth/i,
    title: "Cron / internal auth 401",
    fix: [
      "A cron or internal endpoint returned 401. CRON_SECRET (Vercel cron) or VIDEO_ASSEMBLY_SECRET (VPS↔app) is missing or mismatched.",
      "Fix: confirm CRON_SECRET is set in Vercel env (it's 'sensitive' so `vercel env pull` redacts it — that's expected). Confirm the VPS API_SECRET matches the app's VIDEO_ASSEMBLY_SECRET.",
    ].join("\n"),
  },
  {
    match: /exceeded the maximum allowed size|object exceeded/i,
    title: "Supabase storage upload size limit",
    fix: [
      "An upload exceeded Supabase's Global file size limit (separate from the bucket limit).",
      "Fix: raise the Global file upload size limit in Supabase dashboard → Storage → Settings to match the bucket (e.g. 500MB).",
    ].join("\n"),
  },
]

/** Returns the first known-issue whose pattern matches the error text, or null. */
export function matchKnownIssue(errorText: string): KnownIssue | null {
  const text = errorText || ""
  for (const issue of KNOWN_ISSUES) {
    if (issue.match.test(text)) return issue
  }
  return null
}
