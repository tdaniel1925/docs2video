import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateFullLogoKit } from '../../_lib/logo-styler'
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { brandId } = await request.json()
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  // Fetch the brand
  const { data: brand, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .eq('user_id', user.id)
    .single()

  if (error || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  if (!brand.logo_url && !brand.logo_file_url) {
    return NextResponse.json({ error: 'Brand has no logo uploaded' }, { status: 400 })
  }

  const logoUrl = brand.logo_file_url || brand.logo_url

  // Validate that the logo URL points to an actual image file (not text/brand name)
  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
  const urlPath = new URL(logoUrl).pathname.toLowerCase()
  const hasImageExtension = IMAGE_EXTENSIONS.some(ext => urlPath.endsWith(ext))

  if (!hasImageExtension) {
    // Double-check via HEAD request for content-type
    try {
      const headRes = await fetch(logoUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      const contentType = headRes.headers.get('content-type') ?? ''
      if (!contentType.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Logo URL does not point to a valid image file. Please upload an actual logo image.' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Could not verify logo image. Please upload a valid logo file.' },
        { status: 400 }
      )
    }
  }

  const brandColors = {
    primary: brand.primary_color || '#333333',
    secondary: brand.secondary_color || '#666666',
  }

  try {
    const results = await generateFullLogoKit(brandId, logoUrl, brandColors)
    return NextResponse.json({
      success: true,
      generated: results.length,
      kit: results,
    })
  } catch (err) {
    console.error('[generate-logo-kit] Error:', err)
    return NextResponse.json(
      { error: 'Failed to generate logo kit' },
      { status: 500 }
    )
  }
}
