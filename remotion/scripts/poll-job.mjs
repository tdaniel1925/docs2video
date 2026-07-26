// Watch a videos row while the VPS works it.
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = {}
for (const f of ['.env.local', '.env']) { const p = join(ROOT, f); if (!existsSync(p)) continue
  for (const l of readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].trim() } }
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
const id = process.argv[2]
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
let last = ''
for (let i = 0; i < 90; i++) {
  const r = await fetch(`${URL_}/rest/v1/videos?id=eq.${id}&select=status,progress_pct,progress_detail,video_url,error_message`, { headers: H })
  const [v] = await r.json()
  if (!v) { console.log('row gone'); break }
  const line = `${v.status} ${v.progress_pct}% ${v.progress_detail || ''}`
  if (line !== last) { console.log(new Date().toISOString().slice(11, 19), line); last = line }
  if (v.status === 'completed') { console.log('\nURL:', v.video_url); break }
  if (v.status === 'failed') { console.log('\nFAILED:', v.error_message); break }
  await new Promise((s) => setTimeout(s, 10000))
}
