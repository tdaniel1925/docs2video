import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { processLogo } from '../../../_lib/logo-processor'
import { enhanceLogo } from '../../../_lib/logo-enhance'
import { logError } from '../../../_lib/error-logger'

export const runtime = 'nodejs'
export const maxDuration = 60

const BUCKET = 'creation-assets'
const MAX_BYTES = 8 * 1024 * 1024 // 8MB — logos are small
const ALLOWED = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

/**
 * Upload + process a brand logo for video rendering. Accepts multipart with a
 * single `file`. Pipeline: validate → Sharp knockout + light/dark variants →
 * if knockout is poor, try rembg (VPS) → re-process → if still poor, REJECT with
 * guidance (caller may choose to continue without a logo). On success, stores
 * original + light + dark in storage and returns their public URLs + chip flag.
 *
 * POST /api/brands/logo   (multipart: file)
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Logo must be a PNG, JPG, SVG, or WebP image.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Logo too large (max ${MAX_BYTES / 1024 / 1024}MB).` }, { status: 413 })
  }

  let input: Buffer = Buffer.from(await file.arrayBuffer())

  try {
    let variants = await processLogo(input)

    // Poor knockout → try the rembg enhancer (no-op if VPS endpoint absent),
    // then re-process the cleaned, now-transparent result.
    if (variants.needsEnhance) {
      const cleaned = await enhanceLogo(input).catch(() => null)
      if (cleaned) {
        input = cleaned
        variants = await processLogo(cleaned)
      }
    }

    // Still poor after enhancement → reject with guidance (don't ship a bad logo).
    if (variants.needsEnhance && variants.contentRatio > 0.92) {
      return NextResponse.json({
        error: 'We couldn\'t cleanly separate this logo from its background. Upload a transparent PNG (a white version works best), or continue without a logo — we\'ll use your company name.',
        recoverable: true,
      }, { status: 422 })
    }

    const admin = createAdminClient()
    const base = `${user.id}/brand-logos/${crypto.randomUUID()}`
    const upload = async (suffix: string, buf: Buffer) => {
      const path = `${base}-${suffix}.png`
      // new Uint8Array(buf) gives a plain ArrayBuffer-backed view (Supabase's
      // upload overload rejects Buffer<ArrayBufferLike> from sharp).
      const bytes = new Uint8Array(buf)
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: true })
      if (error) throw new Error(`storage ${suffix}: ${error.message}`)
      return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    const [originalUrl, lightUrl, darkUrl] = await Promise.all([
      upload('original', variants.original),
      upload('light', variants.light),
      upload('dark', variants.dark),
    ])

    return NextResponse.json({
      logo_url: originalUrl,
      logo_light_url: lightUrl,
      logo_dark_url: darkUrl,
      logo_chip: variants.chip,
    })
  } catch (err) {
    await logError('brands/logo', err, { userId: user.id })
    return NextResponse.json({ error: 'Could not process this logo. Please try a different image.' }, { status: 500 })
  }
}
