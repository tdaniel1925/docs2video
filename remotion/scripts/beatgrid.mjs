// Beat grid from any music file: decode via ffmpeg → onset envelope → tempo by
// autocorrelation (100–160 BPM) → phase → beats[]. Writes <out>.json {bpm,beats}
import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'
const [src, out] = process.argv.slice(2)
const SR = 11025
const pcm = execFileSync('ffmpeg', ['-v', 'quiet', '-i', src, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4)
const HOP = 128, WIN = 512
const nF = Math.floor((x.length - WIN) / HOP)
// onset strength: half-wave rectified energy difference in a low band (kick) + broadband
const env = new Float32Array(nF); let prev = 0
for (let i = 0; i < nF; i++) { let e = 0; for (let j = 0; j < WIN; j++) { const v = x[i * HOP + j]; e += v * v } e = Math.sqrt(e / WIN); env[i] = Math.max(0, e - prev); prev = e }
const fps = SR / HOP
let best = { bpm: 0, score: -1 }
for (let bpm = 100; bpm <= 160; bpm += 0.2) { const lag = Math.round(fps * 60 / bpm); let s = 0; for (let i = lag; i < nF; i++) s += env[i] * env[i - lag]; s /= (nF - lag); if (s > best.score) best = { bpm, score: s } }
const lag = fps * 60 / best.bpm
let bestPh = 0, bestS = -1
for (let ph = 0; ph < lag; ph += 0.5) { let s = 0; for (let t = ph; t < nF; t += lag) s += env[Math.round(t)] || 0; if (s > bestS) { bestS = s; bestPh = ph } }
const dur = x.length / SR
const beats = []; for (let t = bestPh / fps; t < dur; t += 60 / best.bpm) beats.push(+t.toFixed(3))
writeFileSync(out, JSON.stringify({ bpm: +best.bpm.toFixed(1), beats }))
console.log(`bpm ${best.bpm.toFixed(1)} first ${beats[0]} count ${beats.length} dur ${dur.toFixed(1)}`)
