// Contact sheet: tile pictures into one PNG so a whole video can be looked at
// at once.   node scripts/look-samples/kit-sheet.mjs out.png cols a.png b.png …
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = createRequire(join(ROOT, 'package.json'))('sharp')

export async function contactSheet(out, files, cols = 4, cellW = 640) {
  const cellH = Math.round(cellW * 9 / 16)
  const rows = Math.ceil(files.length / cols)
  const gap = 8
  const tiles = await Promise.all(files.map((f) => sharp(f).resize(cellW, cellH).png().toBuffer()))
  await sharp({ create: { width: cols * cellW + (cols + 1) * gap, height: rows * cellH + (rows + 1) * gap, channels: 3, background: '#202020' } })
    .composite(tiles.map((input, i) => ({ input, left: gap + (i % cols) * (cellW + gap), top: gap + Math.floor(i / cols) * (cellH + gap) })))
    .png().toFile(out)
  return out
}

if (process.argv[1] && process.argv[1].endsWith('kit-sheet.mjs')) {
  const [out, cols, ...files] = process.argv.slice(2)
  await contactSheet(out, files, Number(cols) || 4)
  console.log(out)
}
