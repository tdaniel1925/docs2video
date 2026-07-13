/* ============================================================================
 * BRAND COLOR EXTRACTOR — reads a site and returns its REAL brand colors,
 * not framework defaults. Fixes the bug where Bootstrap's #0d6efd/#ffc107 were
 * mistaken for a client's brand (Apex is actually red + slate blue).
 *
 * Strategy (in priority order):
 *   1. CSS custom properties (--primary, --brand, --accent, --clr-*) — these are
 *      almost always the real brand, defined by the site author.
 *   2. Colors from the CUSTOM stylesheet(s), NOT framework files
 *      (bootstrap/tailwind/bulla/foundation/normalize/materialize).
 *   3. Filter out the known framework DEFAULT palettes entirely.
 *   4. Weight by usage; classify by hue so we can name "reds"/"blues"/etc.
 *
 * Usage:  node extract-brand.mjs <url>
 *   or import { extractBrand } from './extract-brand.mjs'
 * ==========================================================================*/

// framework files whose colors are NOT the brand
const FRAMEWORK_CSS = /(bootstrap|tailwind|bulma|foundation|normalize|materialize|reset|jquery-ui|slick|fancybox|modal-video|fontawesome|ekiticons|animate)/i

// known framework DEFAULT hexes to ignore (Bootstrap 5 + Tailwind core + common)
const FRAMEWORK_HEXES = new Set([
  // Bootstrap 5 theme
  '#0d6efd', '#6c757d', '#198754', '#dc3545', '#ffc107', '#0dcaf0', '#f8f9fa',
  '#212529', '#e9ecef', '#dee2e6', '#adb5bd', '#495057', '#343a40', '#6610f2',
  '#6f42c1', '#d63384', '#fd7e14', '#20c997', '#ced4da', '#6c757d', '#0a58ca',
  '#084298', '#052c65', '#b02a37', '#842029', '#664d03', '#997404',
  // greys everyone uses
  '#ffffff', '#000000', '#fafafa', '#f5f5f5', '#eeeeee', '#dddddd', '#cccccc',
  '#bbbbbb', '#aaaaaa', '#999999', '#888888', '#777777', '#666666', '#555555',
  '#444444', '#333333', '#222222', '#111111',
])

function fetchText(u) {
  return fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(25000) })
    .then((r) => (r.ok ? r.text() : '')).catch(() => '')
}

function hexLum(hex) { // relative luminance 0..1
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
function classifyHue(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max - min < 28) return hexLum(hex) < 0.25 ? 'dark-neutral' : hexLum(hex) > 0.85 ? 'light-neutral' : 'neutral'
  if (r >= g && r >= b) return g > b + 40 ? 'orange/gold' : 'red'
  if (g >= r && g >= b) return 'green'
  return r > g ? 'purple' : 'blue'
}

export async function extractBrand(url) {
  const base = url.replace(/\/[^/]*$/, '/')
  const home = await fetchText(url)
  const cssLinks = [...home.matchAll(/href="([^"]+\.css[^"]*)"/gi)].map((m) => m[1])

  // 1) pull the CUSTOM (non-framework) stylesheets + inline styles
  let customCss = home.match(/<style[\s\S]*?<\/style>/gi)?.join('\n') || ''
  const customFiles = []
  for (const c of cssLinks) {
    const name = c.split('/').pop() || ''
    if (FRAMEWORK_CSS.test(name)) continue
    const u = c.startsWith('http') ? c : base + c.replace(/^\.?\//, '')
    customCss += '\n' + (await fetchText(u))
    customFiles.push(name)
  }

  // 2) CSS custom properties that look like brand tokens
  const varMatches = [...customCss.matchAll(/--([\w-]*(?:primary|brand|accent|clr|main|secondary|theme|color)[\w-]*)\s*:\s*(#[0-9a-fA-F]{6})/gi)]
  const brandVars = {}
  for (const m of varMatches) brandVars[m[1]] = m[2].toLowerCase()

  // 3) count hexes in custom CSS, dropping framework defaults
  const hexes = [...customCss.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase())
  const freq = {}
  for (const h of hexes) if (!FRAMEWORK_HEXES.has(h)) freq[h] = (freq[h] || 0) + 1
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1])

  // 4) classify + pick primary/secondary/bg
  const byHue = {}
  for (const [hex, count] of ranked) {
    const hue = classifyHue(hex)
    ;(byHue[hue] ||= []).push({ hex, count })
  }
  // primary accent = most-used non-neutral, mid/high saturation color
  const accents = ranked.filter(([h]) => !/neutral/.test(classifyHue(h)))
  const darks = ranked.filter(([h]) => hexLum(h) < 0.22)
  const primary = accents[0]?.[0] || brandVars['primary'] || null
  const secondary = accents.find(([h]) => classifyHue(h) !== classifyHue(primary || ''))?.[0] || null
  const bg = darks[0]?.[0] || null

  return {
    customFiles,
    brandVars,
    primary, secondary, bg,
    topColors: ranked.slice(0, 12).map(([hex, count]) => ({ hex, count, hue: classifyHue(hex) })),
    byHue: Object.fromEntries(Object.entries(byHue).map(([k, v]) => [k, v.slice(0, 4).map((x) => x.hex)])),
  }
}

// CLI
const invoked = process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/').split('/').pop())
if (invoked) {
  const url = process.argv[2]
  if (!url) { console.log('usage: node extract-brand.mjs <url>'); process.exit(1) }
  const b = await extractBrand(url)
  console.log('custom stylesheets:', b.customFiles.join(', ') || '(none found)')
  console.log('brand CSS vars:', JSON.stringify(b.brandVars))
  console.log('\n→ PRIMARY  ', b.primary, b.primary && classifyHue(b.primary))
  console.log('→ SECONDARY', b.secondary, b.secondary && classifyHue(b.secondary))
  console.log('→ BACKGROUND', b.bg)
  console.log('\ntop brand colors:')
  b.topColors.forEach((c) => console.log(`  ${c.hex}  ${String(c.count).padStart(4)}x  ${c.hue}`))
  console.log('\nby hue:', JSON.stringify(b.byHue, null, 0))
}
