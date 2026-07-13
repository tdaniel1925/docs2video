/**
 * Synthesizes a small royalty-free SFX pack as WAV files (authored here → no
 * license concerns, deterministic, no download). These are the "hits" that make
 * fast cuts feel produced: whoosh, impact, riser, click, sub-drop, tick.
 * Placed at cut frames by the beat-cut engine.
 * Run: npx tsx scripts/director/gen-sfx.ts
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
const OUT = join(__dirname, '..', '..', 'remotion', 'public', 'sfx')
import { mkdirSync } from 'fs'
mkdirSync(OUT, { recursive: true })

const SR = 44100
function wav(samples: Float32Array): Buffer {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, samples[i])); buf.writeInt16LE((s * 32767) | 0, 44 + i * 2) }
  return buf
}
const secs = (t: number) => Math.floor(t * SR)
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1 }

// WHOOSH — filtered noise that sweeps up then fades. For whip-pans/fast moves.
function whoosh(dur = 0.5): Float32Array {
  const n = secs(dur), out = new Float32Array(n); let lp = 0
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = Math.sin(Math.PI * t) ** 1.5
    const cutoff = 0.02 + 0.5 * t                 // open the filter over time (sweep up)
    lp += (rnd() - lp) * cutoff
    out[i] = lp * env * 0.6
  }
  return out
}
// IMPACT — a thud: fast sine drop + noise transient. For a number/word landing.
function impact(dur = 0.45): Float32Array {
  const n = secs(dur), out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = Math.exp(-t * 9)
    const freq = 140 * Math.exp(-t * 6) + 45      // pitch drops from ~180 to ~45 Hz
    const body = Math.sin((i / SR) * freq * 2 * Math.PI)
    const click = i < secs(0.006) ? rnd() : 0
    out[i] = (body * 0.9 + click * 0.7) * env
  }
  return out
}
// RISER — noise+tone rising in pitch and volume, for building into a hook payoff.
function riser(dur = 1.4): Float32Array {
  const n = secs(dur), out = new Float32Array(n); let lp = 0
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = t ** 2
    const freq = 200 + 1600 * t ** 2
    const tone = Math.sin((i / SR) * freq * 2 * Math.PI)
    lp += (rnd() - lp) * (0.05 + 0.3 * t)
    out[i] = (tone * 0.35 + lp * 0.5) * env * 0.7
  }
  return out
}
// SUB-DROP — deep low boom for the logo/close. Sine sweep down + long tail.
function subdrop(dur = 1.2): Float32Array {
  const n = secs(dur), out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const env = Math.min(1, t * 20) * Math.exp(-t * 3.2)
    const freq = 90 * Math.exp(-t * 2.5) + 32
    out[i] = Math.sin((i / SR) * freq * 2 * Math.PI) * env * 0.95
  }
  return out
}
// CLICK / TICK — tiny transient for rapid text stamps on off-beats.
function click(dur = 0.06): Float32Array {
  const n = secs(dur), out = new Float32Array(n)
  for (let i = 0; i < n; i++) { const t = i / n; out[i] = (rnd() * 0.5 + Math.sin((i / SR) * 1400 * 2 * Math.PI) * 0.5) * Math.exp(-t * 40) * 0.5 }
  return out
}

const pack: Record<string, Float32Array> = { whoosh: whoosh(), 'whoosh-short': whoosh(0.28), impact: impact(), 'impact-soft': impact(0.6), riser: riser(), subdrop: subdrop(), click: click() }
for (const [name, s] of Object.entries(pack)) { writeFileSync(join(OUT, `${name}.wav`), wav(s)); console.log(`[sfx] ${name}.wav  (${(s.length / SR).toFixed(2)}s)`) }
console.log('SFX pack written to public/sfx/')
