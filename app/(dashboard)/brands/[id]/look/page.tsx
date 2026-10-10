'use client'

// BRANDS → "Video look": the same look screen, for a brand. "Save look" keeps
// it on the brand; that brand's next videos start from it (old videos keep
// the look they were made with).

import Link from 'next/link'
import { useParams } from 'next/navigation'
import LookWizard from '../../../../_components/look/LookWizard'

export default function BrandLookPage() {
  const params = useParams<{ id: string }>()
  return (
    <div className="cf-shell">
      <div style={{ maxWidth: 1240, width: '100%', margin: '0 auto' }}>
        <Link href={`/brands/${params.id}`} className="cf-link">← Back to the brand</Link>
      </div>
      <LookWizard mode="brand" brandId={params.id} />
    </div>
  )
}
