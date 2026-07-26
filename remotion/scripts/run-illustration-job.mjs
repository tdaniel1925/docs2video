// Fire a real job at the VPS /generate pipeline — the original full pipeline
// where the VPS does everything: OpenAI TTS + Gemini full-slide images + sharp
// brand band + ffmpeg assembly + Supabase upload.
//
// Source is the real insurance illustration fixture, run through the app's own
// compliance scrubber (app/_lib/compliance.ts) so the carrier and product names
// never reach the slides or the narration.
//
//   node vps/run-illustration-job.mjs          # dry run, prints the payload
//   node vps/run-illustration-job.mjs --send   # creates the row + fires the job
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const env = {}
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
}
const VPS = (env.VIDEO_ASSEMBLY_URL || '').replace(/\/$/, '')
const SECRET = env.VIDEO_ASSEMBLY_SECRET
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY
const SEND = process.argv.includes('--send')

// ── Compliance + slide-style, both from the app (single source of truth) ────
const tmp = join(ROOT, 'vps', '.job'); mkdirSync(tmp, { recursive: true })
await build({ entryPoints: [join(ROOT, 'app/_lib/compliance.ts')], bundle: true, format: 'esm', platform: 'node', outfile: join(tmp, 'c.mjs'), logLevel: 'error' })
await build({ entryPoints: [join(ROOT, 'app/_lib/slide-engine/simple-prompt.ts')], bundle: true, format: 'esm', platform: 'node', outfile: join(tmp, 's.mjs'), logLevel: 'error' })
const { scrubComplianceText, productTokens, isRegulated, complianceLeaks } =
  await import('file://' + join(tmp, 'c.mjs').replace(/\\/g, '/'))
const { buildSimpleSlidePrompt, getStylePrompt } =
  await import('file://' + join(tmp, 's.mjs').replace(/\\/g, '/'))

// ── The real illustration ───────────────────────────────────────────────────
const ill = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/sources/insurance-illustration.json'), 'utf8'))
const regulated = isRegulated(ill.policyType, ill.carrier, JSON.stringify(ill).slice(0, 4000))
const toks = productTokens(ill.policyType, ill.carrier, ill.additionalNotes)
const scrub = (s) => (regulated ? scrubComplianceText(String(s), toks) : String(s))

console.log('regulated:', regulated)
console.log('blocked tokens:', toks.slice(0, 12).join(' | '))

const y10 = ill.cashValueProjections.find((r) => r.year === 10)
const usd = (n) => '$' + Number(n).toLocaleString('en-US')
const client = ill.insuredName

// ── Six beats. Narration is what the ear gets; slide copy is what the eye gets.
const BEATS = [
  {
    type: 'cover', headline: 'Your Personal Illustration', subtitle: `Prepared for ${client}`,
    narration: `Hi ${client.split(' ')[0]} — thanks for your time. This is a short walk through the illustration prepared for you.`,
  },
  {
    type: 'content', headline: 'What You Put In',
    stats: [
      { label: 'Annual premium', value: usd(ill.annualPremium) },
      { label: 'Payment mode', value: ill.paymentMode },
      { label: 'Your age at issue', value: String(ill.insuredAge) },
    ],
    // paymentMode is "Monthly ($520/mo)" — speak the amount, not the notation.
    narration: `You're putting in ${usd(ill.annualPremium)} a year${
      /\$([\d,]+)\/mo/.exec(ill.paymentMode)
        ? ` — that's $${/\$([\d,]+)\/mo/.exec(ill.paymentMode)[1]} a month`
        : ''}. You started at age ${ill.insuredAge}.`,
  },
  {
    type: 'content', headline: 'What It Protects',
    stats: [{ label: 'Benefit to your family', value: usd(ill.deathBenefit) }],
    bullets: [{ text: 'Paid directly to the people you name' }, { text: 'Generally income-tax free to them' }],
    narration: `The core of it is protection. ${usd(ill.deathBenefit)} paid directly to the people you name, generally free of income tax to them.`,
  },
  {
    type: 'content', headline: 'What It Builds',
    stats: [
      { label: 'Projected at year 10', value: usd(y10.current) },
      { label: 'Guaranteed at year 10', value: usd(y10.guaranteed) },
    ],
    narration: `Alongside that, value builds. At year ten the illustration projects ${usd(y10.current)}. The guaranteed column shows ${usd(y10.guaranteed)}.`,
  },
  {
    type: 'content', headline: 'Projected Is Not Guaranteed',
    bullets: [
      { text: 'The projected column assumes the illustrated rate continues' },
      { text: 'The guaranteed column is what the contract must do' },
      { text: 'Your actual values will land somewhere between' },
    ],
    narration: `That gap matters, so I want to be plain about it. The projected column assumes the illustrated rate continues. The guaranteed column is what the contract must do. Your real values will land somewhere between the two.`,
  },
  {
    type: 'closing', headline: 'Let’s Talk It Through',
    contactInfo: {
      phone: ill.agentInfo?.phone || ill.contactInfo?.phone || '1-555-014-2200',
      email: ill.agentInfo?.email || ill.contactInfo?.email || 'agent@example.com',
    },
    narration: `Take a look at the full illustration, and call me any time — happy to walk through any part of it with you.`,
  },
]

// ── Build the two parallel arrays /generate expects ─────────────────────────
const stylePrompt = getStylePrompt('steampunk')
const brandColors = { primary: '#D4A843', secondary: '#8C5A2B' }

const scenes = BEATS.map((b, i) => ({
  narration: scrub(b.narration),
  sceneNumber: i + 1,
}))

const slidePrompts = BEATS.map((b, i) => buildSimpleSlidePrompt({
  type: b.type,
  headline: scrub(b.headline),
  subtitle: b.subtitle ? scrub(b.subtitle) : undefined,
  stats: b.stats?.map((s) => ({ label: scrub(s.label), value: scrub(s.value) })),
  bullets: b.bullets?.map((x) => ({ text: scrub(x.text) })),
  contactInfo: b.contactInfo,
  narrationContext: scrub(b.narration),
  stylePrompt, brandColors,
  pageNumber: i + 1, totalPages: BEATS.length,
}))

// Refuse to send if anything blocked survived — the scrub is the guarantee, so
// a leak here is a stop, not a warning.
const leaks = complianceLeaks(scenes.map((s) => s.narration).join(' '), slidePrompts.join(' '))
console.log('\nnarration:')
scenes.forEach((s, i) => console.log(` ${i + 1}. ${s.narration}`))
console.log('\ncompliance leaks:', leaks.length ? leaks : 'none')
if (leaks.length) { console.error('\nABORT — blocked terms survived the scrub.'); process.exit(1) }

writeFileSync(join(tmp, 'payload-preview.json'), JSON.stringify({ scenes, slidePrompts }, null, 2))
console.log('\npayload written to vps/.job/payload-preview.json')
if (!SEND) { console.log('\nDRY RUN. Re-run with --send to create the row and fire the job.'); process.exit(0) }

// ── Create the videos row, then fire the job ───────────────────────────────
// Plain PostgREST rather than the JS client — the repo root has no
// node_modules and this only needs two calls.
const sbH = {
  apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json', Prefer: 'return=representation',
}
const pr = await fetch(`${SB_URL}/rest/v1/profiles?select=id,email&limit=1`, { headers: sbH })
const profs = await pr.json()
const prof = Array.isArray(profs) ? profs[0] : null
if (!prof) { console.error('could not resolve a user:', JSON.stringify(profs).slice(0, 220)); process.exit(1) }
console.log('\nuser:', prof.email, prof.id)

const ir = await fetch(`${SB_URL}/rest/v1/videos`, {
  method: 'POST', headers: sbH,
  body: JSON.stringify({
    user_id: prof.id, status: 'processing', progress_pct: 5,
    progress_detail: 'Starting…',
    title: 'VPS pipeline test — steampunk illustration',
  }),
})
const ins = await ir.json()
const row = Array.isArray(ins) ? ins[0] : null
if (!row?.id) { console.error('insert failed:', JSON.stringify(ins).slice(0, 300)); process.exit(1) }
console.log('videoId:', row.id)

const health = await fetch(`${VPS}/health`, { signal: AbortSignal.timeout(8000) })
if (!health.ok) { console.error('VPS unhealthy'); process.exit(1) }

const res = await fetch(`${VPS}/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-secret': SECRET },
  body: JSON.stringify({
    videoId: row.id, userId: prof.id, voiceId: 'nova',
    scenes, slidePrompts, brandName: 'Prepared for you',
    brandColors, industry: 'insurance',
    musicPrompt: 'Understated, warm instrumental background for a financial explainer. No vocals. Fade out.',
  }),
  signal: AbortSignal.timeout(30000),
})
console.log('VPS response:', res.status, (await res.text()).slice(0, 200))
console.log('\nPoll:  node vps/poll-job.mjs', row.id)
