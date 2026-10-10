'use client'

// STEP 3 → "Create your own look" / "Your look": the look screen for this
// project (app/_components/look/LookWizard.tsx). "Use this look" saves a copy
// on this video's draft and on the brand, then returns to step 3.

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import LookWizard from '../../../_components/look/LookWizard'

function LookForProject() {
  const id = useSearchParams().get('id')
  if (!id) {
    return (
      <div className="cf-page">
        <h1 className="cf-h1">We couldn’t find this project.</h1>
        <p className="cf-hint">Open it from Home, then choose Create your own look on the look step.</p>
      </div>
    )
  }
  return <LookWizard mode="draft" videoId={id} />
}

export default function LookPage() {
  return (
    <Suspense fallback={<div className="cf-page"><div className="spinner" /></div>}>
      <LookForProject />
    </Suspense>
  )
}
