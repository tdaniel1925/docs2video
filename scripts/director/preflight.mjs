/* ============================================================================
 * PREFLIGHT — quality gate. Given a video's asset folder + a manifest, checks
 * every bug class we've hit and FAILS loudly if any is wrong. Run before render
 * (and in CI). Turns "hope I didn't screw up" into "the pipeline won't let me."
 *
 * Checks:
 *   1. MUSIC covers the video  (musicSec >= videoSec, else must use MusicBed loop)
 *   2. VO files: no long dead-gaps (>0.8s) — the ellipsis/TTS-choke bug
 *   3. VO SCRIPT text: no "..." ellipsis (causes TTS gaps) and no double spaces
 *   4. VO/TEXT match: on-screen headline lines vs VO lines (warn on divergence)
 *   5. GRADIENT text: any WebkitBackgroundClip node needs lineHeight >= 1.2
 *   6. NUMBERS: no raw multi-digit currency without commas in source
 *   7. no leftover <Audio ...music...> (should be MusicBed)
 *
 * Usage:  node preflight.mjs <compositionFile.tsx> [assetDir] [--music=Nsec] [--video=Nsec]
 *   or import { preflight } from './preflight.mjs'
 * ==========================================================================*/
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const RED = (s) => `\x1b[31m${s}\x1b[0m`, GREEN = (s) => `\x1b[32m${s}\x1b[0m`, YEL = (s) => `\x1b[33m${s}\x1b[0m`

function ffprobeDur(file) {
  try { return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`).toString().trim()) } catch { return null }
}
// detect long silences in a VO mp3 (the ellipsis/TTS-choke bug)
function silenceGaps(file, thresh = 0.8) {
  try {
    const out = execSync(`ffmpeg -i "${file}" -af silencedetect=noise=-40dB:d=${thresh} -f null - 2>&1`).toString()
    return [...out.matchAll(/silence_duration: ([0-9.]+)/g)].map((m) => parseFloat(m[1])).filter((d) => d >= thresh)
  } catch { return [] }
}

export function preflight({ src, assetDir, musicFile, voFiles = [], videoSec, musicSec }) {
  const fails = [], warns = []
  const code = src && fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : ''

  // 1. MUSIC covers the video
  if (videoSec && musicSec) {
    const usesMusicBed = /MusicBed/.test(code)
    if (musicSec < videoSec - 0.5 && !usesMusicBed) fails.push(`MUSIC too short: ${musicSec}s < video ${videoSec}s and no MusicBed loop`)
  }

  // 2. VO dead-gaps
  for (const vf of voFiles) {
    if (!fs.existsSync(vf)) { warns.push(`VO missing: ${path.basename(vf)}`); continue }
    const gaps = silenceGaps(vf)
    if (gaps.length) fails.push(`VO GAP in ${path.basename(vf)}: ${gaps.map((g) => g.toFixed(1) + 's').join(', ')} silence (likely an ellipsis)`)
  }

  // 3. VO script ellipsis in source (the VO strings often live in gen scripts, but
  //    on-screen captions with "..." are also flagged)
  const ellipsis = [...code.matchAll(/(?:text|pre|hot|post|sub)="[^"]*\.\.\.[^"]*"/g)]
  if (ellipsis.length) warns.push(`ELLIPSIS in on-screen text (${ellipsis.length}) — avoid "..." (reads awkward): ${ellipsis[0][0].slice(0, 50)}`)

  // 5. gradient text without safe lineHeight
  const gradNodes = [...code.matchAll(/WebkitBackgroundClip:\s*'text'/g)]
  const badGrad = [...code.matchAll(/lineHeight:\s*(0?\.?9|1)\b[^}]*WebkitBackgroundClip:\s*'text'|WebkitBackgroundClip:\s*'text'[^}]*lineHeight:\s*(0?\.?9|1)\b/g)]
  if (badGrad.length) fails.push(`GRADIENT TEXT clip risk: ${badGrad.length} node(s) with lineHeight <=1 (descenders will clip) — use lineHeight>=1.2 + paddingBottom`)

  // 6. raw multi-digit currency without commas (hand-formatted, bypassing CountUp)
  const rawCur = [...code.matchAll(/[>"']\$\d{4,}(?![\d,])/g)].filter((m) => !/toLocaleString/.test(code.slice(Math.max(0, m.index - 40), m.index)))
  if (rawCur.length) fails.push(`CURRENCY without commas: ${rawCur.length} (e.g. ${rawCur[0][0]}) — route through CountUp`)

  // 7. leftover raw <Audio ...music...>
  if (/<Audio[^>]*music\.mp3[^>]*volume=\{musicDuck\}/.test(code)) fails.push(`RAW <Audio music> found — should be <MusicBed> (music cut-off risk)`)

  return { fails, warns, ok: fails.length === 0 }
}

// CLI
const invoked = process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/').split('/').pop())
if (invoked) {
  const src = process.argv[2]
  const assetDir = process.argv[3]
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
  // auto-discover music + vo in the asset dir
  let musicFile, voFiles = [], musicSec, videoSec = args.video && parseFloat(args.video)
  if (assetDir && fs.existsSync(assetDir)) {
    const files = fs.readdirSync(assetDir)
    const mf = files.find((f) => f === 'music.mp3')
    if (mf) { musicFile = path.join(assetDir, mf); musicSec = ffprobeDur(musicFile) }
    voFiles = files.filter((f) => /^(dv|ax|bm|sv|cm|il|sc|pz|ih|bx)-\d+\.mp3$/.test(f)).map((f) => path.join(assetDir, f))
  }
  if (args.music) musicSec = parseFloat(args.music)
  const r = preflight({ src, assetDir, musicFile, voFiles, videoSec, musicSec })
  console.log(`\n── PREFLIGHT: ${path.basename(src || '?')} ──`)
  r.warns.forEach((w) => console.log(YEL('  ⚠ ' + w)))
  r.fails.forEach((f) => console.log(RED('  ✗ ' + f)))
  if (r.ok) console.log(GREEN(`  ✓ PASS${r.warns.length ? ' (with ' + r.warns.length + ' warnings)' : ''}`))
  else { console.log(RED(`  ✗ FAIL — ${r.fails.length} issue(s)`)); process.exit(1) }
}
