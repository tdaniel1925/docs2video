'use client'

import Link from 'next/link'
import { NAMES } from '../../../_lib/names'

// A saved logo-and-colours (or name-and-photo) is a "brand" everywhere in the
// app (names.ts). This article used to call it a "profile" and send people to
// a "Presenter" step; it now uses the words the screens use.

export default function BrandsHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Brands &amp; Personalization</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Brands &amp; Personalization</h1>
          <p>A brand is who your video comes from. It can be a <strong>Person</strong> (you, with your name, role, and photo) or a <strong>Company</strong> (your logo, colors, and contact info). Your default brand is used automatically, and you can switch to another saved brand on the <strong>The look</strong> step whenever you make a video.</p>
        </div>
      </div>

      {/* Where to find brands */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Where to find your brands
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>From the top bar</strong> — Click <strong style={{ color: 'var(--ink)' }}>{NAMES.brands}</strong> in the top bar. You see all your saved brands. Click <strong style={{ color: 'var(--ink)' }}>{NAMES.newBrand}</strong> to add one, or click a brand to edit it.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>While making a video</strong> — On the <strong style={{ color: 'var(--ink)' }}>The look</strong> step you see which brand is in use. Click <strong style={{ color: 'var(--ink)' }}>Change</strong> to pick another saved brand or make a new one. No brand at all? The video uses plain colors.
          </p>
          <p style={{ marginTop: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Your first brand, inside your first project</strong> — New accounts don&apos;t fill in a brand page first. On the <strong style={{ color: 'var(--ink)' }}>The look</strong> step of your first project, <strong style={{ color: 'var(--ink)' }}>Add your brand</strong> opens right on the page (later, click <strong style={{ color: 'var(--ink)' }}>Add your brand</strong> on the brand line):
          </p>
          <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            <li>Type <strong style={{ color: 'var(--ink)' }}>Your name or company</strong>.</li>
            <li>Type <strong style={{ color: 'var(--ink)' }}>Your website</strong> and click <strong style={{ color: 'var(--ink)' }}>Fill in from it</strong> — it reads your colours and the logo on your site. Or click <strong style={{ color: 'var(--ink)' }}>Upload your logo</strong> and pick <strong style={{ color: 'var(--ink)' }}>Your colours</strong> yourself.</li>
            <li>Click <strong style={{ color: 'var(--ink)' }}>Save my brand</strong>. This project uses it, and your first brand becomes the default for new projects. <strong style={{ color: 'var(--ink)' }}>Not now</strong> closes it; <strong style={{ color: 'var(--ink)' }}>More brand options</strong> adds a photo and contact details.</li>
          </ol>
          <p style={{ marginTop: 10 }}>
            Only your real logo is ever used — we never draw one. With no logo, your name shows as text.
          </p>
          <p style={{ marginTop: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Video look</strong> — press <strong style={{ color: 'var(--ink)' }}>Video look</strong> on a brand to choose the colours, fonts and feel of that brand&apos;s videos (from the brand, a picture or website you like, or a ready style). It&apos;s saved on the brand and your next videos start from it. See <Link href="/help/video-look" style={{ color: 'var(--link)' }}>Your video look</Link>.
          </p>
        </div>
      </div>

      {/* Person vs Company */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Person or Company?
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            When you create a brand, choose a <strong>Brand type</strong> at the top of the form:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Person</strong> — for you, or whoever the video comes from. You add your <strong>name</strong>, your <strong>role</strong> (e.g. "Registered Nurse"), a <strong>photo</strong> (headshot), your <strong>contact details</strong>, and an <strong>intro line</strong> the video speaks at the start. A person uses a photo, not a logo.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Company</strong> — the classic brand: a <strong>logo</strong>, <strong>brand colors</strong>, a tagline, and contact info. Use this when the video should represent an organization rather than an individual.
          </p>
        </div>
      </div>

      {/* Personalizing a video */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Personalizing a Video (Person brands)
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
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
            <strong style={{ color: 'var(--ink)' }}>Show my name on slides</strong> — On the brand, decide whether your name leads the cover, or the document title does (your name still appears in the intro and closing).
          </p>
        </div>
      </div>

      {/* Logo controls */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Logo Controls (Company brands)
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
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
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Creating a Company Brand from Your Website
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            The fastest way to set up a Company brand is to give it your website. Docs2Video visits the site and fills in your brand colors for you.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Open {NAMES.brands} and click &ldquo;{NAMES.newBrand}.&rdquo;</strong> ({NAMES.brands} is in the top bar.) At the top of the form is a box called <strong style={{ color: 'var(--ink)' }}>Import from website</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Enter your website.</strong> Type it in (for example, www.yourcompany.com) and click <strong style={{ color: 'var(--ink)' }}>Analyze brand</strong>, or press Enter.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Check the colors.</strong> When it says <strong style={{ color: 'var(--ink)' }}>Brand guide generated!</strong>, the colors are filled in. Colors from a website are a best guess, so change any that look wrong.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: 'var(--ink)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--fs-ui)', flexShrink: 0,
            }}>4</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Add your logo and save.</strong> Upload your logo, check the name, and click <strong style={{ color: 'var(--ink)' }}>Create brand</strong>. It is now ready to pick on the The look step.
            </div>
          </div>
        </div>
      </div>

      {/* Manual Setup */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Setting Up a Company Brand by Hand
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
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
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          How a Brand Shows Up in Your Video
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The brand a video uses shapes every part of the result:
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
        background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Managing Several Brands
        </h2>
        <div style={{ fontSize: 'var(--fs-ui)', lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            You can create as many brands as you need. This is useful if you work with several clients, manage different product lines, or want separate branding for different audiences.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Default Brand</strong> — Tick <strong style={{ color: 'var(--ink)' }}>Set as default brand</strong> when creating or editing a brand. That brand is picked for you first when you make something new.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>The same name twice</strong> — If you type a name you already used, a line under the name says so with <strong style={{ color: 'var(--ink)' }}>Open it</strong>. Pressing <strong style={{ color: 'var(--ink)' }}>Create brand</strong> asks once more before making a second copy. On the Brands page, brands with the same name show as one card (your default one, or else the newest) with <strong style={{ color: 'var(--ink)' }}>N copies with this name</strong> — press it to see the others. Nothing is deleted for you.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Choosing a Brand for a Video</strong> — On the <strong style={{ color: 'var(--ink)' }}>The look</strong> step, click <strong style={{ color: 'var(--ink)' }}>Change</strong> next to the brand and pick the one you want. The video uses that brand&apos;s logo, colors, photo and contact details.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Editing a Brand</strong> — Click <strong style={{ color: 'var(--ink)' }}>{NAMES.brands}</strong> in the top bar and click any brand to edit it. Changes don&apos;t alter videos you already made; everything you make afterwards uses the new settings.
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
