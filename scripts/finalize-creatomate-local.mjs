// Local-test helper: polls a Creatomate render and, when it finishes,
// triggers the local webhook handler to finalize the video.
// Usage: node scripts/finalize-creatomate-local.mjs <renderId>
import { readFileSync } from 'node:fs'

const renderId = process.argv[2]
if (!renderId) {
  console.error('Usage: node scripts/finalize-creatomate-local.mjs <renderId>')
  process.exit(1)
}

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const apiKey = env.match(/^CREATOMATE_API_KEY=(.+)$/m)?.[1]?.trim()
if (!apiKey) {
  console.error('CREATOMATE_API_KEY not found in .env.local')
  process.exit(1)
}

for (let i = 0; i < 120; i++) {
  const res = await fetch(`https://api.creatomate.com/v2/renders/${renderId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const render = await res.json()
  console.log(`[${new Date().toISOString()}] status: ${render.status}`)
  if (render.status === 'succeeded' || render.status === 'failed') {
    const hook = await fetch('http://localhost:3000/api/webhooks/creatomate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: renderId }),
    })
    console.log('local webhook:', hook.status, await hook.text())
    process.exit(render.status === 'succeeded' ? 0 : 1)
  }
  await new Promise(r => setTimeout(r, 5000))
}
console.error('Timed out waiting for render')
process.exit(1)
