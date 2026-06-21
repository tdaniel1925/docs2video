import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'
import { isAdmin , isAdminRequest } from '../../../_lib/admin'
export const maxDuration = 300

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await isAdminRequest(user))) return null
  return user
}

export async function GET() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()

  // Exclude the email-campaign system's rows (campaign_type='email') so this
  // page only lists its own campaigns — they share the `campaigns` table and
  // were colliding with blank columns (audit fix).
  const { data: campaigns, error } = await admin
    .from('campaigns')
    .select('*')
    .neq('campaign_type', 'email')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get contact stats for each campaign
  const campaignsWithStats = await Promise.all(
    (campaigns ?? []).map(async (campaign) => {
      const { data: contacts } = await admin
        .from('campaign_contacts')
        .select('video_status, email_sent_at, video_watched_at, signed_up_at')
        .eq('campaign_id', campaign.id)

      const contactList = contacts ?? []
      return {
        ...campaign,
        contacts_count: contactList.length,
        sent_count: contactList.filter(c => c.email_sent_at).length,
        watched_count: contactList.filter(c => c.video_watched_at).length,
        signed_up_count: contactList.filter(c => c.signed_up_at).length,
      }
    })
  )

  return NextResponse.json(campaignsWithStats)
}

export async function POST(request: Request) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { name, discount_code, discount_pct, discount_months } = body as {
    name: string
    discount_code: string
    discount_pct?: number
    discount_months?: number
  }

  if (!name?.trim() || !discount_code?.trim()) {
    return NextResponse.json({ error: 'Name and discount code are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: name.trim(),
      discount_code: discount_code.trim(),
      discount_pct: discount_pct ?? 25,
      discount_months: discount_months ?? 3,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
