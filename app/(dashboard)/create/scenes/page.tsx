'use client'

// STEP 5 — "The scenes" (/create/scenes): every scene, editable, and the length. See _components/steps/StoryScenes.tsx.

import { Suspense } from 'react'
import StoryScenes from '../_components/steps/StoryScenes'

export default function Page() {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <StoryScenes part="scenes" />
    </Suspense>
  )
}
