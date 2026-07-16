/**
 * Generate voiceover + write the scene data for a KINETIC-style BioQuest video.
 * Reuses the exact narrative-first script the production run produced, but
 * targets the kinetic composition (animated type + beat-synced music) instead
 * of the cinematic VPS render.
 * Run: npx tsx scripts/gen-bioquest-kinetic-assets.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const KEY = process.env.ELEVENLABS_API_KEY!
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

const data = {
  title: 'Stock Issuance & Transfer Agreement',
  keyMetrics: [
    { label: 'Investment Amount', value: '$100,000', highlight: true },
    { label: 'Investment Shares', value: '100,000', highlight: true },
    { label: 'Consulting Shares', value: '100,000' },
    { label: 'Series A Preferred Transferred', value: '1,700' },
    { label: 'Par Value', value: '$1.00/share' },
  ],
  sections: [
    { title: 'The Investment', content: 'MMM Industries Group invests $100,000 in cash and receives 100,000 shares of BioQuest common stock at $1.00 par value.' },
    { title: 'Consulting Shares', content: 'For business-development services, BioQuest issues an additional 100,000 common shares, to be registered for resale under a new Regulation A offering after the 2025 audit.' },
    { title: 'Preferred Incentive', content: 'CEO Trent Daniel personally transfers 1,700 Series A Preferred shares to MMM Industries Group as an investment incentive, with an anti-dilution agreement, delivered within 5 business days of payment.' },
    { title: 'Securities Compliance', content: 'Shares are issued under Section 4(a)(2) private-placement exemptions, carry restrictive legends, and remain transfer-restricted until registered.' },
  ],
  bulletPoints: ['Company: BioQuest, Inc. (BQST)', 'Effective date: December 30, 2025', 'Governed by the laws of Nevada'],
  additionalNotes: [], companyName: 'BioQuest, Inc.', industry: 'finance',
  classification: { documentType: 'stock_agreement', category: 'finance', tone: 'confident', perspective: 'company-to-investor' },
}

async function tts(text: string, file: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25 } }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 150)}`)
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()))
  console.log(`[vo] ${file}`)
}

async function main() {
  const { generateScript } = await import('../app/_lib/script-generator')
  console.log('Generating narrative-first script for kinetic...')
  const scenes: any[] = await generateScript(
    data as any, 'BioQuest',
    { primary: '#c0182a', secondary: '#111111', accent: '#c0182a', background: '#ffffff', text: '#111111' },
    false, 0, 'nova', undefined, undefined,
    'explain this stock agreement clearly to the investor and reassure them the terms are sound',
    undefined, 'finance', 'standard', 'solo', data.classification as any, null,
  )
  console.log(`${scenes.length} scenes`)

  // Per-scene VO so the kinetic text can sync to spoken words.
  for (let i = 0; i < scenes.length; i++) {
    await tts(scenes[i].narration, `bq-vo-${i + 1}.mp3`)
  }

  // Write the scene structure the kinetic comp will read (headline + stats + beat).
  const sceneData = scenes.map((s, i) => ({
    i, title: s.title, beat: s.beat, headline: s.slideData?.headline || s.title,
    stats: s.slideData?.stats || [], bullets: s.slideData?.bullets || [],
    narration: s.narration,
  }))
  writeFileSync(join(OUT, 'bq-scenes.json'), JSON.stringify(sceneData, null, 2))
  console.log('wrote bq-scenes.json')

  // Music: reuse existing track (music gen intermittent) as the beat source.
  if (existsSync(join(OUT, 'commercial-music.mp3'))) {
    copyFileSync(join(OUT, 'commercial-music.mp3'), join(OUT, 'bq-music.mp3'))
    console.log('music: reused commercial-music.mp3')
  }
  console.log('done')
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
