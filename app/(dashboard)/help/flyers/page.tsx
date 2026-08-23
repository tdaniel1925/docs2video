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
        <span>Custom Graphics</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Custom Graphics</h1>
          <p>Describe what you need in plain English and get finished, print-ready designs — the artwork and the words together — in every size you tick.</p>
        </div>
      </div>

      <div style={step}>
        <div style={STEP_CIRCLE}>1</div>
        <div>
          <h3 style={{ margin: '4px 0 8px' }}>Open the maker</h3>
          <p style={body}>
            Click <strong>Custom Graphics</strong> in the top menu.
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
            Dana Okafor, Managing Broker at Okafor Property Group, 555-0134&rdquo;</em>. Press <strong>Preview details</strong>.
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
            <li><strong>1. Pick Your Style</strong> — 225 looks: twenty-five each in Business, Sales &amp; offers, Food &amp; drink, Local services, Real estate, Fitness, Community, Live music and Nightlife. It picks one that suits your job automatically and tells you when it does. Click a different one any time; once you choose for yourself, your choice sticks. There is a search box above the pictures that looks through every group at once — type <em>taco</em>, <em>gold</em> or <em>wedding</em> rather than guessing which group we filed it under.</li>
            <li><strong>2. Add Photos (Optional)</strong> — up to three of your own pictures. Say what each one is (a person, a place, a product, a logo), because a face and a building need opposite treatment.</li>
            <li><strong>3. Choose Format</strong> — tick every size you need. Print, social posts, banners and business cards.</li>
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

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Slide decks (a whole presentation)</h2>
      <p style={body}>
        On the first step, tap <strong>A slide deck</strong>. On the words step, just describe what the deck is
        about and who it&rsquo;s for &mdash; or paste all your notes. You don&rsquo;t say how many slides; the app
        asks whether you want it <strong>Short</strong>, <strong>Medium</strong> or <strong>Long</strong>, then
        picks the exact number to fit what you gave it.
      </p>
      <p style={body}>
        It doesn&rsquo;t just list your points on slides &mdash; it builds a <strong>story</strong>. It works out
        the deck&rsquo;s purpose (an investor pitch, a sales deck, training, a report&hellip;) and orders the
        slides the way that kind of talk is meant to flow. Before anything is drawn, it shows you the{' '}
        <strong>running order</strong> &mdash; each slide&rsquo;s title and one line on why it&rsquo;s there. You
        can remove any slide or change the length, then press <strong>Make it a deck</strong>.
      </p>
      <div style={note}>
        <strong>It won&rsquo;t make things up.</strong> Real numbers from your notes are kept exactly; a slide it
        can&rsquo;t back up with your material is left out rather than invented. Your <strong>logo</strong> sits in
        the same corner on every inside slide, so the whole set looks designed together.
      </div>
      <p style={body}>
        Every slide is drawn to match your chosen look, at standard widescreen size. Download them as images or as
        one PDF. (Already have a PowerPoint or PDF? Use <strong>restyle a deck</strong> instead &mdash; that keeps
        your existing slides and just redraws them in a new look.)
      </p>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Business cards</h2>
      <p style={body}>
        Tick <strong>Business card — front</strong> and <strong>back</strong> under the sizes button. A card is
        treated as a card, not a shrunken poster: the person&rsquo;s name is the largest thing on it, the job
        title sits underneath, the contact details group into one corner, and the back is kept deliberately
        near-empty — which is what an expensive card looks like.
      </p>

      <h2 style={{ fontSize: 20, margin: '36px 0 12px' }}>Working from a design you like</h2>
      <p style={body}>
        Instead of picking one of our looks, you can give us a design to take direction from. Open{' '}
        <strong>1. Pick Your Style</strong> and use <strong>Upload your own design to work from</strong>. You can
        choose a file, drag one in, or simply copy an image and paste it straight onto the page.
      </p>
      <p style={body}>
        If you have nothing to hand, browse <strong>Envato</strong>, <strong>Freepik</strong> or{' '}
        <strong>Creative Market</strong>, find something you like the look of, and paste it in.
      </p>
      <div style={note}>
        <strong>We don&rsquo;t copy the design itself.</strong> We read its style — the colours, the lettering,
        the mood, the way it is laid out — and build you a new design from your own words. Its text, logos and
        photographs are never reused. That matters: those designs belong to the people who made them, and a
        close copy is theirs, not yours.
      </div>
      <p style={body}>
        A style and a reference cannot both be used at once. Each is a complete instruction for how the design
        should look, and giving two means it follows neither — so choosing one clears the other, and the app
        tells you when it does.
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
      <p style={body}><strong>Why did my old Flyer Creator page disappear?</strong><br />
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
