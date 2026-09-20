/**
 * OPTIONAL: add rembg to /health and /selftest so the logo enhancer is monitored
 * alongside sharp/ffmpeg/keys. Mirrors the existing honest-health pattern.
 */

// --- in GET /health, add to the `checks` object: ---
// checks.rembg = require('fs').existsSync('/opt/rembg/bin/rembg')

// --- in GET /selftest, add a probe (runs rembg on a 1px image): ---
//
// async function selftestRembg() {
//   const { execFile } = require('child_process')
//   const { writeFile, mkdir, rm } = require('fs/promises')
//   const { join } = require('path'); const { tmpdir } = require('os'); const { randomUUID } = require('crypto')
//   const dir = join(tmpdir(), `selftest-rembg-${randomUUID()}`)
//   try {
//     await mkdir(dir, { recursive: true })
//     // 1x1 white PNG
//     const px = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
//     await writeFile(join(dir, 'in.png'), px)
//     await new Promise((resolve, reject) => execFile('rembg', ['i', join(dir, 'in.png'), join(dir, 'out.png')],
//       { timeout: 30000, env: { ...process.env, U2NET_HOME: '/root/.u2net' } },
//       (e) => e ? reject(e) : resolve()))
//     return { ok: true }
//   } catch (e) {
//     return { ok: false, error: e.message }
//   } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}) }
// }
//
// then in the /selftest handler:  results.rembg = await selftestRembg()
