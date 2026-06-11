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
        <span>Setting Up Brands</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Setting Up Brands</h1>
          <p>Create and manage brands so every video, flyer, and card uses your logo, colors, and contact info.</p>
        </div>
      </div>

      {/* Creating from URL */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 10,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Creating a Brand from a Website URL
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            The fastest way to set up a brand is by entering a website URL. Docs2Video will visit the site and extract your brand colors automatically.
          </p>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>1</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Go to Brands and click "New Brand."</strong> You will see the brand creation form with fields for name, logo, colors, and an optional website URL field.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>2</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Enter the website URL.</strong> Paste the full URL (e.g., https://yourcompany.com). Click the scrape button or press Enter.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>3</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Review the extracted colors.</strong> The system reads the site's CSS and identifies the primary, secondary, and accent colors. These fill in automatically. You can adjust any color by clicking on its swatch.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>4</div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Upload your logo and save.</strong> Add your logo file, confirm the brand name, and click Save. Your brand is ready to use.
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
          Manual Brand Setup
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
            <strong style={{ color: 'var(--ink)' }}>Secondary and Accent Colors</strong> — These are auto-generated from your primary color to create a harmonious palette. Click "Advanced" to override them with your own choices. You can set up to 5 custom colors.
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
          How Brands Affect Video Generation
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            When you select a brand during video creation, it influences every part of the output:
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
          Managing Multiple Brands
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            You can create as many brands as you need. This is useful if you work with multiple clients, manage different product lines, or want separate branding for different audiences.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Default Brand</strong> — One brand can be set as your default. Check "Set as default" when creating or editing a brand. The default brand is automatically pre-selected every time you create a new video, flyer, or other item.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Switching Brands</strong> — During the creation flow, you can switch brands at any time using the brand dropdown. Changing the brand updates the colors and logo used in the output.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Editing a Brand</strong> — Go to Brands, click on any brand to edit it. Changes to a brand do not retroactively update previously created items, but all future items will use the updated settings.
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
