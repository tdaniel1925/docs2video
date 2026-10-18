'use client'

// STEP 6 — "Voice" (/create/voice): the narrator, music, video or presentation. See _components/steps/LookVoiceReview.tsx.

import { Suspense } from 'react'
import LookVoiceReview from '../_components/steps/LookVoiceReview'

export default function Page() {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <LookVoiceReview part="voice" />
    </Suspense>
  )
}
