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

    // INSURANCE PATH: If classified as insurance, run Claude Opus extraction + reconciliation + sanity checks
    const isInsuranceDoc = classification?.category === 'insurance' ||
      classification?.documentType === 'life_insurance_illustration' ||
      (result.insurance && result.insurance.deathBenefit > 0)

    if (isInsuranceDoc) {
      console.log(`[extract-doc] Insurance detected — running Claude Opus extraction`)
      const opusResult = await extractInsuranceWithOpus(base64, mimeType)

      if (opusResult) {
        result.insurance = opusResult
        console.log(`[extract-doc] Opus extraction succeeded: ${opusResult.policyType}, DB=${opusResult.deathBenefit}, confidence=${opusResult.extractionConfidence}`)

        // Reconciliation: fire-and-forget (async) — don't block extraction response
        // VPS + Opus already takes ~170s of the 300s Vercel limit; reconciliation would exceed it.
        // Results are logged and will be checked at video generation time via sanityFlags.
        console.log(`[extract-doc] Scheduling async Gemini reconciliation (non-blocking)...`)
        reconcileInsuranceExtraction(base64, mimeType, opusResult).then(reconciliation => {
          if (reconciliation.overallVerdict === 'fail') {
            console.error(`[extract-doc] ASYNC RECONCILIATION FAILED — ${reconciliation.mismatches.map((m: any) => m.field).join(', ')}`)
          } else if (reconciliation.overallVerdict === 'review') {
            console.warn(`[extract-doc] ASYNC Reconciliation: REVIEW — ${reconciliation.unverifiable.length} unverifiable`)
          } else {
            console.log(`[extract-doc] ASYNC Reconciliation PASSED`)
          }
        }).catch(err => {
          console.error(`[extract-doc] ASYNC Reconciliation error:`, err instanceof Error ? err.message : 'unknown')
        })

        // Deterministic sanity checks
        const sanityFlags = runInsuranceSanityChecks(result.insurance)
        if (sanityFlags.length > 0) {
          result.insurance.sanityFlags = [...(result.insurance.sanityFlags || []), ...sanityFlags]
          console.warn(`[extract-doc] Sanity checks: ${sanityFlags.length} flags`)
        }
      } else {
        // Opus failed — flag for review, no silent auto-proceed
        console.warn(`[extract-doc] Opus extraction failed — flagging for REVIEW`)
        result.insurance = {
          extractionConfidence: 0,
          lowConfidenceFields: ['ALL — Opus extraction failed'],
          sanityFlags: ['OPUS_EXTRACTION_FAILED: Column metadata unavailable. Requires human review.'],
        }
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Extraction failed' }, { status: 500 })
  }
}
