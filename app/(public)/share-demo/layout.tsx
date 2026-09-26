import type { Metadata } from 'next'

// Sample of what a client sees on a share page. It is a demo, not content,
// so search engines are asked not to index it.
export const metadata: Metadata = {
  title: 'Sample Client Share Page | Docs2Video',
  description: 'See what your clients get: a branded page with your explainer video, your contact details, and a way to book a call.',
  robots: { index: false, follow: true },
}

export default function ShareDemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
