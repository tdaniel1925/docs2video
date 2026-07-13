/**
 * Synthesize simple sound-design elements (whoosh riser + sub-bass impact) as
 * WAV files — the "Hollywood" layer, no external library. Triggered on the beat
 * grid in the composition.
 * Run: npx tsx scripts/gen-sfx.ts
 */
import { writeFileSync } from 'fs'
import { join } from 'path'

const OUT = join(__dirname, '..', 'remotion', 'public')
const SR = 44100

function wav(samples: Float32Array): Buffer {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  return buf
}

// Sub-bass impact: a fast pitch-drop sine + a click transient, short decay.
function impact(): Float32Array {
  const dur = 0.5, n = Math.floor(SR * dur), out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const f = 120 * Math.exp(-t * 14) + 42        // 120Hz → 42Hz drop
    const env = Math.exp(-t * 7)
    const click = i < 120 ? (Math.random() * 2 - 1) * Math.exp(-t * 220) * 0.5 : 0
    out[i] = (Math.sin(2 * Math.PI * f * t) * env * 0.85) + click
  }
  return out
}

// Whoosh riser: filtered noise swelling up over ~0.7s, for transitions.
function whoosh(): Float32Array {
  const dur = 0.75, n = Math.floor(SR * dur), out = new Float32Array(n)
  let lp = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR, p = t / dur
    const noise = Math.random() * 2 - 1
    const cutoff = 0.02 + p * 0.4          // sweep the low-pass upward
    lp += cutoff * (noise - lp)
    const env = Math.sin(Math.PI * p) * Math.pow(p, 0.6) // swell in, taper out
    out[i] = lp * env * 0.5
  }
  return out
}

writeFileSync(join(OUT, 'sfx-impact.wav'), wav(impact()))
writeFileSync(join(OUT, 'sfx-whoosh.wav'), wav(whoosh()))
console.log('sfx written: sfx-impact.wav, sfx-whoosh.wav')
