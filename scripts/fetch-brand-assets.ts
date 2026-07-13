/**
 * Brand-asset sourcing: given a website URL, pull the brand's REAL assets —
 * logo, hero images, background videos, and brand colors/fonts — for use in a
 * commercial (the "download from the website" step the demo relies on).
 * Run: npx tsx scripts/fetch-brand-assets.ts <url> <slug>
 *   e.g. npx tsx scripts/fetch-brand-assets.ts https://docs2video.com d2v
 */
import path from 'path'
import { writeFileSync, mkdirSync } from 'fs'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require(path.join('C:/dev/1 - PrismGraphs', 'node_modules/playwright'))

const url = process.argv[2] || 'https://docs2video.com'
const slug = process.argv[3] || 'brand'
const OUT = path.join(__dirname, '..', 'remotion', 'public', 'brand', slug)
mkdirSync(OUT, { recursive: true })

async function dl(u: string, file: string): Promise<boolean> {
  try {
    const r = await fetch(u); if (!r.ok) return false
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 800) return false
    writeFileSync(path.join(OUT, file), buf); return true
  } catch { return false }
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)

  // 1) brand palette + fonts (computed from the live page).
  // NOTE: pass source as a STRING so tsx/esbuild doesn't inject its __name
  // helper into the browser context (which isn't defined there).
  const brand = await page.evaluate(`(() => {
    const colorCount = {};
    const fonts = new Set();
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      [cs.color, cs.backgroundColor, cs.borderColor].forEach((c) => {
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'rgb(0, 0, 0)' && c !== 'rgb(255, 255, 255)') colorCount[c] = (colorCount[c] || 0) + 1;
      });
      const f = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
      if (f) fonts.add(f);
    });
    const colors = Object.entries(colorCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map((e) => e[0]);
    return { colors, fonts: Array.from(fonts).slice(0, 4) };
  })()`) as { colors: string[]; fonts: string[] }

  // 2) candidate images (og:image, logo, big <img>s), + background videos
  const media = await page.evaluate(`(() => {
    const abs = (u) => { try { return new URL(u, location.href).href } catch { return u } };
    const ogEl = document.querySelector('meta[property="og:image"]');
    const og = ogEl ? ogEl.content : null;
    const logoEl = Array.from(document.querySelectorAll('img')).find((i) => /logo/i.test(i.src) || /logo/i.test(i.alt) || /logo/i.test(i.className));
    const logo = logoEl ? logoEl.src : null;
    const imgs = Array.from(document.querySelectorAll('img'))
      .map((i) => ({ src: abs(i.currentSrc || i.src), w: i.naturalWidth || i.width, h: i.naturalHeight || i.height }))
      .filter((x) => x.src && x.w >= 400 && !/\\.svg($|\\?)/i.test(x.src))
      .sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 6).map((x) => x.src);
    const vids = Array.from(document.querySelectorAll('video source, video'))
      .map((v) => abs(v.src)).filter(Boolean).slice(0, 3);
    return { og: og ? abs(og) : null, logo: logo ? abs(logo) : null, imgs: Array.from(new Set(imgs)), vids: Array.from(new Set(vids)) };
  })()`) as { og: string | null; logo: string | null; imgs: string[]; vids: string[] }

  await browser.close()

  // 3) download what we found
  const saved: Record<string, string> = {}
  if (media.logo && await dl(media.logo, 'logo.png')) saved.logo = 'logo.png'
  if (media.og && await dl(media.og, 'og.jpg')) saved.og = 'og.jpg'
  let n = 0
  for (const src of media.imgs) { const ext = src.match(/\.(png|jpe?g|webp)/i)?.[1] || 'jpg'; if (await dl(src, `img-${n + 1}.${ext}`)) saved[`img${n + 1}`] = `img-${n + 1}.${ext}`; n++ }
  let v = 0
  for (const src of media.vids) { if (await dl(src, `vid-${v + 1}.mp4`)) saved[`vid${v + 1}`] = `vid-${v + 1}.mp4`; v++ }

  writeFileSync(path.join(OUT, 'brand.json'), JSON.stringify({ url, colors: brand.colors, fonts: brand.fonts, saved }, null, 2))
  console.log(`brand: ${slug}`)
  console.log(`  colors: ${brand.colors.join(', ')}`)
  console.log(`  fonts: ${brand.fonts.join(', ')}`)
  console.log(`  saved: ${Object.keys(saved).join(', ') || '(nothing downloadable)'}`)
  console.log(`  → remotion/public/brand/${slug}/`)
}
main().catch(e => { console.error('FAILED:', e); process.exit(1) })
