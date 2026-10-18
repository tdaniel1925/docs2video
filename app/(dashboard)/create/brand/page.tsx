'use client'

// STEP 3 — "Your brand" (/create/brand): a saved brand, a new one, or none. See _components/steps/BrandCovers.tsx.

import { Suspense } from 'react'
import BrandCovers from '../_components/steps/BrandCovers'

export default function Page() {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <BrandCovers part="brand" />
    </Suspense>
  )
}
