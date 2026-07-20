// Shared generator for ALL Apex Roadmap episodes. An episode file imports this and
// calls generate({ dir, beats, scenePrompts, musicPrompt }). Handles VO (ElevenLabs
// Rachel + OpenAI fallback), FLUX torn-paper scenes, ElevenLabs music, durations.json.
// Torn-paper compliance + no-AI-text rules baked into PAPER. See memory:
// project_apex_roadmap_series, feedback_readable_panels_over_ai_bg.
import { readFileSync, mkdirSync, existsSync, writeFileSync, copyFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = join(HERE, '..', '..')
const env = {}; for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (existsSync(p)) for (const line of readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const ELEVEN = env.ELEVENLABS_API_KEY, VOICE = env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM', OPENAI = env.OPENAI_API_KEY
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID, CF_TOKEN = env.CLOUDFLARE_API_KEY, CF_MODEL = env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'
const durOf = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

export const PAPER = "Cut-paper craft collage illustration, layered navy blue, red, and cream construction paper, visible torn edges, soft drop shadows, paper grain, patriotic corporate feel, premium editorial paper-craft. 16:9. CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO writing, NO labels anywhere — surfaces completely blank. Any figure MUST strongly contrast its background (dark navy or bright red figure, NEVER cream on cream), with a visible outline or shadow."

async function eleven(t) { const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: t, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.12 } }) }); if (!r.ok) throw new Error(`eleven ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function openaiTTS(t) { const r = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'tts-1-hd', voice: 'nova', input: t }) }); if (!r.ok) throw new Error(`openai ${r.status}`); return Buffer.from(await r.arrayBuffer()) }
async function flux(prompt, outPath) { const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, { method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 6, width: 1280, height: 720 }) }); if (!r.ok) throw new Error(`${r.status}`); const j = await r.json(); if (!j?.result?.image) throw new Error('no image'); writeFileSync(outPath, Buffer.from(j.result.image, 'base64')) }

export async function generate({ dir, beats, scenePrompts, musicPrompt }) {
  const OUT = join(HERE, '..', 'public', dir); mkdirSync(OUT, { recursive: true })
  const FORCE = process.env.FORCE === '1', ONLY = process.env.ONLY
  const tag = `[${dir}]`; const log = (...a) => console.log(tag, ...a)
  try { copyFileSync(join(HERE, '..', 'public', 'apex', 'logo.png'), join(OUT, 'logo.png')) } catch {}
  const LINES = beats.map((b) => b[0])
  const SCENE_BEATS = beats.map((b, i) => b[1] === 'S' ? i : -1).filter((i) => i >= 0)
  const PANEL_KIND = {}; beats.forEach((b, i) => { if (b[1] !== 'S') PANEL_KIND[i] = b[1] })

  async function genVO() {
    const durs = []
    for (let i = 0; i < LINES.length; i++) {
      const f = join(OUT, `vo-${i}.mp3`)
      if (!FORCE && existsSync(f)) { durs.push(durOf(f)); log(`vo-${i} cached`); continue }
      let b; try { b = ELEVEN ? await eleven(LINES[i]) : await openaiTTS(LINES[i]) } catch (e) { b = await openaiTTS(LINES[i]) }
      writeFileSync(f, b); const d = durOf(f); durs.push(d); log(`vo-${i} ${d.toFixed(2)}s`)
    }
    writeFileSync(join(OUT, 'durations.json'), JSON.stringify({ vo: durs, lines: LINES, panels: PANEL_KIND }, null, 2))
    log(`VO ${durs.reduce((a, b) => a + b, 0).toFixed(1)}s`); return durs
  }
  async function genImgs() {
    for (const i of SCENE_BEATS) {
      const f = join(OUT, `f-${i}.png`)
      if (!FORCE && existsSync(f)) { log(`f-${i} cached`); continue }
      const prompt = scenePrompts[i] || `${PAPER} Abstract navy and red paper shapes.`
      for (let a = 0; a < 3; a++) { try { await flux(prompt, f); log(`f-${i} ok`); break } catch (e) { if (a < 2) await new Promise((s) => setTimeout(s, 2000)) } }
    }
  }
  async function genMusic(sec) {
    const f = join(OUT, 'music.mp3'); if (!FORCE && existsSync(f)) { log('music cached'); return }
    const ms = Math.min(300000, Math.round((sec + 4) * 1000))
    const r = await fetch('https://api.elevenlabs.io/v1/music', { method: 'POST', headers: { 'xi-api-key': ELEVEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: musicPrompt || 'Uplifting, warm, inspiring corporate underscore for a training video, steady and motivating, sits under narration, instrumental.', music_length_ms: ms }) })
    if (r.status !== 200) { log('music FAIL ' + r.status); return }
    writeFileSync(f, Buffer.from(await r.arrayBuffer())); log('music ok')
  }

  let total = 0
  if (ONLY !== 'img' && ONLY !== 'music') { const d = await genVO(); total = d.reduce((a, b) => a + b, 0) }
  else { try { total = JSON.parse(readFileSync(join(OUT, 'durations.json'), 'utf8')).vo.reduce((a, b) => a + b, 0) } catch { total = 90 } }
  const timeline = total + LINES.length * 0.5 + 12
  if (ONLY !== 'vo' && ONLY !== 'music') await genImgs()
  if (ONLY !== 'vo' && ONLY !== 'img') await genMusic(timeline)
  log(`ASSETS DONE ~${timeline.toFixed(0)}s`)
}
