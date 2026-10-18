import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { generateSlide } from '../../_lib/gemini'
import { CREDIT_COSTS } from '../../_lib/credits'
import { runCharged } from '../../_lib/credit-charge'
import type { SlideStyleId } from '../../_lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300

// Sample data used for brand deck previews
const SAMPLE_DATA = {
  title: 'Company Overview',
  subtitle: 'Annual Performance Summary',
  source: 'Internal Report',
  keyMetrics: [
    { label: 'Total Revenue', value: '$1,500,000', highlight: true },
    { label: 'Growth Rate', value: '+18.4%', highlight: true },
    { label: 'Client Retention', value: '94%', highlight: false },
    { label: 'Projects Delivered', value: '127', highlight: false },
  ],
  sections: [
    { title: 'Performance', content: 'Strong year-over-year growth across all key metrics.' },
    { title: 'Outlook', content: 'Projected 22% growth in the next fiscal year.' },
  ],
  bulletPoints: [
    'Revenue exceeded targets by 12%',
    'Client satisfaction at all-time high',
    'Expanded to 3 new markets',
    'Team grew by 40%',
  ],
  additionalNotes: [],
}

// 4 slide types for the brand deck
const DECK_SLIDES = [
  {
    title: 'Title / Cover Slide',
    prompt: `SLIDE — TITLE CARD / COVER
Create an impressive cover slide:
- Title: "Company Overview" displayed large and prominent
- Subtitle: "Annual Performance Summary"
- The company logo and branding should be the focal point
- Make this feel like the opening of a premium presentation — elegant, confident, and inviting.`,
  },
  {
    title: 'Data / Metrics Slide',
    prompt: `SLIDE — KEY METRICS
Show key business metrics in a clear, organized layout:
- Total Revenue: $1,500,000 — make this the hero number, very large
- Growth Rate: +18.4%
- Client Retention: 94%
- Projects Delivered: 127
Use data cards, bold numbers, and clean labels. Professional and data-forward.`,
  },
  {
    title: 'Chart / Comparison Slide',
    prompt: `SLIDE — GROWTH CHART
Create a visual chart showing quarterly growth:
- Q1: $320,000
- Q2: $365,000
- Q3: $390,000
- Q4: $425,000
Use a clear bar chart or visual growth timeline. Label each data point.
Title: "Quarterly Revenue Growth"
Show the upward trajectory clearly. Make the chart the hero of the slide.`,
  },
  {
    title: 'Closing / CTA Slide',
    prompt: `SLIDE — CLOSING / CONTACT
Create a professional closing slide:
- "Thank You" or "Let's Connect" as the main message
- Key takeaways: Revenue exceeded targets, 94% client retention, expanded to new markets
- Company logo and branding prominent
- Contact information area
Make it feel like a warm, confident closing that invites the next step.`,
  },
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { brandId, styleId } = body as { brandId: string; styleId: string }

  if (!brandId || !styleId) {
    return NextResponse.json({ error: 'Brand and style are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load brand
  // Scope to owner (review S3): brands RLS may be off in prod — never fetch by bare id.
  // Extra important here: this uses the ADMIN client, which bypasses RLS entirely.
  const { data: brand } = await admin.from('brands').select('*').eq('id', brandId).eq('user_id', user.id).single()
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const colors = {
    primary: brand.primary_color,
    secondary: brand.secondary_color,
    accent: brand.accent_color,
    background: brand.background_color,
    text: brand.text_color,
  }

  // Download logo if available
  const logoUrl = brand.logo_file_url ?? brand.logo_url ?? null
  let logoBuffer: Buffer | null = null
  if (logoUrl) {
    try {
      const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) })
      if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer())
    } catch {
      console.log(`[brand-deck] Could not download logo for brand ${brandId}`)
    }
  }

  const contactInfo = {
    phone: (brand.brand_guide_data as Record<string, string> | null)?.phone ?? undefined,
    website: (brand.brand_guide_data as Record<string, string> | null)?.website ?? undefined,
  }

  // Charge the real price for 4 AI slides BEFORE the work (this used to take
  // 1 credit afterwards and ignore a failed deduction) and refund on any
  // failure (audit H5).
  return runCharged({ userId: user.id, amount: CREDIT_COSTS['brand-deck'], action: 'brand-deck' }, async () => {
  try {
    console.log(`[brand-deck] Generating 4 reference slides for brand "${brand.name}" with style "${styleId}"...`)

    const slideUrls: string[] = []

    for (let i = 0; i < DECK_SLIDES.length; i++) {
      console.log(`[brand-deck] Slide ${i + 1}/4: ${DECK_SLIDES[i].title}...`)

      const buf = await generateSlide(
        SAMPLE_DATA,
        i,
        styleId as SlideStyleId,
        brand.name,
        logoUrl,
        colors,
        DECK_SLIDES[i].prompt,
        false,
        contactInfo,
        logoBuffer
      )

      // Upload to storage
      const path = `${user.id}/brand-decks/${brandId}/${styleId}_slide_${i}.png`
      const { error: upErr } = await admin.storage.from('videos').upload(path, buf, { contentType: 'image/png', upsert: true })
      if (upErr) throw new Error(`upload failed: ${upErr.message}`)
      const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)
      slideUrls.push(urlData.publicUrl)
    }

    // Save reference slides and style to brand
    await admin.from('brands').update({
      reference_slides: slideUrls,
      deck_style_id: styleId,
      updated_at: new Date().toISOString(),
    }).eq('id', brandId)

    console.log(`[brand-deck] Done! 4 reference slides saved for brand "${brand.name}"`)

    return NextResponse.json({
      success: true,
      slides: slideUrls,
      styleId,
    })
  } catch (err) {
    console.error(`[brand-deck] Error:`, err)
    return NextResponse.json({ error: 'Failed to generate the brand deck. Your credits were returned — please try again.' }, { status: 500 })
  }
  })
}
