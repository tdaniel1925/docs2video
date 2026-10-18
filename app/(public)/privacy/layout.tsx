import SitePage from '../../_components/marketing/SiteChrome'

// In the public site's one shell (header, footer, dark frame), like the front page.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <SitePage className="hp-legal">{children}</SitePage>
}
