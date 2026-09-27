import SiteHeader from '../../_components/marketing/SiteHeader'
import SiteFooter from '../../_components/marketing/SiteFooter'

// Industry landing pages share the home page's header and footer, so the
// marketing site has one nav. The .mk wrapper scopes the marketing palette to
// the header/footer; the page bodies keep their own styles.
export default function IndustryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mk mk-chrome"><SiteHeader /></div>
      {children}
      <div className="mk mk-chrome"><SiteFooter /></div>
    </>
  )
}
