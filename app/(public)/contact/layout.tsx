import type { Metadata } from 'next'

// The contact page is a client component, which cannot export metadata, so
// its title/description live here.
export const metadata: Metadata = {
  title: 'Contact Us | Docs2Video',
  description: 'Questions about Docs2Video, pricing, or your account? Send us a message and we will get back to you.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
