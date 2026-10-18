import type { Metadata } from 'next'
import SitePage from '../../../_components/marketing/SiteChrome'

export const metadata: Metadata = {
  title: 'Email preferences | Docs2Video',
  robots: { index: false, follow: false },
}

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return <SitePage>{children}</SitePage>
}
