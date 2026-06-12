# Docs2Video Public API (v1)

Generate videos (and PowerPoint/PDF decks) programmatically from text, a URL, a
file upload, or an AI prompt. The API mirrors the in-app pipeline, so output
quality is identical to the dashboard.

All endpoints are under `https://docs2video.com/api/v1`.

## Authentication

Every request needs a Bearer API key:

```
Authorization: Bearer d2v_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

Keys are issued by an admin (Admin → API Keys). The raw key is shown **once** at
creation and stored only as a SHA‑256 hash — save it securely. A revoked key
returns `401`.

## Credits

API usage draws from a **separate metered API credit pool**, independent of the
UI subscription credits. An admin tops it up (Admin → API Keys → Top up).
Per‑job cost:

| Output | Detail | Credits |
|--------|--------|---------|
| video  | quick    | 250 |
| video  | standard | 500 |
| video  | detailed | 750 |
| pptx   | —        | 400 |
| pdf    | —        | 300 |

Credits are charged when a job is accepted and **automatically refunded** if the
job fails to start or fails during rendering.

## Create a job — `POST /api/v1/videos`

Asynchronous: returns immediately with a `job_id`. Poll the job or supply a
`webhook_url` for a push callback.

### Request body

```jsonc
{
  "input": {
    "type": "text",            // "text" | "url" | "file" | "idea"
    "text": "Paste content…",  // for type "text"
    "url": "https://…",        // for type "url"
    "file_base64": "…",        // for type "file" (base64 of the file bytes)
    "filename": "report.pdf",  // for type "file"
    "topic": "…",              // for type "idea"
    "audience": "…",           // optional, type "idea"
    "tone": "professional"     // optional, type "idea"
  },
  "purpose": "Explain this policy to a new client",  // REQUIRED — what the video should accomplish
  "outputType": "video",       // "video" | "pptx" | "pdf"  (default "video")
  "detailLevel": "standard",   // "quick" | "standard" | "detailed"  (video only)
  "brandId": null,             // optional brand id owned by the account
  "voiceId": "nova",           // optional TTS voice
  "styleId": "apex-corporate", // optional slide style
  "recipientName": "Jane",     // optional — spoken in the opening
  "webhook_url": "https://your-app.com/hooks/d2v"  // optional push callback
}
```

### Responses

- `202 Accepted` — `{ "job_id": "uuid", "status": "queued", "credits_charged": 500 }`
- `400` — bad input (missing `purpose`, missing input field, invalid URL)
- `401` — missing/invalid/revoked key
- `402` — insufficient API credits
- `422` — could not extract usable content
- `429` — rate limit (default 60 create calls per key per hour)
- `502` — extraction or generation backend failed (credits refunded)

### Example

```bash
curl -X POST https://docs2video.com/api/v1/videos \
  -H "Authorization: Bearer d2v_live_…" \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "type": "text", "text": "Q3 revenue grew 18% to $2.4M…" },
    "purpose": "Summarize Q3 results for investors",
    "outputType": "video",
    "detailLevel": "standard"
  }'
```

## Check a job — `GET /api/v1/videos/{job_id}`

```jsonc
{
  "id": "uuid",
  "status": "queued",      // queued | processing | completed | failed
  "progress_pct": 42,
  "video_url": null,       // populated when completed (video output)
  "thumbnail_url": null,
  "slide_urls": null,      // array of slide image URLs when available
  "error": null,           // set when status = failed
  "created_at": "2026-06-12T…Z"
}
```

`404` if the job doesn't exist **or** isn't owned by your key. Poll every few
seconds; a typical video completes in a couple of minutes.

## Webhook callback

If you pass `webhook_url`, we `POST` the same JSON payload as the status
endpoint to that URL once, when the job reaches `completed` or `failed`. The
request has `Content-Type: application/json` and a 10‑second timeout; it is
best‑effort and not retried, so always treat polling as the source of truth.

> Note: push callbacks fire on the Creatomate (pipeline v2) path. On the legacy
> VPS path (v1), poll the job for completion; failure callbacks still fire.

## Check API credit balance — `GET /api/v1/credits`

```json
{ "balance": 4250 }
```

## Notes & limits

- Rate limit: 60 `POST /api/v1/videos` calls per key per rolling hour (`429`).
- URL inputs are fetched through the same SSRF‑guarded scraper as the app;
  internal/private addresses are rejected.
- File uploads accept PDF, DOCX, and PPTX. Send the raw bytes base64‑encoded.
- No carrier/product names are spoken in insurance videos, and no contact info
  is invented — same content rules as the dashboard.
