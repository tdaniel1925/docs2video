'use client'

import Link from 'next/link'

export default function BrandsHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Profiles &amp; Personalization</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Profiles &amp; Personalization</h1>
          <p>A profile is who presents your video. It can be a <strong>Person</strong> (you, with your name, role, and photo) or a <strong>Company</strong> (your logo, colors, and contact info). You pick a saved profile on the <strong>Presenter</strong> step whenever you make a video.</p>
        </div>
      </div>

      {/* Where to find profiles */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Where to Find Your Profiles
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>From the menu</strong> — Click your name in the top-right corner to open the account menu, then choose <strong style={{ color: 'var(--ink)' }}>Brand profiles</strong>. You see all your saved profiles. Click <strong style={{ color: 'var(--ink)' }}>+ New profile</strong> to add one, or click a profile to edit it.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>While making a video</strong> — On the <strong style={{ color: 'var(--ink)' }}>Presenter</strong> step, pick a saved profile or click <strong style={{ color: 'var(--ink)' }}>+ Create a new profile</strong> to make one on the spot. You can also skip this step if you don&apos;t want a presenter or branding.
          </p>
        </div>
      </div>

      {/* Person vs Company */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Person or Company?
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            When you create a profile, choose a type at the top of the form:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Person</strong> — for a real presenter. You add your <strong>name</strong>, your <strong>role</strong> (e.g. "Registered Nurse"), a <strong>photo</strong> (headshot), your <strong>contact details</strong>, and an <strong>intro line</strong> the video speaks at the start. A person uses a photo, not a logo.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Company</strong> — the classic brand: a <strong>logo</strong>, <strong>brand colors</strong>, a tagline, and contact info. Use this when the video should represent an organization rather than an individual.
          </p>
        </div>
      </div>

      {/* Personalizing a video */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Personalizing a Video (Person profiles)
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Intro line</strong> — Write how you&apos;d like to be introduced, in your own words: <em>"Hi, I&apos;m Sarah Talls, a registered nurse. I&apos;ve prepared this video to walk you through your prescription plan."</em> The video speaks this at the opening.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Introduce me in the opening / Show my contact on the closing</strong> — Toggle these per video. The closing card shows your name, role, photo, and contact.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Where my photo appears</strong> — Choose Auto (the video style decides), Cover, Closing, Both, or None.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Show my name on slides</strong> — On the profile, decide whether your name leads the cover, or the document title does (your name still appears in the intro and closing).
          </p>
        </div>
      </div>

      {/* Logo controls */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Logo Controls (Company profiles)
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Show logo in videos</strong> — A simple on/off switch. When on, your logo appears in the lower corner and on the closing card; when off, videos render without it.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Background removal</strong> — When you upload a logo, we automatically clean its background so it sits cleanly on any slide. If your logo can&apos;t be cleaned automatically, you&apos;ll see guidance to upload a transparent PNG, or you can continue without a logo and we&apos;ll use your company name instead.
          </p>
        </div>
      </div>

      {/* Creating from URL */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Creating a Company Profile from Your Website
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            The fastest way to set up a Company profile is to give it your website. Docs2Video visits the site and fills in your brand colors for you.
          </p>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Open Brand profiles and click &ldquo;+ New profile.&rdquo;</strong> (Account menu, top-right &gt; Brand profiles.) At the top of the form is a box called <strong style={{ color: 'var(--ink)' }}>Import from website</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Enter your website.</strong> Type it in (for example, www.yourcompany.com) and click <strong style={{ color: 'var(--ink)' }}>Analyze brand</strong>, or press Enter.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Check the colors.</strong> When it says <strong style={{ color: 'var(--ink)' }}>Brand guide generated!</strong>, the colors are filled in. Colors from a website are a best guess, so change any that look wrong.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>4</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Add your logo and save.</strong> Upload your logo, check the name, and click <strong style={{ color: 'var(--ink)' }}>Create profile</strong>. It is now ready to pick on the Presenter step.
            </div>
          </div>
        </div>
      </div>

      {/* Manual Setup */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Setting Up a Company Profile by Hand
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            If you prefer to set everything manually or do not have a website, you can configure each setting individually:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Brand Name</strong> — Required. This appears on your videos and share pages. It can be your company name, a product name, or a client's brand name.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Logo</strong> — Upload a PNG or SVG file. Recommended but not required. The logo appears on the title slide, closing slide, and share page of your videos.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Primary Color</strong> — Click the color swatch to open a color picker, or type in a hex code (e.g., #3BB5C8). This is the dominant color used throughout your videos.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Secondary and Accent Colors</strong> — These are created from your primary color so they go well together. To choose them yourself, open <strong style={{ color: 'var(--ink)' }}>Advanced color settings</strong> near the bottom of the form.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Contact Information</strong> — Optionally add a phone number, email, and website. These appear on your video closing slides and share pages.
          </p>
        </div>
      </div>

      {/* How Brands Affect Videos */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How a Profile Shows Up in Your Video
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            When you pick a profile on the Presenter step, it shapes every part of the result:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Title Slide</strong> — Displays your logo, brand name, and your headshot photo.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Content Slides</strong> — Your brand colors replace the template's default colors. Backgrounds, accents, headings, and data highlights all use your palette.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Closing Slide</strong> — Shows your logo, name, title, contact information, and standing photo.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Share Page</strong> — The entire share page is branded with your logo, colors, and contact details, creating a professional and cohesive experience for your clients.
          </p>
        </div>
      </div>

      {/* Managing Multiple Brands */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Managing Several Profiles
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            You can create as many profiles as you need. This is useful if you work with several clients, manage different product lines, or want separate branding for different audiences.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Default Profile</strong> — Tick <strong style={{ color: 'var(--ink)' }}>Set as default profile</strong> when creating or editing a profile. That profile is picked for you first when you make something new.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Choosing a Profile for a Video</strong> — On the <strong style={{ color: 'var(--ink)' }}>Presenter</strong> step, click the profile you want. The video uses that profile&apos;s logo, colors, photo and contact details.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Editing a Profile</strong> — Open <strong style={{ color: 'var(--ink)' }}>Brand profiles</strong> from the account menu and click any profile to edit it. Changes don&apos;t alter videos you already made; everything you make afterwards uses the new settings.
          </p>
        </div>
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/help" className="btn btn-soft">
          Back to Help Center
        </Link>
      </div>
    </div>
  )
}
