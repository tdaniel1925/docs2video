import Link from 'next/link'
import IndustryMegaMenu from '../../_components/IndustryMegaMenu'

export default function IndustryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="container">
        <nav className="top-nav">
          <div className="top-nav-inner">
            <Link href="/" className="logo"><img src="/logo.png" alt="Docs2Video" style={{height:72}} /></Link>
            <div className="top-nav-links">
              <Link href="/">Home</Link>
              <Link href="/#features">Features</Link>
              <IndustryMegaMenu />
              <Link href="/#templates">Templates</Link>
              <Link href="/#pricing">Pricing</Link>
            </div>
            <div className="top-nav-right">
              <Link href="/login" style={{color:'rgba(255,255,255,0.85)',textDecoration:'none',fontSize:'14px',fontWeight:500}}>Login</Link>
              <Link href="/signup" className="btn btn-mint">Try for free</Link>
            </div>
          </div>
        </nav>
      </div>
      {children}
      <footer className="footer">
        <div className="container" style={{textAlign:'center',padding:'40px 0'}}>
          <Link href="/" className="logo" style={{justifyContent:'center'}}><img src="/logo.png" alt="Docs2Video" style={{height:60}} /></Link>
          <p style={{marginTop:16,fontSize:14,color:'rgba(255,255,255,0.5)'}}>Turn complex documents into stunning visuals.</p>
        </div>
      </footer>
    </>
  )
}
