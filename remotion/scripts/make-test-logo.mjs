/**
 * Test-only: produce a transparent light + dark logo PNG so we can verify the
 * BrandLogo render components. Uses the APP's sharp (../node_modules). This is
 * NOT the real upload pipeline — just a fixture. A simple geometric mark + wordmark.
 */
import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')
const require = createRequire(join(__dirname, '..', '..', 'package.json'))
const sharp = require('sharp')

function svg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160">
    <g fill="none" stroke="${color}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
      <path d="M40 120 L40 40 L80 40 A30 30 0 0 1 80 100 L40 100"/>
    </g>
    <text x="150" y="108" font-family="Arial, sans-serif" font-size="84" font-weight="800" fill="${color}">Acme</text>
  </svg>`
}

async function main() {
  await writeFile(join(PUBLIC, 'logo-light.png'), await sharp(Buffer.from(svg('#FFFFFF'))).png().toBuffer())
  await writeFile(join(PUBLIC, 'logo-dark.png'), await sharp(Buffer.from(svg('#0E1A2B'))).png().toBuffer())
  console.log('Wrote public/logo-light.png + public/logo-dark.png')
}
main().catch((e) => { console.error(e.message); process.exit(1) })
