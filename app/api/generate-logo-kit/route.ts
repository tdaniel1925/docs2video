import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { generateFullLogoKit } from '../../_lib/logo-styler'

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
