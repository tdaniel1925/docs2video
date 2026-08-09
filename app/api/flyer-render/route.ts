import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { FLYER_SIZES, FLYER_TEMPLATES, renderFlyer, type FlyerFields } from '../../_lib/flyer'

// =============================================================================
// Render one design at EVERY ticked size, as PNGs.
//
// The point of the whole engine: the design is described once, and an 8.5x11
// handout, a square Instagram post and a 2560x1440 YouTube banner all come out
// of it — laid out for their own shape, not one image stretched three ways.
//
// PRINT SIZES ARE RENDERED AT 300 DPI. An 8.5x11 at screen resolution is 816
// pixels wide and looks like a fax; the artboard is set in inches, so the page
// is simply photographed at a device scale that lands on 300 dots per inch.
//
// Chromium is heavy for a serverless function. If VIDEO_ASSEMBLY_URL is set,
// the work goes to the VPS that already runs headless Chrome for slide
// capture; otherwise it falls back to a local browser, which is what a laptop
// wants during development. Either way the caller gets the same answer, and if
// neither is available it says so rather than returning half a batch.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 300

const VPS = (process.env.VIDEO_ASSEMBLY_URL || '').replace(/\/$/, '')
const PRINT_DPI = 300

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    templateId?: string
    sizeIds?: string[]
    fields?: FlyerFields
    artUrl?: string | null
    artWide?: string | null
    accent?: string
    logoUrl?: string | null
  } | null

  const template = FLYER_TEMPLATES.find((t) => t.id === body?.templateId) ?? FLYER_TEMPLATES[0]
  const sizes = (body?.sizeIds ?? []).map((id) => FLYER_SIZES.find((s) => s.id === id)).filter(Boolean) as typeof FLYER_SIZES
  if (!sizes.length) return NextResponse.json({ error: 'Tick at least one size' }, { status: 400 })
  if (sizes.length > 12) return NextResponse.json({ error: 'Too many sizes at once' }, { status: 400 })

  let browser: import('puppeteer').Browser | null = null
  try {
    const puppeteer = (await import('puppeteer')).default
    browser = VPS
      ? await puppeteer.connect({ browserURL: `${VPS}/chrome` }).catch(() => null)
      : null
    if (!browser) browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  } catch (err) {
    return NextResponse.json({
      error: 'No browser available to render images. Print/Save PDF still works for print sizes.',
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 503 })
  }

  const out: { sizeId: string; label: string; w: number; h: number; png: string }[] = []
  const failed: string[] = []

  try {
    for (const size of sizes) {
      const wide = size.w / size.h > 1.35
      const artUrl = wide ? (body?.artWide ?? body?.artUrl ?? null) : (body?.artUrl ?? null)
      const html = renderFlyer({
        template, size, fields: body?.fields ?? {}, artUrl,
        accent: body?.accent, logoUrl: body?.logoUrl, print: false,
      })

      // Inches → 300 dpi. Pixels are already the final pixel count, so those
      // render at 1:1 and are never upscaled past what was asked for.
      const cssW = size.unit === 'in' ? size.w * 96 : size.w
      const cssH = size.unit === 'in' ? size.h * 96 : size.h
      const scale = size.unit === 'in' ? PRINT_DPI / 96 : 1

      const page = await browser.newPage()
      try {
        await page.setViewport({
          width: Math.round(cssW), height: Math.round(cssH),
          deviceScaleFactor: Math.min(scale, 4),
        })
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45000 })
        // Webfonts decide the whole look; screenshotting before they land gives
        // a flyer set in Times New Roman.
        await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready)
        const el = await page.$('.page')
        const shot = await (el ?? page).screenshot({ encoding: 'base64', type: 'png' })
        out.push({
          sizeId: size.id, label: size.label,
          w: Math.round(cssW * (size.unit === 'in' ? scale : 1)),
          h: Math.round(cssH * (size.unit === 'in' ? scale : 1)),
          png: `data:image/png;base64,${shot}`,
        })
      } catch {
        // Name what failed. A batch that silently returns five of six looks
        // like success until somebody counts.
        failed.push(size.label)
      } finally {
        await page.close().catch(() => {})
      }
    }
  } finally {
    if (VPS) await browser.disconnect().catch(() => {})
    else await browser.close().catch(() => {})
  }

  if (!out.length) return NextResponse.json({ error: 'Every size failed to render', failed }, { status: 500 })
  return NextResponse.json({ images: out, ...(failed.length ? { failed } : {}) })
}
