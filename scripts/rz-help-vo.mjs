/**
 * NARRATION FOR THE THREE NEW HELP VIDEOS.
 *
 *   node scripts/rz-help-vo.mjs <rzlogo|rzmagic|rzbrands|all>
 *
 * One MP3 per line into remotion/public/showcase/<id>/vo-N.mp3, plus a
 * vo.json holding the lines and their MEASURED durations — the beat lengths
 * come from those, so a guessed duration would desync the whole film.
 *
 * Voice and model match the seven videos already published: ElevenLabs
 * Rachel, eleven_turbo_v2_5, the same stability and style. A help section
 * narrated by two different voices reads as two different products.
 *
 * The music track and its beatgrid are copied from an existing Restylez
 * video rather than regenerated — every one of them shares the same bed, and
 * that is what makes them feel like a set.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SHOWCASE = join(ROOT, 'remotion', 'public', 'showcase')
/* Any finished Restylez tool video — they all share one bed. */
const BED = join(SHOWCASE, 'rzedit')

const VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'

/*
 * "ReStyles", not "Restylez" — it is how the name is SAID, and the speech
 * model reads the z spelling as "restilez". The existing tracks do the same.
 */
export const VO = {
  rzlogo: [
    "Here's how to make a logo in ReStyles.",
    'Start with the name, spelled exactly how it should look on the logo.',
    "Then say what you do, the way you'd tell a person. It reads the feeling in that, not just the facts.",
    'Press send, and about a minute later you have four.',
    'Four different ideas, not one idea four times. A wordmark, a crest, a symbol, a monogram.',
    'Like one of them? Point at it by number. Make the fourth one green.',
    'It changes that one, and keeps everything you liked about it. Changing your mind costs nothing.',
    'A logo, by talking.',
  ],
  rzmagic: [
    "Here's how Magic Design works.",
    "Say what you're making, the way you'd tell a designer.",
    'Then the exact words. Every line is printed just as you wrote it, so a phone number is never wrong.',
    'Drop in the things you already own. Your logo, your photos, a headshot.',
    'You get three ways it could go, free. Nothing is charged for these.',
    'Bold, warm, or clean. Pick the one you like.',
    "And if something's not right, say so before you pay. It's made once, correctly.",
    'Your pictures, one finished piece.',
  ],
  rzbrands: [
    "Here's how to save your brand in ReStyles.",
    'Paste your website, and we pull your real logo and colors straight off it.',
    'Or upload the logo yourself. We use it exactly as it is. We never invent a logo.',
    "Give it a name, tick that it's yours to use, and save.",
    'From then on, pick that brand on any deck and your logo lands on every slide.',
    'Your logo, your colors, every time.',
  ],
}

function env() {
  const out = {}
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

/** Seconds of audio in an mp3, measured rather than guessed. */
function durationOf(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8' })
  const n = Number(String(out).trim())
  if (!Number.isFinite(n) || n <= 0) throw new Error('could not measure ' + file)
  return Math.round(n * 100) / 100
}

async function say(key, text, file) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      /* The same settings as the published seven. Style low: this is a person
         explaining a tool, not an advert. */
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3 },
    }),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

const which = process.argv[2] || 'all'
const ids = which === 'all' ? Object.keys(VO) : [which]
const key = env().ELEVENLABS_API_KEY
if (!key) throw new Error('ELEVENLABS_API_KEY missing from .env.local')

for (const id of ids) {
  const lines = VO[id]
  if (!lines) throw new Error('no narration written for ' + id)
  const dir = join(SHOWCASE, id)
  mkdirSync(dir, { recursive: true })
  console.log('==', id)

  const durations = []
  for (let i = 0; i < lines.length; i++) {
    const file = join(dir, `vo-${i + 1}.mp3`)
    /* Skip what is already there, so a failure halfway does not re-buy every
       line that already worked. Delete the folder to force a redo. */
    if (!existsSync(file)) {
      await say(key, lines[i], file)
      process.stdout.write(` line ${i + 1}`)
    } else {
      process.stdout.write(` line ${i + 1} (kept)`)
    }
    const d = durationOf(file)
    durations.push(d)
    console.log(`  ${d}s`)
  }

  writeFileSync(join(dir, 'vo.json'), JSON.stringify({ lines, durations }, null, 2))

  /* The bed and its grid, copied from a finished video — every Restylez tool
     film shares one track, and that shared bed is most of why they feel like
     a set rather than seven separate things. */
  for (const f of ['music.mp3', 'beatgrid.json']) {
    if (!existsSync(join(dir, f))) copyFileSync(join(BED, f), join(dir, f))
  }

  const total = durations.reduce((a, b) => a + b, 0)
  console.log(` ${lines.length} lines, ${Math.round(total)}s of narration`)
}
console.log('narration done')
