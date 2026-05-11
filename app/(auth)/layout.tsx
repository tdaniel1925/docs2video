import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-split">
      <div className="auth-side">
        <Link href="/" className="logo"><img src="/logo.png" alt="Docs2Video" style={{height:72}} /></Link>
        <div className="auth-side-content">
          <h2>Turn documents into <em>polished</em> visual summaries.</h2>
          <p>Join thousands of professionals who&apos;ve replaced their slideware with Docs2Video.</p>
        </div>
        <div className="auth-side-mock">
          <div style={{ background: 'var(--mint)', borderRadius: 10, padding: 18, color: 'var(--ink)' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, opacity: 0.7, marginBottom: 6 }}>Henderson Financial</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14 }}>Q4 Report Summary</div>
            <div style={{ background: 'white', borderRadius: 10, padding: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-light)', fontWeight: 700 }}>Total Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>$1,500,000</div>
            </div>
            <div style={{ background: 'white', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-light)', fontWeight: 700 }}>Year-over-Year Growth</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>+18.4%</div>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          {children}
        </div>
      </div>
    </div>
  )
}
