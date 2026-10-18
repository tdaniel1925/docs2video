'use client'

// STEP 2 — "The story" (/create/story): what we took from the content. See _components/steps/StoryScenes.tsx.

import { Suspense } from 'react'
import StoryScenes from '../_components/steps/StoryScenes'

export default function Page() {
  return (
    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>}>
      <StoryScenes part="story" />
    </Suspense>
  )
}
