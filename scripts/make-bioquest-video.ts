/**
 * Production-path video from the BioQuest stock agreement PDF.
 * Runs the REAL pipeline: narrative-first script (Opus story + Sonnet segment)
 * → buildV3Payload → POST /render-v3 on the VPS (same call the app makes).
 * Then polls the videos row for the finished URL.
 * Run: npx tsx scripts/make-bioquest-video.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { randomUUID } from 'crypto'

// The document, extracted into the app's ExtractedData shape (this is what the
// extract step produces — done by hand here so we don't need to re-upload).
const data = {
  title: 'Stock Issuance & Transfer Agreement',
  subtitle: 'BioQuest, Inc. (BQST) × MMM Industries Group',
  source: 'BioQuest_MMM_Group_Stock_Agreement.pdf',
  keyMetrics: [
    { label: 'Investment Amount', value: '$100,000', highlight: true },
    { label: 'Investment Shares', value: '100,000', highlight: true },
    { label: 'Consulting Shares', value: '100,000' },
    { label: 'Series A Preferred Transferred', value: '1,700' },
    { label: 'Par Value', value: '$1.00/share' },
    { label: 'Preferred Delivery', value: '5 business days' },
  ],
  sections: [
    { title: 'The Investment', content: 'MMM Industries Group invests $100,000 in cash and receives 100,000 shares of BioQuest common stock at $1.00 par value.' },
    { title: 'Consulting Shares', content: 'For business-development services, BioQuest issues an additional 100,000 common shares, to be registered for resale under a new Regulation A offering (upgrading from Tier 1 to Tier 2) after the 2025 audit.' },
    { title: 'Preferred Incentive', content: 'CEO Trent Daniel personally transfers 1,700 Series A Preferred shares to MMM Industries Group as an investment incentive, with an anti-dilution agreement, delivered within 5 business days of payment.' },
    { title: 'Securities Compliance', content: 'Shares are issued under Section 4(a)(2) private-placement exemptions, carry restrictive legends, and remain transfer-restricted until registered.' },
  ],
  bulletPoints: [
    'Company: BioQuest, Inc., a Nevada corporation (BQST)',
    'Effective date: December 30, 2025',
    'Governed by the laws of Nevada',
    'BioQuest reps: duly incorporated, board-authorized, shares fully paid',
  ],
  additionalNotes: [],
  companyName: 'BioQuest, Inc.',
  industry: 'finance',
  contactInfo: { website: null, phone: null, email: null },
  classification: { documentType: 'stock_agreement', category: 'finance', tone: 'confident', perspective: 'company-to-investor' },
}

async function main() {
  const { generateScript } = await import('../app/_lib/script-generator')
  const { buildV3Payload } = await import('../app/_lib/v3-render')
  const { createAdminClient } = await import('../app/_lib/supabase/admin')

  const videoId = randomUUID()
  const USER = '0e28a48c-978c-4bf0-93c3-6769229c85cc' // existing owner (music files are under this id)
  const VPS = process.env.VIDEO_ASSEMBLY_URL!
  const SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

  console.log('[1/4] Generating script (narrative-first two-pass)...')
  const t0 = Date.now()
  const scenes = await generateScript(
    data as any, 'BioQuest',
    { primary: '#c0182a', secondary: '#111111', accent: '#c0182a', background: '#ffffff', text: '#111111' }, // BioQuest red/black
    false, 0, 'nova', undefined,
    undefined, // no contact closing
    'explain this stock agreement clearly to the investor and reassure them the terms are sound',
    undefined, 'finance', 'standard', 'solo',
    data.classification as any, null,
  )
  console.log(`      ${scenes.length} scenes in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  scenes.forEach((s: any) => console.log(`      · ${s.title}: ${(s.narration || '').slice(0, 70)}...`))

  console.log('[2/4] Creating videos row...')
  const admin = createAdminClient()
  await admin.from('videos').insert({
    id: videoId, user_id: USER, title: data.title, status: 'assembling',
    output_type: 'video', detail_level: 'standard',
  })

  console.log('[3/4] Building payload + submitting to /render-v3...')
  const payload = buildV3Payload({
    videoId, userId: USER, voiceId: 'nova', scenes: scenes as any,
    brand: null, brandName: 'BioQuest',
    classification: data.classification as any, industry: 'finance',
    keyMetrics: data.keyMetrics as any,
    // reuse an existing generated track (music gen is intermittent; not the point here)
    musicUrl: 'https://izccljcgxsbumgsznndd.supabase.co/storage/v1/object/public/videos/0e28a48c-978c-4bf0-93c3-6769229c85cc/0567ca2f-7ad1-45bb-a56c-6d6a88714a34_music.mp3',
    videoStyle: 'auto',
  })
  console.log(`      theme=${(payload as any).theme}, scenes=${(payload as any).scenes?.length}`)
  const res = await fetch(`${VPS}/render-v3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-secret': SECRET },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(28000),
  }).catch((e) => { console.log(`      submit ack: ${e.name} (likely queued — VPS renders async)`); return null })
  if (res) console.log(`      submit status: ${res.status}`)

  console.log('[4/4] Polling for completion (renders take a few minutes)...')
  const deadline = Date.now() + 12 * 60 * 1000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15000))
    const { data: row } = await admin.from('videos').select('status, progress, progress_detail, video_url').eq('id', videoId).single()
    if (!row) continue
    console.log(`      ${row.status} ${row.progress ?? ''}% ${row.progress_detail ?? ''}`)
    if (row.status === 'completed' && row.video_url) {
      console.log(`\n✅ DONE: ${row.video_url}\n   videoId: ${videoId}`)
      return
    }
    if (row.status === 'failed') { console.log(`\n❌ FAILED: ${row.progress_detail}`); return }
  }
  console.log(`\n⏱  Still rendering after 12min. videoId: ${videoId} — check the videos row.`)
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
