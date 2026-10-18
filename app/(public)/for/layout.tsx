import SitePage from '../../_components/marketing/SiteChrome'

// Industry landing pages sit in the public site's one shell (header, footer,
// dark frame) — the same as the front page.
export default function IndustryLayout({ children }: { children: React.ReactNode }) {
  return <SitePage>{children}</SitePage>
}
