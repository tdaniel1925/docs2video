/**
 * Stage 1 of the PDF->V3 test path. Posts a real document to the LIVE VPS
 * /extract-document endpoint (the exact endpoint the app uses) and saves the
 * returned ExtractedData to a JSON file. Then feed that file to
 * generate-v3-from-doc.mjs.
 *
 * Usage: node scripts/extract-doc.mjs <path-to.pdf> [out.json] [purpose]
 * Reads VIDEO_ASSEMBLY_URL + VIDEO_ASSEMBLY_SECRET from ../.env.local.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const DOC = process.argv[2]
const OUT = process.argv[3] || join(ROOT, 'public', 'extracted.json')
const PURPOSE = process.argv[4] || 'Create an informative overview of this document.'
if (!DOC) { console.error('Usage: node scripts/extract-doc.mjs <file.pdf> [out.json] [purpose]'); process.exit(1) }

async function env(name) {
  if (process.env[name]) return process.env[name]
  const e = await readFile(join(ROOT, '..', '.env.local'), 'utf8')
  const m = e.match(new RegExp('^' + name + '=(.+)$', 'm'))
  if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  throw new Error(`${name} not found in .env.local`)
}

const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }

async function main() {
  const url = (await env('VIDEO_ASSEMBLY_URL')).replace(/\/$/, '')
  const secret = await env('VIDEO_ASSEMBLY_SECRET')
  const fileName = basename(DOC)
  const ext = (fileName.split('.').pop() || '').toLowerCase()
  const buf = await readFile(resolve(DOC))
  console.log(`Uploading ${fileName} (${(buf.length / 1024).toFixed(0)} KB) to ${url}/extract-document ...`)

  // Pre-check health (mirrors the app).
  const h = await fetch(`${url}/health`, { signal: AbortSignal.timeout(6000) }).catch(() => null)
  console.log(`/health: ${h ? h.status : 'unreachable'}`)

  const res = await fetch(`${url}/extract-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-secret': secret },
    body: JSON.stringify({ fileBase64: buf.toString('base64'), fileName, purpose: PURPOSE, mimeType: MIME[ext] || 'application/octet-stream' }),
    signal: AbortSignal.timeout(260000),
  })
  const txt = await res.text()
  if (!res.ok) { console.error(`Extract failed ${res.status}: ${txt.slice(0, 400)}`); process.exit(1) }
  const data = JSON.parse(txt)
  await writeFile(OUT, JSON.stringify(data, null, 2))
  console.log(`OK -> ${OUT}`)
  console.log(`  title:   ${data.title}`)
  console.log(`  metrics: ${(data.keyMetrics || []).length}, sections: ${(data.sections || []).length}, points: ${(data.bulletPoints || []).length}`)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
