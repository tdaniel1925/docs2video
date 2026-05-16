import { createAdminClient } from '../../../_lib/supabase/admin'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const { data: video } = await admin.from('videos').select('title, thumbnail_url').eq('id', id).single()

  return {
    title: video?.title ? `${video.title} | Docs2Video` : 'Presentation | Docs2Video',
    description: 'Watch this personalized presentation created with Docs2Video.',
    openGraph: {
      title: video?.title ?? 'Presentation',
      description: 'Watch this personalized presentation.',
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
