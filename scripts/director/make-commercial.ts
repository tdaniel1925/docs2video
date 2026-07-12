/**
 * MAKE-COMMERCIAL — the director for the SPEC-DRIVEN engine (TemplateCommercial).
 *
 * URL → a fully-produced, brand-matched ~30-40s commercial. This is the piece
 * that turns "make a commercial for this site" into the `commercialSchema` props
 * JSON that TemplateCommercial renders (locally or on the VPS).
 *
 * Pipeline:
 *   1. COMPREHEND  (crawl + Opus understanding)                — comprehend.ts
 *   2. BRAND       (extract real palette, build cinematic dark) — extract-brand.mjs
 *   3. DIRECT      (Opus writes styleId + beats[] spec)         — this file
 *   4. ASSETS      (VO per beat, hero images, music)            — tts-timed / gen-image / music
 *   5. WRITE PROPS (commercialSchema JSON) + measure VO durs so beats fit the voice
 *
 * Run: npx tsx scripts/director/make-commercial.ts --url https://smartviewz.com \
 *        --brand "SmartViewz" --music tension
 *
 * Output: remotion/public/<assetDir>/{vo mp3s, gen/*.png, music.mp3} + <assetDir>-props.json
 * Render: npx remotion render TemplateCommercial out/<assetDir>.mp4 --props=remotion/public/<assetDir>-props.json
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { gatherSource, comprehend } from './comprehend'
import { ttsTimed } from './tts-timed'
// @ts-ignore — .mjs helpers (no types)
import { extractBrand } from './extract-brand.mjs'
// @ts-ignore
import { genImage } from './gen-image.mjs'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const PUB = join(__dirname, '..', '..', 'remotion', 'public')

const argv = process.argv.slice(2)
const flag = (n: string, d = '') => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const url = flag('url', '')
const brandName = flag('brand', '')
const music = flag('music', 'tension')     // which music bed (must exist as public/music/bed-<music>-128.wav) or 'gen'
const forceStyle = flag('style', '')       // override the director's styleId choice
if (!url) { console.error('usage: make-commercial.ts --url <site> [--brand Name] [--music tension] [--style casino]'); process.exit(1) }

const STYLE_IDS = ['fintech', 'luxury', 'tech', 'upbeat', 'emerald', 'redblueprint', 'data', 'playful', 'casino', 'clean'] as const
type StyleId = typeof STYLE_IDS[number]

function extractJson(t: string): any { const s = t.indexOf('{'); const e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)) }
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'brand'

// ---- color helpers (build a cohesive dark cinematic palette from the site accent) ----
function hexToRgb(h: string) { const n = h.replace('#', ''); return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)] }
function rgbToHex(r: number, g: number, b: number) { const c = (n: number) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); return '#' + c(r) + c(g) + c(b) }
function lift(hex: string, k: number) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) }
function lum(h: string) { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 }

// Turn an extracted accent into the full brand{} the schema wants. Dark cinematic
// backdrop faintly tinted with the brand, a bright accentHi for hot text, a
// secondary complement for alternating stats, legible cream + mute.
function buildBrand(accent: string, secondary?: string | null) {
  let acc = accent
  if (lum(acc) < 0.22) acc = lift(acc, 0.35)        // brighten so it pops on near-black
  const [ar, ag, ab] = hexToRgb(acc)
  return {
    bg: rgbToHex(ar * 0.08 + 8, ag * 0.08 + 9, ab * 0.08 + 12),
    bg2: rgbToHex(ar * 0.16 + 12, ag * 0.16 + 14, ab * 0.16 + 20),
    panel: rgbToHex(ar * 0.10 + 22, ag * 0.10 + 22, ab * 0.10 + 26),
    accent: acc,
    accentHi: lift(acc, 0.4),
    accent2: secondary && lum(secondary) > 0.15 ? lift(secondary, lum(secondary) < 0.3 ? 0.35 : 0) : lift(acc, 0.15),
    cream: '#f4f1ea', mute: '#9fa2ad', white: '#ffffff',
  }
}

// ---- DIRECT: Opus writes the commercial spec (styleId + beats) ----
async function direct(u: any): Promise<any> {
  const sys = `You are a creative DIRECTOR writing a punchy ~30-40 second COMMERCIAL for a brand, from a complete understanding of what it is. Output a tight SPEC our renderer executes. Return ONLY JSON:
{
  "styleId": "ONE of: fintech (SaaS/finance, grotesk, terminal intro), luxury (premium/wealth/high-end, serif, elegant), tech (developer/infra/AI, assembly intro), upbeat (energetic/consumer, bold caps), emerald (growth/green/eco/health), redblueprint (bold/industrial/security), data (analytics/dashboards), playful (fun/creative/consumer app, rounded), casino (gaming/entertainment/bold caps), clean (minimal/design-forward). Pick what fits the brand's TONE.",
  "wordmark": { "pre": "first part of the brand name", "post": "second part to color-accent (may be empty)" },
  "logoLetter": "single uppercase initial for the logo mark",
  "beats": [
    { "kind": "shot|meet|stats|grid|chat|quote|split|cta",
      "vo": "one natural spoken sentence for THIS beat (conversational, contractions, speak to 'you'; NO ellipsis '...'; say numbers naturally)",
      "kicker": "(optional) tiny label above the headline",
      "pre": "(shot/quote) headline text before the hot phrase",
      "hot": "(shot/quote) the 1-3 word phrase to light up in accent color",
      "post": "(optional) headline text after hot",
      "sub": "(meet/shot) small subtitle line",
      "img_prompt": "(shot ONLY) a cinematic, dark, photorealistic, IDENTITY-NEUTRAL 16:9 backdrop that LITERALLY illustrates this beat's words — no people/faces, no text, no logos",
      "stats": [ { "value": <number>, "prefix": "$", "suffix": "M|%|k", "label": "SHORT LABEL", "decimals": 0 } ],
      "items": [ { "icon": "single emoji", "title": "feature", "desc": "one line" } ],
      "chat": { "q": "a question a user would ask", "a": "the product's answer (concrete, references a real capability)" },
      "split": { "leftLabel": "OLD WAY", "leftSub": "before", "rightLabel": "NEW WAY", "rightSub": "after", "both": "(optional) unifying line" },
      "cta": { "headline": "the closing promise (short)", "button": "action label (e.g. Start Free)", "url": "the brand's domain, no https://" }
    }
  ]
}
STRUCTURE (5-7 beats, ~30-40s total):
- Beat 1 = "shot": a tension/hook headline over a literal cinematic backdrop (img_prompt MUST match the words).
- Beat 2 = "meet": reveal the brand (wordmark) with a one-line positioning sub.
- Then 2-4 PROOF beats chosen to fit the product: "stats" (real key_numbers → number+label), "grid" (3-4 features), "chat" (a real Q&A the product answers), "split" (old vs new), or "quote" (a punchy value line). Prefer stats/chat if there are real numbers or a clear "ask anything" capability.
- Final beat = "cta": the promise + button + the real domain.
RULES:
- Use ONLY facts from the understanding. Real numbers only in stats (strip units into prefix/suffix; e.g. "$2.8M" → value 2.8, prefix "$", suffix "M", decimals 1). Never invent metrics.
- VO must be natural spoken sentences, one per beat, that TOGETHER tell the story. No "..." ever (it makes the voice choke). Contractions. Speak to "you".
- Headlines SHORT (2-6 words). Labels SHORT (1-2 words, will render uppercase).
- img_prompt only on "shot" beats and must be LITERAL to that beat + identity-neutral (architecture, screens, objects, light, texture, abstract data — NEVER a person).
- Pick the styleId that matches the brand's real tone; don't default to fintech for everything.`
  const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 4000, system: sys, messages: [{ role: 'user', content: 'UNDERSTANDING:\n' + JSON.stringify(u, null, 2) + (brandName ? `\n\nBRAND NAME: ${brandName}` : '') }] })
  return extractJson((r.content[0] as any).text)
}

function ffprobeDur(file: string): number {
  try { return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`).toString().trim()) } catch { return 3 }
}

async function main() {
  console.log(`\n▶ COMMERCIAL: ${url}${brandName ? `  (${brandName})` : ''}  music=${music}\n`)

  console.log('[1/5] COMPREHEND (crawl + understand)...')
  const g = await gatherSource({ url })
  const u = await comprehend(g.text, g.kind)
  console.log(`   what: ${(u.what_it_is || '').slice(0, 90)}...`)
  console.log(`   category: ${u.category} | tone: ${u.tone}`)

  console.log('\n[2/5] BRAND palette...')
  let accent = '#6ea8fe', secondary: string | null = null
  try {
    const b: any = await extractBrand(url)
    accent = b.primary || b.brandVars?.primary || accent
    secondary = b.secondary || null
    console.log(`   accent ${accent}${secondary ? ` + ${secondary}` : ''} (from site)`)
  } catch (e) { console.log(`   ! brand extract failed → default accent ${accent}`) }
  const brand = buildBrand(accent, secondary)

  console.log('\n[3/5] DIRECT (write the commercial spec)...')
  const spec = await direct(u)
  const styleId: StyleId = (forceStyle && STYLE_IDS.includes(forceStyle as StyleId) ? forceStyle : spec.styleId) as StyleId
  const finalStyle: StyleId = STYLE_IDS.includes(styleId) ? styleId : 'fintech'
  console.log(`   styleId=${finalStyle}${forceStyle ? ' (forced)' : ''} | ${spec.beats.length} beats`)
  spec.beats.forEach((be: any, i: number) => console.log(`     ${i + 1}. ${be.kind}${be.hot ? ` "${be.pre || ''}${be.hot}"` : be.sub ? ` "${be.sub}"` : ''}`))

  const assetDir = slug(brandName || spec.wordmark?.pre || u.category || 'brand')
  const dir = join(PUB, assetDir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(join(dir, 'gen'))) mkdirSync(join(dir, 'gen'), { recursive: true })

  console.log(`\n[4/5] ASSETS → public/${assetDir}/  (VO + images)...`)
  const beats: any[] = []
  for (let i = 0; i < spec.beats.length; i++) {
    const be = spec.beats[i]
    const voId = `${assetDir.slice(0, 2)}-${i + 1}`
    let dur = 4
    if (be.vo && String(be.vo).trim()) {
      try {
        const timed = await ttsTimed(be.vo, `${assetDir}/${voId}.mp3`)
        dur = Math.max(2.4, timed.durationSec + 0.5)     // pad so the beat doesn't cut the voice
        process.stdout.write(`   vo${i + 1}(${dur.toFixed(1)}s) `)
      } catch { console.log(`   ! vo${i + 1} failed`) }
    }
    // hero image for shot beats — LITERAL to the beat's words
    let img: string | undefined
    if (be.kind === 'shot' && be.img_prompt) {
      const out = join(dir, 'gen', `shot${i + 1}.png`)
      try { await genImage({ prompt: be.img_prompt, out, look: 'cinematic', tier: 'auto' }); img = `gen/shot${i + 1}.png`; process.stdout.write(`img${i + 1}✓ `) }
      catch { console.log(`   ! img${i + 1} failed`) }
    }
    beats.push({
      dur: Math.round(dur * 100) / 100, vo: be.vo ? voId : undefined, kind: be.kind,
      img, kicker: be.kicker, pre: be.pre, hot: be.hot, post: be.post, sub: be.sub,
      stats: be.stats, items: be.items, chat: be.chat, split: be.split, cta: be.cta,
    })
  }
  console.log('')

  // MUSIC — a REAL track from ElevenLabs Music, prompted for THIS brand and
  // generated at the video's EXACT length (the project's approach — not a canned
  // bed). Falls back to a synthesized bed only if the API fails.
  const videoSecEarly = (90 + beats.reduce((t, b) => t + b.dur * 30, 0) + 6) / 30
  const musicOut = join(dir, 'music.mp3')
  const musicPrompt = spec.musicPrompt || 'Modern cinematic commercial track, confident and premium, clear kick drum pulse, driving bass, builds energy toward the end.'
  try {
    const ms = Math.max(10000, Math.min(300000, Math.round(videoSecEarly * 1000)))
    const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: `${musicPrompt} Instrumental only, no vocals.`, music_length_ms: ms }),
    })
    if (!res.ok) throw new Error(`eleven-music ${res.status}`)
    writeFileSync(musicOut, Buffer.from(await res.arrayBuffer()))
    console.log(`   music: ElevenLabs Music (${(ms / 1000).toFixed(0)}s)`)
  } catch (e) {
    console.log(`   ! ElevenLabs Music failed (${e instanceof Error ? e.message : e}) — retry recommended (no music written)`)
  }
  const musicFrames = existsSync(musicOut) ? Math.round(ffprobeDur(musicOut) * 30) : 900

  console.log('\n[5/5] WRITE props...')
  const domain = new URL(url).hostname.replace(/^www\./, '')
  const props = {
    styleId: finalStyle,
    brand,
    wordmark: spec.wordmark || { pre: brandName || 'Brand', post: '' },
    logoLetter: spec.logoLetter || (spec.wordmark?.pre || brandName || 'B')[0].toUpperCase(),
    assetDir,
    music: { file: 'music.mp3', frames: musicFrames },
    introFrames: 90,
    duck: { loud: 0.2, duck: 0.08 },
    bug: true,
    beats,
  }
  // ensure any cta without a url gets the real domain
  for (const b of props.beats) if (b.kind === 'cta' && b.cta && !b.cta.url) b.cta.url = domain

  const propsPath = join(PUB, `${assetDir}-props.json`)
  writeFileSync(propsPath, JSON.stringify(props, null, 2))
  const totalSec = (90 + beats.reduce((t, b) => t + b.dur * 30, 0) + 6) / 30
  console.log(`\n[done] ${beats.length} beats, ~${totalSec.toFixed(1)}s → ${assetDir}-props.json`)
  console.log(`  render: npx remotion render TemplateCommercial out/${assetDir}.mp4 --props=remotion/public/${assetDir}-props.json --gl=swiftshader`)
  console.log(`  preflight: node scripts/director/preflight.mjs remotion/src/templates/TemplateCommercial.tsx remotion/public/${assetDir} --video=${totalSec.toFixed(0)}`)
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
