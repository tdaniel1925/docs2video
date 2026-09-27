'use client'

// The voice and music used to have their own step here. They now live on
// step 3, "Make it yours" (/create/theme), next to the look and the price
// (length is chosen with the story, on step 2). Old links and saved
// "continue where you left off" links land on the right step: the story if it
// isn't written yet, otherwise step 3.

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { nextStepAfterBrand } from '../_components/make/nextStep'

function Forward() {
  const router = useRouter()
  const videoId = useSearchParams().get('id')
  useEffect(() => {
    if (!videoId) { router.replace('/create'); return }
    let alive = true
    fetch(`/api/videos/draft?videoId=${encodeURIComponent(videoId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((v) => { if (alive) router.replace(nextStepAfterBrand(videoId, v?.draft_data)) })
    return () => { alive = false }
  }, [router, videoId])
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><div className="spinner" /></div>
}

export default function VoicePage() {
  return <Suspense fallback={null}><Forward /></Suspense>
}
