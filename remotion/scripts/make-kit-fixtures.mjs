/**
 * Test-only fixtures for the scene kit (QA cases + sample videos): a made-up
 * logo in light / dark / one-colour versions, and a drawn head-and-shoulders
 * silhouette standing in for a presenter photo (never a real person).
 * Uses the APP's sharp (../node_modules).
 *
 *   node remotion/scripts/make-kit-fixtures.mjs
 * Writes remotion/qa-public/kit-qa/{logo-light,logo-dark,logo-any,presenter}.png
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'qa-public', 'kit-qa')
const require = createRequire(join(HERE, '..', '..', 'package.json'))
const sharp = require('sharp')

const logo = (mark, word) => `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="160" viewBox="0 0 720 160">
  <g fill="none" stroke="${mark}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30 128 L80 32 L130 128 Z"/><path d="M58 96 H102"/>
  </g>
  <text x="160" y="104" font-family="Georgia, serif" font-size="70" font-weight="700" fill="${word}">Your Agency</text>
  <text x="162" y="142" font-family="Arial, sans-serif" font-size="24" letter-spacing="7" fill="${word}">INSURANCE &amp; PLANNING</text>
</svg>`

const presenter = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="960" viewBox="0 0 800 960">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d6e3"/><stop offset="1" stop-color="#8fa3b8"/></linearGradient>
    <linearGradient id="coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3e55"/><stop offset="1" stop-color="#1c2738"/></linearGradient>
  </defs>
  <rect width="800" height="960" fill="url(#bg)"/>
  <circle cx="400" cy="360" r="150" fill="#e7c3a4"/>
  <path d="M250 300 C250 170 550 170 550 300 C540 240 470 215 400 215 C330 215 262 240 250 300 Z" fill="#4a3426"/>
  <path d="M140 960 C150 700 260 590 400 590 C540 590 650 700 660 960 Z" fill="url(#coat)"/>
  <path d="M350 590 L400 700 L450 590 Z" fill="#f2f2f2"/>
  <rect x="360" y="490" width="80" height="110" fill="#e7c3a4"/>
</svg>`

await mkdir(OUT, { recursive: true })
await writeFile(join(OUT, 'logo-light.png'), await sharp(Buffer.from(logo('#e9c46a', '#ffffff'))).png().toBuffer())
await writeFile(join(OUT, 'logo-dark.png'), await sharp(Buffer.from(logo('#b0822c', '#152238'))).png().toBuffer())
await writeFile(join(OUT, 'logo-any.png'), await sharp(Buffer.from(logo('#1d4e89', '#1d4e89'))).png().toBuffer())
await writeFile(join(OUT, 'presenter.png'), await sharp(Buffer.from(presenter)).png().toBuffer())
console.log(`Wrote kit fixtures to ${OUT}`)
