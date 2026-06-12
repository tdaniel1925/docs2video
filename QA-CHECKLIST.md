# Docs2Video — Manual QA Checklist

A do-this / expect-that script covering every user-facing feature. Run before
a release, or after big changes. Automated tests cover the wiring; this covers
what only human eyes catch (visuals, copy, feel).

## How to run the automated tests first
```
npm run test:api          # API smoke + subscription (fast, no AI spend)
npm run test:e2e          # full Playwright UI suite (no real video)
# Real video (spends credits) — Windows PowerShell:
$env:RUN_VIDEO_E2E=1; npm run test:e2e:video
#   macOS/Linux:  RUN_VIDEO_E2E=1 npm run test:e2e:video
```
Local video runs: Creatomate's webhook can't reach localhost. When the run
logs `Creatomate render started: <id>`, finish it with
`node scripts/finalize-creatomate-local.mjs <id>`.

---

## 1. Signup & onboarding
- [ ] Sign up with a fresh email → confirmation flow works
- [ ] **Welcome email arrives** with the 1-2-3 and "Create your first video" button
- [ ] First login lands on dashboard → **"Make your first video" card shows** (only for zero-creation users) with 3 steps + CTA + getting-started link
- [ ] Setup/onboarding wizard (if shown) completes and doesn't loop

## 2. Create a video — the core flow
- [ ] **Step 0 "Who's this for?"** — Existing client / New client / Skip all work
- [ ] New client created inline → appears later on the Clients page
- [ ] Pick a client → on the Content step the **recipient name is pre-filled**
- [ ] Content step: URL scrape, file upload (PDF/DOCX/PPTX), paste text, and "AI writes it" each show a loading state and succeed
- [ ] **Brand step:** with one brand → compact "Using [Brand] — Change"; with multiple → picker. On-the-fly brand with colors works
- [ ] Voice step: single voice grid (no empty "narrator style" section), samples play, length options work
- [ ] Script step: scenes are editable, regenerate works
- [ ] **Generating page:** progress bar moves smoothly (not frozen at 18%), shows "3–5 minutes", and after ~4 min shows "taking longer than usual"
- [ ] Completes → lands on the video page; **video plays**
- [ ] **Recipient name is spoken** in the intro ("Hello [name]…")
- [ ] **Slide colors match the selected brand** (not navy default)
- [ ] **No stray phone number** on the closing slide unless set in the brand
- [ ] **No logo on video slides** (text branding only) — by design
- [ ] Background music is subtle (not overpowering)

## 3. Slide deck (PPTX)
- [ ] Create a deck end to end → downloads a valid PPTX
- [ ] **300 credits deducted** (check balance before/after), refunded if it fails
- [ ] Logo appears on the deck cover/closing slides
- [ ] Style choice changes the look

## 4. Share & deliver
- [ ] "Share with Client" → email sends; client logo in the email header
- [ ] Watch page (public link) plays the video, no login needed
- [ ] Watching it records a view → **Analytics page shows the view** (Total Views > 0)
- [ ] Copy Link / MP4 / PDF / PPTX download buttons work

## 5. Clients
- [ ] Clients page lists clients; search works
- [ ] Add / edit / delete a client
- [ ] "Send Video" on a client → opens the flow with that client preselected
- [ ] Client detail shows activity (email sent, etc.)

## 6. Brands
- [ ] Settings → "Your default brand" edits logo/colors; note links to /brands
- [ ] /brands page manages multiple brands; set default works
- [ ] Logo upload shows the "decks + emails, not videos" note

## 7. Subscription & billing
- [ ] Settings → Subscription shows current plan
- [ ] **Upgrade** → Stripe Checkout opens (test card 4242 4242 4242 4242)
- [ ] After purchase → plan reflects new tier (webhook fired), credits granted
- [ ] **"Manage billing & invoices"** → Stripe portal opens
- [ ] **"Cancel subscription"** button present for paid users → portal cancel flow
- [ ] Buy a credit pack → checkout opens, credits land after payment
- [ ] Out-of-credits / trial-exhausted → clear upgrade path

## 8. Account self-service
- [ ] **Change password** in Settings → Security works
- [ ] **Change email** → confirmation to both inboxes; after confirm, profile email updates
- [ ] Logout works
- [ ] Delete account (danger zone) works

## 9. Support & help
- [ ] Help center articles match the product (video + deck only; no flyers/logos/courses)
- [ ] Contact form → email lands in the support inbox (SUPPORT_EMAIL)
- [ ] FAQ "email support" link works

## 10. Notifications & failure paths
- [ ] Video-ready notification appears in the bell + links to the video
- [ ] Force a failure (bad input) → failed notification links to the video page; credits refunded
- [ ] **Daily digest cron** (admin): trigger with CRON_SECRET → email lists failed/stuck videos

## 11. Cross-cutting
- [ ] No console errors on any page (check the create flow especially)
- [ ] Empty states (no videos, no clients) guide the user, not blank
- [ ] Mobile: nav menu, create flow, and watch page are usable
- [ ] Border radius ≤ 10px everywhere (brand style rule)

---

## Pre-launch gates (must pass)
1. One real video, watched end to end (RUN_VIDEO_E2E)
2. One test-mode subscription purchase → plan activates
3. One test-mode credit-pack purchase → credits land
4. Stripe failed-webhook backlog resent
5. Vercel envs set: USE_PIPELINE_V2 (if enabling), CREATOMATE_API_KEY, Inngest keys, CRON_SECRET, SUPPORT_EMAIL
