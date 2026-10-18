import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import type { Brand } from '../../_lib/types'
import { loadPreviewBrand } from '../../_lib/first-scene-preview-server'
import { draftPreviewPlan, samplePreviewPlan } from '../../_lib/look-preview-plan'
import { readBrandLooks, snapshotLook, withSavedLook } from '../../_lib/look-wizard'

// =============================================================================
// /api/look — the look screen's data. Nothing here costs anything.
//
//   GET  ?videoId=…  the person's own scenes (for the live preview), their
//                    brand, the brand's saved looks, the look on the draft.
//   GET  ?brandId=…  same for Brands → Video look, with a sample story.
//   PUT  { brandId, look }            save the look on the brand.
//   POST { videoId, look, brandId? }  "Use this look": a COPY onto this video's
//                    draft (videoStyle 'kit', kitLook 'custom') and, when the
//                    project has a brand, onto the brand too — its next videos
//                    start from it. Old videos keep their own copy.
// =============================================================================

export const runtime = 'nodejs'

const DRAFT_EDITABLE = ['draft', 'failed']

async function signedIn() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function brandOut(b: Brand | null) {
  if (!b) return null
  const x = b as Brand & Record<string, unknown>
  return {
    id: x.id, name: x.name, primary_color: x.primary_color ?? null, secondary_color: x.secondary_color ?? null, accent_color: x.accent_color ?? null,
    fonts: Array.isArray(x.fonts) ? x.fonts : [], logo_chip: !!x.logo_chip,
    hasLogo: !!(x.logo_url || x.logo_file_url || x.logo_light_url || x.logo_dark_url),
    hasLogoKit: !!(x.logo_light_url || x.logo_dark_url),
  }
}

async function ownBrand(admin: ReturnType<typeof createAdminClient>, userId: string, brandId: string): Promise<Brand | null> {
  const { data } = await admin.from('brands').select('*').eq('id', brandId).eq('user_id', userId).maybeSingle()
  return (data as Brand | null) ?? null
}

export async function GET(request: Request) {
  const user = await signedIn()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const q = new URL(request.url).searchParams
  const admin = createAdminClient()
  const videoId = q.get('videoId')
  const brandId = q.get('brandId')

  if (videoId) {
    const { data: row } = await admin.from('videos').select('id, user_id, title, status, draft_data').eq('id', videoId).eq('user_id', user.id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 })
    const draft = (row.draft_data ?? {}) as Record<string, unknown>
    const brand = await loadPreviewBrand(admin, user.id, draft)
    const plan = draftPreviewPlan({ draft, brand, rowTitle: row.title as string | null }) ?? samplePreviewPlan(brand)
    const looks = readBrandLooks(brand?.brand_guide_data)
    return NextResponse.json({
      plan, sample: !draftPreviewPlan({ draft, brand }), brand: brandOut(brand), looks,
      draftLook: draft.kitLook === 'custom' && draft.kitLookCustom && typeof draft.kitLookCustom === 'object' ? snapshotLook(draft.kitLookCustom) : null,
      editable: DRAFT_EDITABLE.includes(String(row.status)),
    })
  }
  if (brandId) {
    const brand = await ownBrand(admin, user.id, brandId)
    if (!brand) return NextResponse.json({ error: 'We couldn’t find that brand.' }, { status: 404 })
    return NextResponse.json({ plan: samplePreviewPlan(brand), sample: true, brand: brandOut(brand), looks: readBrandLooks(brand.brand_guide_data), draftLook: null, editable: false })
  }
  return NextResponse.json({ error: 'Missing project or brand.' }, { status: 400 })
}

/** Save `look` on the brand (keeps every other guide field). */
async function saveOnBrand(admin: ReturnType<typeof createAdminClient>, userId: string, brandId: string, look: unknown) {
  const brand = await ownBrand(admin, userId, brandId)
  if (!brand) return { error: 'We couldn’t find that brand.', status: 404 as const }
  const guide = withSavedLook(brand.brand_guide_data, snapshotLook(look))
  const { error } = await admin.from('brands').update({ brand_guide_data: guide }).eq('id', brandId).eq('user_id', userId)
  if (error) return { error: 'We couldn’t save the look on your brand. Please try again.', status: 500 as const }
  return { looks: readBrandLooks(guide), brandName: brand.name }
}

export async function PUT(request: Request) {
  const user = await signedIn()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { brandId?: unknown; look?: unknown }
  if (typeof body.brandId !== 'string' || !body.look || typeof body.look !== 'object') return NextResponse.json({ error: 'Missing brand or look.' }, { status: 400 })
  const r = await saveOnBrand(createAdminClient(), user.id, body.brandId, body.look)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, looks: r.looks, brandName: r.brandName })
}

export async function POST(request: Request) {
  const user = await signedIn()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { videoId?: unknown; look?: unknown; brandId?: unknown }
  if (typeof body.videoId !== 'string' || !body.look || typeof body.look !== 'object') return NextResponse.json({ error: 'Missing project or look.' }, { status: 400 })
  const admin = createAdminClient()
  const { data: row } = await admin.from('videos').select('id, user_id, status, draft_data').eq('id', body.videoId).eq('user_id', user.id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'We couldn’t find that project.' }, { status: 404 })
  if (!DRAFT_EDITABLE.includes(String(row.status))) return NextResponse.json({ error: 'This video has already been made — its look can’t change. Make a copy to try a new look.' }, { status: 409 })
  const look = snapshotLook(body.look)
  const draft = (row.draft_data ?? {}) as Record<string, unknown>
  // This video's own copy (old videos keep theirs; a later edit can't reach it).
  const { error } = await admin.from('videos').update({ draft_data: { ...draft, videoStyle: 'kit', kitLook: 'custom', kitLookCustom: look } })
    .eq('id', body.videoId).eq('user_id', user.id).in('status', DRAFT_EDITABLE)
  if (error) return NextResponse.json({ error: 'We couldn’t save the look. Please try again.' }, { status: 500 })
  // …and the brand's look, so its next videos start here.
  let brandName: string | null = null
  const brandId = typeof body.brandId === 'string' && body.brandId ? body.brandId : null
  if (brandId) {
    const r = await saveOnBrand(admin, user.id, brandId, look)
    if (!('error' in r)) brandName = r.brandName
  }
  return NextResponse.json({ ok: true, look, brandName })
}
