import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email preferences | Docs2Video',
  robots: { index: false, follow: false },
}

export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return children
}
