/**
 * Generates per-scene narration MP3s with OpenAI TTS, probes each duration with
 * ffprobe, and writes public/narration.json { narration:{scene:path}, durations:{scene:sec} }.
 * Run: node scripts/generate-narration.mjs
 *
 * Reads OPENAI_API_KEY from ../.env.local (the main app) or the environment.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PUBLIC = join(ROOT, 'public')

// Scene narration text (kept in sync with src/sample-data.ts NARRATION_TEXT).
const TEXT = {
  cover: "Picture the one event your guests actually talk about for years. That's what we do. iHostPoker brings the real casino floor to your party — in Houston since two thousand three.",
  pillars: "Here's why it works. Over twelve casino games, so everyone finds their table. Trained, professional dealers who run the whole night for you. And an experience built for everyone, from first-timers to high rollers.",
  stat: "More than ten thousand parties hosted. That's not a number we throw around — it's two decades of nights nobody forgets.",
  bullets: "Whatever you're planning, we've got it covered. Corporate galas, fundraisers, private parties. Full setup and breakdown handled for you. Authentic casino-grade tables. And flexible packages for any guest count.",
  closing: "Let's host yours. Book your casino night today, and give your guests a seat at the table they'll never forget.",
}

async function getKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  try {
    const env = await readFile(join(ROOT, '..', '.env.local'), 'utf8')
    const m = env.match(/^OPENAI_API_KEY=(.+)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {}
  throw new Error('OPENAI_API_KEY not found (env or ../.env.local)')
}

function probe(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 10000 }, (err, stdout) => {
      const d = parseFloat((stdout || '').trim())
      resolve(Number.isFinite(d) && d > 0 ? d : 0)
    })
  })
}

async function main() {
  const key = await getKey()
  await mkdir(PUBLIC, { recursive: true })
  const narration = {}
  const durations = {}
  for (const [scene, input] of Object.entries(TEXT)) {
    process.stdout.write(`TTS ${scene}... `)
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input, response_format: 'mp3', speed: 0.98 }),
    })
    if (!resp.ok) throw new Error(`TTS ${scene} failed: ${resp.status} ${await resp.text()}`)
    const buf = Buffer.from(await resp.arrayBuffer())
    const rel = `narration-${scene}.mp3`
    await writeFile(join(PUBLIC, rel), buf)
    const d = await probe(join(PUBLIC, rel))
    // +0.6s tail so the scene lingers slightly after the voice ends.
    narration[scene] = rel
    durations[scene] = Math.round((d + 0.6) * 100) / 100
    console.log(`${buf.length} bytes, ${durations[scene]}s`)
  }
  await writeFile(join(PUBLIC, 'narration.json'), JSON.stringify({ narration, durations }, null, 2))
  console.log('Wrote public/narration.json')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
