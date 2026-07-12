/**
 * Composes a REAL musical bed (not a click-track): a chord progression with
 * bass, an arpeggiated melody, warm pads, and light percussion — at a known BPM
 * so the beat-cut engine still locks. Royalty-free (authored here). Several moods.
 * Run: npx tsx scripts/director/gen-music.ts [mood] [seconds] [bpm]
 *   moods: warm | corporate | uplifting | serious
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
const OUT = join(__dirname, '..', '..', 'remotion', 'public', 'music')
mkdirSync(OUT, { recursive: true })

const SR = 44100
const mood = (process.argv[2] || 'warm') as 'warm' | 'corporate' | 'uplifting' | 'serious' | 'tension' | 'athletic' | 'cinematic'
const DUR = Number(process.argv[3] || 80)
const BPM = Number(process.argv[4] || 128)

function wav(s: Float32Array): Buffer {
  const n = s.length, b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24)
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, s[i])); b.writeInt16LE((v * 32767) | 0, 44 + i * 2) }
  return b
}
const note = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12)
// scale degrees (semitones from A) for chords, by mood — all consonant, tasteful
const PROGS: Record<string, number[][]> = {
  // each chord = [root, third, fifth] in semitones relative to A2 (=-24)
  warm:      [[-24, -17, -12], [-19, -12, -7], [-21, -14, -9], [-16, -9, -4]],   // Am-C-Bb-Dm-ish, warm
  corporate: [[-24, -20, -17], [-17, -13, -10], [-19, -15, -12], [-22, -18, -15]], // bright major-ish
  uplifting: [[-24, -17, -12], [-16, -9, -4], [-14, -7, -2], [-19, -12, -7]],
  serious:   [[-24, -21, -17], [-26, -22, -19], [-24, -21, -17], [-19, -16, -12]], // minor, grave
  // COMMERCIAL beds — punchier, cinematic:
  tension:   [[-24, -21, -17], [-24, -21, -17], [-22, -19, -15], [-19, -16, -12]], // brooding minor, driving pulse
  athletic:  [[-24, -17, -12], [-14, -7, -2], [-16, -9, -4], [-12, -5, 0]],        // rising, energetic anthem
  cinematic: [[-24, -20, -17], [-19, -15, -12], [-21, -17, -14], [-16, -12, -9]],  // grand, wide, dramatic
}
const MELODY: Record<string, number[]> = {
  warm: [0, 3, 5, 7, 5, 3, 0, -2], corporate: [0, 4, 7, 4, 0, 7, 4, 0], uplifting: [0, 5, 7, 12, 7, 5, 3, 0], serious: [0, -2, -5, -2, 0, -5, -7, -5],
  tension: [0, 0, -2, 0, 3, 0, -2, -5], athletic: [0, 7, 12, 7, 5, 12, 7, 5], cinematic: [0, 5, 7, 5, 0, -5, 0, 5],
}

const n = Math.floor(DUR * SR), out = new Float32Array(n)
const spb = 60 / BPM
const chordLen = spb * 4                       // one chord per bar (4 beats)
const prog = PROGS[mood], mel = MELODY[mood]

// soft instrument voices
const sine = (t: number, f: number) => Math.sin(t * f * 2 * Math.PI)
const tri = (t: number, f: number) => 2 / Math.PI * Math.asin(Math.sin(t * f * 2 * Math.PI))
const env = (t: number, dur: number, a = 0.02, r = 0.3) => Math.min(1, t / a) * Math.min(1, (dur - t) / r + 0.0001)

function addTone(start: number, dur: number, freq: number, gain: number, voice: (t: number, f: number) => number, aA = 0.02, aR = 0.3) {
  const s0 = Math.floor(start * SR), L = Math.floor(dur * SR)
  for (let i = 0; i < L; i++) { const idx = s0 + i; if (idx < 0 || idx >= n) continue; const t = i / SR; out[idx] += voice(t, freq) * env(t, dur, aA, aR) * gain }
}
function kick(start: number, gain = 0.5) { const s0 = Math.floor(start * SR), L = Math.floor(0.26 * SR); for (let i = 0; i < L; i++) { const idx = s0 + i; if (idx >= n) break; const t = i / L; out[idx] += Math.sin((i / SR) * (110 * Math.exp(-t * 7) + 44) * 2 * Math.PI) * Math.exp(-t * 6) * gain } }

const bars = Math.ceil(DUR / chordLen)
for (let bar = 0; bar < bars; bar++) {
  const chord = prog[bar % prog.length]
  const barStart = bar * chordLen
  // PAD: sustained chord (triangle voices, soft)
  chord.forEach((semi, k) => addTone(barStart, chordLen, note(semi), 0.10, tri, 0.3, 0.6))
  // BASS: root, pulsing on beats 1 & 3
  addTone(barStart, spb * 1.6, note(chord[0] - 12), 0.22, sine, 0.01, 0.25)
  addTone(barStart + spb * 2, spb * 1.6, note(chord[0] - 12), 0.18, sine, 0.01, 0.25)
  // MELODY: arpeggio over the bar (8th notes), gentle
  for (let e = 0; e < 8; e++) { const semi = chord[0] + 12 + mel[(bar * 8 + e) % mel.length]; addTone(barStart + e * (spb / 2), spb / 2 * 0.9, note(semi), 0.07, tri, 0.01, 0.12) }
  // light percussion: soft kick on beats (musical pulse, NOT a naked click)
  if (mood === 'serious' || mood === 'cinematic') { kick(barStart, 0.32); kick(barStart + spb * 2, 0.28) }  // sparse, grave
  else if (mood === 'tension' || mood === 'athletic') { for (let bt = 0; bt < 4; bt++) kick(barStart + bt * spb, 0.36); kick(barStart + spb * 2.5, 0.22) }  // driving 4-on-floor + push
  else for (let bt = 0; bt < 4; bt++) kick(barStart + bt * spb, 0.28)
}

// gentle master: soft-clip + normalize to -1.5 dBFS-ish
let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
const g = 0.84 / (peak || 1)
for (let i = 0; i < n; i++) { let v = out[i] * g; out[i] = Math.tanh(v * 1.1) * 0.9 }

const file = `bed-${mood}-${BPM}.wav`
writeFileSync(join(OUT, file), wav(out))
console.log(`music/${file} — ${mood}, ${BPM} BPM, ${DUR}s (chords+bass+melody+pads, tagged for the cut engine)`)
