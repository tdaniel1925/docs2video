'use client'

import Link from 'next/link'

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 15, flexShrink: 0,
}

const step: React.CSSProperties = { display: 'flex', gap: 16, marginBottom: 28, alignItems: 'flex-start' }
const body: React.CSSProperties = { fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }
const note: React.CSSProperties = {
  background: 'var(--cream)', border: '1px solid var(--border-light)', borderRadius: 10,
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
        <span>Flyers, Ads &amp; Business Cards</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Flyers, Ads &amp; Business Cards</h1>
          <p>Describe what you need in plain English and get finished, print-ready designs — the artwork and the words together — in every size you tick.</p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>1</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Open the maker</h3>
          <p style={body}>
            In the top menu, open <strong>Tools</strong> and click <strong>📄 Flyer Creator</strong>.
            The page looks like a chat: a conversation down the middle, and a typing bar at the bottom.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>2</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Say what it&rsquo;s for</h3>
          <p style={body}>
            Type it the way you&rsquo;d say it out loud. For example: <em>&ldquo;Saturday club night at The
            Foundry, doors 9pm, $20 cover, DJ Sable headlining&rdquo;</em> — or <em>&ldquo;business card for
            Dana Okafor, Managing Broker at Okafor Property Group, 555-0134&rdquo;</em>. Press <strong>Send</strong>.
          </p>
          <p style={{ ...body, marginTop: 10 }}>
            A card appears headed <strong>What goes on the design</strong>, listing everything it understood —
            the headline, the date, the price, the phone number. Read it. If anything is wrong, just say so
            (&ldquo;the price is $25&rdquo;) and it will correct that one thing without touching the rest.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>3</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Check the look and the sizes</h3>
          <p style={body}>
            Three buttons sit above where you type:
          </p>
          <ul style={{ ...body, marginTop: 10, paddingLeft: 20 }}>
            <li><strong>🎨 the style</strong> — fifteen looks, grouped into Nightlife, Business, Community, Real estate and Fitness. It picks one that suits your job automatically, and tells you when it does. Click a different one any time; once you choose for yourself, your choice sticks.</li>
            <li><strong>📷 your photos</strong> — up to three of your own pictures. Say what each one is (a person, a place, a product, a logo), because a face and a building need opposite treatment.</li>
            <li><strong>📐 the sizes</strong> — tick everything you need. Print, social posts, banners and business cards.</li>
          </ul>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>4</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Press Make</h3>
          <p style={body}>
            The button shows the price before you commit — <strong>Make 3 · 600 cr</strong>. Each design costs
            200 credits, because each one is drawn from scratch rather than being a crop of the others: a
            poster and a Facebook banner are laid out completely differently.
          </p>
          <p style={{ ...body, marginTop: 10 }}>
            A block appears in the conversation with a progress bar and a rough countdown. Designs land one at
            a time — about two minutes each, three at a time — so you don&rsquo;t wait for all of them to
            start looking. If one fails you are not charged for it.
          </p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>5</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Check it properly, then download</h3>
          <p style={body}>
            Click any design to fill the screen with it, then <strong>Download</strong>. Print sizes come out
            at 300 dots per inch, which is what a printer asks for.
          </p>
          <div style={note}>
            <strong>Please read the small print before you print.</strong> The dates, prices, phone numbers and
            email addresses are drawn by the AI as part of the picture. It is very good at this now, but an
            unusual venue name or a phone number is worth a second look at full size — which is exactly why
            clicking a design opens it full screen.
          </div>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>6</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Change something and go again</h3>
          <p style={body}>
            Say what you want different and press Make again. The new designs appear <em>underneath</em> the
            old ones — nothing is overwritten, so you can compare and pick. Everything is saved: close the
            tab, come back tomorrow, and the whole conversation and every design is still there. They also
            appear in your Library under My Creations.
          </p>
        </div>
      </div>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Business cards</h2>
      <p style={body}>
        Tick <strong>Business card — front</strong> and <strong>back</strong> under the sizes button. A card is
        treated as a card, not a shrunken poster: the person&rsquo;s name is the largest thing on it, the job
        title sits underneath, the contact details group into one corner, and the back is kept deliberately
        near-empty — which is what an expensive card looks like.
      </p>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Using your own photos</h2>
      <p style={body}>
        Add a headshot, the actual property, or your product and the design is built around it instead of an
        invented stranger. One thing to know: your photo is <strong>redrawn</strong> into the artwork rather
        than pasted in, so a person stays clearly recognisable but is not pixel-for-pixel the original
        photograph. Look at the face before you send it anywhere.
      </p>
      <p style={body}>
        A logo is the exception — mark it as <strong>A logo</strong> and it is placed as-is, never redrawn or
        recoloured.
      </p>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Common questions</h2>
      <p style={body}><strong>Why did my old flyer page disappear?</strong><br />
        There used to be two flyer tools. They have been replaced by this one, which produces better designs,
        handles more sizes, keeps a history and makes business cards. Anything you made before is untouched
        and still in your Library.
      </p>
      <p style={{ ...body, marginTop: 14 }}><strong>Can I get a really big poster?</strong><br />
        Yes — 11&times;17 inches is offered. Very large print sizes are enlarged to reach their full
        dimensions, so they suit handouts and posters rather than billboards.
      </p>
      <p style={{ ...body, marginTop: 14 }}><strong>Why is one design different from another?</strong><br />
        Because each is an original for its own shape. A tall poster and a wide banner cannot hold the same
        layout, so they are siblings in one style rather than copies. Nothing is ever cropped to fit.
      </p>

      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Help Center
        </Link>
      </div>
    </div>
  )
}
