/**
 * BRING THE TEMPLATES' PREVIEW PAGES AND COLOR RULES OVER FROM THE ENGINE.
 *
 * The templates are built in the shared deck engine (One Dollar Decks,
 * lib/code-deck/templates). For the Look step's "Colors: My brand" the cards
 * show the engine's own fitted pages, recolored here with the engine's own
 * rules — so what a customer sees is what the film will be drawn in.
 *
 *   # in the One Dollar Decks repo:
 *   node render-worker/build.mjs templates
 *   node render-worker/dist/local-templates.mjs <dir> --photo <sample presenter.jpg> --layouts cover,bignumber,cards,closing --export <dir>/previews.json
 *   # then here:
 *   node scripts/import-template-previews.mjs <One Dollar Decks repo> <dir> <sample presenter.jpg>
 *
 * Writes app/_lib/template-palette.ts (a copy of the engine's palette.ts),
 * public/templates/previews.json (the pages, their stylesheets and skins),
 * public/templates/bg/<template>/<name>.jpg and public/templates/sample-presenter.jpg.
 */
import { copyFileSync, cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [odd, dir, photo] = process.argv.slice(2)
if (!odd || !dir || !photo) { console.error('usage: node scripts/import-template-previews.mjs <One Dollar Decks repo> <export dir> <sample presenter.jpg>'); process.exit(1) }

const palette = readFileSync(join(odd, 'lib/code-deck/templates/palette.ts'), 'utf8')
writeFileSync('app/_lib/template-palette.ts', `// COPIED from One Dollar Decks lib/code-deck/templates/palette.ts by scripts/import-template-previews.mjs — change it there, then import again.\n${palette}`)

const previews = JSON.parse(readFileSync(join(dir, 'previews.json'), 'utf8'))
for (const [id, t] of Object.entries(previews)) {
  for (const p of t.pages) {
    p.html = p.html
      .replace(/ART_bg_([A-Za-z0-9_]+)/g, (_, n) => `/templates/bg/${id}/${n.replace(/_/g, '-')}.jpg`)
      .replace(/PORTRAIT_URL/g, '/templates/sample-presenter.jpg')
      .replace(/LOGO_URL/g, '')
  }
}
writeFileSync('public/templates/previews.json', JSON.stringify(previews))
cpSync(join(dir, 'bg'), 'public/templates/bg', { recursive: true })
copyFileSync(photo, 'public/templates/sample-presenter.jpg')
console.log(`imported ${Object.keys(previews).length} templates' preview pages and the color rules`)
