/* Generate assets for the Apex opportunity/income commercial (apex-opp).
 * VO (ElevenLabs, 6 lines) + 1 hero image (Cloudflare FLUX→Gemini) + music
 * (ElevenLabs Music, exact length). Writes into remotion/public/apex-opp/. */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const PUB = join(process.cwd(), 'remotion', 'public', 'apex-opp')
mkdirSync(join(PUB, 'gen'), { recursive: true })

const KEY = process.env.ELEVENLABS_API_KEY
const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'
const CF_ACCT = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_TOK = process.env.CLOUDFLARE_API_KEY

// VO lines — opportunity pitch, NO specific income figures (compliance).
const VO = {
  'ao-1': "What if you got paid every single month? Not just once — every month a client keeps their SmartViewz.",
  'ao-2': "Apex Affinity Group gives you a way to earn recurring income by putting powerful A I in the hands of insurance agents.",
  'ao-3': "And it practically sells itself. SmartViewz answers any question about an agent's book of business, it's zero dollars to join Apex, and every agent out there is hungry for an edge.",
  'ao-4': "Stop trading your time for a one-time paycheck. Build residual income that keeps paying you long after the sale.",
  'ao-5': "Every agent you bring on can pay you month after month. That's the real power of recurring revenue.",
  'ao-6': "Ready to start earning every month? Talk to your Apex representative today, and see how far this can go.",
}

async function tts(id, text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3 } }),
  })
  if (!r.ok) throw new Error(`tts ${id}: ${r.status} ${(await r.text()).slice(0, 120)}`)
  writeFileSync(join(PUB, `${id}.mp3`), Buffer.from(await r.arrayBuffer()))
  console.log(`  vo ${id} ok`)
}

async function image(prompt, out) {
  // Cloudflare FLUX first (free), then Gemini fallback
  if (CF_ACCT && CF_TOK) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
        method: 'POST', headers: { Authorization: `Bearer ${CF_TOK}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 6 }), signal: AbortSignal.timeout(60000),
      })
      if (r.ok) { const j = await r.json(); const b64 = j?.result?.image; if (b64) { writeFileSync(out, Buffer.from(b64, 'base64')); console.log('  image ok (flux)'); return } }
    } catch (e) { console.log('  flux failed, trying gemini:', e.message) }
  }
  const gk = process.env.GEMINI_API_KEY, model = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gk}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt + ' Cinematic, photorealistic, dark, moody, 16:9. No text, no logos, no people faces.' }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
    signal: AbortSignal.timeout(90000),
  })
  if (!r.ok) throw new Error(`gemini image ${r.status}`)
  const j = await r.json(); const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData)
  if (!part) throw new Error('no image'); writeFileSync(out, Buffer.from(part.inlineData.data, 'base64')); console.log('  image ok (gemini)')
}

async function music(seconds) {
  const ms = Math.max(10000, Math.min(300000, Math.round(seconds * 1000)))
  const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'Uplifting, motivational modern corporate anthem — confident and aspirational, driving four-on-the-floor kick, warm bass, bright optimistic synth plucks and piano, builds energy toward an inspiring finish. Instrumental only, no vocals. Feels like financial success and opportunity.', music_length_ms: ms }),
    signal: AbortSignal.timeout(180000),
  })
  if (!r.ok) throw new Error(`music ${r.status}: ${(await r.text()).slice(0, 120)}`)
  writeFileSync(join(PUB, 'music.mp3'), Buffer.from(await r.arrayBuffer())); console.log(`  music ok (${(ms/1000).toFixed(0)}s)`)
}

;(async () => {
  console.log('▶ Apex opportunity assets')
  console.log('[VO]')
  for (const [id, text] of Object.entries(VO)) await tts(id, text)
  console.log('[IMAGE]')
  await image('A cinematic dark image symbolizing recurring monthly income and opportunity: golden light rays over an abstract upward-climbing financial growth chart, warm gold and emerald tones, sense of momentum and wealth, moody and premium, no text.', join(PUB, 'gen', 'shot1.png'))
  console.log('[MUSIC]')
  // video length ≈ intro(3s) + beats(4.4+5.6+6.2+5.4+5.6+6.0) + tail ≈ 36.4s
  await music(37)
  console.log('done → remotion/public/apex-opp/')
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
