'use client'

import Link from 'next/link'

// Help article for the Custom Graphics maker at /design — the five-step
// wizard (What → Content → Style → Sizes → Review). Rewritten 2026-09-26 to
// match the wizard; the old text described the retired one-page chat maker.

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: 10, background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 15, flexShrink: 0,
}

const step: React.CSSProperties = { display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-start' }
const body: React.CSSProperties = { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }
const list: React.CSSProperties = { ...body, marginTop: 10, paddingLeft: 20 }
const note: React.CSSProperties = {
  background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 10,
  padding: '14px 16px', margin: '16px 0', fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6,
}

export default function FlyersHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Custom Graphics</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Custom Graphics</h1>
          <p>
            Flyers, posters, social posts, banners, business cards and slide decks. Tell it what you need,
            pick a look and your sizes, and get finished designs — the artwork and the words together.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>1</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Open the maker</h3>
          <p style={body}>
            Click <strong>+ Create</strong> at the top of the screen, then the <strong>Custom Graphics</strong> card.
            (On Text2Art it&rsquo;s <strong>Designs</strong> in the top menu.)
          </p>
          <p style={{ ...body, marginTop: 10 }}>
            A list down the left called <strong>Your design</strong> shows the five steps: <strong>What</strong>,{' '}
            <strong>Content</strong>, <strong>Style</strong>, <strong>Sizes</strong> and <strong>Review</strong>. The
            bar at the bottom has <strong>&larr; Back</strong> and a button that names the next step. If that button is
            greyed out, the hint beside it says what&rsquo;s missing. Every step has a <strong>? Need help?</strong>{' '}
            link, and on a wide screen a live preview sits on the right.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>2</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>What — what do you want to make?</h3>
          <p style={body}>Tap one of four pictures. Tapping moves you straight on to the next step.</p>
          <ul style={list}>
            <li><strong>Something to print</strong> — a flyer, poster, postcard, sign or card.</li>
            <li><strong>A social graphic</strong> — a post, story, ad or banner.</li>
            <li><strong>A slide deck</strong> — a whole presentation (see below).</li>
            <li><strong>A set of sizes</strong> — the same design in several shapes.</li>
          </ul>
          <p style={{ ...body, marginTop: 10 }}>
            <strong>Shortcut:</strong> under the pictures, type (or tap the 🎤 and say) what you need — for example{' '}
            <em>&ldquo;Saturday club night at The Foundry, doors 9pm, $20 cover&rdquo;</em> — and press{' '}
            <strong>Draft it &rarr;</strong>. It fills in the kind, a look, the words and the sizes for you, then takes
            you to the Content step to check them. You can also name your website and it will pick up your colours,
            logo and wording. Not sure what to write? Tap one of the examples.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>3</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Content — what should it say?</h3>
          <p style={body}>
            This step works like a chat. Type or paste in the box (or press <strong>🎤 Talk</strong>), then press{' '}
            <strong>Send</strong>. Three buttons help you get started:
          </p>
          <ul style={list}>
            <li><strong>✍️ Write it for me</strong> — it drafts the words from what you&rsquo;ve told it.</li>
            <li><strong>📎 Upload a document</strong> — PDF, Word, PowerPoint, text or CSV — and it pulls the words out.</li>
            <li><strong>✏️ Type it in myself</strong> — three boxes: <strong>Headline</strong>, <strong>The details</strong>{' '}
              (one per line) and an optional <strong>Call to action</strong>.</li>
          </ul>
          <p style={{ ...body, marginTop: 10 }}>
            The card called <strong>On your design so far</strong> shows the headline, details and call to action it
            will use. If something is wrong, just say so in the chat (&ldquo;the price is $25&rdquo;) and it fixes that
            one thing. Press <strong>Next: choose a look</strong> when it&rsquo;s right.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>4</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Style — choose your look</h3>
          <p style={body}>The <strong>The look</strong> box gives you three ways to set the style. Pick one:</p>
          <ul style={list}>
            <li><strong>Drop or paste a design you like</strong> — an image to take direction from (see
              &ldquo;Working from a design you like&rdquo; below). Tick the box confirming you have the right to use it.</li>
            <li><strong>Or match a website&rsquo;s brand</strong> — type a web address and press <strong>Read brand</strong>.
              It picks up up to three colours, the logo and the fonts. Click the &times; on a colour to drop it.</li>
            <li><strong>Or choose one of our styles</strong> — open the gallery and click a thumbnail. Press{' '}
              <strong>See more</strong> to load more. If the app picked a style for you, it says{' '}
              <strong>✨ Suggested look</strong>.</li>
          </ul>
          <p style={{ ...body, marginTop: 10 }}>
            Choosing a style clears a reference image, and the other way round — a small message offers{' '}
            <strong>Undo</strong> if you change your mind.
          </p>
          <p style={{ ...body, marginTop: 10 }}>
            The second box, <strong>Your logo &amp; photos (optional)</strong>, takes up to six pictures. Each one is
            labelled <strong>Logo</strong> or <strong>Photo</strong> automatically; if it guessed wrong, click{' '}
            <strong>Not a logo? Mark it a photo</strong>. Use <strong>Add a QR code</strong> to put a scannable code on
            the design. Press <strong>Next: pick sizes</strong>.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>5</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Sizes — where will you use it?</h3>
          <p style={body}>Tick every size you need, up to eight. Each shows its price (200 credits).</p>
          <ul style={list}>
            <li><strong>Print</strong> — letter flyer, square flyer, half page, 11&times;17 poster, postcards, rack card,
              door hanger, table tent, A4, yard sign and vinyl banner.</li>
            <li><strong>Social</strong> — Instagram post and story, Facebook post, Facebook/Instagram ad.</li>
            <li><strong>Banners &amp; headers</strong> — Facebook cover, YouTube banner and thumbnail, X header, LinkedIn banner.</li>
            <li><strong>Business cards</strong> — front and back.</li>
            <li><strong>Slides</strong> — widescreen and 4:3.</li>
          </ul>
          <p style={{ ...body, marginTop: 10 }}>
            If you tick a print size, it asks <strong>For printing — do you want a bleed?</strong> Choose{' '}
            <strong>Full bleed</strong> if your print shop trims the edges (they&rsquo;ll tell you), otherwise leave it on{' '}
            <strong>No bleed</strong>. The bottom of the page shows how many designs you&rsquo;re making, the total
            credits, and what you&rsquo;ll have left.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>6</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Review — check and start</h3>
          <p style={body}>
            A summary lists what you&rsquo;re making, the look, the headline, the sizes, the print edge and your
            pictures, plus the price — for example <strong>600 credits (3 designs &times; 200)</strong> and what
            you&rsquo;ll have left. Press <strong>Start designing</strong>.
          </p>
          <p style={{ ...body, marginTop: 10 }}>
            A waiting screen shows one placeholder per size while it works. You can close the tab — finished designs
            are saved to your Library either way. If it can&rsquo;t finish, you aren&rsquo;t charged.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>7</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Your designs — download, share, or change a part</h3>
          <p style={body}>
            Click any size in the list to see it large. From here you can:
          </p>
          <ul style={list}>
            <li><strong>Download this one</strong>, <strong>Download all</strong>, or <strong>Share</strong> a link.</li>
            <li><strong>Edit a part</strong> (200 credits) — paint over the area you want changed, describe the change,
              and press <strong>Change it</strong>. To change wording, use <strong>Change the words</strong> instead.</li>
            <li><strong>Add a QR code</strong> or <strong>Add a logo</strong> — pick the file, click where it should go,
              then <strong>Place it</strong> (costs one design).</li>
            <li><strong>&larr; Make more sizes</strong>, <strong>Change the words</strong>, or{' '}
              <strong>Start another design</strong>.</li>
          </ul>
          <p style={{ ...body, marginTop: 10 }}>
            Every design is also in your <strong>Library</strong>, under the <strong>Custom Graphics</strong> tab.
          </p>
          <div style={note}>
            <strong>Read the small print before you print.</strong> Dates, prices, phone numbers and email addresses
            are drawn by the AI as part of the picture. If it spots a word that may be misspelled it shows a warning,
            but always check names and numbers at full size before sending anything to a printer.
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Slide decks (a whole presentation)</h2>
      <p style={body}>
        On the <strong>What</strong> step, tap <strong>A slide deck</strong>. On the Content step, describe what the
        deck is about and who it&rsquo;s for — or paste your notes. It asks <strong>How long should this deck
        run?</strong> — <strong>Short</strong> (5–7 slides), <strong>Medium</strong> (8–14) or <strong>Long</strong> (15–24).
      </p>
      <p style={body}>
        Before anything is drawn it shows <strong>Review every slide — edit anything</strong>: each slide&rsquo;s headline
        and lines, which you can change. You can <strong>Delete</strong> a slide, <strong>+ Add a line</strong>, add{' '}
        <strong>+ Slide below</strong>, or switch between short, medium and long without losing your edits. When
        it&rsquo;s right, press <strong>Make it a deck</strong> (the button shows the slide count and credits). Decks
        skip the Sizes step and are drawn at widescreen size; download the slides as images or as one PDF.
      </p>
      <div style={note}>
        <strong>It won&rsquo;t make things up.</strong> Real numbers from your notes are kept exactly; a slide it
        can&rsquo;t back up with your material is left out rather than invented. Already have a PowerPoint or PDF? Use{' '}
        <Link href="/help/restyle-deck" style={{ color: 'var(--ink)', fontWeight: 700 }}>Restyle a Deck</Link> instead.
      </div>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Business cards</h2>
      <p style={body}>
        On the <strong>Sizes</strong> step, tick <strong>Business card — front</strong> and <strong>back</strong> in the
        Business cards group. A card is treated as a card, not a shrunken poster: the name is the largest thing on it,
        the job title sits underneath, the contact details group together, and the back is kept simple.
      </p>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Working from a design you like</h2>
      <p style={body}>
        On the <strong>Style</strong> step, use <strong>Drop or paste a design you like</strong>. You can choose a file,
        drag one in, or copy an image and paste it straight onto the page.
      </p>
      <div style={note}>
        <strong>We don&rsquo;t copy the design itself.</strong> We read its style — the colours, the lettering, the
        mood, the layout — and build a new design from your own words. Its text, logos and photographs are never
        reused. Only use a design you own or have permission to use.
      </div>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Using your own photos and logo</h2>
      <p style={body}>
        Add a headshot, the actual property, or your product and the design is built around it. A photo of a person
        becomes the featured subject and is <strong>redrawn</strong> into the artwork, so it stays recognisable but is
        not pixel-for-pixel the original — look at the face before you send it anywhere. A <strong>logo</strong> and a{' '}
        <strong>QR code</strong> are the exceptions: they are placed exactly as you uploaded them, never redrawn.
      </p>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Common questions</h2>
      <p style={body}><strong>What does it cost?</strong><br />
        200 credits per design (each size is its own design), per deck slide, per <strong>Edit a part</strong>, and per
        logo or QR placement. The price is shown on the Sizes and Review steps before you start.
      </p>
      <p style={{ ...body, marginTop: 14 }}><strong>Are the files good enough to print?</strong><br />
        Print sizes are saved at the right size and resolution for their paper (300 dots per inch for most; less for
        the yard sign and vinyl banner, which are seen from further away). Small lettering can look softer on the
        largest sizes, so for posters and signs, zoom in and check before ordering a big print run.
      </p>
      <p style={{ ...body, marginTop: 14 }}><strong>Why is one size different from another?</strong><br />
        Each is an original for its own shape. A tall poster and a wide banner cannot hold the same layout, so they
        are siblings in one style rather than copies. Nothing is cropped to fit.
      </p>
      <p style={{ ...body, marginTop: 14 }}><strong>Where did the old Flyer Creator go?</strong><br />
        It was replaced by this maker. Anything you made before is untouched and still in your Library.
      </p>

      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Help Center
        </Link>
      </div>
    </div>
  )
}
