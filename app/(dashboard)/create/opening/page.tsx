'use client'

// STEP 7 — "Opener & close" (/create/opening): how you are introduced, your photo, contact and booking link. See _components/steps/BrandCovers.tsx.

import { Suspense } from 'react'
import BrandCovers from '../_components/steps/BrandCovers'

export default function Page() {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <BrandCovers part="covers" />
    </Suspense>
  )
}
