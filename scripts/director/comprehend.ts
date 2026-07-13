/**
 * COMPREHENSION LAYER — the fix for "cherry-picking." Before ANY scriptwriting,
 * the system must READ and UNDERSTAND the full source, whatever its type:
 *   - website  → crawl key pages (nav links), concatenate all text
 *   - pdf      → full text (Gemini reads it)
 *   - text     → raw pasted/AI text
 * Then a dedicated Opus COMPREHENSION pass produces a structured understanding:
 * what it is, WHO the distinct audiences are, what EACH gets + costs, the real
 * benefits, differentiators, and the core promise. The writer consumes THIS —
 * never the raw source — so the video reflects the whole offering, not a random
 * number it happened to find.
 *
 * Exports: gatherSource(input) → { kind, text, meta }
 *          comprehend(text, hint) → structured understanding object
 */
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const SHOTS_DIR = join(__dirname, '..', '..', 'remotion', 'public', 'shots')

// lazy init — env vars may load (via dotenv) AFTER this module is imported.
let _anthropic: Anthropic | null = null, _genai: GoogleGenAI | null = null
const anthropicClient = () => (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }))
const genaiClient = () => (_genai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }))

export type SourceInput = { url?: string; pdf?: string; text?: string }
// shots: map of same-origin path (e.g. "/pricing") → captured screenshot file
// (relative to remotion/public, e.g. "shots/pricing-hero.png"). The Director can
// reference a page by path and the renderer drops the real screenshot in.
export type Shot = { path: string; url: string; hero: string; full: string; title: string }
export type Gathered = { kind: 'website' | 'pdf' | 'text'; text: string; pages?: string[]; brand?: any; shots?: Shot[] }

const slug = (u: string) => { const p = new URL(u).pathname.replace(/\/$/, '') || '/home'; return p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'home' }

// ---- CRAWL a site's key pages (homepage + main nav links, same-origin) ----
// Also CAPTURES a hero (above-the-fold) + full-page screenshot per page, so the
// video can show the REAL product UI as supporting evidence (the thing we do on
// the "plain background" videos and lost when we went cinematic).
async function crawlSite(startUrl: string, maxPages = 12): Promise<{ text: string; pages: string[]; brand: any; shots: Shot[] }> {
  const { chromium } = await import('playwright')
  mkdirSync(SHOTS_DIR, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (compatible; DirectorBot/1.0)', viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const origin = new URL(startUrl).origin
  const seen = new Set<string>()
  const queue = [startUrl]
  const chunks: string[] = []
  const visited: string[] = []
  const shots: Shot[] = []
  let brand: any = null

  const readPage = async (url: string) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(2500)
    // Also SAMPLE the brand palette from this page: the theme-color meta, plus the
    // dominant non-neutral color used by CTAs/buttons/links/headings. We tally
    // color usage weighted by element prominence so the true brand accent wins.
    const data: any = await page.evaluate(`(() => {
      const txt = document.body ? document.body.innerText : '';
      const title = document.title || '';
      const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
      const bodyStyle = getComputedStyle(document.body);
      const toHex = (c) => {
        const m = (c||'').match(/rgba?\\(([0-9.]+),\\s*([0-9.]+),\\s*([0-9.]+)(?:,\\s*([0-9.]+))?\\)/);
        if (!m) return null; const a = m[4] === undefined ? 1 : parseFloat(m[4]); if (a < 0.3) return null;
        const h = (n)=>('0'+Math.round(parseFloat(n)).toString(16)).slice(-2);
        return '#'+h(m[1])+h(m[2])+h(m[3]);
      };
      // is a color "neutral" (near grey/black/white)? we want the saturated brand hue.
      const isNeutral = (hex) => { const n=hex.slice(1); const r=parseInt(n.slice(0,2),16),g=parseInt(n.slice(2,4),16),b=parseInt(n.slice(4,6),16); const mx=Math.max(r,g,b),mn=Math.min(r,g,b); const sat=mx===0?0:(mx-mn)/mx; return sat < 0.28 || (mx<30) || (mn>235); };
      const tally = {};
      const bump = (hex, w) => { if(!hex) return; if(isNeutral(hex)) return; tally[hex]=(tally[hex]||0)+w; };
      // pull EVERY rgb() out of a background-image (gradients hold the brand color)
      const bumpGradient = (bgImg, w) => { const ms = (bgImg||'').match(/rgba?\\([^)]+\\)/g) || []; ms.forEach(c => bump(toHex(c), w)); };
      // CTA-ish elements: match Tailwind bg-*-600 utility classes too (bg-emerald-600).
      document.querySelectorAll('button, a[class*="btn"], a[class*="button"], [class*="cta"], [role="button"], a[class*="bg-"], [class*="bg-emerald"], [class*="bg-green"], [class*="bg-blue"], [class*="bg-indigo"], [class*="bg-primary"]').forEach(el=>{ const s=getComputedStyle(el); bump(toHex(s.backgroundColor), 6); bumpGradient(s.backgroundImage, 5); bump(toHex(s.color), 0.5); });
      // brand-colored TEXT (logo spans, accent text) — Tailwind text-*-600 + emerald/green
      document.querySelectorAll('[class*="text-emerald"], [class*="text-green"], [class*="text-blue"], [class*="text-indigo"], [class*="text-primary"], header a, nav a[class], h1 span, h2 span').forEach(el=>{ bump(toHex(getComputedStyle(el).color), 3); });
      document.querySelectorAll('h1,h2,h3').forEach(el=>{ bump(toHex(getComputedStyle(el).color), 0.6); });
      document.querySelectorAll('header svg [fill], nav svg [fill], header svg path, nav svg path').forEach(el=>{ const s=getComputedStyle(el); bump(toHex(s.fill), 3); });
      // any element whose class literally names a brand-ish color, sampled broadly
      document.querySelectorAll('a').forEach(el=>{ bump(toHex(getComputedStyle(el).color), 0.3); });
      const ranked = Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
      const theme = (document.querySelector('meta[name="theme-color"]')||{}).content || null;
      return { txt, title, links, bg: bodyStyle.backgroundColor, brandColors: ranked.slice(0,6), themeColor: theme };
    })()`)
    return data
  }

  const capture = async (url: string, title: string) => {
    try {
      const base = slug(url)
      // hero = above the fold (browser-frame ready), full = whole page (scroll)
      const hero = `shots/${base}-hero.png`, full = `shots/${base}-full.png`
      await page.screenshot({ path: join(SHOTS_DIR, `${base}-hero.png`), clip: { x: 0, y: 0, width: 1600, height: 1000 } })
      await page.screenshot({ path: join(SHOTS_DIR, `${base}-full.png`), fullPage: true })
      shots.push({ path: new URL(url).pathname || '/', url, hero, full, title })
    } catch (e: any) { console.log(`   ! shot failed ${url}: ${e.message?.slice(0, 50)}`) }
  }

  while (queue.length && visited.length < maxPages) {
    const url = queue.shift()!
    const norm = url.split('#')[0].replace(/\/$/, '')
    if (seen.has(norm)) continue
    seen.add(norm)
    try {
      const d = await readPage(url)
      if (d.txt && d.txt.trim().length > 40) { chunks.push(`\n\n===== PAGE: ${d.title} (${url}) =====\n${d.txt.trim()}`); visited.push(url); await capture(url, d.title || '') }
      // brand palette: prefer the homepage's sampled colors; merge accents from
      // subsequent pages so a strong brand color that only appears deeper still counts.
      if (d.bg || d.brandColors || d.themeColor) {
        if (!brand) brand = { bg: d.bg, colors: [], themeColor: d.themeColor }
        for (const c of (d.brandColors || [])) if (!brand.colors.includes(c)) brand.colors.push(c)
        if (!brand.themeColor && d.themeColor) brand.themeColor = d.themeColor
      }
      // enqueue same-origin nav links (dedupe, skip assets/anchors/mailto)
      for (const l of (d.links || [])) {
        try {
          const u = new URL(l)
          if (u.origin !== origin) continue
          if (/\.(png|jpg|jpeg|svg|pdf|zip|mp4|css|js|ico)$/i.test(u.pathname)) continue
          const n = u.href.split('#')[0].replace(/\/$/, '')
          if (!seen.has(n) && !queue.includes(u.href)) queue.push(u.href)
        } catch {}
      }
    } catch (e: any) { console.log(`   ! could not read ${url}: ${e.message?.slice(0, 60)}`) }
  }
  await browser.close()
  return { text: chunks.join('\n'), pages: visited, brand, shots }
}

export async function gatherSource(input: SourceInput): Promise<Gathered> {
  if (input.url) {
    console.log(`   crawling ${input.url} ...`)
    const { text, pages, brand, shots } = await crawlSite(input.url)
    console.log(`   read ${pages.length} pages, ${text.length} chars, ${shots.length} screenshots`)
    return { kind: 'website', text, pages, brand, shots }
  }
  if (input.pdf) {
    if (!existsSync(input.pdf)) throw new Error(`pdf not found: ${input.pdf}`)
    // 1) FIRST try to read the PDF's own text layer locally (no Gemini needed —
    //    works offline / with no image credits for any text-based PDF).
    const local = extractPdfText(input.pdf)
    if (local && local.trim().length > 120) {
      console.log(`   read PDF text layer locally (${local.length} chars, no Gemini)`)
      return { kind: 'pdf', text: local }
    }
    // 2) FALLBACK: scanned/image PDF with no text layer → Gemini OCR/transcription.
    console.log('   no local text layer — using Gemini to transcribe...')
    const b64 = readFileSync(input.pdf).toString('base64')
    const res = await genaiClient().models.generateContent({
      model: process.env.DOC_MODEL || 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: b64 } }, { text: 'Transcribe ALL text and data from this document verbatim, preserving every number, label, table, and section. Output plain text only.' }] }],
    })
    const text = res.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
    return { kind: 'pdf', text }
  }
  if (input.text) return { kind: 'text', text: input.text }
  throw new Error('gatherSource: provide url, pdf, or text')
}

// Extract text drawn via `(...) Tj` and `[...] TJ` operators from a PDF's content
// streams. Handles uncompressed streams directly and FlateDecode via zlib. Good
// enough for text-based (non-scanned) PDFs — the common case for illustrations. */
function extractPdfText(path: string): string {
  const zlib = require('zlib') as typeof import('zlib')
  const buf = readFileSync(path)
  const out: string[] = []
  const pushFrom = (s: string) => {
    // (literal) Tj
    for (const m of s.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)) out.push(unesc(m[1]))
    // [ (a) (b) ] TJ  — array show with kerning
    for (const m of s.matchAll(/\[((?:[^\]]|\\.)*)\]\s*TJ/g)) {
      const parts = [...m[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)].map((x) => unesc(x[1]))
      if (parts.length) out.push(parts.join(''))
    }
  }
  const unesc = (s: string) => s.replace(/\\([()\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ')
  // walk each `stream ... endstream`; try inflate, else treat as raw.
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let m: RegExpExecArray | null
  while ((m = re.exec(buf.toString('latin1')))) {
    const raw = Buffer.from(m[1], 'latin1')
    let content = ''
    try { content = zlib.inflateSync(raw).toString('latin1') } catch { content = raw.toString('latin1') }
    if (/\bTj\b|\bTJ\b/.test(content)) pushFrom(content)
  }
  // join with spaces/newlines; collapse runaway whitespace.
  return out.join('\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

// ---- COMPREHEND: read everything, understand it, output structure ----
export async function comprehend(sourceText: string, kindHint: string): Promise<any> {
  const sys = `You are a research analyst. You are given the FULL text of a source (a whole website's pages, a document, or pasted text). Your ONE job is to READ ALL OF IT and produce a faithful, COMPLETE structured understanding — NOT a summary of the first thing you see, and NOT cherry-picked. Return ONLY JSON:
{
  "what_it_is": "2-3 sentences: what this product/service/offer actually is, in plain language",
  "category": "e.g. fintech platform, insurance illustration, SaaS tool, coaching service",
  "audiences": [
    { "name": "who (e.g. 'Investors', 'Public companies')",
      "what_they_get": ["the concrete things THIS audience receives — be thorough, list all of them"],
      "pricing": "what it costs THIS audience, incl. free tiers/ranges (e.g. 'free to research', '$0–$10 per chat', 'from $399/mo') or null",
      "value": "why this audience cares — the core benefit" }
  ],
  "differentiators": ["what makes it distinct / proof points / compliance / data sources"],
  "core_promise": "the single positioning line / big idea",
  "key_numbers": [ { "label": "...", "value": "...", "context": "what it means" } ],
  "notable_features": ["important features across the whole offering"],
  "tone": "the brand voice (e.g. 'confident, no-nonsense, transparency-first')",
  "coverage_notes": "anything important you saw but couldn't fully resolve, or sections that seemed to exist but weren't in the text"
}
RULES:
- Cover EVERY distinct audience and offering. If there are two sides (e.g. buyers and sellers, investors and companies), BOTH must appear with their own what_they_get + pricing.
- Capture pricing RANGES and free tiers, not just one headline price.
- Do not invent. If something isn't stated, omit it or note it in coverage_notes.
- Be thorough over concise — this understanding drives the whole video; missing an audience or tier is the failure we're preventing.`
  const r = await anthropicClient().messages.create({
    model: 'claude-opus-4-8', max_tokens: 6000, system: sys,
    messages: [{ role: 'user', content: `SOURCE TYPE: ${kindHint}\n\nFULL SOURCE TEXT:\n${sourceText.slice(0, 120000)}` }],
  })
  const t = (r.content[0] as any).text
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  return JSON.parse(t.slice(s, e + 1))
}
