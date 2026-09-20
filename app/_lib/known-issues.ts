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
  /*
   * THESE USED TO GIVE INSTRUCTIONS FOR A MACHINE THAT NO LONGER EXISTS.
   *
   * They told you to ssh to the Hetzner box, npm install inside a running
   * container, or disable a systemd unit. The renderer runs on ECS Fargate
   * now: a task is replaced, never edited, so anything installed by hand
   * inside it vanishes the moment it restarts.
   *
   * These are shown to a human who is already looking at a failure, so a fix
   * that cannot work is worse than no fix at all — it sends them down a path
   * that ends in confusion rather than a working render.
   */
  {
    match: /cannot find module ['"]?sharp/i,
    title: "Sharp is missing from the render image",
    fix: [
      "The `sharp` image library isn't in the running container, so every slide fails Gemini→sharp processing and falls back to the blank navy card (blue slides).",
      "This is an IMAGE problem, not a running-container problem — installing it by hand inside an ECS task is lost the next time the task restarts.",
      "Fix: add sharp to `render-service/package.json`, then rebuild and redeploy — render-service/DEPLOY.md has the four steps.",
    ].join("\n"),
    docs: "render-service/DEPLOY.md",
  },
  {
    match: /brandName is not defined|brandColors is not defined/i,
    title: "Brand vars not destructured in the render service /generate",
    fix: [
      "The slide compositing step references `brandName`/`brandColors` but they weren't destructured from req.body, so every branded slide throws and falls back to blue.",
      "Fix: in `render-service/server.js` /generate, ensure `const { ..., brandName, brandColors } = req.body` and use a `safeBrandColors` fallback, then rebuild and redeploy (render-service/DEPLOY.md).",
    ].join("\n"),
    docs: "render-service/DEPLOY.md",
  },
  {
    match: /EADDRINUSE.*:?4000|address already in use.*4000/i,
    title: "Port 4000 already bound",
    fix: [
      "Two things are trying to hold port 4000 inside one task. On ECS this normally means the task definition starts more than one container, or the image's CMD runs the server twice.",
      "Fix: check `render-service/ecs-task-definition.json` has a single container on port 4000, then `aws logs tail /ecs/docs2video-service --follow --region us-east-1` to see what else bound it.",
      "Historical note: on the old Hetzner box this was a stale `docs2video-assembler` systemd unit fighting Docker. That box is gone; if you see that name anywhere it is a leftover.",
    ].join("\n"),
    docs: "render-service/DEPLOY.md",
  },
  {
    match: /column .*slide_durations.* does not exist|slide_durations/i,
    title: "slide_durations column missing",
    fix: [
      "The render writes `slide_durations` but the column doesn't exist, so the entire 'completed' DB update is rejected and the video never finishes (share page shows 'no longer available').",
      "Fix: run `supabase/legacy/supabase-slide-durations-migration.sql` in the Supabase SQL editor (ALTER TABLE videos ADD COLUMN IF NOT EXISTS slide_durations jsonb).",
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
      "A narration TTS call failed or returned empty audio. The render service now retries 3x with backoff and FAILS the job (refund + notify) rather than shipping a silent slide.",
      "Check OPENAI_API_KEY validity/quota. If persistent, inspect the narration text for content that may be rejected.",
    ].join("\n"),
  },
  {
    match: /401|Unauthorized.*cron|verifyCronAuth/i,
    title: "Cron / internal auth 401",
    fix: [
      "A cron or internal endpoint returned 401. CRON_SECRET (Vercel cron) or VIDEO_ASSEMBLY_SECRET (render service ↔ app) is missing or mismatched.",
      "Fix: confirm CRON_SECRET is set in Vercel env (it's 'sensitive' so `vercel env pull` redacts it — that's expected). Confirm the render service API_SECRET (SSM /docs2video/) matches the app's VIDEO_ASSEMBLY_SECRET.",
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
