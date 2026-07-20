// Trim leading/trailing silence from VO clips + rewrite durations.json so slide
// timing matches ACTUAL speech (kills dead-air where a stale slide overstays).
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = process.env.DIR || 'road1'
const P = join(HERE, '..', 'public', DIR)
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','csv=p=0', f]).toString().trim())
const data = JSON.parse(readFileSync(join(P, 'durations.json'), 'utf8'))
const TAIL = parseFloat(process.env.TAIL || '0.35') // keep this much silence after speech (breath)
const newDurs = []
for (let i = 0; i < data.vo.length; i++) {
  const f = join(P, `vo-${i}.mp3`), tmp = join(P, `vo-${i}.trim.mp3`)
  // strip leading silence, and trailing silence beyond TAIL. -40dB threshold.
  execFileSync('ffmpeg', ['-y','-i', f,
    '-af', `silenceremove=start_periods=1:start_silence=0.1:start_threshold=-40dB:detection=peak,areverse,silenceremove=start_periods=1:start_silence=${TAIL}:start_threshold=-40dB:detection=peak,areverse`,
    tmp], { stdio: 'ignore' })
  renameSync(tmp, f)
  const d = durOf(f); newDurs.push(d)
  console.log(`[trim] vo-${i}: ${data.vo[i].toFixed(2)}s -> ${d.toFixed(2)}s`)
}
data.vo = newDurs
writeFileSync(join(P, 'durations.json'), JSON.stringify(data, null, 2))
console.log(`[trim] durations.json rewritten. total ${newDurs.reduce((a,b)=>a+b,0).toFixed(1)}s`)
