import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const body = await req.json()
  const { csv } = body

  if (!csv || typeof csv !== 'string') {
    return NextResponse.json({ error: 'CSV text is required' }, { status: 400 })
  }

  const lines = csv.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) {
    return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })
  }

  // Parse header
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
  const emailIdx = header.findIndex(h => h === 'email' || h === 'e-mail')
  const nameIdx = header.findIndex(h => h === 'name' || h === 'full name' || h === 'client name')
  const companyIdx = header.findIndex(h => h === 'company' || h === 'organization' || h === 'org')
  const phoneIdx = header.findIndex(h => h === 'phone' || h === 'telephone' || h === 'mobile')

  // Get existing client emails for dedup
  const { data: existingClients } = await admin
    .from('clients')
    .select('email')
    .eq('user_id', user.id)

  const existingEmails = new Set(
    (existingClients ?? []).map(c => c.email?.toLowerCase()).filter(Boolean)
  )

  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const seenInBatch = new Set<string>()

  const dataLines = lines.slice(1)
  const toInsert: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]
    // Simple CSV parse (handles quoted fields)
    const fields = parseCsvLine(line)

    const email = emailIdx >= 0 ? fields[emailIdx]?.trim().toLowerCase() : null
    const name = nameIdx >= 0 ? fields[nameIdx]?.trim() : null
    const company = companyIdx >= 0 ? fields[companyIdx]?.trim() : null
    const phone = phoneIdx >= 0 ? fields[phoneIdx]?.trim() : null

    if (!name && !email) {
      errors.push(`Row ${i + 2}: Missing name and email`)
      continue
    }

    if (email && (existingEmails.has(email) || seenInBatch.has(email))) {
      skipped++
      continue
    }

    if (email) seenInBatch.add(email)

    toInsert.push({
      user_id: user.id,
      name: name || email || 'Unknown',
      email: email || null,
      company: company || null,
      phone: phone || null,
      source: 'import',
      status: 'lead',
      first_contact_at: now,
      last_activity_at: now,
    })
  }

  if (toInsert.length > 0) {
    // Insert in batches of 100
    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100)
      const { error } = await admin.from('clients').insert(batch)
      if (error) {
        console.error('[import] Batch insert error:', error)
        errors.push(`Batch error at rows ${i + 2}-${i + batch.length + 1}: ${error.message}`)
      } else {
        imported += batch.length
      }
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields.map(f => f.replace(/^"|"$/g, '').trim())
}
