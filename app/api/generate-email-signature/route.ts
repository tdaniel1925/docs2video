import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { deductCredits } from '../../_lib/credits'

export const runtime = 'nodejs'
export const maxDuration = 300

type Style = 'minimal' | 'professional' | 'bold' | 'elegant' | 'modern'

interface SignatureInput {
  fullName: string
  title?: string
  company?: string
  email?: string
  phone?: string
  website?: string
  logoUrl?: string
  photoUrl?: string
  primaryColor?: string
  style: Style
}

function esc(str: string | undefined): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/* ------------------------------------------------------------------ */
/*  MINIMAL: clean single line, small text, subtle divider             */
/* ------------------------------------------------------------------ */
function generateMinimal(input: SignatureInput): string {
  const color = input.primaryColor || '#333333'
  const parts: string[] = []

  parts.push(`<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;line-height:1.4;">`)

  // Photo row
  if (input.photoUrl) {
    parts.push(`<tr><td style="padding-bottom:8px;">`)
    parts.push(`<img src="${esc(input.photoUrl)}" alt="${esc(input.fullName)}" width="40" height="40" style="border-radius:50%;display:block;" />`)
    parts.push(`</td></tr>`)
  }

  // Name + title
  parts.push(`<tr><td>`)
  parts.push(`<span style="font-size:14px;font-weight:bold;color:${esc(color)};">${esc(input.fullName)}</span>`)
  if (input.title) parts.push(`<span style="color:#999999;"> | ${esc(input.title)}</span>`)
  if (input.company) parts.push(`<span style="color:#999999;"> | ${esc(input.company)}</span>`)
  parts.push(`</td></tr>`)

  // Divider
  parts.push(`<tr><td style="padding:6px 0;"><hr style="border:none;border-top:1px solid #e0e0e0;margin:0;" /></td></tr>`)

  // Contact line
  const contactParts: string[] = []
  if (input.email) contactParts.push(`<a href="mailto:${esc(input.email)}" style="color:${esc(color)};text-decoration:none;">${esc(input.email)}</a>`)
  if (input.phone) contactParts.push(`<span>${esc(input.phone)}</span>`)
  if (input.website) contactParts.push(`<a href="${esc(input.website)}" style="color:${esc(color)};text-decoration:none;">${esc(input.website)}</a>`)
  if (contactParts.length) {
    parts.push(`<tr><td style="font-size:12px;">${contactParts.join(' &middot; ')}</td></tr>`)
  }

  // Logo
  if (input.logoUrl) {
    parts.push(`<tr><td style="padding-top:8px;"><img src="${esc(input.logoUrl)}" alt="Logo" height="24" style="display:block;" /></td></tr>`)
  }

  parts.push(`</table>`)
  return parts.join('')
}

/* ------------------------------------------------------------------ */
/*  PROFESSIONAL: 2-column (photo left, info right), clean borders     */
/* ------------------------------------------------------------------ */
function generateProfessional(input: SignatureInput): string {
  const color = input.primaryColor || '#2c5282'
  const parts: string[] = []

  parts.push(`<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;line-height:1.5;">`)
  parts.push(`<tr>`)

  // Left column: photo
  if (input.photoUrl) {
    parts.push(`<td style="vertical-align:top;padding-right:14px;">`)
    parts.push(`<img src="${esc(input.photoUrl)}" alt="${esc(input.fullName)}" width="80" height="80" style="border-radius:6px;display:block;" />`)
    parts.push(`</td>`)
  }

  // Separator bar
  parts.push(`<td style="vertical-align:top;padding-right:14px;"><div style="width:2px;background:${esc(color)};height:80px;"></div></td>`)

  // Right column: info
  parts.push(`<td style="vertical-align:top;">`)
  parts.push(`<div style="font-size:16px;font-weight:bold;color:${esc(color)};margin-bottom:2px;">${esc(input.fullName)}</div>`)
  if (input.title) parts.push(`<div style="font-size:13px;color:#555555;margin-bottom:1px;">${esc(input.title)}</div>`)
  if (input.company) parts.push(`<div style="font-size:13px;font-weight:600;color:#333333;margin-bottom:6px;">${esc(input.company)}</div>`)

  if (input.email) parts.push(`<div style="font-size:12px;"><a href="mailto:${esc(input.email)}" style="color:${esc(color)};text-decoration:none;">${esc(input.email)}</a></div>`)
  if (input.phone) parts.push(`<div style="font-size:12px;color:#555555;">${esc(input.phone)}</div>`)
  if (input.website) parts.push(`<div style="font-size:12px;"><a href="${esc(input.website)}" style="color:${esc(color)};text-decoration:none;">${esc(input.website)}</a></div>`)

  if (input.logoUrl) {
    parts.push(`<div style="margin-top:8px;"><img src="${esc(input.logoUrl)}" alt="Logo" height="28" style="display:block;" /></div>`)
  }

  parts.push(`</td>`)
  parts.push(`</tr></table>`)
  return parts.join('')
}

/* ------------------------------------------------------------------ */
/*  BOLD: large name, brand color accent bar, strong typography        */
/* ------------------------------------------------------------------ */
function generateBold(input: SignatureInput): string {
  const color = input.primaryColor || '#e53e3e'
  const parts: string[] = []

  parts.push(`<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Trebuchet MS',Arial,Helvetica,sans-serif;font-size:13px;color:#222222;line-height:1.5;">`)

  // Accent bar
  parts.push(`<tr><td colspan="2" style="padding-bottom:10px;"><div style="width:60px;height:4px;background:${esc(color)};border-radius:2px;"></div></td></tr>`)

  parts.push(`<tr>`)

  // Photo column
  if (input.photoUrl) {
    parts.push(`<td style="vertical-align:top;padding-right:16px;">`)
    parts.push(`<img src="${esc(input.photoUrl)}" alt="${esc(input.fullName)}" width="70" height="70" style="border-radius:8px;display:block;" />`)
    parts.push(`</td>`)
  }

  parts.push(`<td style="vertical-align:top;">`)

  // Large name
  parts.push(`<div style="font-size:20px;font-weight:bold;color:${esc(color)};letter-spacing:-0.5px;margin-bottom:2px;">${esc(input.fullName)}</div>`)
  if (input.title || input.company) {
    const titleParts: string[] = []
    if (input.title) titleParts.push(esc(input.title))
    if (input.company) titleParts.push(esc(input.company))
    parts.push(`<div style="font-size:13px;font-weight:600;color:#444444;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">${titleParts.join(' // ')}</div>`)
  }

  // Contact details
  if (input.phone) parts.push(`<div style="font-size:13px;font-weight:bold;">${esc(input.phone)}</div>`)
  if (input.email) parts.push(`<div style="font-size:13px;"><a href="mailto:${esc(input.email)}" style="color:${esc(color)};text-decoration:none;font-weight:600;">${esc(input.email)}</a></div>`)
  if (input.website) parts.push(`<div style="font-size:13px;"><a href="${esc(input.website)}" style="color:${esc(color)};text-decoration:none;">${esc(input.website)}</a></div>`)

  parts.push(`</td></tr>`)

  // Logo
  if (input.logoUrl) {
    parts.push(`<tr><td colspan="2" style="padding-top:10px;"><img src="${esc(input.logoUrl)}" alt="Logo" height="30" style="display:block;" /></td></tr>`)
  }

  parts.push(`</table>`)
  return parts.join('')
}

/* ------------------------------------------------------------------ */
/*  ELEGANT: serif font, subtle separator lines, refined spacing       */
/* ------------------------------------------------------------------ */
function generateElegant(input: SignatureInput): string {
  const color = input.primaryColor || '#2d3748'
  const parts: string[] = []

  parts.push(`<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,'Times New Roman',Times,serif;font-size:13px;color:#3d3d3d;line-height:1.6;">`)

  // Photo
  if (input.photoUrl) {
    parts.push(`<tr><td style="padding-bottom:10px;">`)
    parts.push(`<img src="${esc(input.photoUrl)}" alt="${esc(input.fullName)}" width="64" height="64" style="border-radius:50%;border:2px solid #e8e8e8;display:block;" />`)
    parts.push(`</td></tr>`)
  }

  // Name
  parts.push(`<tr><td>`)
  parts.push(`<div style="font-size:17px;font-weight:normal;color:${esc(color)};letter-spacing:1px;font-style:italic;">${esc(input.fullName)}</div>`)
  parts.push(`</td></tr>`)

  // Separator
  parts.push(`<tr><td style="padding:4px 0;"><div style="width:40px;height:1px;background:#cccccc;"></div></td></tr>`)

  // Title + Company
  if (input.title) parts.push(`<tr><td style="font-size:12px;color:#777777;font-style:italic;">${esc(input.title)}</td></tr>`)
  if (input.company) parts.push(`<tr><td style="font-size:13px;color:${esc(color)};font-weight:normal;">${esc(input.company)}</td></tr>`)

  // Separator
  parts.push(`<tr><td style="padding:6px 0;"><div style="width:40px;height:1px;background:#cccccc;"></div></td></tr>`)

  // Contact
  if (input.email) parts.push(`<tr><td style="font-size:12px;"><a href="mailto:${esc(input.email)}" style="color:${esc(color)};text-decoration:none;">${esc(input.email)}</a></td></tr>`)
  if (input.phone) parts.push(`<tr><td style="font-size:12px;color:#777777;">${esc(input.phone)}</td></tr>`)
  if (input.website) parts.push(`<tr><td style="font-size:12px;"><a href="${esc(input.website)}" style="color:${esc(color)};text-decoration:none;">${esc(input.website)}</a></td></tr>`)

  // Logo
  if (input.logoUrl) {
    parts.push(`<tr><td style="padding-top:10px;"><img src="${esc(input.logoUrl)}" alt="Logo" height="26" style="display:block;" /></td></tr>`)
  }

  parts.push(`</table>`)
  return parts.join('')
}

/* ------------------------------------------------------------------ */
/*  MODERN: rounded photo, icon badges, gradient accent                */
/* ------------------------------------------------------------------ */
function generateModern(input: SignatureInput): string {
  const color = input.primaryColor || '#6366f1'
  // Lighter shade for gradient
  const colorLight = color + '99'
  const parts: string[] = []

  parts.push(`<table cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.5;">`)

  // Gradient accent bar
  parts.push(`<tr><td colspan="2" style="padding-bottom:12px;"><div style="width:100%;max-width:300px;height:3px;background:linear-gradient(90deg,${esc(color)},${esc(colorLight)});border-radius:3px;"></div></td></tr>`)

  parts.push(`<tr>`)

  // Photo column
  if (input.photoUrl) {
    parts.push(`<td style="vertical-align:top;padding-right:14px;">`)
    parts.push(`<img src="${esc(input.photoUrl)}" alt="${esc(input.fullName)}" width="72" height="72" style="border-radius:50%;display:block;border:3px solid ${esc(color)};" />`)
    parts.push(`</td>`)
  }

  // Info column
  parts.push(`<td style="vertical-align:top;">`)
  parts.push(`<div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">${esc(input.fullName)}</div>`)

  if (input.title || input.company) {
    const titleParts: string[] = []
    if (input.title) titleParts.push(esc(input.title))
    if (input.company) titleParts.push(esc(input.company))
    parts.push(`<div style="font-size:12px;color:#666666;margin-bottom:8px;">${titleParts.join(' at ')}</div>`)
  }

  // Icon badges
  if (input.phone) {
    parts.push(`<div style="font-size:12px;margin-bottom:3px;">`)
    parts.push(`<span style="display:inline-block;width:20px;height:20px;background:${esc(color)};color:#ffffff;border-radius:50%;text-align:center;line-height:20px;font-size:10px;margin-right:6px;vertical-align:middle;">&#9742;</span>`)
    parts.push(`<span style="vertical-align:middle;">${esc(input.phone)}</span>`)
    parts.push(`</div>`)
  }
  if (input.email) {
    parts.push(`<div style="font-size:12px;margin-bottom:3px;">`)
    parts.push(`<span style="display:inline-block;width:20px;height:20px;background:${esc(color)};color:#ffffff;border-radius:50%;text-align:center;line-height:20px;font-size:10px;margin-right:6px;vertical-align:middle;">&#9993;</span>`)
    parts.push(`<a href="mailto:${esc(input.email)}" style="color:${esc(color)};text-decoration:none;vertical-align:middle;">${esc(input.email)}</a>`)
    parts.push(`</div>`)
  }
  if (input.website) {
    parts.push(`<div style="font-size:12px;margin-bottom:3px;">`)
    parts.push(`<span style="display:inline-block;width:20px;height:20px;background:${esc(color)};color:#ffffff;border-radius:50%;text-align:center;line-height:20px;font-size:10px;margin-right:6px;vertical-align:middle;">&#9672;</span>`)
    parts.push(`<a href="${esc(input.website)}" style="color:${esc(color)};text-decoration:none;vertical-align:middle;">${esc(input.website)}</a>`)
    parts.push(`</div>`)
  }

  parts.push(`</td></tr>`)

  // Logo
  if (input.logoUrl) {
    parts.push(`<tr><td colspan="2" style="padding-top:10px;"><img src="${esc(input.logoUrl)}" alt="Logo" height="28" style="display:block;" /></td></tr>`)
  }

  parts.push(`</table>`)
  return parts.join('')
}

const GENERATORS: Record<Style, (input: SignatureInput) => string> = {
  minimal: generateMinimal,
  professional: generateProfessional,
  bold: generateBold,
  elegant: generateElegant,
  modern: generateModern,
}

const STYLE_LABELS: Record<Style, string> = {
  minimal: 'Minimal',
  professional: 'Professional',
  bold: 'Bold',
  elegant: 'Elegant',
  modern: 'Modern',
}

const ALL_STYLES: Style[] = ['minimal', 'professional', 'bold', 'elegant', 'modern']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { fullName, title, company, email, phone, website, logoUrl, photoUrl, primaryColor } = body as SignatureInput

  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const signatures: { style: string; html: string; previewUrl: string }[] = []

    for (const style of ALL_STYLES) {
      const input: SignatureInput = { fullName, title, company, email, phone, website, logoUrl, photoUrl, primaryColor, style }
      const html = GENERATORS[style](input)

      // Wrap in a full HTML document for preview
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(fullName)} - ${STYLE_LABELS[style]} Email Signature</title></head><body style="margin:20px;font-family:Arial,sans-serif;">${html}</body></html>`

      // Upload to Supabase storage
      const fileName = `${user.id}/email-signatures/${Date.now()}-${style}.html`
      const { error: uploadError } = await admin.storage
        .from('infographics')
        .upload(fileName, Buffer.from(fullHtml, 'utf-8'), {
          contentType: 'text/html',
          upsert: true,
        })

      if (uploadError) {
        console.error(`[email-signature] Upload error for ${style}:`, uploadError)
        throw uploadError
      }

      const { data: urlData } = admin.storage.from('infographics').getPublicUrl(fileName)

      signatures.push({
        style: STYLE_LABELS[style],
        html,
        previewUrl: urlData.publicUrl,
      })
    }

    // Deduct credits
    await deductCredits(admin, user.id, 1)

    // Log to creations table
    await admin.from('creations').insert({
      user_id: user.id,
      type: 'email-signature',
      title: `Email Signature: ${fullName}`,
      file_url: signatures[0].previewUrl,
      credits_used: 1,
    })

    return NextResponse.json({ signatures })
  } catch (err: any) {
    console.error('[email-signature] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate signatures' }, { status: 500 })
  }
}
