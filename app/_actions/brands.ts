'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'

/** Profile (Person | Company) fields shared by create + update. */
function profileFields(formData: FormData) {
  const type = (formData.get('profile_type') as string) === 'person' ? 'person' : 'company'
  return {
    profile_type: type,
    person_role: (formData.get('person_role') as string) || null,
    photo_url: (formData.get('photo_url') as string) || null,
    intro_line: (formData.get('intro_line') as string) || null,
    show_name_on_slides: formData.get('show_name_on_slides') !== 'false',
    show_logo: formData.get('show_logo') !== 'false',
    photo_placement: (formData.get('photo_placement') as string) || 'auto',
  }
}

/** The brands row for a new brand, from the brand form fields. Shared by the
 *  Brands page (createBrand) and step 3's "Add your brand" (createProjectBrand)
 *  so both save a brand exactly the same way. */
function newBrandRow(formData: FormData, userId: string) {
  // Parse JSON fields from hidden inputs
  const parseJson = (key: string, fallback: unknown = null) => {
    const val = formData.get(key) as string | null
    if (!val) return fallback
    try { return JSON.parse(val) } catch { return fallback }
  }

  return {
    user_id: userId,
    name: formData.get('name') as string,
    logo_url: (formData.get('logo_url') as string) || null,
    logo_file_url: (formData.get('logo_file_url') as string) || null,
    logo_light_url: (formData.get('logo_light_url') as string) || null,
    logo_dark_url: (formData.get('logo_dark_url') as string) || null,
    logo_chip: formData.get('logo_chip') === 'true',
    primary_color: formData.get('primary_color') as string || '#1B365D',
    secondary_color: formData.get('secondary_color') as string || '#4A90D9',
    accent_color: formData.get('accent_color') as string || '#FFB347',
    background_color: formData.get('background_color') as string || '#0a1628',
    text_color: formData.get('text_color') as string || '#FFFFFF',
    tagline: (formData.get('tagline') as string) || null,
    description: (formData.get('description') as string) || null,
    industry: (formData.get('industry') as string) || null,
    tone: (formData.get('tone') as string) || null,
    target_audience: (formData.get('target_audience') as string) || null,
    fonts: parseJson('fonts', []),
    brand_values: parseJson('brand_values', []),
    services: parseJson('services', []),
    social_links: parseJson('social_links', {}),
    content_themes: parseJson('content_themes', []),
    competitor_notes: (formData.get('competitor_notes') as string) || null,
    unique_selling_points: parseJson('unique_selling_points', []),
    brand_guide_data: parseJson('brand_guide_data', null),
    is_default: formData.get('is_default') === 'true',
    ...profileFields(formData),
  }
}

export async function createBrand(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('brands').insert(newBrandRow(formData, user.id))

  if (error) return { error: error.message }
  redirect('/brands')
}

/**
 * "Add your brand" from inside a project (step 3, Make it yours). Same row as
 * the Brands page saves; stays on the page (no redirect) and hands back the
 * new brand's id so the project can use it. A person's FIRST brand becomes
 * their default, so their next project starts with it too.
 */
export async function createProjectBrand(formData: FormData): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Type your name or your company’s name.' }
  formData.set('name', name.slice(0, 120))

  const { data: existing } = await supabase.from('brands').select('id').eq('user_id', user.id).limit(1)
  formData.set('is_default', (existing ?? []).length === 0 ? 'true' : 'false')

  const { data, error } = await supabase.from('brands').insert(newBrandRow(formData, user.id)).select('id').single()
  if (error || !data) return { error: 'We couldn’t save your brand. Please try again.' }
  return { id: data.id as string }
}

export async function updateBrand(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = formData.get('id') as string

  // Parse JSON fields from hidden inputs
  const parseJson = (key: string, fallback: unknown = null) => {
    const val = formData.get(key) as string | null
    if (!val) return fallback
    try { return JSON.parse(val) } catch { return fallback }
  }

  const { error } = await supabase
    .from('brands')
    .update({
      name: formData.get('name') as string,
      logo_url: (formData.get('logo_url') as string) || null,
      logo_file_url: (formData.get('logo_file_url') as string) || null,
    logo_light_url: (formData.get('logo_light_url') as string) || null,
    logo_dark_url: (formData.get('logo_dark_url') as string) || null,
    logo_chip: formData.get('logo_chip') === 'true',
      primary_color: formData.get('primary_color') as string,
      secondary_color: formData.get('secondary_color') as string,
      accent_color: formData.get('accent_color') as string,
      background_color: formData.get('background_color') as string,
      text_color: formData.get('text_color') as string,
      tagline: (formData.get('tagline') as string) || null,
      description: (formData.get('description') as string) || null,
      industry: (formData.get('industry') as string) || null,
      tone: (formData.get('tone') as string) || null,
      target_audience: (formData.get('target_audience') as string) || null,
      brand_values: parseJson('brand_values', []),
      services: parseJson('services', []),
      unique_selling_points: parseJson('unique_selling_points', []),
      content_themes: parseJson('content_themes', []),
      competitor_notes: (formData.get('competitor_notes') as string) || null,
      social_links: parseJson('social_links', {}),
      brand_guide_data: parseJson('brand_guide_data', null),
      is_default: formData.get('is_default') === 'true',
      ...profileFields(formData),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  redirect('/brands')
}

export async function deleteBrand(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  redirect('/brands')
}
