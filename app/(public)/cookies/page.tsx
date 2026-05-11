export const metadata = {
  title: 'Cookie Policy | Docs2Video',
  description: 'Cookie Policy for Docs2Video.com',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '2.5rem',
}

const h2Style: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 700,
  color: 'var(--ink)',
  marginBottom: '0.75rem',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '0.5rem',
}

const pStyle: React.CSSProperties = {
  color: 'var(--ink-soft)',
  lineHeight: 1.75,
  marginBottom: '0.75rem',
  fontSize: '0.95rem',
}

const ulStyle: React.CSSProperties = {
  color: 'var(--ink-soft)',
  lineHeight: 1.75,
  marginBottom: '0.75rem',
  paddingLeft: '1.5rem',
  fontSize: '0.95rem',
}

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto' as const,
  marginBottom: '1.5rem',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: '0.9rem',
  color: 'var(--ink-soft)',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left' as const,
  padding: '0.75rem 1rem',
  borderBottom: '2px solid var(--border)',
  color: 'var(--ink)',
  fontWeight: 600,
  fontSize: '0.85rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.03em',
}

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top' as const,
}

export default function CookiePolicyPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '3rem 2.5rem' }}>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.25rem' }}>Cookie Policy</h1>
        <p style={{ color: 'var(--ink-soft)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
          Effective Date: May 9, 2026 &mdash; Last Updated: May 9, 2026
        </p>

        {/* 1. What Are Cookies */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>1. What Are Cookies?</h2>
          <p style={pStyle}>
            Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you visit a website. They are widely used to make websites work more efficiently, provide a better user experience, and give website operators useful information about how their site is being used.
          </p>
          <p style={pStyle}>
            Cookies may be &quot;session&quot; cookies (which are deleted when you close your browser) or &quot;persistent&quot; cookies (which remain on your device for a set period or until you delete them).
          </p>
        </div>

        {/* 2. How We Use Cookies */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>2. How Docs2Video Uses Cookies</h2>
          <p style={pStyle}>
            Docs2Video uses a minimal number of cookies, limited to what is necessary to operate the platform securely and provide you with a functional experience. We prioritize your privacy and keep cookie usage to a minimum.
          </p>
        </div>

        {/* 3. Types of Cookies We Use */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>3. Types of Cookies We Use</h2>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.75rem', marginTop: '1.25rem' }}>3.1 Essential Cookies (Strictly Necessary)</h3>
          <p style={pStyle}>
            These cookies are required for the platform to function and cannot be disabled. They enable core functionality such as authentication, security, and session management.
          </p>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Cookie</th>
                  <th style={thStyle}>Purpose</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Provider</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}><code>sb-access-token</code></td>
                  <td style={tdStyle}>Authentication session token. Identifies you as a logged-in user and secures your session.</td>
                  <td style={tdStyle}>Session / 1 hour</td>
                  <td style={tdStyle}>Supabase</td>
                </tr>
                <tr>
                  <td style={tdStyle}><code>sb-refresh-token</code></td>
                  <td style={tdStyle}>Refresh token used to maintain your authenticated session without requiring repeated logins.</td>
                  <td style={tdStyle}>Persistent / 7 days</td>
                  <td style={tdStyle}>Supabase</td>
                </tr>
                <tr>
                  <td style={tdStyle}><code>sb-auth-token</code></td>
                  <td style={tdStyle}>Stores authentication state in local storage for session persistence.</td>
                  <td style={tdStyle}>Persistent</td>
                  <td style={tdStyle}>Supabase</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.75rem', marginTop: '1.25rem' }}>3.2 Functional Cookies</h3>
          <p style={pStyle}>
            These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.
          </p>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Cookie</th>
                  <th style={thStyle}>Purpose</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Provider</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}><code>theme-preference</code></td>
                  <td style={tdStyle}>Stores your selected theme preference (light/dark mode).</td>
                  <td style={tdStyle}>Persistent / 1 year</td>
                  <td style={tdStyle}>Docs2Video</td>
                </tr>
                <tr>
                  <td style={tdStyle}><code>cookie-consent</code></td>
                  <td style={tdStyle}>Records whether you have acknowledged the cookie notice.</td>
                  <td style={tdStyle}>Persistent / 1 year</td>
                  <td style={tdStyle}>Docs2Video</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Cookies We Do NOT Use */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>4. Cookies We Do NOT Use</h2>
          <p style={pStyle}>
            Docs2Video is committed to your privacy. We want to be clear about what we do <em>not</em> do:
          </p>
          <ul style={ulStyle}>
            <li><strong>No advertising cookies:</strong> We do not use cookies for advertising, retargeting, or ad tracking purposes.</li>
            <li><strong>No third-party tracking cookies:</strong> We do not embed third-party trackers (such as Google Analytics, Facebook Pixel, or similar services) that follow your activity across other websites.</li>
            <li><strong>No cross-site tracking:</strong> We do not share cookie data with advertising networks or data brokers.</li>
            <li><strong>No profiling:</strong> We do not use cookies to build profiles about you for marketing purposes.</li>
          </ul>
        </div>

        {/* 5. Managing Cookies */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>5. How to Manage Cookies</h2>
          <p style={pStyle}>
            You can control and manage cookies through your browser settings. Most browsers allow you to:
          </p>
          <ul style={ulStyle}>
            <li>View what cookies are stored and delete them individually</li>
            <li>Block third-party cookies</li>
            <li>Block cookies from specific websites</li>
            <li>Block all cookies</li>
            <li>Delete all cookies when you close your browser</li>
          </ul>
          <p style={pStyle}>
            Please note that if you block or delete essential cookies, you may not be able to log in or use Docs2Video properly, as these cookies are required for authentication and core functionality.
          </p>
          <p style={pStyle}>
            Here are links to cookie management instructions for common browsers:
          </p>
          <ul style={ulStyle}>
            <li><strong>Chrome:</strong> Settings &gt; Privacy and Security &gt; Cookies and other site data</li>
            <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
            <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
            <li><strong>Edge:</strong> Settings &gt; Privacy, search, and services &gt; Cookies</li>
          </ul>
        </div>

        {/* 6. Changes */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>6. Changes to This Cookie Policy</h2>
          <p style={pStyle}>
            We may update this Cookie Policy from time to time. When we make changes, we will update the &quot;Last Updated&quot; date at the top of this page. We encourage you to review this policy periodically to stay informed about our use of cookies.
          </p>
        </div>

        {/* 7. Contact */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>7. Contact Us</h2>
          <p style={pStyle}>
            If you have any questions about our use of cookies, please contact us:
          </p>
          <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '1.25rem 1.5rem', border: '1px solid var(--border)', fontSize: '0.95rem', lineHeight: 1.75, color: 'var(--ink-soft)' }}>
            <strong style={{ color: 'var(--ink)' }}>Docs2Video.com</strong><br />
            27675 Nelson Way, 225<br />
            Katy, Texas 77494<br />
            Email: <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a><br />
            Website: <a href="https://docs2video.com" style={{ color: 'var(--mint)' }}>docs2video.com</a>
          </div>
        </div>

      </div>
    </div>
  )
}
