import { createAdminClient } from '../../../_lib/supabase/admin'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: video } = await admin.from('videos').select('title, thumbnail_url, user_id').eq('id', id).single()

  // Client-facing tab title/description lead with the AGENT'S identity, not our
  // platform — this page is the agent's, sent to their client. Person's name first,
  // then company, then a neutral phrase (never "Docs2Video").
  let agentLabel = ''
  if (video?.user_id) {
    const { data: prof } = await admin.from('profiles').select('full_name, company_name').eq('id', video.user_id).single()
    agentLabel = (prof?.full_name || prof?.company_name || '').trim()
  }
  const suffix = agentLabel || 'Presentation'
  const desc = agentLabel ? `A personalized presentation from ${agentLabel}.` : 'Watch this personalized presentation.'

  return {
    title: video?.title ? `${video.title} | ${suffix}` : suffix,
    description: desc,
    openGraph: {
      title: video?.title ?? 'Presentation',
      description: desc,
      images: video?.thumbnail_url ? [{ url: video.thumbnail_url, width: 1920, height: 1080 }] : [],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: video?.title ?? 'Presentation',
      images: video?.thumbnail_url ? [video.thumbnail_url] : [],
    },
  }
}

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
