'use client'

// STEP 8 — "Review" (/create/review): everything at a glance, the free preview, the price, Make it. See _components/steps/LookVoiceReview.tsx.

import { Suspense } from 'react'
import LookVoiceReview from '../_components/steps/LookVoiceReview'

export default function Page() {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <LookVoiceReview part="review" />
    </Suspense>
  )
}
