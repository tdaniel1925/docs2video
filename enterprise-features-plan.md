# Enterprise Features Plan

## Phase 1 — Build Now (High Value, Fast to Ship)

### 1. Viewer Attestation
- **Tier:** Business+ ($99)
- **What:** Checkbox at end of video: "I acknowledge I have reviewed this material"
- **Storage:** Timestamp, viewer email/name, video ID, IP → `video_attestations` table
- **Value:** Compliance proof, E&O protection, regulatory requirement for training

### 2. Quiz / Knowledge Check
- **Tier:** Business+ ($99)
- **What:** 2-3 auto-generated multiple-choice questions shown after video completes
- **Generation:** Gemini generates questions from the script during video creation
- **Storage:** `video_quizzes` table (questions + correct answers), `quiz_responses` table (viewer answers + score)
- **Value:** Proves training ROI, compliance proof, engagement metric

### 3. Per-Viewer Watch Analytics
- **Tier:** Pro+ ($25)
- **What:** Dashboard showing who watched, how much, when, completion rate
- **Infra:** Already tracking views — surface as a per-video analytics tab in dashboard
- **Value:** Sales knows who engaged, HR knows who completed training

### 4. Playlist / Series
- **Tier:** Pro+ ($25)
- **What:** Group videos in ordered series ("Onboarding: 1 of 5"), shared playlist page
- **Storage:** `playlists` table (name, order, video_ids)
- **Value:** Sticky — one video is a tool, a series is a platform

---

## Phase 2 — Enterprise Tier Only (Build on Demand)

| Feature | Notes |
|---------|-------|
| SSO / SAML | Require enterprise contract, use Auth0 or WorkOS |
| Custom domains | CNAME setup, SSL via Vercel |
| SCORM / LMS export | Package as SCORM 1.2 for Cornerstone, Workday |
| CRM sync (Salesforce, HubSpot) | Push view events as engagement activities |
| API access | Programmatic video creation for bulk content |
| Embed code + iframe support | One-click embed for LMS, intranet, Notion |
| Expiration / auto-archive | Videos expire after set date, auto-flag stale content |
| Version history | Track which version viewer saw, flag updates |
| Branching paths | Interactive "choose your path" mid-video |

---

## Tier Gating Strategy

- **Free:** Basic share page, no analytics
- **Pro ($25):** Per-viewer analytics, playlists
- **Business ($99):** Attestation, quizzes, full analytics dashboard
- **Agency ($249):** White-label, team management, all Business features
- **Enterprise ($custom):** SSO, custom domain, SCORM, CRM sync, API, SLA

---

## Build Order

1. Viewer attestation (simplest, highest compliance value)
2. Quiz/knowledge check (Gemini auto-generates from script)
3. Per-viewer analytics dashboard (infra already exists)
4. Playlist/series grouping

---

## Key Selling Points for CIPRS / Corporate Pitch

- "Proof of disclosure" — attestation satisfies insurance regulators
- "Training compliance in minutes" — auto-generated quiz from any document
- "Full audit trail" — who saw what, when, and did they understand it
- "Onboarding in a box" — playlist series replaces manual walkthroughs
