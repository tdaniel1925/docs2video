/**
 * COMMERCIAL PIPELINE (VPS) — the production port of
 * scripts/director/make-commercial.ts. Runs on the VPS: read a URL (or pasted
 * text) → comprehend (Claude) → DIRECT a commercial spec (styleId + beats) →
 * per-beat word-timed VO + literal hero images → build the commercialSchema props
 * JSON + assets in `public/<assetDir>/`. The caller (server.js /generate-commercial)
 * then renders the TemplateCommercial composition + uploads.
 *
 * Reuses slides.js helpers (claude, comprehend, ttsTimed, cloudflareImage, brand
 * palette) so we don't duplicate the API plumbing. Only NEW piece here is the
 * director prompt + the beat→props mapping.
 */
const { writeFile, stat } = require('fs/promises')
const { join } = require('path')
const { execFile } = require('child_process')
const { claude, comprehend, ttsTimed, cloudflareImage, cloudflareAvailable, CARRIER_BLOCKLIST } = require('./slides')

const FPS = 30
const STYLE_IDS = ['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean', 'glitchcore', 'cinematic', 'noir', 'retro', 'vibrant', 'editorial', 'brutalist', 'aurora', 'sport', 'corporate', 'neon', 'organic']
function extractJson(t) { const s = t.indexOf('{'); const e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)) }
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'brand'

// ---------- single-page HTML fetch → text (no browser; enough for a commercial) ----------
async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; docs2video/1.0)' }, signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`fetch ${r.status}`)
  return await r.text()
}
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 60000)
}

// ---------- brand palette (extract the site accent, build a cinematic dark set) ----------
const FRAMEWORK_HEXES = new Set(['#ffffff', '#000000', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da', '#6c757d', '#343a40', '#212529', '#007bff', '#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#28a745', '#198754', '#20c997', '#17a2b8', '#f5f5f5', '#eeeeee', '#e0e0e0'])
function hexToRgb(h) { const n = h.replace('#', ''); return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)] }
function rgbToHex(r, g, b) { const c = (n) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); return '#' + c(r) + c(g) + c(b) }
function lift(hex, k) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) }
function lum(h) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 }
function sat(h) { const [r, g, b] = hexToRgb(h); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }

// Pull the true brand accent from a page's HTML/CSS: most-frequent, saturated,
// non-framework hex (filters Bootstrap/Tailwind defaults — the Apex bug).
function extractAccent(html) {
  const hexes = [...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase())
  const varHit = [...html.matchAll(/--[\w-]*(?:primary|brand|accent|main|theme)[\w-]*\s*:\s*(#[0-9a-fA-F]{6})/gi)].map((m) => m[1].toLowerCase())
  const freq = {}
  for (const h of hexes) { if (FRAMEWORK_HEXES.has(h)) continue; if (sat(h) < 0.35) continue; const l = lum(h); if (l < 0.05 || l > 0.9) continue; freq[h] = (freq[h] || 0) + 1 }
  for (const v of varHit) if (!FRAMEWORK_HEXES.has(v) && sat(v) >= 0.3) freq[v] = (freq[v] || 0) + 5   // CSS vars weigh heavier
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([h]) => h)
  const primary = ranked[0] || null
  const secondary = ranked.find((h) => Math.abs(lum(h) - lum(primary || '#000')) > 0.12 || sat(h) > 0.5 && h !== primary) || null
  return { primary, secondary }
}
function buildBrand(accent, secondary) {
  let acc = accent || '#6ea8fe'
  if (lum(acc) < 0.22) acc = lift(acc, 0.35)
  const [ar, ag, ab] = hexToRgb(acc)
  return {
    bg: rgbToHex(ar * 0.08 + 8, ag * 0.08 + 9, ab * 0.08 + 12),
    bg2: rgbToHex(ar * 0.16 + 12, ag * 0.16 + 14, ab * 0.16 + 20),
    panel: rgbToHex(ar * 0.10 + 22, ag * 0.10 + 22, ab * 0.10 + 26),
    accent: acc, accentHi: lift(acc, 0.4),
    accent2: secondary && lum(secondary) > 0.15 ? lift(secondary, lum(secondary) < 0.3 ? 0.35 : 0) : lift(acc, 0.15),
    cream: '#f4f1ea', mute: '#9fa2ad', white: '#ffffff',
  }
}

// ---------- LOGO: find + download the site's real logo, and derive brand color
// from it. Priority: <meta og:image (logo-ish)> → header/nav <img> whose src/alt
// says "logo" → apple-touch-icon → link rel icon → /favicon. Returns the saved
// relative path (in the asset dir) or null. Also returns the logo's dominant
// saturated color so brand color can come from the LOGO when the page CSS is just
// Bootstrap defaults (the Apex bug). Uses sharp (present on the VPS). ----
function absUrl(src, base) { try { return new URL(src, base).href } catch { return null } }

function findLogoCandidates(html, pageUrl) {
  const cands = []
  const push = (u) => { const a = absUrl(u, pageUrl); if (a && !cands.includes(a)) cands.push(a) }
  // 1) explicit logo-named images in the header/nav area (strongest signal)
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0]
    const src = (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1]
    if (!src) continue
    const alt = (tag.match(/\balt=["']([^"']*)["']/i) || [])[1] || ''
    const cls = (tag.match(/\bclass=["']([^"']*)["']/i) || [])[1] || ''
    if (/logo|brand/i.test(src) || /logo|brand/i.test(alt) || /logo|brand/i.test(cls)) push(src)
  }
  // 2) apple-touch-icon (usually the real brand mark, high-res)
  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi)) {
    const href = (m[0].match(/\bhref=["']([^"']+)["']/i) || [])[1]; if (href) push(href)
  }
  // 3) og:image (often a logo/brand card)
  const og = (html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i) || [])[1]
  if (og) push(og)
  // 4) any icon link
  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)) {
    const href = (m[0].match(/\bhref=["']([^"']+)["']/i) || [])[1]; if (href) push(href)
  }
  // 5) /favicon.ico as a last resort
  push('/favicon.ico')
  return cands
}

// download a candidate, normalize to PNG, reject junk (too small, not an image).
// Returns { buffer, width, height } or null.
async function downloadImage(u) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) })
    if (!r.ok) return null
    const ct = r.headers.get('content-type') || ''
    if (!/image|octet-stream/i.test(ct) && !/\.(png|jpe?g|svg|webp|ico)(\?|$)/i.test(u)) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 200) return null
    const sharp = require('sharp')
    // SVG: rasterize at a good size; others: just load
    const img = sharp(buf, { density: 384 })
    const meta = await img.metadata()
    if (!meta.width || !meta.height) return null
    // reject tiny favicons only if we truly have nothing better (caller ranks)
    const png = await img.png().toBuffer()
    return { buffer: png, width: meta.width, height: meta.height, area: meta.width * meta.height }
  } catch { return null }
}

// The BRAND color of an image (logo or screenshot): the most PROMINENT vivid
// color — not just the most common. We weight each color bucket by frequency ×
// saturation² so a punchy accent (a red nav bar) beats a large muted area (a
// navy/grey background). Ignores white/black/grey/transparent. `vividBias` (>1)
// leans harder toward saturation (used for screenshots where the accent is a
// minority of pixels).
async function logoDominantColor(pngBuffer, vividBias = 1) {
  try {
    const sharp = require('sharp')
    const { data, info } = await sharp(pngBuffer).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const buckets = {}
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = info.channels > 3 ? data[i + 3] : 255
      if (a < 128) continue
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const s = mx ? (mx - mn) / mx : 0
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      if (s < 0.4 || l < 0.1 || l > 0.9) continue          // skip white/black/grey/muted
      const key = `${r >> 4},${g >> 4},${b >> 4}`           // 16-level bucket
      ;(buckets[key] = buckets[key] || { n: 0, r: 0, g: 0, b: 0, s: 0 })
      buckets[key].n++; buckets[key].r += r; buckets[key].g += g; buckets[key].b += b; buckets[key].s += s
    }
    const vals = Object.values(buckets)
    if (!vals.length) return null
    // score = frequency × saturation^(1+vividBias): prominence, but vividness wins
    let top = null, best = -1
    for (const v of vals) {
      const avgS = v.s / v.n
      const score = v.n * Math.pow(avgS, 1 + vividBias)
      if (score > best) { best = score; top = v }
    }
    return rgbToHex(top.r / top.n, top.g / top.n, top.b / top.n)
  } catch { return null }
}

// Fetch the best logo: prefer a real header/apple-touch logo with area, skip
// tiny favicons unless nothing else. Saves PNG to dir/logo.png, returns
// { rel, color } (color = dominant hue for brand fallback) or { rel:null }.
async function fetchLogo(html, pageUrl, dir) {
  const path = require('path')
  const { writeFile } = require('fs/promises')
  const cands = findLogoCandidates(html, pageUrl)
  let best = null
  for (let i = 0; i < Math.min(cands.length, 8); i++) {
    const u = cands[i]
    const img = await downloadImage(u)
    if (!img) continue
    // score: prefer bigger + wider (wordmark logos are wide); heavily penalize
    // favicon-sized icons (<64px) so they're only used if nothing else exists.
    const w = img.width, h = img.height
    const tiny = Math.min(w, h) < 64
    // AFFILIATION-BADGE PENALTY: dental/business sites festoon their pages with
    // membership badges (McKinney Chamber, ADA, Dental Society, BBB, awards) that
    // ARE logos but NOT the brand's own — the old size-only scorer picked the
    // widest one (the Chamber badge for Waterview Dentistry). Heavily demote any
    // candidate whose URL looks like a 3rd-party badge, and reward earlier
    // (header-position) candidates, which is where a site's REAL logo lives.
    const badge = /chamber|associat|\bada\b|-ada-|society|\bbbb\b|better.business|accredit|member|award|badge|partner|certifi|endorse|affiliat|google.review|yelp|facebook|verified/i.test(u)
    const orderBonus = Math.max(0, 400 - i * 120)   // 1st cand +400, 2nd +280, ...
    const score = (tiny ? 0 : 1000) + img.area / 1000 + (w > h ? 200 : 0) + orderBonus + (badge ? -5000 : 0)
    if (!best || score > best.score) best = { ...img, url: u, score }
  }
  if (!best) return { rel: null, color: null }
  const color = await logoDominantColor(best.buffer)
  // KNOCKOUT: if the logo has a solid opaque background (e.g. a white box — the
  // Domino's case), remove it so it sits cleanly on the dark video. rembg is
  // baked into this image. Skip if already transparent or if rembg fails.
  let finalBuf = best.buffer
  try {
    if (await needsKnockout(best.buffer)) {
      const ko = await knockoutLogo(best.buffer, dir)
      if (ko) finalBuf = ko
    }
  } catch { /* keep original on any failure */ }
  // SANITIZE + DOWNSCALE: scraped "logos" are sometimes huge hero/OG images
  // (Compass gave a 5100x3300, 20MB PNG). A giant image crashes Chrome's decoder
  // in the intro + per-frame corner bug and kills the render (EncodingError).
  // Cap the longest side and re-encode to a clean PNG. A real logo is small; this
  // is lossless for legit logos and life-saving for oversized scrapes.
  finalBuf = await sanitizeLogo(finalBuf)
  const outAbs = path.join(dir, 'logo.png')
  await writeFile(outAbs, finalBuf)
  return { rel: 'logo.png', color }
}

// Re-encode any candidate logo to a safe, render-friendly PNG (max 800px longest
// side, alpha preserved). Returns the original buffer if sharp can't process it
// (better a stale logo than a crashed pipeline — the beat still renders).
async function sanitizeLogo(buf) {
  try {
    const sharp = require('sharp')
    const meta = await sharp(buf).metadata()
    const longest = Math.max(meta.width || 0, meta.height || 0)
    let img = sharp(buf).ensureAlpha()
    if (longest > 800) img = img.resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    return await img.png({ compressionLevel: 9 }).toBuffer()
  } catch { return buf }
}

// Does this PNG have a solid, mostly-opaque background that should be removed?
// A clean logo mark is either already transparent (lots of alpha=0 pixels) or
// tightly cropped. A "logo on a white box" has ~all pixels opaque AND its border
// pixels are a uniform bright color. Returns true only for the box case.
async function needsKnockout(pngBuffer) {
  try {
    const sharp = require('sharp')
    const { data, info } = await sharp(pngBuffer).resize(40, 40, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const ch = info.channels, W = info.width, H = info.height
    let transparent = 0, total = 0
    const border = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch; total++
      if (data[i + 3] < 40) transparent++
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
    }
    if (transparent / total > 0.12) return false                 // already has transparency → leave it
    // is the border a uniform opaque color (a solid box)?
    const opaqueBorder = border.filter((p) => p[3] > 200)
    if (opaqueBorder.length < border.length * 0.85) return false  // border isn't solid → probably already clean
    const [r0, g0, b0] = opaqueBorder[0]
    const uniform = opaqueBorder.every((p) => Math.abs(p[0] - r0) < 24 && Math.abs(p[1] - g0) < 24 && Math.abs(p[2] - b0) < 24)
    return uniform                                                // solid uniform border on an opaque image → knockout
  } catch { return false }
}

// Run rembg (baked into the image) to remove the logo's background. Returns the
// transparent PNG buffer, or null on failure.
async function knockoutLogo(pngBuffer, dir) {
  try {
    const path = require('path'); const { writeFile, readFile, rm } = require('fs/promises')
    const inP = path.join(dir, '_logo-in.png'), outP = path.join(dir, '_logo-ko.png')
    await writeFile(inP, pngBuffer)
    await new Promise((resolve, reject) => {
      execFile('rembg', ['i', '-a', '-ae', '15', inP, outP], { timeout: 45000, env: { ...process.env, U2NET_HOME: '/root/.u2net' } },
        (err) => err ? reject(err) : resolve())
    })
    const buf = await readFile(outP)
    await rm(inP, { force: true }).catch(() => {}); await rm(outP, { force: true }).catch(() => {})
    return buf && buf.length > 500 ? buf : null
  } catch { return null }
}

// ---------- BRAND COLORS via VISION: show the screenshot to Claude and let it
// NAME the brand's primary + secondary colors. Far more reliable than pixel-
// averaging for pages where the accent is a thin strip (e.g. a red nav bar on a
// mostly-navy page — the Apex case). Returns { primary, secondary } hex or null. ----
async function nameBrandColors(pngBuffer) {
  try {
    const KEY = process.env.ANTHROPIC_API_KEY
    if (!KEY) return null
    const b64 = pngBuffer.toString('base64')
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-8', max_tokens: 200,
        system: 'You identify a brand\'s color palette from a screenshot of its website. Return ONLY compact JSON: {"primary":"#rrggbb","secondary":"#rrggbb"}. primary = the brand\'s main ACCENT/identity color (the vivid one used in the logo, nav bar, buttons, headings) — NOT a neutral background. secondary = the next distinct brand color (or a complementary one). Pick real, saturated brand colors; ignore pure white/black/grey. If only one clear brand color exists, set secondary to a darker/lighter tone of primary.',
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
          { type: 'text', text: 'What are this brand\'s primary and secondary colors?' },
        ] }],
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!r.ok) return null
    const j = await r.json()
    const txt = j.content && j.content[0] && j.content[0].text || ''
    const m = txt.match(/\{[\s\S]*\}/); if (!m) return null
    const obj = JSON.parse(m[0])
    const ok = (h) => typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h)
    if (!ok(obj.primary)) return null
    return { primary: obj.primary.toLowerCase(), secondary: ok(obj.secondary) ? obj.secondary.toLowerCase() : null }
  } catch { return null }
}

// ---------- RENDERED METADATA (for JS-heavy SPA sites): many big brands render
// their content client-side, so a raw fetch returns near-zero text (dominos.com,
// etc). microlink renders the page in a real browser and returns its title +
// description + og data — enough for the director to understand the brand when
// the raw HTML is empty. Returns a text blob or null. ----
// JUNK/BOT-WALL DETECTOR — a raw fetch often returns a platform interstitial or
// anti-bot page instead of the real site (e.g. realtyfirmglobal.com is built on
// Lofty and serves a 357-char "Lofty does not support embedding... clickjacking
// ... contact bugreport@moatable.com" notice). That boilerplate is JUST over the
// thin-content threshold, so without this check the director "understands the
// brand" as the PLATFORM (Lofty) and ships a confident WRONG-BRAND video. Any
// text matching these patterns is not real brand content — treat as unreadable.
function isJunkContent(text) {
  if (!text) return true
  const t = String(text).toLowerCase()
  const PATTERNS = [
    'does not support embedding', 'inside iframes', 'iframes or framesets',
    'clickjacking', 'bugreport@moatable', 'lofty does not',
    'press & hold', 'px-captcha', 'perimeterx', 'unusual traffic',
    'enable javascript', 'please enable cookies', 'access denied',
    'are you a robot', 'verify you are human', 'human verification',
    'checking your browser', 'cloudflare', 'captcha', 'ddos protection',
  ]
  // short AND matching a wall pattern = junk. (A long real page might legitimately
  // mention "captcha" in copy, so require it to be short-ish to count as a wall.)
  const short = t.length < 1200
  return short && PATTERNS.some((p) => t.includes(p))
}

async function fetchRenderedMeta(pageUrl) {
  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(pageUrl)}&meta=true&screenshot=false`, { signal: AbortSignal.timeout(30000) })
    if (!r.ok) return null
    const j = await r.json()
    const d = j && j.data
    if (!d) return null
    const parts = [d.title, d.description, d.author, d.publisher].filter(Boolean)
    const txt = parts.join('. ').trim()
    // microlink's PRERENDER can also return the wall; its plain meta usually gets
    // the real og:title/description. Reject junk so we never feed a wall downstream.
    if (isJunkContent(txt)) return null
    return txt.length >= 40 ? txt : null
  } catch { return null }
}

// ---------- SCREENSHOT: capture a clean viewport shot of the real site via the
// microlink API (free tier, no key, no browser to manage). Saves to dir/site.png
// and returns the rel path, or null on any failure (caller then falls back to an
// AI backdrop — NEVER ships a broken/blank shot). Used sparingly + director-gated
// so we don't spam random screenshots. ----
async function captureScreenshot(pageUrl, dir) {
  try {
    const target = encodeURIComponent(pageUrl)
    const api = `https://api.microlink.io/?url=${target}&screenshot=true&meta=false&viewport.width=1280&viewport.height=800&waitUntil=networkidle2`
    const r = await fetch(api, { signal: AbortSignal.timeout(35000) })
    if (!r.ok) return null
    const j = await r.json()
    const shotUrl = j && j.data && j.data.screenshot && j.data.screenshot.url
    if (!shotUrl) return null
    const img = await fetch(shotUrl, { signal: AbortSignal.timeout(25000) })
    if (!img.ok) return null
    const buf = Buffer.from(await img.arrayBuffer())
    if (buf.length < 3000) return null              // reject blank/error images
    // normalize + verify it's a real image via sharp; crop off any huge dead space
    const sharp = require('sharp')
    const meta = await sharp(buf).metadata()
    if (!meta.width || meta.width < 400) return null
    const path = require('path'); const { writeFile } = require('fs/promises')
    const png = await sharp(buf).png().toBuffer()
    await writeFile(path.join(dir, 'site.png'), png)
    return 'site.png'
  } catch { return null }
}

// ---------- COMPLIANCE: detect regulated (insurance/financial) content so the
// director applies the guardrails — no carrier/product-as-guarantee claims, no
// invented returns/income figures, no promises. Mirrors the illustration rule
// spirit (remotion/src/lib/compliance.ts) for the commercial context. ----
function isRegulated(u) {
  const hay = JSON.stringify(u || {}).toLowerCase()
  return /\b(insuranc|annuit|iul|life policy|indexed universal|premium|underwrit|carrier|policyholder|book of business|licensed agent|financial advisor|retirement|investment|securit|fiduciary|medicare|final expense)\b/.test(hay)
}
const COMPLIANCE_CLAUSE = `
COMPLIANCE (regulated financial/insurance content detected) — STRICT:
- NEVER promise or imply specific returns, income amounts, or guaranteed results. If the source has no stated figure, sell the CONCEPT only (e.g. "recurring income", "grow your book") with NO number.
- NEVER present the product as a guarantee. No "guaranteed", "risk-free", "you will earn/make $X".
- Do not name a specific insurance CARRIER or branded illustration product as the source of a claim.
- Keep claims general and defensible; the viewer is directed to a licensed rep / the real materials for specifics.
- This is marketing, not financial advice — keep it aspirational but truthful.`

// scrub VO/headlines of hard guarantee language as a belt-and-suspenders pass
// (the director prompt already avoids it; this is the safety net). Removes the
// phrase cleanly rather than substituting awkward filler.
function scrubGuarantees(spec) {
  const banned = [/\b(100%\s+)?guaranteed\b/ig, /\bguarantees?\b/ig, /\brisk[- ]free\b/ig, /\bno risk\b/ig, /\bget rich\b/ig]
  const clean = (s) => typeof s === 'string' ? banned.reduce((x, re) => x.replace(re, ''), s).replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim() : s
  for (const b of (spec.beats || [])) { b.vo = clean(b.vo); b.pre = clean(b.pre); b.hot = clean(b.hot); b.post = clean(b.post); b.sub = clean(b.sub)
    if (b.cta) { b.cta.headline = clean(b.cta.headline) } }
  return spec
}

// ---------- CARRIER/PRODUCT SCRUB (regulated content): the prompt asks the LLM
// not to name the carrier or branded product, but LLMs ignore negative rules when
// the source repeats the name 100x (a Mutual of Omaha illustration leaked both).
// This is the CODE-LEVEL net: strip known-carrier names + any branded product
// name(s) detected in the source + specific dollar figures, from all vo/on-screen
// text. Must run AFTER all LLM steps (hook/critique/consistency can re-add them).
// NOTE: CARRIER_BLOCKLIST is imported from ./slides (the single canonical list);
// commercials scrub figures too (they're marketing, not a coverage explainer).
function scrubCarrierProduct(spec, u, brandName) {
  // build the strip list: blocklist + any branded product tokens from the source
  const strip = new Set(CARRIER_BLOCKLIST)
  for (const n of productNames(u, brandName)) if (n && n.length >= 3) strip.add(n.toLowerCase())
  // longest-first so multi-word carriers are removed before sub-words. No \b
  // anchors (they fail around the trailing optional group + the ℠/®/™ marks);
  // a trailing optional suffix group eats "IUL", "Life Insurance Company", etc.
  const terms = [...strip].filter(Boolean).sort((a, b) => b.length - a.length)
  const res = terms.map((t) => new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&') + '(?:\\s?(?:iul|life insurance company|life insurance|life|insurance company|insurance|company|policy|group|financial|iii|ii|iv|vi|v(?![a-z])|\\u2120|\\u00ae|\\u2122))*', 'ig'))
  // also strip specific dollar figures + percentages that shouldn't appear
  const figRe = [/\$\s?\d[\d,]*(?:\.\d+)?/g, /\b\d+(?:\.\d+)?\s?%/g]
  const clean = (s) => {
    if (typeof s !== 'string') return s
    let out = s
    for (const re of res) out = out.replace(re, '')
    for (const re of figRe) out = out.replace(re, '')
    out = out.replace(/(^|\s)\+?\s*(?:iii|ii|iv|vi)\b/gi, '$1').replace(/(^|\s)\+(?=\s|$)/g, '$1')
    return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1').replace(/^[\s—–-]+|[\s—–-]+$/g, '').trim()
  }
  const cleanBeat = (b) => {
    b.vo = clean(b.vo); b.pre = clean(b.pre); b.hot = clean(b.hot); b.post = clean(b.post); b.sub = clean(b.sub); b.kicker = clean(b.kicker)
    if (b.cta) { b.cta.headline = clean(b.cta.headline) }
    for (const it of (b.items || [])) { if (it) { it.title = clean(it.title); it.desc = clean(it.desc) } }
    for (const st of (b.stats || [])) { if (st) st.label = clean(st.label) }
    if (b.chat) { b.chat.q = clean(b.chat.q); b.chat.a = clean(b.chat.a) }
    for (const st of (b.steps || [])) { if (st) { st.title = clean(st.title); st.desc = clean(st.desc) } }
  }
  for (const b of (spec.beats || [])) cleanBeat(b)
  // the wordmark/brand shown in intro + corner: for regulated, never show a carrier
  if (spec.wordmark) { spec.wordmark.pre = clean(spec.wordmark.pre); spec.wordmark.post = clean(spec.wordmark.post) }
  return spec
}

// ---------- VO ↔ ON-SCREEN CONSISTENCY: enforce (in code, on top of the prompt)
// that the PRODUCT/BRAND NAME the voice speaks in a beat also appears on screen.
// If a beat's VO names the product but none of its on-screen text does, inject
// the name into a visible slot (sub, or kicker) so sound-off === sound-on. The
// product name(s) come from the understanding (what_it_is / category / brand). ----
function productNames(u, brandName) {
  const names = new Set()
  const add = (s) => { if (typeof s === 'string') for (const w of s.split(/[\s,.—:;()]+/)) { const t = w.trim(); if (t.length >= 3 && /^[A-Z]/.test(t) && !/^(The|And|For|Your|With|Ask|Get|How|Why|You|Our)$/i.test(t)) names.add(t) } }
  if (brandName) add(brandName)
  // pull CamelCase / branded product tokens from the understanding
  const hay = [u && u.what_it_is, u && u.core_promise, ...(u && u.notable_features || []), ...((u && u.audiences || []).map(a => a && a.what_they_get).flat())].filter(Boolean).join(' ')
  for (const m of String(hay).matchAll(/\b([A-Z][a-z]+[A-Z][A-Za-z]*|[A-Z][a-zA-Z]{3,})\b/g)) add(m[1])
  return [...names].slice(0, 6)
}
function enforceConsistency(spec, u, brandName) {
  const names = productNames(u, brandName)
  if (!names.length) return spec
  for (const b of (spec.beats || [])) {
    if (!b.vo) continue
    // which product names does the VO speak in this beat?
    const spoken = names.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(b.vo))
    if (!spoken.length) continue
    const onScreen = [b.kicker, b.pre, b.hot, b.post, b.sub, b.cta && b.cta.headline, b.cta && b.cta.button, ...(b.items || []).map((x) => x.title), ...(b.stats || []).map((x) => x.label)].filter(Boolean).join(' ')
    // if none of the spoken names appear on screen, surface the first one
    const missing = spoken.filter((n) => !new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(onScreen))
    if (missing.length) {
      const name = missing[0]
      // meet/brand beats show the BRAND wordmark. If the spoken name IS the brand,
      // the wordmark covers it. But if the VO names a PRODUCT different from the
      // brand (e.g. brand=Apex, VO says "SmartViewz"), the wordmark does NOT show
      // it — surface the product name in the sub so screen matches voice.
      const isBrandName = brandName && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(brandName)
      // meet/brand/cta beats show the brand wordmark already — only inject a
      // PRODUCT name (different from the brand) into meet/brand; leave cta clean.
      if (b.kind === 'cta') { /* wordmark + headline carry the brand; don't clutter */ }
      else if ((b.kind === 'meet' || b.kind === 'brand') && isBrandName) { /* wordmark shows it */ }
      else if (isBrandName) { /* the brand shows via bug/wordmark elsewhere */ }
      else if (!b.sub) b.sub = name
      else if (!new RegExp(name, 'i').test(b.sub)) b.sub = `${name} — ${b.sub}`
      else if (!b.kicker) b.kicker = name
    }
  }
  return spec
}

// ---------- CREATIVE BRIEF: the director's BRAIN. Before writing a single beat,
// think like a world-class creative director — understand the brand's SOUL
// (mission/vision/values), invent ONE memorable BIG IDEA the whole video hangs
// on, model the AUDIENCE + the emotional shift to create, and lock the brand's
// VOICE + its distinctive angle. The beat-writer then executes THIS brief, so
// the video expresses a real idea + the brand's soul — not a feature list. ----
async function creativeBrief(u, brandName, goal) {
  const sys = `You are a legendary creative director (think the person behind the ads people actually remember). Before any script, you write a CREATIVE BRIEF. Reason hard, then return ONLY JSON:
{
  "mission": "the brand's real MISSION/purpose — WHY it exists beyond making money (1 sentence). Infer from the source; if it's a well-known brand, use what you know.",
  "values": ["2-4 core values / what the brand stands for"],
  "emotional_promise": "the FEELING the brand promises its customer (e.g. 'confidence', 'freedom from worry', 'belonging')",
  "audience": "who is watching this video, specifically (not 'everyone')",
  "audience_state": "what this viewer FEELS right now before the video — their pain, fear, frustration, or hope",
  "emotional_shift": "the shift this video should create in them: FROM [current feeling] TO [desired feeling]",
  "distinctive": "the ONE thing that makes this brand different from everyone else in its category — the wedge",
  "big_idea": "the BIG IDEA: one memorable creative concept the whole 30-40s video hangs on. NOT a feature list — a CONCEPT or through-line (e.g. for a security co: 'We stay awake so you can sleep.'; for a book-of-business AI: 'Your book, finally talking back.'). Make it specific to THIS brand + goal.",
  "voice": "the exact TONE the voiceover should sound like (e.g. 'warm and confident, like a smart friend' / 'bold and punchy' / 'calm and premium'), matched to the brand",
  "throughline": "one sentence: how the video should FEEL start to finish, expressing the big idea + emotional shift"
}
RULES:
- Ground everything in the SOURCE facts + the USER GOAL. Don't invent product claims.
- The big_idea must be a real creative concept, not a restatement of 'we sell X'. If it's boring, you failed.
- If a USER GOAL is given, the brief serves that goal above all.`
  const user = (goal ? `USER GOAL (serve this above all): ${goal}\n\n` : '') + `BRAND${brandName ? ` (${brandName})` : ''} — SOURCE UNDERSTANDING:\n` + JSON.stringify(u, null, 2)
  try { return extractJson(await claude(sys, user, 1500)) } catch { return null }
}

// ---------- DIRECT: Claude writes the commercial spec (styleId + beats) ----------
// The director FIRST classifies the video's INTENT, then structures the beats to
// fit that intent. `goal` is the USER'S PLAIN-ENGLISH BRIEF of what the video
// should accomplish — it is the PRIMARY driver (the source is only for facts).
// `brief` is the CREATIVE BRIEF (mission/big-idea/emotion/voice) — the beats must
// express it. This is what lets "show SmartViewz + how reps earn from it" produce
// exactly that, even though the page is only about the product.
async function direct(u, brandName, intentHint, goal, brief) {
  const regulated = isRegulated(u)
  const sys = `You are a world-class creative DIRECTOR writing a punchy ~30-45 second COMMERCIAL. Your job is to make each commercial feel PURPOSE-BUILT for its goal — never a fill-in-the-blanks template. Return ONLY JSON.

${brief ? `⭐ YOUR CREATIVE BRIEF — you (the director) already thought this through. The video MUST express it:
• BIG IDEA (the whole video hangs on this — every beat serves it): ${brief.big_idea || '?'}
• MISSION (the brand's soul — make the video FEEL like this): ${brief.mission || '?'}
• EMOTIONAL SHIFT (take the viewer FROM→TO): ${brief.emotional_shift || '?'}
• AUDIENCE (write TO this person, who currently feels: ${brief.audience_state || '?'}): ${brief.audience || '?'}
• VOICE (the VO must sound like this): ${brief.voice || '?'}
• DISTINCTIVE (lead with what makes this brand different): ${brief.distinctive || '?'}
• THROUGHLINE (how it should feel start→finish): ${brief.throughline || '?'}
Do NOT just list features. Build the video AROUND the big idea, in the brand's voice, to create the emotional shift. This is the difference between memorable and generic.
\n` : ''}${goal ? `⭐ THE USER'S GOAL (drives the video's angle + structure): "${goal}"\nThe SOURCE material below is ONLY for accurate FACTS. If goal and source differ, the GOAL WINS. If the goal asks for two things, serve BOTH in one arc.\n` : ''}
STEP 1 — CLASSIFY THE INTENT. ${goal ? 'Derive the intent from the USER GOAL above (not just the source).' : 'Decide what this video is really for (use intent_hint if provided, else infer):'}
- "product"      → sell a product/service TO its end user. Show what it does, why it's better.
- "sales"        → get the viewer excited to BUY NOW / a specific offer. Urgency, value, price.
- "opportunity"  → recruit people to EARN money by selling/partnering (MLM, affiliate, rep, residual income). Sell the DREAM of income + how easy it is. NO invented income figures.
- "recruiting"   → get people to JOIN an org/team/career. Belonging, mission, "why us".
- "service"      → a service business (agency, firm, coach). Trust, expertise, transformation, results.
- "brand"        → pure brand/awareness. Emotion, identity, vibe over features.

STEP 2 — pick a STRUCTURE that fits the intent (these are PLAYBOOKS, not rigid — reorder/adapt):
- product:     shot(problem) → meet(reveal) → chat/stats/grid(proof) → split(old vs new) → cta
- sales:       shot(bold hook) → stats/grid(the value/what you get) → split(price vs value) → quote(urgency line) → cta(buy)
- opportunity: shot(the DREAM: "get paid every month?") → meet(the vehicle) → grid(why it's easy: low barrier, real demand) → split(trading-time vs residual) → quote(the payoff) → cta(join/contact)
- recruiting:  shot(aspiration) → quote(mission) → grid(what you get / why us) → split(alone vs with-us) → cta(join)
- service:     shot(their pain) → meet(the firm) → grid(what we do) → quote(transformation) → stats(results if real) → cta(book/contact)
- brand:       shot(emotional hook) → quote → quote → meet → cta

Vary beat COUNT (5-8), ORDER, and MIX to fit — two videos of different intent must look and feel different.

SCHEMA:
{
  "intent": "product|sales|opportunity|recruiting|service|brand",
  "styleId": "Pick the ONE style whose VISUAL + MOTION feel best fits this brand's energy (each has a distinct movement signature, not just fonts/colors):\n    · fintech — clean SaaS/finance, snappy wipes, punchy sound\n    · luxury — premium/wealth, slow elegant drifts, soft sound, film grain\n    · tech — developer/infra/AI, subtle glitch, snappy\n    · upbeat — energetic consumer/opportunity, punchy slams, bold caps\n    · emerald — growth/eco/health/money, smooth calm drifts\n    · redblueprint — bold/industrial/security/insurance, GLITCH + aggressive hard cuts\n    · data — analytics/dashboards, precise snappy wipes\n    · playful — fun consumer app, bouncy slams, rounded font\n    · casino — gaming/entertainment, flashy glitch, aggressive\n    · clean — minimal/design-forward, quiet soft fades, no SFX\n    · glitchcore — edgy/crypto/streetwear/gaming, heavy glitch, mono font, aggressive\n    · cinematic — story-driven/premium brand film, slow camera + big grain, soft\n    · noir — moody/serious/high-end, dark elegant, heavy grain, soft\n    · retro — nostalgic/80s-90s/vintage, VHS grain, glitch, punchy\n    · vibrant — bold youthful consumer, energetic slams, punchy\n    · editorial — magazine/fashion/publishing, refined serif wipes, smooth\n    · brutalist — bold/architectural/design/agency, hard slams, mono, aggressive\n    · aurora — modern SaaS/wellness/beauty, smooth glowing drifts, soft\n    · sport — athletic/fitness/energy, hard glitch slams, aggressive\n    · corporate — B2B/professional/enterprise, clean snappy, punchy\n    · neon — nightlife/entertainment/tech-edge, glitch, aggressive glow\n    · organic — natural/food/craft/artisan, warm soft fades, grain.\n    Match the MOTION energy to the brand — an edgy brand should feel edgy (glitch/aggressive), a luxury brand should feel slow and refined. DON'T default to fintech.",
  "wordmark": { "pre": "first part of brand name", "post": "second part to color-accent (may be empty)" },
  "logoLetter": "single uppercase initial",
  "musicPrompt": "vivid prompt for an INSTRUMENTAL track matching the intent's ENERGY (opportunity/recruiting = uplifting aspirational anthem; product = confident modern; luxury = elegant cinematic). Name genre, instruments, tempo, mood; build toward the end. No vocals.",
  "beats": [
    { "kind": "shot|meet|stats|grid|chat|quote|split|cta|showcase|bignumber|steps",
      "vo": "one natural spoken sentence for THIS beat (conversational, contractions, speak to 'you'; NO ellipsis '...'; numbers spoken naturally)",
      "kicker": "(optional) tiny label above headline — a REAL 1-3 word label (e.g. 'THE PROBLEM', 'MEET'). NEVER a meta word like a language name.",
      "pre": "(shot/quote) headline before the hot phrase — INCLUDE the trailing space if a word boundary follows",
      "hot": "(shot/quote) the 1-3 word phrase to light in accent color. Renderer concatenates pre+hot+post; write as ONE sentence broken at word boundaries (pre 'Get paid ' + hot 'every month', NOT 'Get paid'+'every month')",
      "post": "(optional) headline after hot",
      "sub": "(meet/shot) small subtitle line — a SHORT phrase (3-8 words) that PARAPHRASES this beat's own vo. It must be words a viewer would read on screen (a benefit/tagline). NEVER a meta prefix like 'English —', 'Voiceover:', a language name, or a label describing the audio. On a 'meet' beat where the vo names the PRODUCT, the sub should name that product + its one-line value.",
      "img_prompt": "(shot ONLY) cinematic, dark, photorealistic, IDENTITY-NEUTRAL 16:9 backdrop that LITERALLY illustrates this beat's words — no people/faces, no text, no logos",
      "stats": [ { "value": <number>, "prefix": "$", "suffix": "M|%|k", "label": "SHORT LABEL", "decimals": 0 } ],
      "items": [ { "icon": "single emoji", "title": "feature", "desc": "one line" } ],
      "chat": { "q": "a real question a user would ask", "a": "the product's concrete answer" },
      "split": { "leftLabel": "OLD WAY", "leftSub": "before", "rightLabel": "NEW WAY", "rightSub": "after", "both": "(optional) unifying line" },
      "cta": { "headline": "closing promise (short)", "button": "action label", "url": "the real domain or contact, no https://" },
      "big": { "value": <number>, "prefix": "$", "suffix": "%|k|M", "label": "WHAT THIS NUMBER IS", "decimals": 0 },
      "steps": [ { "title": "step name (2-4 words)", "desc": "(optional) one short line" } ]
    }
  ]
}
RULES:
- Use ONLY facts from the understanding. Real numbers only (strip units to prefix/suffix). NEVER invent metrics, income figures, or claims. For opportunity/sales videos with no stated numbers, sell the CONCEPT (e.g. "recurring income") without a specific %/$.
- ⭐ VO ↔ ON-SCREEN CONSISTENCY (CRITICAL — a viewer with sound OFF must follow the same story as a viewer with sound ON): the on-screen text of each beat (kicker/pre/hot/post/sub, item titles, stat labels, cta headline) MUST echo the KEY WORDS the VO speaks in that SAME beat. What you HEAR and what you SEE must match. Specifically:
  · The PRODUCT/BRAND NAME the VO names must appear ON SCREEN in that beat (or an adjacent one) — never let the voice say "SmartViewz" while the screen shows unrelated words.
  · The 'hot' (accent) phrase should be the exact punchy phrase the VO emphasizes.
  · A stat/number the VO says must appear as a stat on screen; a feature the VO names must appear as a grid item; a question the VO poses must be the chat question.
  · Don't write on-screen text that describes something DIFFERENT from what the voice is saying at that moment.
- VO: natural spoken sentences, one per beat, that TOGETHER tell the story. No "..." ever. Contractions. Speak to "you". Match the TONE to the intent (opportunity = exciting/aspirational; luxury = refined; product = confident).
- Headlines SHORT (2-6 words). Labels SHORT. img_prompt only on "shot" beats, literal + identity-neutral.
- Pick styleId + musicPrompt to match the INTENT, not a default. An opportunity/income video should feel energetic and aspirational, not like a SaaS demo.
- "showcase" = shows a REAL screenshot of the actual website/product in a browser frame. Use AT MOST ONE showcase beat, and ONLY when the video is about a software PRODUCT/tool the viewer would want to SEE (intent product/service with a real UI). Its kicker/hot/sub should reference seeing it in action (e.g. hot "See it live." sub "Ask anything, instantly."). Do NOT use showcase for opportunity/recruiting/brand videos, or for businesses with no real product UI. If in doubt, don't use it.
- "bignumber" = ONE giant animated number filling the screen — use when a SINGLE real stat is dramatic (a price, a %, a count). Only with a real figure from the source. Great for a punchy value moment.
- "steps" = a "how it works" timeline of 3-4 short steps — use for a process/onboarding video ("Connect → Ask → Act"). Keep step titles 2-4 words.
- Use these NEW beat types for VARIETY when they fit — don't make every video the same shot→meet→grid→cta. Mix in bignumber/steps/showcase/chat/split where the content earns it.
${intentHint ? `\nINTENT HINT (honor this): the video's goal is "${intentHint}".` : ''}${regulated ? '\n' + COMPLIANCE_CLAUSE : ''}`
  const spec = extractJson(await claude(sys, (goal ? `USER GOAL (primary brief): ${goal}\n\n` : '') + 'SOURCE FACTS (use only for accurate details):\n' + JSON.stringify(u, null, 2) + (brandName ? `\n\nBRAND NAME: ${brandName}` : '') + (intentHint ? `\n\nINTENT_HINT: ${intentHint}` : ''), 4500))
  return regulated ? scrubGuarantees(spec) : spec
}

// ---------- HOOK OBSESSION: the first 3 seconds decide everything. Instead of
// treating beat 1 like any other beat, generate 5 DIFFERENT opening hooks (angles:
// bold claim, provocative question, pain, surprising truth, pattern-interrupt),
// judge which grabs hardest, and rewrite beat 1 with the winner. This is the
// single highest-leverage copy change in short-form video. ----
async function pickHook(spec, brief, brandName) {
  const first = (spec.beats || [])[0]
  if (!first || first.kind === 'meet' || first.kind === 'brand') return spec   // brand-reveal opens are intentional
  try {
    const sys = `You write scroll-stopping opening HOOKS for short commercials. The first 3 seconds decide if anyone keeps watching.
${brief && brief.big_idea ? `Big idea: ${brief.big_idea}\n` : ''}${brief && brief.audience_state ? `Viewer currently feels: ${brief.audience_state}\n` : ''}${brief && brief.voice ? `Voice: ${brief.voice}\n` : ''}${brandName ? `Brand: ${brandName}\n` : ''}
Given the current opening beat, generate 5 DISTINCT hook options using different angles (a bold claim, a provocative question, a pain/tension, a surprising truth, a pattern-interrupt). Then PICK the single strongest one — the one that would stop a scroll and set up the whole video. Keep it to ONE spoken sentence, in the brand's voice, no ellipsis, no invented claims.
Return ONLY JSON: {"vo":"the winning hook (one spoken sentence)","hot":"the 1-3 word phrase to highlight","kicker":"optional tiny label"}`
    const user = `CURRENT OPENING BEAT:\nvo: ${first.vo || ''}\npre: ${first.pre || ''}\nhot: ${first.hot || ''}\nsub: ${first.sub || ''}`
    const win = extractJson(await claude(sys, user, 800))
    if (win && typeof win.vo === 'string' && win.vo.trim()) {
      first.vo = win.vo.trim()
      if (typeof win.hot === 'string' && win.hot.trim()) { first.hot = win.hot.trim(); first.pre = ''; first.post = '' }
      if (typeof win.kicker === 'string' && win.kicker.trim()) first.kicker = win.kicker.trim()
    }
    return spec
  } catch { return spec }
}

// ---------- CREATIVE CRITIQUE: after the beats are written, the director steps
// back and judges its OWN work like a tough creative director — is it memorable,
// does it express the brand's mission + big idea, does it land the emotional
// shift, or is it generic? Then it REWRITES the weak VO/headlines. LLMs critique
// far better than they first-draft, so this catches flat/templated output. ----
async function critiqueCreative(spec, brief, brandName) {
  if (!brief || !brief.big_idea) return spec
  try {
    const beats = (spec.beats || []).map((b, i) => ({ i, kind: b.kind, vo: b.vo || '', hot: b.hot, headline: b.cta && b.cta.headline }))
    const sys = `You are a tough, brilliant creative director reviewing a commercial's script against its own brief. Be honest — most first drafts are too generic.

THE BRIEF:
• Big idea: ${brief.big_idea}
• Mission/soul: ${brief.mission || '?'}
• Emotional shift (FROM→TO): ${brief.emotional_shift || '?'}
• Voice it should sound like: ${brief.voice || '?'}
${brandName ? `• Brand: ${brandName}` : ''}

Judge the beats below. For any beat whose VO is generic, off-voice, doesn't serve the big idea, or wouldn't make the viewer FEEL the shift — REWRITE its vo (and hot/headline if present) to be sharper, more on-voice, and true to the big idea. Keep it the same length-ish, same facts, no "..." ellipsis, no invented claims. Leave genuinely-good beats alone.

Return ONLY JSON: {"beats":[{"i":<index>,"vo":"rewritten line","hot":"?","headline":"?"}]} — only beats you actually improved, only the fields you changed.`
    const out = extractJson(await claude(sys, 'BEATS:\n' + JSON.stringify(beats, null, 2), 2500))
    const fixes = new Map((out.beats || []).map((f) => [f.i, f]))
    for (const b of (spec.beats || [])) {
      const f = fixes.get(spec.beats.indexOf(b)); if (!f) continue
      if (typeof f.vo === 'string' && f.vo.trim()) b.vo = f.vo.trim()
      if (typeof f.hot === 'string') b.hot = f.hot
      if (f.headline && b.cta && typeof f.headline === 'string') b.cta.headline = f.headline
    }
    return spec
  } catch { return spec }
}

// ---------- SELF-REVIEW: the single biggest lever for word↔visual awareness.
// LLMs are far better at CHECKING their own work than getting it right first
// try. We hand the finished beats back to Claude with ONE job: for each beat,
// verify the ON-SCREEN text truly matches what the VOICE says in that beat, and
// FIX any that don't — remove meta/garbage (e.g. "English —"), make sure the
// product/brand named in the vo appears on screen, and that the headline is
// pulled from the vo (not an invented, unrelated label). Returns the fixed spec. ----
async function reviewConsistency(spec, brandName) {
  try {
    const beats = (spec.beats || []).map((b, i) => ({
      i, kind: b.kind, vo: b.vo || '',
      onscreen: { kicker: b.kicker, pre: b.pre, hot: b.hot, post: b.post, sub: b.sub,
        items: (b.items || []).map((x) => x.title), stats: (b.stats || []).map((x) => x.label),
        cta: b.cta ? { headline: b.cta.headline, button: b.cta.button } : undefined },
    }))
    const sys = `You are a strict video QA editor. For a commercial, each beat has a VOICEOVER (what the viewer HEARS) and ON-SCREEN TEXT (what the viewer SEES). Your ONE job: make them CONSISTENT — a viewer watching muted must follow the same message as one listening.

Fix each beat's on-screen text so that:
1. It reflects THIS beat's voiceover — the headline/sub are short phrases drawn from what the voice actually says in this beat (a paraphrase or the key words), NOT an unrelated invented label.
2. If the voiceover names a PRODUCT or BRAND (e.g. "SmartViewz"), that name MUST appear in this beat's on-screen text (put it in sub or hot). ${brandName ? `The company is "${brandName}". A product name different from the company must still be shown when the voice says it.` : ''}
3. DELETE any garbage/meta text: language names ("English"), "Voiceover:", stray prefixes like "English —", anything that describes the audio instead of being real on-screen copy.
4. Keep it SHORT and punchy (headlines 2-6 words, sub 3-8 words). Keep the same beat kinds and structure.

Return ONLY JSON: {"beats":[{"i":<index>,"kicker":?,"pre":?,"hot":?,"post":?,"sub":?,"items":[{"title":?}]?,"stats":[{"label":?}]?,"cta":{"headline":?,"button":?}?}]}. Only include fields that EXIST for that beat and only beats you CHANGED (omit unchanged beats). Do not change vo.`
    const out = extractJson(await claude(sys, 'BEATS:\n' + JSON.stringify(beats, null, 2), 3000))
    const fixes = new Map((out.beats || []).map((f) => [f.i, f]))
    for (const b of (spec.beats || [])) {
      const f = fixes.get(spec.beats.indexOf(b)); if (!f) continue
      for (const k of ['kicker', 'pre', 'hot', 'post', 'sub']) if (typeof f[k] === 'string') b[k] = f[k]
      if (f.cta && b.cta) { if (typeof f.cta.headline === 'string') b.cta.headline = f.cta.headline; if (typeof f.cta.button === 'string') b.cta.button = f.cta.button }
      if (Array.isArray(f.items) && Array.isArray(b.items)) f.items.forEach((it, j) => { if (b.items[j] && typeof it.title === 'string') b.items[j].title = it.title })
      if (Array.isArray(f.stats) && Array.isArray(b.stats)) f.stats.forEach((it, j) => { if (b.stats[j] && typeof it.label === 'string') b.stats[j].label = it.label })
    }
    return spec
  } catch { return spec }   // review is best-effort — never block generation
}

function ffprobeDur(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 15000 },
      (err, stdout) => resolve(err ? 3 : (parseFloat(String(stdout).trim()) || 3)))
  })
}

// ---------- MUSIC: ElevenLabs Music — a REAL generated track at an EXACT length,
// prompted per-commercial (the project's music approach; NOT a pre-made bed).
// ElevenLabs caps a single generation ~ a few minutes; our commercials are ~40s
// so `music_length_ms` = the video length is always in range. Returns true on
// success. Falls back to the caller's staged bed on any failure. ----
async function elevenMusic(prompt, lengthMs, outPath) {
  const KEY = process.env.ELEVENLABS_API_KEY
  if (!KEY) throw new Error('no ELEVENLABS_API_KEY')
  const ms = Math.max(10000, Math.min(300000, Math.round(lengthMs)))   // clamp to the API's supported range
  const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: `${prompt} Instrumental only, no vocals.`, music_length_ms: ms }),
    signal: AbortSignal.timeout(180000),
  })
  if (!r.ok) throw new Error(`eleven-music ${r.status}: ${(await r.text()).slice(0, 160)}`)
  await writeFile(outPath, Buffer.from(await r.arrayBuffer()))
}

/**
 * generateCommercial — the full generation, MINUS the render. Writes the props
 * JSON path + all assets into `pub/<assetDir>/` and returns { props, propsPath,
 * assetDir } for the caller to render + upload. `deps` injects the image + tts +
 * music helpers; falls back to the slides.js helpers when omitted.
 */
async function generateCommercial({ pub, url, text, brandName, music, forceStyle, intent, goal, logoUrl, videoId, deps = {}, log }) {
  const say = log || (() => {})
  const { mkdir } = require('fs/promises')
  const imageGen = deps.geminiImage || (cloudflareAvailable() ? cloudflareImage : null)
  const tts = deps.tts || ((fn) => fn())

  // 1) SOURCE
  say('Reading source...')
  let sourceText, domain = ''
  if (url) { const html = await fetchText(url); sourceText = htmlToText(html); try { domain = new URL(url).hostname.replace(/^www\./, '') } catch {}; var homeHtml = html }
  else if (text) { sourceText = String(text).slice(0, 60000); var homeHtml = '' }
  else throw new Error('Provide url or text')
  // A raw fetch may return a PLATFORM INTERSTITIAL / bot-wall instead of the real
  // site (e.g. Lofty's anti-iframe notice) — that's junk, not brand content, even
  // if it's over the length threshold. If the raw text is junk OR thin, fall back
  // to microlink's browser-rendered title + description (which gets the real
  // og:title/description). JS-heavy SPAs (dominos.com) also land here.
  if (url && (!sourceText || sourceText.trim().length < 200 || isJunkContent(sourceText))) {
    if (isJunkContent(sourceText)) say('That page served a bot/platform wall — reading its real metadata instead...')
    else say('Page is JS-rendered — reading it with a browser...')
    const meta = await fetchRenderedMeta(url)
    // If the raw was junk, REPLACE it (don't concatenate the wall text); else append.
    if (meta) sourceText = isJunkContent(sourceText) ? meta : (sourceText + ' ' + meta).trim()
    else if (isJunkContent(sourceText)) sourceText = ''   // wall + no meta = nothing usable
  }
  if (!sourceText || sourceText.trim().length < 40 || isJunkContent(sourceText)) {
    throw new Error('Not enough readable content at that URL — the site may block automated access.')
  }

  // 2) COMPREHEND
  say('Understanding the brand...')
  const u = await comprehend(sourceText, url ? 'website' : 'text')

  // asset dir needs to exist before we can save the logo
  const assetDir = videoId ? `c-${videoId}` : slug(brandName || u.category)
  const dir = join(pub, assetDir)
  await mkdir(join(dir, 'gen'), { recursive: true })
  const assetNames = []   // paths relative to `dir` (for staging/cleanup)

  // 3) LOGO — prefer a caller-supplied logo (user upload / saved brand logo);
  // else scrape the real site logo. Never invented. Also yields the logo's
  // dominant color as a brand-color fallback.
  let logoRel = null, logoColor = null
  if (logoUrl) {
    try {
      const img = await downloadImage(logoUrl)
      if (img) {
        logoColor = await logoDominantColor(img.buffer)
        let buf = img.buffer
        try { if (await needsKnockout(buf)) { const ko = await knockoutLogo(buf, dir); if (ko) buf = ko } } catch {}
        buf = await sanitizeLogo(buf)   // cap size + re-encode (see fetchLogo note)
        const { writeFile } = require('fs/promises'); await writeFile(join(dir, 'logo.png'), buf)
        logoRel = 'logo.png'; assetNames.push(logoRel); say('Using provided logo.')
      }
    } catch (e) { say(`provided logo failed: ${e.message}`) }
  }
  if (!logoRel && homeHtml && url) {
    try { const lg = await fetchLogo(homeHtml, url, dir); logoRel = lg.rel; logoColor = lg.color; if (logoRel) { assetNames.push(logoRel); say('Logo found.') } }
    catch (e) { say(`logo lookup failed: ${e.message}`) }
  }

  // 4) BRAND palette — accent from the page's CUSTOM CSS first; then the LOGO's
  // color; then, if BOTH fail (pure-Bootstrap page + colorless logo — the Apex
  // case), from a SCREENSHOT of the rendered page (its real visual brand color).
  // We only invent a default as the very last resort. `shotRel` is captured here
  // once and reused for a showcase beat if the director asks for one.
  let { primary, secondary } = homeHtml ? extractAccent(homeHtml) : { primary: null, secondary: null }
  if (!primary && logoColor) { primary = logoColor; say('Brand color from logo.') }
  let shotRel = null
  if (!primary && url) {
    try {
      shotRel = await captureScreenshot(url, dir)
      if (shotRel) {
        assetNames.push(shotRel)
        // vision: let Claude NAME the brand colors from the screenshot (reliable
        // where pixel-averaging fails, e.g. a thin red nav on a navy page).
        const { readFile } = require('fs/promises')
        const named = await nameBrandColors(await readFile(join(dir, shotRel)))
        if (named && named.primary) { primary = named.primary; if (named.secondary) secondary = named.secondary; say(`Brand colors from screenshot: ${primary}${secondary ? ' + ' + secondary : ''}`) }
      }
    } catch (e) { say(`screenshot-color failed: ${e.message}`) }
  }
  const brand = buildBrand(primary, secondary)

  // 5) DIRECT — think (creative brief) → write beats FROM the brief → critique →
  // check word↔visual consistency → code enforcement.
  say('Thinking through the creative...')
  const brief = await creativeBrief(u, brandName, goal)
  if (brief && brief.big_idea) say(`Big idea: ${brief.big_idea}`.slice(0, 90))
  say('Writing the commercial...')
  let spec = await direct(u, brandName, intent, goal, brief)
  say('Perfecting the hook...')
  spec = await pickHook(spec, brief, brandName)
  say('Reviewing the creative...')
  spec = await critiqueCreative(spec, brief, brandName)
  say('Checking script matches visuals...')
  spec = await reviewConsistency(spec, brandName)
  // enforceConsistency INJECTS the product/brand name onto screen for sound-off
  // parity — but for REGULATED content that would force a carrier/product name
  // into view (the compliance leak). Skip it when regulated.
  const regulated = isRegulated(u)
  if (!regulated) spec = enforceConsistency(spec, u, brandName)
  // FINAL compliance net (regulated only): strip carrier/product names + dollar
  // figures from all vo/on-screen text, AFTER every LLM step that could re-add them.
  if (regulated) {
    spec = scrubGuarantees(spec); spec = scrubCarrierProduct(spec, u, brandName)
    // post-scrub assertion: log any carrier/product term that survived (so a leak
    // is visible in the pipeline logs, not just discovered on screen later).
    const allText = JSON.stringify(spec.beats || []).toLowerCase() + ' ' + JSON.stringify(spec.wordmark || {}).toLowerCase()
    const leaked = CARRIER_BLOCKLIST.filter((t) => allText.includes(t))
    if (leaked.length) say(`⚠ COMPLIANCE: carrier/product term(s) survived scrub: ${leaked.join(', ')}`)
  }
  let styleId = (forceStyle && STYLE_IDS.includes(forceStyle)) ? forceStyle : spec.styleId
  if (!STYLE_IDS.includes(styleId)) styleId = 'fintech'
  say(`Intent: ${spec.intent || '?'} | style: ${styleId} | ${(spec.beats || []).length} beats`)

  // HARD CAP: at most ONE showcase beat. If the director asked for a showcase but
  // we don't yet have a screenshot (color came from CSS/logo, so none was taken),
  // grab one now. Extra/invalid showcase beats are demoted to a quote so we never
  // emit a broken/empty screenshot beat.
  let showcaseUsed = false
  if (url && !shotRel && spec.beats.some((b) => b.kind === 'showcase')) {
    say('Capturing site screenshot...')
    try { shotRel = await captureScreenshot(url, dir); if (shotRel) assetNames.push(shotRel) } catch (e) { say(`screenshot failed: ${e.message}`) }
  }

  // 5) ASSETS: per-beat VO (measured so beats fit the voice) + literal hero images
  say('Generating voice + visuals...')
  const beats = []
  // LAYOUT VARIANTS: split + cta beats each have 3 compositions (0/1/2) in the
  // template. Pick a per-video OFFSET seeded off the videoId so different videos
  // get different layouts (breaks the "same spatial skeleton" sameness), but the
  // same video is deterministic. If a kind appears twice, the second use rotates
  // to a different variant (no-repeat within a video).
  const seed = String(videoId || assetDir).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const variantCount = { split: 3, cta: 3 }
  const variantUsed = {}
  const pickVariant = (kind) => {
    const n = variantCount[kind]; if (!n) return undefined
    const base = seed % n
    const used = variantUsed[kind] || 0
    variantUsed[kind] = used + 1
    return (base + used) % n   // rotate on repeat so a video never reuses one
  }

  for (let i = 0; i < spec.beats.length; i++) {
    const be = spec.beats[i]
    // demote a showcase beat if: cap already used, or no screenshot was captured.
    if (be.kind === 'showcase' && (showcaseUsed || !shotRel)) be.kind = 'quote'
    const voId = `${assetDir.slice(0, 6)}-${i + 1}`
    let dur = 4
    if (be.vo && String(be.vo).trim()) {
      try {
        const timed = await tts(() => ttsTimed(be.vo, join(dir, `${voId}.mp3`)))
        dur = Math.max(2.4, (timed.durationSec || 3) + 0.5)   // pad so the beat never cuts the voice
        assetNames.push(`${voId}.mp3`)
      } catch (e) { say(`vo ${i + 1} failed: ${e.message}`) }
    }
    let img, shot
    if (be.kind === 'shot' && be.img_prompt && imageGen) {
      const outImg = join(dir, 'gen', `shot${i + 1}.png`)
      try {
        await imageGen(be.img_prompt + ' Cinematic, photorealistic, dark, moody, 16:9. No people, no faces, no text, no logos.', outImg)
        // VERIFY the file actually landed and isn't empty — imageGen can resolve
        // without writing a usable file (provider error / safety block / truncated
        // download). Referencing a missing/empty file makes Remotion's static-file
        // reader ENOENT and kills the whole render (read-file.js exit 1).
        let ok = false
        try { const st = await stat(outImg); ok = st.isFile() && st.size > 1024 } catch { ok = false }
        if (ok) { img = `gen/shot${i + 1}.png`; assetNames.push(`gen/shot${i + 1}.png`) }
        else { say(`img ${i + 1} produced no usable file — demoting shot beat to text`); be.kind = 'quote' }
      } catch (e) { say(`img ${i + 1} failed: ${e.message} — demoting shot beat to text`); be.kind = 'quote' }
    } else if (be.kind === 'shot') {
      // a shot beat with no prompt or no image generator can't render an image —
      // demote so we never emit a shot beat that points at a nonexistent file.
      say(`shot beat ${i + 1} has no image — demoting to text`); be.kind = 'quote'
    } else if (be.kind === 'showcase' && shotRel) {
      shot = shotRel; showcaseUsed = true
    }
    beats.push({
      dur: Math.round(dur * 100) / 100, vo: be.vo ? voId : undefined, kind: be.kind,
      img, shot, kicker: be.kicker, pre: be.pre, hot: be.hot, post: be.post, sub: be.sub,
      stats: be.stats, items: be.items, chat: be.chat, split: be.split, cta: be.cta, big: be.big, steps: be.steps,
      variant: pickVariant(be.kind),
    })
  }

  // 6) MUSIC — a REAL track from ElevenLabs Music, prompted for THIS brand and
  // generated at the video's EXACT length (the project's approach — every video
  // gets its own custom score). Video length is known now (intro + sum of beat
  // durs + tail). MusicBed loops it as a safety net if it comes back a touch
  // short. If the API fails, `deps.stageMusic` writes a short SILENT track (the
  // ffmpeg last-resort) so the render never dies — we retry rather than ship a
  // generic bed on a paid commercial.
  const videoSec = (90 + beats.reduce((t, b) => t + b.dur * FPS, 0) + 6) / FPS
  const musicOut = join(dir, 'music.mp3')
  const musicPrompt = spec.musicPrompt || 'Modern cinematic commercial track, confident and premium, clear kick drum pulse, driving bass, builds energy toward the end.'
  let musicOk = false
  try {
    say('Composing the soundtrack...')
    await elevenMusic(musicPrompt, videoSec * 1000, musicOut)   // +0ms extra; MusicBed loop covers any rounding
    assetNames.push('music.mp3'); musicOk = true
  } catch (e) {
    say(`ElevenLabs Music failed (${e.message}) — using a silent track (retry recommended)`)
    if (deps.stageMusic) { try { await deps.stageMusic('silent', musicOut); assetNames.push('music.mp3'); musicOk = true } catch (e2) { say(`silent fallback failed: ${e2.message}`) } }
  }
  const musicFrames = musicOk ? (Math.round((await ffprobeDur(musicOut)) * FPS) || 900) : 900

  // 7) PROPS (commercialSchema) — pass the real logo when we found one; the
  // template shows it in the intro + corner bug and falls back to the wordmark/
  // letter only when logo is absent.
  const props = {
    styleId, brand,
    ...(logoRel ? { logo: logoRel } : {}),
    wordmark: spec.wordmark || { pre: brandName || 'Brand', post: '' },
    logoLetter: spec.logoLetter || ((spec.wordmark && spec.wordmark.pre) || brandName || 'B')[0].toUpperCase(),
    assetDir,
    music: { file: 'music.mp3', frames: musicFrames },
    introFrames: 90, duck: { loud: 0.2, duck: 0.08 }, bug: true,
    beats,
  }
  for (const b of props.beats) if (b.kind === 'cta' && b.cta && !b.cta.url && domain) b.cta.url = domain

  const propsPath = join(pub, `commercial-${videoId || assetDir}-props.json`)
  await writeFile(propsPath, JSON.stringify(props))
  return { props, propsPath, assetDir, assetNames, styleId, intent: spec.intent, logo: logoRel, totalSec: videoSec }
}

module.exports = { generateCommercial }
