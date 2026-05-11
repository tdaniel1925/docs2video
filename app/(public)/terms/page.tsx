import Link from 'next/link'

export default function TermsOfService() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--ink)',
      padding: '0 20px',
    }}>
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '60px 0 100px',
      }}>
        {/* Back link */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{
            color: 'var(--mint)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          }}>&larr; Back to Home</Link>
        </div>

        <h1 style={{
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          marginBottom: 8,
        }}>Terms of Service</h1>
        <p style={{
          color: 'var(--ink-soft, rgba(255,255,255,0.5))',
          fontSize: 14,
          marginBottom: 48,
        }}>Effective Date: May 9, 2026 &middot; Last Updated: May 9, 2026</p>

        {/* Intro */}
        <Section>
          <p>Welcome to Docs2Video.com (&quot;Docs2Video,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Docs2Video platform, website, and related services (collectively, the &quot;Service&quot;). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
          <p>Docs2Video is operated by Docs2Video.com, located at 27675 Nelson Way, 225, Katy, Texas 77494.</p>
        </Section>

        {/* 1 */}
        <SectionHeading num={1} title="Acceptance of Terms" />
        <Section>
          <p>By creating an account, accessing, or using the Service in any way, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using the Service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.</p>
          <p>We reserve the right to update or modify these Terms at any time. Your continued use of the Service after any changes constitutes acceptance of the revised Terms. We will make reasonable efforts to notify you of material changes via email or in-app notification.</p>
        </Section>

        {/* 2 */}
        <SectionHeading num={2} title="Description of Service" />
        <Section>
          <p>Docs2Video is a software-as-a-service (SaaS) platform that transforms documents (including PDFs, text files, and user-provided ideas) into professional, branded video explainers. The Service uses artificial intelligence technologies to:</p>
          <ul>
            <li>Extract and analyze data from uploaded documents using Google Gemini AI</li>
            <li>Generate presentation slides with branded layouts</li>
            <li>Write narration scripts based on extracted content</li>
            <li>Produce voiceover audio using OpenAI text-to-speech technology</li>
            <li>Compile final video explainers combining slides, narration, and branding</li>
            <li>Provide shareable public links for distributing generated videos</li>
          </ul>
          <p>The Service is provided on an &quot;as available&quot; basis. We may modify, suspend, or discontinue any part of the Service at any time, with or without notice.</p>
        </Section>

        {/* 3 */}
        <SectionHeading num={3} title="Account Registration and Responsibilities" />
        <Section>
          <p>To use certain features of the Service, you must create an account. When registering, you agree to:</p>
          <ol>
            <li>Provide accurate, current, and complete information during registration.</li>
            <li>Maintain and promptly update your account information to keep it accurate.</li>
            <li>Maintain the security and confidentiality of your login credentials.</li>
            <li>Accept responsibility for all activities that occur under your account.</li>
            <li>Notify us immediately at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a> if you suspect unauthorized access to your account.</li>
          </ol>
          <p>You must be at least 18 years of age to create an account and use the Service. We reserve the right to suspend or terminate accounts that violate these Terms or that we reasonably believe are being used fraudulently.</p>
        </Section>

        {/* 4 */}
        <SectionHeading num={4} title="Subscription Plans, Billing, Credits, and Refund Policy" />
        <Section>
          <h3 style={h3Style}>4.1 Subscription Plans</h3>
          <p>Docs2Video offers the following subscription tiers: Free (Demo), Starter, Professional, and Agency. Each plan includes different usage limits, features, and capabilities as described on our pricing page. Plan details and pricing are subject to change with reasonable advance notice.</p>

          <h3 style={h3Style}>4.2 Billing</h3>
          <p>Paid subscriptions are billed on a monthly recurring basis through Stripe, our third-party payment processor. By subscribing to a paid plan, you authorize us to charge the payment method on file for recurring fees until you cancel. All fees are quoted and charged in U.S. dollars unless otherwise indicated.</p>

          <h3 style={h3Style}>4.3 Pay-Per-Use Credits</h3>
          <p>In addition to subscription plans, Docs2Video offers pay-per-use credit packs that allow you to purchase individual video explainers without a subscription. Credits are non-transferable and do not expire. Purchased credits are non-refundable once used.</p>

          <h3 style={h3Style}>4.4 Free Tier and Demo Videos</h3>
          <p>The free (Demo) tier allows users to generate a limited number of watermarked video explainers for evaluation purposes. Watermarked demo videos are intended solely for evaluation and may not be used for commercial distribution or client-facing purposes. Upgrading to a paid plan removes watermarks.</p>

          <h3 style={h3Style}>4.5 Refund Policy</h3>
          <p>Subscription fees are generally non-refundable. However, if you are dissatisfied with the Service, you may contact us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a> within 14 days of your initial purchase to request a refund. Refund requests after 14 days will be evaluated on a case-by-case basis. Unused credits from credit packs may be refunded within 30 days of purchase if no credits from the pack have been used.</p>

          <h3 style={h3Style}>4.6 Cancellation</h3>
          <p>You may cancel your subscription at any time from your account settings. Upon cancellation, you will retain access to your paid plan features until the end of your current billing period. No partial refunds will be issued for unused portions of a billing cycle.</p>
        </Section>

        {/* 5 */}
        <SectionHeading num={5} title="User Content and Intellectual Property" />
        <Section>
          <h3 style={h3Style}>5.1 Your Content</h3>
          <p>You retain all ownership rights to the documents, files, text, images, and other materials you upload to the Service (&quot;User Content&quot;). By uploading User Content, you grant Docs2Video a limited, non-exclusive, royalty-free license to process, transform, and store your content solely for the purpose of providing the Service to you.</p>

          <h3 style={h3Style}>5.2 Generated Output</h3>
          <p>Videos, slides, scripts, and other materials generated by the Service from your User Content (&quot;Generated Output&quot;) are owned by you, subject to any limitations of your subscription plan. You are solely responsible for reviewing Generated Output for accuracy before distributing it.</p>

          <h3 style={h3Style}>5.3 Our Intellectual Property</h3>
          <p>The Service, including its software, design, templates, branding elements, algorithms, and documentation, is the intellectual property of Docs2Video and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the Service or its underlying technology.</p>

          <h3 style={h3Style}>5.4 Feedback</h3>
          <p>If you provide us with suggestions, ideas, or feedback regarding the Service, you grant us an unrestricted, perpetual, irrevocable, royalty-free license to use such feedback for any purpose without compensation or attribution to you.</p>
        </Section>

        {/* 6 */}
        <SectionHeading num={6} title="AI-Generated Content Disclaimer" />
        <Section>
          <p>The Service uses artificial intelligence technologies (including Google Gemini and OpenAI) to process documents and generate video content. You acknowledge and agree that:</p>
          <ol>
            <li><strong>AI output is not guaranteed to be accurate.</strong> Generated scripts, slides, and narration may contain errors, omissions, misinterpretations, or inaccuracies. You are solely responsible for reviewing and verifying all Generated Output before use or distribution.</li>
            <li><strong>AI-generated content does not constitute professional advice.</strong> Generated videos should not be relied upon as legal, financial, medical, or other professional advice. Always consult qualified professionals for such matters.</li>
            <li><strong>AI models may produce unexpected results.</strong> The underlying AI models are provided by third parties and may be updated, modified, or discontinued at any time, potentially affecting the quality or characteristics of Generated Output.</li>
            <li><strong>No guarantee of consistency.</strong> Processing the same document multiple times may produce different results due to the nature of AI processing.</li>
          </ol>
        </Section>

        {/* 7 */}
        <SectionHeading num={7} title="Acceptable Use Policy" />
        <Section>
          <p>You agree not to use the Service to:</p>
          <ol>
            <li>Upload, process, or distribute any content that is illegal, harmful, threatening, abusive, harassing, defamatory, obscene, or otherwise objectionable.</li>
            <li>Violate any applicable local, state, national, or international law or regulation.</li>
            <li>Infringe upon the intellectual property rights of any third party.</li>
            <li>Upload documents containing malware, viruses, or other harmful code.</li>
            <li>Abuse the free tier by creating multiple accounts, using automated tools to generate excessive demo videos, or circumventing usage limits.</li>
            <li>Scrape, crawl, or use automated means to access the Service or extract data from it.</li>
            <li>Attempt to reverse-engineer, decompile, or disassemble any part of the Service.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service or its infrastructure.</li>
            <li>Impersonate any person or entity, or falsely state or misrepresent your affiliation with a person or entity.</li>
            <li>Use the Service to generate content that is misleading, fraudulent, or intended to deceive.</li>
            <li>Resell, redistribute, or sublicense access to the Service without our express written consent.</li>
          </ol>
          <p>We reserve the right to investigate and take appropriate action against anyone who violates this policy, including removing content, suspending or terminating accounts, and reporting violations to law enforcement authorities.</p>
        </Section>

        {/* 8 */}
        <SectionHeading num={8} title="Share Pages and Public Links" />
        <Section>
          <p>The Service allows you to share generated videos via public links (&quot;Share Pages&quot;). You acknowledge and agree that:</p>
          <ol>
            <li>Any content shared via a public link is accessible to anyone who has the link. Docs2Video does not restrict access to Share Pages based on authentication.</li>
            <li>You are solely responsible for determining whether the content of your generated videos is appropriate for public sharing.</li>
            <li>You should not share videos containing sensitive, confidential, or personally identifiable information via public links unless you accept the risk of unauthorized access.</li>
            <li>Docs2Video is not liable for any unauthorized access to or use of content shared via public links.</li>
          </ol>
        </Section>

        {/* 9 */}
        <SectionHeading num={9} title="Limitation of Liability" />
        <Section>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, DOCS2VIDEO AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO:</p>
          <ol>
            <li>Your use of or inability to use the Service;</li>
            <li>Any errors, inaccuracies, or omissions in AI-generated content;</li>
            <li>Unauthorized access to or alteration of your transmissions or data;</li>
            <li>Any third-party conduct on the Service;</li>
            <li>Any content shared via public links or Share Pages;</li>
            <li>Any other matter relating to the Service.</li>
          </ol>
          <p>IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THE SERVICE EXCEED THE AMOUNT YOU HAVE PAID TO DOCS2VIDEO IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.</p>
        </Section>

        {/* 10 */}
        <SectionHeading num={10} title="Disclaimer of Warranties" />
        <Section>
          <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING OUT OF COURSE OF DEALING OR USAGE OF TRADE.</p>
          <p>WITHOUT LIMITING THE FOREGOING, DOCS2VIDEO DOES NOT WARRANT THAT:</p>
          <ol>
            <li>The Service will be uninterrupted, timely, secure, or error-free;</li>
            <li>The results obtained from the Service (including AI-generated content) will be accurate, reliable, or complete;</li>
            <li>The quality of any generated videos, slides, scripts, or voiceovers will meet your specific requirements or expectations;</li>
            <li>Any errors in the Service will be corrected.</li>
          </ol>
          <p>You acknowledge that AI-generated output may contain errors, and you assume all risk associated with the use, distribution, or reliance upon such output.</p>
        </Section>

        {/* 11 */}
        <SectionHeading num={11} title="Termination" />
        <Section>
          <p>We may suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. Grounds for termination include, but are not limited to:</p>
          <ol>
            <li>Violation of these Terms or the Acceptable Use Policy;</li>
            <li>Fraudulent, abusive, or illegal activity;</li>
            <li>Non-payment of fees;</li>
            <li>Extended inactivity;</li>
            <li>Requests by law enforcement or government agencies.</li>
          </ol>
          <p>Upon termination, your right to use the Service will immediately cease. We may, but are not obligated to, retain your data for a reasonable period following termination. You may request deletion of your data by contacting us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>.</p>
          <p>All provisions of these Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnification, and limitations of liability.</p>
        </Section>

        {/* 12 */}
        <SectionHeading num={12} title="Privacy" />
        <Section>
          <p>Your use of the Service is also governed by our Privacy Policy, which describes how we collect, use, store, and protect your personal information. By using the Service, you consent to the practices described in our Privacy Policy.</p>
          <p>We take data privacy seriously and implement industry-standard security measures to protect your information. For detailed information about our data practices, please review our Privacy Policy.</p>
        </Section>

        {/* 13 */}
        <SectionHeading num={13} title="Third-Party Services" />
        <Section>
          <p>The Service integrates with and relies upon third-party services to deliver its functionality. These include, but are not limited to:</p>
          <ul>
            <li><strong>Stripe</strong> &mdash; for payment processing and subscription management</li>
            <li><strong>Google (Gemini AI)</strong> &mdash; for document analysis and content generation</li>
            <li><strong>OpenAI</strong> &mdash; for text-to-speech voiceover generation</li>
            <li><strong>Supabase</strong> &mdash; for data storage and authentication</li>
          </ul>
          <p>Your use of the Service may be subject to the terms and privacy policies of these third-party providers. We are not responsible for the practices, availability, or performance of third-party services. Third-party services may be changed, updated, or discontinued at any time, which may affect the Service&apos;s functionality.</p>
          <p>We do not sell your data to third parties. Data shared with third-party services is limited to what is necessary to provide the Service.</p>
        </Section>

        {/* 14 */}
        <SectionHeading num={14} title="Data Processing and GDPR" />
        <Section>
          <p>If you are located in the European Economic Area (EEA), United Kingdom, or other jurisdiction with data protection laws, the following applies:</p>
          <ol>
            <li><strong>Data Controller.</strong> Docs2Video.com acts as the data controller for personal data collected through the Service.</li>
            <li><strong>Legal Basis.</strong> We process your personal data based on: (a) your consent; (b) the necessity to perform our contract with you; (c) our legitimate business interests; or (d) compliance with legal obligations.</li>
            <li><strong>Your Rights.</strong> You have the right to access, rectify, erase, restrict processing of, and port your personal data. You also have the right to object to processing and to withdraw consent at any time.</li>
            <li><strong>Data Transfers.</strong> Your data may be transferred to and processed in the United States and other countries where our service providers operate. We take appropriate safeguards to ensure your data is protected in accordance with applicable data protection laws.</li>
            <li><strong>Data Retention.</strong> We retain your personal data only for as long as necessary to provide the Service and fulfill the purposes described in our Privacy Policy.</li>
          </ol>
          <p>To exercise any of your data protection rights, please contact us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>.</p>
        </Section>

        {/* 15 */}
        <SectionHeading num={15} title="Indemnification" />
        <Section>
          <p>You agree to indemnify, defend, and hold harmless Docs2Video, its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related to:</p>
          <ol>
            <li>Your use of the Service;</li>
            <li>Your User Content or Generated Output;</li>
            <li>Your violation of these Terms;</li>
            <li>Your violation of any rights of a third party;</li>
            <li>Your distribution of AI-generated content without adequate review.</li>
          </ol>
        </Section>

        {/* 16 */}
        <SectionHeading num={16} title="Governing Law and Dispute Resolution" />
        <Section>
          <p>These Terms shall be governed by and construed in accordance with the laws of the State of Texas, United States, without regard to its conflict of law provisions.</p>
          <p>Any dispute arising out of or relating to these Terms or the Service shall be resolved exclusively in the state or federal courts located in Harris County, Texas. You consent to the personal jurisdiction and venue of such courts.</p>
          <p>Before initiating any formal legal proceedings, you agree to first attempt to resolve the dispute informally by contacting us at <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>. We will attempt to resolve the dispute through good-faith negotiations within 30 days.</p>
        </Section>

        {/* 17 */}
        <SectionHeading num={17} title="Changes to These Terms" />
        <Section>
          <p>We reserve the right to modify these Terms at any time. When we make material changes, we will:</p>
          <ol>
            <li>Update the &quot;Last Updated&quot; date at the top of this page;</li>
            <li>Provide notice via email to the address associated with your account or through an in-app notification;</li>
            <li>Where required by law, obtain your consent before the changes take effect.</li>
          </ol>
          <p>Your continued use of the Service following the posting of revised Terms means that you accept and agree to the changes. If you do not agree to the revised Terms, you must stop using the Service and cancel your account.</p>
        </Section>

        {/* 18 */}
        <SectionHeading num={18} title="General Provisions" />
        <Section>
          <ol>
            <li><strong>Entire Agreement.</strong> These Terms, together with the Privacy Policy, constitute the entire agreement between you and Docs2Video regarding the Service and supersede all prior agreements and understandings.</li>
            <li><strong>Severability.</strong> If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that the remaining provisions remain in full force and effect.</li>
            <li><strong>Waiver.</strong> Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.</li>
            <li><strong>Assignment.</strong> You may not assign or transfer these Terms or your rights hereunder without our prior written consent. We may assign these Terms without restriction.</li>
            <li><strong>Force Majeure.</strong> We shall not be liable for any failure or delay in performance resulting from causes beyond our reasonable control, including but not limited to acts of God, natural disasters, pandemics, war, terrorism, labor disputes, or failures of third-party services.</li>
          </ol>
        </Section>

        {/* 19 */}
        <SectionHeading num={19} title="Contact Information" />
        <Section>
          <p>If you have any questions, concerns, or requests regarding these Terms of Service, please contact us at:</p>
          <div style={{
            background: 'var(--surface, rgba(255,255,255,0.05))',
            borderRadius: 12,
            padding: '24px 28px',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            marginTop: 16,
          }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Docs2Video.com</p>
            <p style={{ margin: '0 0 4px' }}>27675 Nelson Way, 225</p>
            <p style={{ margin: '0 0 4px' }}>Katy, Texas 77494</p>
            <p style={{ margin: '0 0 4px' }}>United States</p>
            <p style={{ margin: '12px 0 4px' }}>
              Email: <a href="mailto:support@docs2video.com" style={{ color: 'var(--mint)' }}>support@docs2video.com</a>
            </p>
            <p style={{ margin: '0' }}>
              Website: <a href="https://docs2video.com" style={{ color: 'var(--mint)' }}>docs2video.com</a>
            </p>
          </div>
        </Section>

        {/* Footer separator */}
        <div style={{
          borderTop: '1px solid var(--border, rgba(255,255,255,0.1))',
          marginTop: 60,
          paddingTop: 24,
          textAlign: 'center',
          color: 'var(--ink-soft, rgba(255,255,255,0.4))',
          fontSize: 13,
        }}>
          <p>&copy; 2026 Docs2Video.com. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

/* ---- Sub-components ---- */

const h3Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginTop: 24,
  marginBottom: 8,
}

function SectionHeading({ num, title }: { num: number; title: string }) {
  return (
    <h2 style={{
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: '-0.02em',
      marginTop: 48,
      marginBottom: 16,
      paddingBottom: 10,
      borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
    }}>
      {num}. {title}
    </h2>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 15,
      lineHeight: 1.75,
      color: 'var(--ink-soft, rgba(255,255,255,0.75))',
    }}>
      {children}
      <style>{`
        .terms-section ol, .terms-section ul { padding-left: 24px; margin: 12px 0; }
        .terms-section li { margin-bottom: 8px; }
        .terms-section p { margin: 0 0 12px; }
      `}</style>
    </div>
  )
}
