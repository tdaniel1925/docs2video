/**
 * Synthesizes a driving music bed at a KNOWN BPM so the cut engine can lock cuts
 * to an exact beat grid (no detection guesswork). Four-on-the-floor kick + hats +
 * a bass pulse + a sparse pad. Royalty-free (authored here). Loops cleanly.
 * Run: npx tsx scripts/director/gen-beatbed.ts [bpm] [seconds]
 */
import { writeFileSync } from 'fs'
import { join } from 'path'
const OUT = join(__dirname, '..', '..', 'remotion', 'public')
const SR = 44100
const BPM = Number(process.argv[2] || 128)
const DUR = Number(process.argv[3] || 20)

function wav(s: Float32Array): Buffer {
  const n = s.length, b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24)
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, s[i])); b.writeInt16LE((v * 32767) | 0, 44 + i * 2) }
  return b
}
let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1 }

const n = Math.floor(DUR * SR), out = new Float32Array(n)
const spb = 60 / BPM                        // seconds per beat
const beatSamp = spb * SR
const add = (start: number, buf: Float32Array, gain = 1) => { for (let i = 0; i < buf.length; i++) { const idx = start + i; if (idx >= 0 && idx < n) out[idx] += buf[i] * gain } }

// kick: sine drop
function kick(): Float32Array { const L = Math.floor(0.28 * SR), o = new Float32Array(L); for (let i = 0; i < L; i++) { const t = i / L; o[i] = Math.sin((i / SR) * (110 * Math.exp(-t * 7) + 42) * 2 * Math.PI) * Math.exp(-t * 6) } return o }
// hat: short noise
function hat(): Float32Array { const L = Math.floor(0.05 * SR), o = new Float32Array(L); for (let i = 0; i < L; i++) o[i] = rnd() * Math.exp(-(i / L) * 30) * 0.35; return o }
// bass note
function bass(freq: number, dur: number): Float32Array { const L = Math.floor(dur * SR), o = new Float32Array(L); for (let i = 0; i < L; i++) { const t = i / L; o[i] = (Math.sin((i / SR) * freq * 2 * Math.PI) * 0.6 + Math.sin((i / SR) * freq * 4 * Math.PI) * 0.15) * (Math.min(1, t * 30) * Math.exp(-t * 1.6)) } return o }

const K = kick(), H = hat()
const totalBeats = Math.ceil(DUR / spb)
// minor-key bass movement (A E F C-ish) for a confident, driving feel
const notes = [55, 55, 82.4, 65.4]  // A1, A1, E2, C2
for (let bt = 0; bt < totalBeats; bt++) {
  const start = Math.floor(bt * beatSamp)
  add(start, K, 0.9)                              // four-on-the-floor kick
  add(Math.floor((bt + 0.5) * beatSamp), H, 1)    // off-beat hat
  add(start, H, 0.5)
  if (bt % 2 === 0) add(start, bass(notes[(bt / 2) % notes.length], spb * 2), 0.5)
}
// gentle pad shimmer
for (let i = 0; i < n; i++) { const t = i / SR; out[i] += Math.sin(t * 220 * 2 * Math.PI) * 0.03 * Math.sin(t * 0.5) }
// normalize
let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
for (let i = 0; i < n; i++) out[i] = (out[i] / peak) * 0.85

writeFileSync(join(OUT, 'beat-bed.wav'), wav(out))
console.log(`beat-bed.wav written — ${BPM} BPM, ${DUR}s, beat every ${spb.toFixed(3)}s (${beatSamp.toFixed(0)} samples)`)
console.log(`grid frames @30fps: beat every ${(spb * 30).toFixed(2)} frames`)
