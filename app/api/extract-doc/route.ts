import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { classifyDocument } from '../../_lib/document-classifier'
import { extractInsuranceWithOpus } from '../../_lib/insurance-extractor'
import { reconcileInsuranceExtraction } from '../../_lib/insurance-reconciler'
import { runInsuranceSanityChecks } from '../../_lib/insurance-sanity-checks'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Proxy: accepts file upload (FormData), converts to base64,
 * forwards to VPS /extract-document for generic extraction (Claude Sonnet).
 * Also classifies the document and runs insurance-specific extraction if needed.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const VIDEO_ASSEMBLY_URL = process.env.VIDEO_ASSEMBLY_URL || 'http://5.161.215.156:4000'
  const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const purpose = formData.get('purpose') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'application/pdf'

    // Run generic extraction (VPS) and classification (Gemini Flash) in parallel
    const [vpsRes, classification] = await Promise.all([
      fetch(`${VIDEO_ASSEMBLY_URL}/extract-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': VIDEO_ASSEMBLY_SECRET },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: file.name,
          purpose: purpose || undefined,
          mimeType,
        }),
      }),
      classifyDocument(base64, mimeType).catch(err => {
        console.error('[extract-doc] Classification failed:', err instanceof Error ? err.message : 'unknown')
        return null
      }),
    ])

    const result = await vpsRes.json()
    if (!vpsRes.ok) return NextResponse.json({ error: result.error || 'Extraction failed' }, { status: vpsRes.status })

    // Attach classification to extraction result
    if (classification) {
      result.classification = classification
      result.industry = classification.industry
      console.log(`[extract-doc] Classified: ${classification.documentType} (${classification.category}/${(classification as any).sensitivity}) → ${classification.redFlags?.length || 0} red flags`)
    }

    // INSURANCE PATH: Flag the document, but run Opus extraction ASYNC (non-blocking)
    // VPS + Opus + reconciliation exceeds Vercel's 300s limit if done synchronously.
    // Return VPS generic extraction immediately. Opus results will be available at video generation time.
    const isInsuranceDoc = classification?.category === 'insurance' ||
      classification?.documentType === 'life_insurance_illustration' ||
      (result.insurance && result.insurance.deathBenefit > 0)

    if (isInsuranceDoc) {
      result.isInsurance = true
      console.log(`[extract-doc] Insurance detected — Opus extraction will run at video generation time`)
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, { status: 500 })
  }
}
