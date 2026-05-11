export const metadata = {
  title: 'Privacy Policy | Docs2Video',
  description: 'Privacy Policy for Docs2Video.com',
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

const h3Style: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  color: 'var(--ink)',
  marginBottom: '0.5rem',
  marginTop: '1.25rem',
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

export default function PrivacyPolicyPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '3rem 2.5rem' }}>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.25rem' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--ink-soft)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
          Effective Date: May 9, 2026 &mdash; Last Updated: May 9, 2026
        </p>

        <div style={sectionStyle}>
          <p style={pStyle}>
            Docs2Video.com (&quot;Docs2Video,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website docs2video.com and the Docs2Video platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. Please read this policy carefully. By using Docs2Video, you consent to the practices described in this Privacy Policy.
          </p>
        </div>

        {/* 1. Information We Collect */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>1. Information We Collect</h2>

          <h3 style={h3Style}>1.1 Account Information</h3>
          <p style={pStyle}>When you create an account, we collect:</p>
          <ul style={ulStyle}>
            <li>Name and email address</li>
            <li>Password (stored securely via Supabase Auth with industry-standard hashing)</li>
            <li>Profile information you choose to provide (company name, brand settings, logo)</li>
          </ul>

          <h3 style={h3Style}>1.2 Uploaded Documents and Content</h3>
          <p style={pStyle}>When you use our service, we collect and process:</p>
          <ul style={ulStyle}>
            <li>Documents you upload (PDFs, text files, and other supported formats)</li>
            <li>Text, ideas, or other content you submit for video generation</li>
            <li>Generated content including slides, narration scripts, and videos</li>
            <li>Brand assets you upload (logos, color schemes, fonts)</li>
          </ul>

          <h3 style={h3Style}>1.3 Payment Information</h3>
          <p style={pStyle}>
            Payment processing is handled entirely by Stripe, Inc. We do not store your full credit card number, CVV, or bank account details on our servers. We receive and store only:
          </p>
          <ul style={ulStyle}>
            <li>Last four digits of your card number (for display purposes)</li>
            <li>Card brand and expiration date</li>
            <li>Billing address</li>
            <li>Subscription plan and payment history</li>
            <li>Stripe customer ID</li>
          </ul>

          <h3 style={h3Style}>1.4 Usage Data</h3>
          <p style={pStyle}>We automatically collect certain information when you use our platform:</p>
          <ul style={ulStyle}>
            <li>IP address and approximate location</li>
            <li>Browser type, device type, and operating system</li>
            <li>Pages visited and features used</li>
            <li>Date and time of access</li>
            <li>Referring URL</li>
            <li>Video generation history and credit usage</li>
          </ul>

          <h3 style={h3Style}>1.5 Demo Submissions</h3>
          <p style={pStyle}>
            If you submit a website URL for a free demo video, we will access and temporarily cache the publicly available content at that URL to generate your demo. This content is processed in the same manner as uploaded documents (see Section 3).
          </p>
        </div>

        {/* 2. How We Use Your Information */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>2. How We Use Your Information</h2>
          <p style={pStyle}>We use the information we collect to:</p>
          <ul style={ulStyle}>
            <li>Provide, operate, and maintain the Docs2Video platform</li>
            <li>Process your documents and generate video explainers</li>
            <li>Process payments and manage your subscription</li>
            <li>Send transactional emails (account confirmations, password resets, billing receipts, video completion notifications)</li>
            <li>Improve and optimize our service</li>
            <li>Respond to customer support requests</li>
            <li>Detect and prevent fraud, abuse, or security incidents</li>
            <li>Comply with legal obligations</li>
          </ul>
        </div>

        {/* 3. AI Data Processing Disclosure */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>3. AI Data Processing Disclosure</h2>
          <p style={pStyle}>
            Docs2Video uses artificial intelligence to transform your documents into video content. It is important that you understand how your data is processed by our AI partners:
          </p>

          <h3 style={h3Style}>3.1 Google Gemini (Document Analysis &amp; Image Generation)</h3>
          <p style={pStyle}>
            When you upload a document or submit content for video creation, the text and relevant data from your document is sent to Google&apos;s Gemini AI service for analysis. Gemini processes your content to extract key information, generate structured slide content, create narration scripts, and generate presentation imagery. Google processes this data pursuant to their Cloud Data Processing terms. We use Gemini&apos;s API, and Google does not use your data submitted via the API to train their models.
          </p>

          <h3 style={h3Style}>3.2 OpenAI (Text-to-Speech)</h3>
          <p style={pStyle}>
            The narration scripts generated for your videos are sent to OpenAI&apos;s text-to-speech (TTS) service to produce voiceover audio. OpenAI processes this text solely to generate the audio output. Per OpenAI&apos;s API data usage policy, data submitted through the API is not used to train their models.
          </p>

          <h3 style={h3Style}>3.3 Your Rights Regarding AI Processing</h3>
          <p style={pStyle}>
            You retain ownership of all content you upload. Our use of AI services is solely to provide you with the video generation functionality you have requested. If you do not wish for your content to be processed by these AI services, please do not upload documents or use the video generation features of the platform.
          </p>
        </div>

        {/* 4. Data Sharing */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>4. Data Sharing and Third-Party Service Providers</h2>
          <p style={pStyle}>
            We do not sell your personal information. We share your data only with the following service providers, and only to the extent necessary to operate the Docs2Video platform:
          </p>
          <ul style={ulStyle}>
            <li><strong>Supabase</strong> &mdash; Authentication, database storage, and file storage (uploaded documents, generated videos). Hosted in the United States.</li>
            <li><strong>Google (Gemini AI)</strong> &mdash; Document analysis, content extraction, slide generation, and image generation.</li>
            <li><strong>OpenAI</strong> &mdash; Text-to-speech audio generation for video narration.</li>
            <li><strong>Stripe</strong> &mdash; Payment processing for subscriptions and credit pack purchases.</li>
            <li><strong>Resend</strong> &mdash; Transactional email delivery (account notifications, receipts).</li>
            <li><strong>Vercel</strong> &mdash; Web application hosting and content delivery.</li>
          </ul>
          <p style={pStyle}>
            We may also disclose your information if required to do so by law, or if we believe in good faith that such action is necessary to comply with legal proceedings, a court order, or legal process; protect and defend our rights or property; or act in urgent circumstances to protect the personal safety of users or the public.
          </p>
        </div>

        {/* 5. Data Retention */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>5. Data Retention</h2>
          <ul style={ulStyle}>
            <li><strong>Uploaded documents:</strong> Your original uploaded documents are processed for video generation and are not permanently stored after processing is complete. Processed content may be temporarily cached to allow you to regenerate or edit your videos.</li>
            <li><strong>Generated videos:</strong> Videos you create are stored in Supabase storage and remain available in your account until you delete them or close your account.</li>
            <li><strong>Account data:</strong> Your account information is retained for as long as your account is active. If you request account deletion, we will delete your personal data within 30 days, except where we are required by law to retain it.</li>
            <li><strong>Payment records:</strong> Transaction records are retained as required for tax, accounting, and legal compliance purposes.</li>
            <li><strong>Demo content:</strong> Website content scraped for free demo video generation is cached temporarily and deleted after demo delivery.</li>
          </ul>
        </div>

        {/* 6. User Rights */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>6. Your Rights</h2>
          <p style={pStyle}>Depending on your location, you may have the following rights regarding your personal data:</p>
          <ul style={ulStyle}>
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong>Correction:</strong> Request correction of any inaccurate personal data.</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data and account.</li>
            <li><strong>Export:</strong> Request a portable copy of your data in a machine-readable format.</li>
            <li><strong>Restriction:</strong> Request that we restrict processing of your personal data.</li>
            <li><strong>Objection:</strong> Object to certain types of data processing.</li>
            <li><strong>Withdraw consent:</strong> Where processing is based on consent, you may withdraw it at any time.</li>
          </ul>
          <p style={pStyle}>
            To exercise any of these rights, please contact us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>. We will respond to your request within 30 days.
          </p>
        </div>

        {/* 7. Children's Privacy */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>7. Children&apos;s Privacy</h2>
          <p style={pStyle}>
            Docs2Video is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal data from a child under 18, we will take steps to delete such information promptly. If you believe a child under 18 has provided us with personal information, please contact us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>.
          </p>
        </div>

        {/* 8. Security Measures */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>8. Security Measures</h2>
          <p style={pStyle}>We implement appropriate technical and organizational measures to protect your personal data, including:</p>
          <ul style={ulStyle}>
            <li>Encryption of data in transit (TLS/SSL) and at rest</li>
            <li>Secure authentication via Supabase Auth with password hashing</li>
            <li>Row-level security policies on database tables to prevent unauthorized access</li>
            <li>Regular security reviews of our infrastructure and code</li>
            <li>Access controls limiting employee access to personal data</li>
            <li>Secure API key management for third-party service integrations</li>
          </ul>
          <p style={pStyle}>
            While we strive to protect your personal data, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security.
          </p>
        </div>

        {/* 9. International Data Transfers */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>9. International Data Transfers</h2>
          <p style={pStyle}>
            Docs2Video is based in the United States, and our primary data infrastructure (Supabase, Vercel) is hosted in the United States. If you access Docs2Video from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States and other countries where our service providers operate.
          </p>
          <p style={pStyle}>
            By using Docs2Video, you consent to the transfer of your information to the United States and other jurisdictions as described in this Privacy Policy. Where required by applicable law, we ensure appropriate safeguards are in place for international data transfers, such as Standard Contractual Clauses approved by the European Commission.
          </p>
        </div>

        {/* 10. California Residents (CCPA) */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>10. Notice to California Residents (CCPA/CPRA)</h2>
          <p style={pStyle}>
            If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA):
          </p>
          <ul style={ulStyle}>
            <li><strong>Right to Know:</strong> You may request details about the categories and specific pieces of personal information we have collected about you, the purposes for collection, and the categories of third parties with whom we share it.</li>
            <li><strong>Right to Delete:</strong> You may request deletion of your personal information, subject to certain exceptions.</li>
            <li><strong>Right to Correct:</strong> You may request correction of inaccurate personal information.</li>
            <li><strong>Right to Opt-Out of Sale:</strong> We do not sell your personal information. We do not share your personal information for cross-context behavioral advertising.</li>
            <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
          </ul>
          <p style={pStyle}>
            To exercise your CCPA rights, please contact us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>. We will verify your identity before processing your request.
          </p>
        </div>

        {/* 11. European Residents (GDPR) */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>11. Notice to European Residents (GDPR)</h2>
          <p style={pStyle}>
            If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, the following additional provisions apply:
          </p>

          <h3 style={h3Style}>Legal Bases for Processing</h3>
          <p style={pStyle}>We process your personal data under the following legal bases:</p>
          <ul style={ulStyle}>
            <li><strong>Contract performance:</strong> Processing necessary to provide you with the Docs2Video service (account management, video generation, billing).</li>
            <li><strong>Legitimate interests:</strong> Processing for fraud prevention, security, service improvement, and customer support.</li>
            <li><strong>Consent:</strong> Where you have given explicit consent (e.g., marketing communications).</li>
            <li><strong>Legal obligation:</strong> Processing required to comply with applicable laws.</li>
          </ul>

          <h3 style={h3Style}>Data Protection Officer</h3>
          <p style={pStyle}>
            For GDPR-related inquiries, please contact us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>.
          </p>

          <h3 style={h3Style}>Right to Lodge a Complaint</h3>
          <p style={pStyle}>
            You have the right to lodge a complaint with your local data protection supervisory authority if you believe our processing of your personal data violates applicable law.
          </p>
        </div>

        {/* 12. Shared Videos */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>12. Publicly Shared Videos</h2>
          <p style={pStyle}>
            Docs2Video allows you to share generated videos via public links. Please be aware of the following:
          </p>
          <ul style={ulStyle}>
            <li>When you create a share link for a video, that video becomes accessible to anyone who has the link.</li>
            <li>Shared videos may be viewed without requiring authentication or a Docs2Video account.</li>
            <li>You are responsible for controlling the distribution of your share links. If you share a link publicly, the video content will be publicly accessible.</li>
            <li>You can revoke a share link at any time from your dashboard, which will immediately prevent further access.</li>
            <li>We do not index shared videos in search engines. However, we cannot control whether recipients of your link further distribute it.</li>
          </ul>
        </div>

        {/* 13. Changes to This Policy */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>13. Changes to This Privacy Policy</h2>
          <p style={pStyle}>
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes, we will notify you by posting the updated policy on this page and updating the &quot;Last Updated&quot; date. For significant changes, we may also send you a notification via email. Your continued use of Docs2Video after any changes constitutes your acceptance of the updated Privacy Policy.
          </p>
        </div>

        {/* 14. Contact Information */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>14. Contact Information</h2>
          <p style={pStyle}>
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
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
