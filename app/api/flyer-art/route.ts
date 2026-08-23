import { NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, addTopupCredits, costForUser } from '../../_lib/credits'
import { FLYER_TEMPLATES, FLYER_SIZES, flyerPrompt, apiSize, printPixels, canBleed, dpiFor } from '../../_lib/flyer-engine'
import { upscaleForPrint } from '../../_lib/upscale'
import { pickEngine, drawChecked, checkWords } from '../../_lib/image-engine'
import type { FlyerFields, PhotoRole } from '../../_lib/flyer-engine'

// =============================================================================
// Generate complete flyers — artwork AND lettering — at every ticked size.
//
// Each size is generated at ITS OWN aspect ratio — the API takes any dimensions
// divisible by 16 up to 3:1, so nothing is cropped. Only a 4:1 LinkedIn strip
// falls outside that and is composed as a band inside 3:1, then trimmed 12%.

//
// EACH SIZE IS ITS OWN GENERATION, not one image stretched. A portrait poster
// squashed into a 1500x500 header is unusable; asking for a banner gets a
// banner composition. They are siblings in the same style rather than clones.
//
// Sizes run in parallel. Six sequential image calls is several minutes, and
// nobody waits that long watching a spinner.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 300

let _ai: OpenAI | null = null
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' }))
const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    templateId?: string
    sizeIds?: string[]
    fields?: FlyerFields
    /** Extra art direction typed by the user, appended verbatim. */
    note?: string
    /** What the design should picture, in the customer's words. Outranks the
     *  style's own motif — that is the entire point of splitting the two. */
    subject?: string
    /** Keep the style's own props (the pumpkins, the disco ball) as well. */
    keepMotif?: boolean
    /** The customer's own photographs, as data URLs, with what each one is. */
    photos?: { dataUrl: string; role: PhotoRole }[]
    /** A design to copy the LOOK of. Mutually exclusive with a template style —
     *  both are an art direction, and two at once produce a muddle of neither. */
    referenceDataUrl?: string
    /**
     * Whose brand this is for. The colours, the logo and the contact details
     * are then applied to every design — which is the only way a small business
     * gets a consistent look, and the reason to come back next month rather
     * than start from nothing again.
     */
    brandId?: string
    /**
     * Generate printed pieces oversize, for a commercial printer to trim into.
     * Off means exact size, which is what you want for printing at home or for
     * anything that stays on a screen.
     */
    bleed?: boolean
    /** Which press of Make this belongs to, so the history groups correctly.
     *  Minted by the browser: the page fires one request per size and they all
     *  have to land in the same round. */
    roundId?: string
    /** Which project chat this belongs to. Minted by the browser. */
    chatId?: string
    /**
     * DECK RESTYLE ONLY. A deck makes many designs at the SAME size
     * (slide-16x9), so the storage path and the saved row can't be keyed by
     * size.id — every slide would overwrite the last. When present, slotId
     * replaces size.id as the unique key for THIS design (e.g. "slide-3"), and
     * slotLabel replaces the size label (e.g. "Slide 3"). Only meaningful with a
     * single sizeId. The normal (non-deck) path never sends these and is
     * unchanged.
     */
    slotId?: string
    slotLabel?: string
    /** The conversation as it stood when Make was pressed. Stored once per
     *  round so reopening the page reads like the conversation it was. */
    messages?: { role: string; text: string }[]
  } | null

  const template = FLYER_TEMPLATES.find((t) => t.id === body?.templateId) ?? FLYER_TEMPLATES[0]
  const sizes = (body?.sizeIds ?? []).map((id) => FLYER_SIZES.find((s) => s.id === id)).filter(Boolean) as typeof FLYER_SIZES
  if (!sizes.length) return NextResponse.json({ error: 'Tick at least one size' }, { status: 400 })
  if (sizes.length > 8) return NextResponse.json({ error: 'Up to 8 sizes at a time' }, { status: 400 })

  const fields = body?.fields ?? {}
  const note = String(body?.note ?? '').trim().slice(0, 400)
  /**
   * What the customer wants pictured. Falls back to their free-typed note,
   * which is where they have always said it — "make it an HVAC van" was
   * already being sent, it was just being read last.
   */
  const subject = String(body?.subject ?? '').trim().slice(0, 300) || note
  /** Keep the style's own props. Off unless asked for. */
  const keepMotif = Boolean(body?.keepMotif)

  // WHAT THIS COSTS. Charged per design, because each one is a separate
  // generation with its own real cost — ticking four sizes is four designs.
  // This whole feature used to be free, which was not a pricing decision so
  // much as an oversight.
  const unit = costForUser('flyer', user.id)
  const check = await checkCredits(user.id, unit * sizes.length)
  if (!check.allowed) {
    return NextResponse.json({
      error: `Not enough credits. ${sizes.length} design${sizes.length === 1 ? '' : 's'} costs ${(unit * sizes.length).toLocaleString()} credits and you have ${check.remaining.toLocaleString()}.`,
      needed: unit * sizes.length, remaining: check.remaining, unit,
    }, { status: 402 })
  }

  // The round groups every size from one press of Make. The browser mints the
  // id so the parallel requests agree on it; ownership is checked here so a
  // guessed id cannot attach designs to somebody else's history.
  const admin = createAdminClient()
  // Deck-restyle overrides (see the type). Sanitised: slotId is used in a
  // storage path and a db key, so keep it to safe chars.
  const slotId = String(body?.slotId ?? '').trim().replace(/[^a-z0-9-]/gi, '').slice(0, 40) || null
  const slotLabel = String(body?.slotLabel ?? '').trim().slice(0, 80) || null
  let roundId = /^[0-9a-f-]{36}$/i.test(String(body?.roundId ?? '')) ? String(body!.roundId) : null
  if (roundId) {
    const { data: existing } = await admin
      .from('flyer_rounds').select('user_id').eq('id', roundId).maybeSingle()
    if (existing && existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not your design' }, { status: 403 })
    }
    if (!existing) {
      // The chat this round belongs to. Created on first use and titled from
      // whatever was asked for, so the sidebar reads like the work rather than
      // "Chat 3". Ownership is checked for the same reason the round is: a
      // guessed id must not attach work to somebody else's sidebar.
      const chatId = /^[0-9a-f-]{36}$/i.test(String(body?.chatId ?? '')) ? String(body!.chatId) : null
      let chatOk = false
      if (chatId) {
        const { data: chat } = await admin
          .from('flyer_chats').select('user_id').eq('id', chatId).maybeSingle()
        if (chat && chat.user_id !== user.id) {
          return NextResponse.json({ error: 'Not your chat' }, { status: 403 })
        }
        const title = (fields.headline || note || 'New chat').toString().slice(0, 80)
        const { error: chatErr } = chat
          ? await admin.from('flyer_chats')
              .update({ updated_at: new Date().toISOString() }).eq('id', chatId)
          : await admin.from('flyer_chats')
              .insert({ id: chatId, user_id: user.id, title })
        chatOk = !chatErr
        if (chatErr) console.error('[flyer] chat not recorded:', chatErr.message)
      }

      const { error: roundErr } = await admin.from('flyer_rounds').insert({
        id: roundId, user_id: user.id, template_id: template.id,
        fields, note: note || null,
        messages: (body?.messages ?? []).slice(-40),
        ...(chatOk && chatId ? { chat_id: chatId } : {}),
      })
      // If the round cannot be recorded — most likely because the migration
      // has not been run on this environment — generate anyway but skip the
      // whole save path. Uploading files that nothing will ever reference just
      // fills the bucket with rubbish.
      if (roundErr) {
        console.error('[flyer] history unavailable, generating without saving:', roundErr.message)
        roundId = null
      }
    }
  }

  /**
   * The customer's brand, if this job belongs to one.
   *
   * Scoped by user_id as well as id. RLS already enforces ownership, but a
   * guessed id must return nothing rather than somebody else's colours and
   * logo — and a logo is the one asset here that is genuinely theirs.
   */
  type BrandBits = {
    name: string | null
    primary_color: string | null
    secondary_color: string | null
    accent_color: string | null
    logo_url: string | null
    logo_light_url: string | null
    fonts: string[] | null
    tone: string | null
  }
  let brand: BrandBits | null = null
  if (/^[0-9a-f-]{36}$/i.test(String(body?.brandId ?? ''))) {
    const { data } = await admin
      .from('brands')
      .select('name, primary_color, secondary_color, accent_color, logo_url, logo_light_url, fonts, tone')
      .eq('id', body!.brandId)
      .eq('user_id', user.id)
      .maybeSingle()
    brand = (data as BrandBits) ?? null
  }

  // No saved brand, but colours were read off a website the user pointed at in
  // the chat? Tint the design with those. Validated hex only, so nothing weird
  // reaches the prompt. Name/fonts/tone stay empty — this is a palette, not a
  // full brand kit.
  if (!brand && Array.isArray((body as { brandColors?: unknown })?.brandColors)) {
    const hexes = ((body as { brandColors?: unknown[] }).brandColors ?? [])
      .map((c) => String(c))
      .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
      .slice(0, 3)
    if (hexes.length) {
      brand = {
        name: null, primary_color: hexes[0], secondary_color: hexes[1] ?? null,
        accent_color: hexes[2] ?? null, logo_url: null, logo_light_url: null, fonts: null, tone: null,
      }
    }
  }

  /**
   * The brand, written as art direction.
   *
   * COLOURS AS A PALETTE, NOT AS A COMMAND. Telling an image model "use
   * #1B4D89" produces a flat block of that exact colour somewhere unhelpful.
   * Naming it as the palette the design is built FROM leaves the model free to
   * shade, tint and contrast, which is what a designer would do with a brand
   * colour anyway.
   */
  const brandDirection = brand
    ? [
        '',
        'BRAND — this design belongs to a real business and must look like the rest of their material:',
        brand.primary_color ? `- Build the palette around ${brand.primary_color} as the dominant colour${brand.secondary_color ? `, with ${brand.secondary_color} supporting it` : ''}${brand.accent_color ? ` and ${brand.accent_color} for accents and call-to-action` : ''}. Shade and tint them freely; do not paint flat blocks of the raw hex.`
          : '',
        brand.fonts?.length ? `- Lettering in the spirit of ${brand.fonts.slice(0, 2).join(' and ')}.` : '',
        brand.tone ? `- The tone is ${brand.tone}.` : '',
        // The name is NOT drawn as a logo. Rule of this codebase: real uploaded
        // logos only, never an AI-drawn approximation of a company mark.
        '- Do NOT invent, draw or letter a logo. If a logo is supplied as an image, place it exactly as given.',
      ].filter(Boolean).join('\n')
    : ''

  // The customer's own photographs. Capped at three: past that the model starts
  // dropping one silently, which is worse than refusing a fourth up front.
  const rawPhotos = (body?.photos ?? []).slice(0, 3)

  /**
   * The brand's logo joins the photographs automatically.
   *
   * The whole point of picking a brand is not having to attach the same logo
   * every single time. It goes on the END so it cannot displace a photograph
   * the customer deliberately chose, and only when they have not already
   * attached a logo themselves — theirs wins, always.
   *
   * logo_light_url is the background-removed variant made for exactly this;
   * logo_url is whatever was scraped off their website and may carry its
   * original backdrop.
   */
  const brandLogo = brand?.logo_light_url || brand?.logo_url || null
  const alreadyHasLogo = rawPhotos.some((p) => p.role === 'logo')
  if (brandLogo && !alreadyHasLogo && rawPhotos.length < 3) {
    rawPhotos.push({ dataUrl: brandLogo, role: 'logo' as PhotoRole })
  }

  // DECK BODY SLIDES — keep the logo in ONE corner, every slide identical.
  //
  // A deck is many independent image calls. When the logo is handed to the
  // image model on each one, the model puts it somewhere different every time —
  // the exact complaint ("the logo appeared all over the place on inside
  // pages"). So for a deck's body slides the caller sends logoPlacement:'corner'.
  // We then DON'T show the logo to the model at all; instead we paste it in code
  // at a fixed top-right spot after the slide renders — same fraction on every
  // slide, so it can't wander. Cover/closing slides don't set this and keep the
  // model's hero placement (which the customer liked).
  const logoCorner = (body as { logoPlacement?: string })?.logoPlacement === 'corner'
  const cornerLogoSrc = logoCorner
    ? (rawPhotos.find((p) => p.role === 'logo')?.dataUrl ?? null)
    : null
  // Decode the corner logo ONCE (data URL or stored http URL), not per slide.
  let cornerLogoBuf: Buffer | null = null
  if (cornerLogoSrc) {
    try {
      cornerLogoBuf = cornerLogoSrc.startsWith('http')
        ? Buffer.from(await (await fetch(cornerLogoSrc, { signal: AbortSignal.timeout(15_000) })).arrayBuffer())
        : Buffer.from(cornerLogoSrc.split(',')[1] ?? '', 'base64')
    } catch (e) {
      console.warn('[flyer] corner logo could not be read:', e instanceof Error ? e.message : e)
    }
  }

  // A QR code is NOT an AI input — it must be pasted pixel-exact afterwards, not
  // handed to the model (which would redraw it into something that won't scan).
  // So it's excluded from the images/roles the model sees; the paste step below
  // reads it straight from rawPhotos. A corner-pasted logo is excluded for the
  // same reason: the model must not draw its own copy of it.
  const aiPhotos = rawPhotos.filter((p) => p.role !== 'qr' && !(logoCorner && p.role === 'logo'))
  const roles = aiPhotos.map((p) => p.role)

  // A reference design, if there is one, goes FIRST — the prompt refers to it
  // as image 1 and numbers the photographs after it.
  const ref = String(body?.referenceDataUrl ?? '')
  const hasReference = ref.startsWith('data:image')
  const toPrepare = hasReference
    ? [{ dataUrl: ref }, ...aiPhotos]
    : aiPhotos

  // Prepare them ONCE, not per size. Every ticked size needs the same files,
  // and re-decoding a 5 MB upload six times is pure waste.
  let files: Awaited<ReturnType<typeof toFile>>[] = []
  // The same pictures again, as raw buffers, because Gemini takes them inline
  // rather than as uploads. Built in the SAME ORDER — the prompt says "Image 1"
  // and "Image 2", and a different order here would apply the "keep this person
  // recognisable" rule to the wrong picture.
  const geminiInputs: { data: Buffer<ArrayBuffer>; mimeType: string }[] = []
  try {
    const sharp = (await import('sharp')).default
    files = await Promise.all(toPrepare.map(async (p, i) => {
      // The customer's uploads arrive as data URLs; a brand logo is a stored
      // URL. Fetching it here rather than making the browser download and
      // re-upload its own logo on every single design.
      const raw = String(p.dataUrl)
      const b64 = raw.startsWith('http')
        ? Buffer.from(await (await fetch(raw, { signal: AbortSignal.timeout(15_000) })).arrayBuffer()).toString('base64')
        : raw.split(',')[1] ?? ''
      // Downscale before sending. A phone photo is 4000px on the long edge and
      // the model gains nothing from it, but the upload cost is real.
      const buf = await sharp(Buffer.from(b64, 'base64'))
        .rotate()                       // honour EXIF, or portraits arrive sideways
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
      // Name the reference for what it is. The order is what the prompt keys
      // off, but a readable filename makes a failed request diagnosable.
      const name = hasReference && i === 0 ? 'reference.png' : `photo-${i + (hasReference ? 0 : 1)}.png`
      geminiInputs[i] = { data: buf as Buffer<ArrayBuffer>, mimeType: 'image/png' }
      return toFile(buf, name, { type: 'image/png' })
    }))
  } catch (err) {
    return NextResponse.json({
      error: 'Could not read one of the photos. Try a JPEG or PNG.',
      detail: err instanceof Error ? err.message.slice(0, 120) : undefined,
    }, { status: 400 })
  }

  const one = async (size: typeof FLYER_SIZES[number]) => {
    // For a deck, many designs share one size, so the UNIQUE key for this design
    // is the slot (slide-3), not the size. Everything that must not collide
    // across designs in the same round keys off `key`; the human name is `lbl`.
    const key = slotId ?? size.id
    const lbl = slotLabel ?? size.label
    const bleed = Boolean(body?.bleed) && canBleed(size)
      // The customer's own words go in as THE SUBJECT, not as a footnote. See
      // the long note on flyerPrompt's `subject` — appending them at the end is
      // what made "change the burger to a radio ad" get quietly ignored.
      const prompt = flyerPrompt(template, fields, size, roles, hasReference, bleed, subject, keepMotif)
        + brandDirection

    // Charge BEFORE generating, refund if it fails — the same order the video
    // pipeline uses. Charging afterwards would let a hammered page run several
    // generations against a balance that only covered one.
    if (!(await deductCredits(user.id, unit, 'flyer', undefined, `Flyer — ${lbl}`))) {
      return { sizeId: key, label: lbl, error: 'Not enough credits' }
    }
    // Put the credits back for THIS design only. Deliberately not
    // refundVideoCredits: that one writes to the videos table and keys off a
    // video id, and passing a non-video key there silently swallows the refund.
    const refund = async () => {
      try {
        await addTopupCredits(user.id, unit, `refund:flyer:${roundId ?? 'adhoc'}:${key}`, {
          action: 'refund_flyer',
          idempotencyKey: `refund:flyer:${roundId ?? Date.now()}:${key}`,
        })
      } catch (e) {
        // A failed refund must be findable later — it is money.
        console.error(`[flyer] REFUND FAILED user=${user.id} slot=${key} amount=${unit}`, e)
      }
    }

    try {
      // Ask for THIS size's own shape. The API takes any dimensions divisible
      // by 16 up to 3:1 and about 4 MP, so almost everything is generated
      // natively and never cropped — see apiSize for the measured limits.
      //
      // With photographs attached the design is EDITED around them instead of
      // generated from nothing, which is what keeps a real face looking like
      // that person rather than a stranger who dresses similarly.
      // WHICH ENGINE. Measured on the same slide and prompt: Gemini is 16x
      // faster (5s against 90s) and 4x cheaper (~4c against ~18c), and the
      // design is just as good. Its one weakness is spelling in small type —
      // so the words are read back off the finished image and it is simply
      // drawn again if they came out wrong. Three Gemini attempts still cost
      // less and finish sooner than one gpt-image-2 attempt.
      //
      // gpt-image-2 keeps the shapes Gemini cannot hold: a rack card at 1:2.4,
      // a 4:1 banner. Squeezing those into the nearest offered shape would cut
      // into a design composed for a different one.
      const target0 = printPixels(size, bleed)
      const { engine, aspect } = pickEngine(target0.w, target0.h)

      // The words that MUST survive. A headline, a price, a phone number —
      // not the decorative text in the background, where a redraw would throw
      // away a good design over something nobody reads.
      const mustSay = [
        fields.headline, fields.subhead, fields.price, fields.date,
        fields.venue, fields.cta, fields.contact,
      ].filter((s): s is string => typeof s === 'string' && s.trim().length > 2)

      let src: Buffer<ArrayBuffer>
      let spellingNote = ''
      /** Words the Gemini path already read back as wrong, so the final check
       *  does not have to pay to read the same image twice. */
      let alreadyMissing: string[] | null = null

      if (engine === 'gemini' && aspect) {
        const drawn = await drawChecked(prompt, aspect, mustSay, geminiInputs)
        src = drawn.image
        alreadyMissing = drawn.spelling.ok ? [] : drawn.spelling.missing
        if (!drawn.spelling.ok) {
          // Say it rather than hide it. A word that came out wrong on a flyer
          // being sent to a printer is exactly the thing worth a second look,
          // and the customer is the only one who can decide it matters.
          spellingNote = `Check the small print — "${drawn.spelling.missing[0]}" may not have come out right.`
          console.warn(`[flyer] ${size.id} kept with misspellings after ${drawn.attempts} attempts: ${drawn.spelling.missing.join(', ')}`)
        }
      } else {
        // With photographs attached the design is EDITED around them instead of
        // generated from nothing, which is what keeps a real face looking like
        // that person rather than a stranger who dresses similarly.
        const res = files.length
          ? await ai().images.edit({
              model: MODEL, prompt, image: files.length === 1 ? files[0] : files,
              size: apiSize(size, bleed).size as '1024x1024', quality: 'high', n: 1,
            })
          : await ai().images.generate({
              model: MODEL, prompt, size: apiSize(size, bleed).size as '1024x1024', quality: 'high', n: 1,
            })
        const b64 = res.data?.[0]?.b64_json
        if (!b64) { await refund(); return { sizeId: key, label: lbl, error: 'no image returned' } }
        src = Buffer.from(b64, 'base64')
      }

      const sharp = (await import('sharp')).default
      // The true finished size, including the bleed margin the printer trims
      // off. printPixels also knows that a yard sign is printed at 150 dpi and
      // a six-foot banner at 72 — asking those for 300 would demand a
      // ten-thousand-pixel file to carry detail nobody can stand close enough
      // to see.
      const targetW = target0.w
      const targetH = target0.h

      // ENLARGE BEFORE SCALING, where the generator could not reach print size.
      // The image API caps out around 4 megapixels; a letter flyer at 300 dpi
      // needs 8.4. Until now the shortfall was covered by stretching, which
      // makes a file that SAYS 300 dpi while the lettering inside is soft.
      // Measured on a real design, the small caps line is visibly furred when
      // stretched and clean when upscaled.
      //
      // Never fatal: a design at its original size is worth far more to the
      // person who paid for it than an error.
      const grown = await upscaleForPrint(src, targetW, targetH)
      if (grown.reason) console.warn(`[flyer] upscale skipped for ${size.id}: ${grown.reason}`)
      src = grown.buffer

      // EVERY SIZE IS ITS OWN ORIGINAL DESIGN, generated at its own aspect
      // ratio. For all but one shape this resize is a pure scale — the aspect
      // already matches, so not a pixel of the design is cut.
      //
      // The exception is the 4:1 LinkedIn strip, which exceeds the API's 3:1
      // limit. That one is composed as a band inside a 3:1 frame, with the
      // prompt naming the band and asking for empty space around it, so the
      // trim takes only the margin it was told to leave.
      // TAG THE RESOLUTION. Without a density in the file, a lot of print
      // software assumes 72 dpi and offers to print an 8.5-inch flyer at 35
      // inches across — the file was always the right number of pixels, it just
      // never said what they meant.
      let png = await sharp(src)
        .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
        .withMetadata({ density: dpiFor(size) })
        .png()
        .toBuffer()

      // PASTE ANY QR CODE EXACTLY — never let the model draw it. A QR that is
      // redrawn or restyled will not scan, so it is composited as crisp pixels
      // onto the FINISHED design (on a white quiet-zone tile, bottom-right),
      // after everything the AI touched is done. Placed at ~16% of the shorter
      // side, which stays scannable in print and on screen.
      const qrPhoto = rawPhotos.find((p) => p.role === 'qr')
      if (qrPhoto?.dataUrl?.startsWith('data:image')) {
        try {
          const qrRaw = Buffer.from(qrPhoto.dataUrl.split(',')[1] ?? '', 'base64')
          const box = Math.round(Math.min(targetW, targetH) * 0.16)
          const pad = Math.round(box * 0.08)
          // nearest-neighbour keeps the QR's hard edges crisp — smoothing would
          // grey the module borders and can break a scan.
          const qrImg = await sharp(qrRaw).resize(box - pad * 2, box - pad * 2, { fit: 'contain', background: '#fff', kernel: 'nearest' }).png().toBuffer()
          // white tile behind the QR = its required quiet zone
          const tile = await sharp({ create: { width: box, height: box, channels: 4, background: '#ffffff' } })
            .composite([{ input: qrImg, gravity: 'centre' }]).png().toBuffer()
          const margin = Math.round(Math.min(targetW, targetH) * 0.04)
          png = await sharp(png).composite([{ input: tile, top: targetH - box - margin, left: targetW - box - margin }]).png().toBuffer()
        } catch (e) {
          console.warn(`[flyer] QR paste skipped for ${key}:`, e instanceof Error ? e.message : e)
        }
      }

      // PASTE A DECK BODY-SLIDE LOGO IN THE SAME CORNER, EVERY TIME.
      //
      // Fixed fractions — width 14% of the long edge, margin 4% of the short
      // edge, top-right — so the logo lands on identical pixels on every body
      // slide of the deck. This is what makes the deck feel like one designed
      // set instead of a shuffle. 'inside' fit keeps the logo's aspect ratio and
      // never enlarges past its box; transparency is preserved.
      if (cornerLogoBuf) {
        try {
          const logoRaw = cornerLogoBuf
          const boxW = Math.round(targetW * 0.14)
          const boxH = Math.round(targetH * 0.14)
          const margin = Math.round(Math.min(targetW, targetH) * 0.04)
          const logoImg = await sharp(logoRaw)
            .resize(boxW, boxH, { fit: 'inside', withoutEnlargement: false })
            .png().toBuffer()
          const meta = await sharp(logoImg).metadata()
          const lw = meta.width ?? boxW
          png = await sharp(png)
            .composite([{ input: logoImg, top: margin, left: targetW - lw - margin }])
            .png().toBuffer()
        } catch (e) {
          console.warn(`[flyer] corner logo paste skipped for ${key}:`, e instanceof Error ? e.message : e)
        }
      }

      /**
       * READ THE WORDS BACK OFF THE FINISHED DESIGN.
       *
       * The AI DRAWS the text. That is the single thing most likely to lose a
       * customer: a flyer printed five hundred times with a mangled phone
       * number is not a bad design, it is a bill — and they will not come back,
       * and they will tell people.
       *
       * So every design is read and compared with what was asked for, whichever
       * engine drew it. This used to run only on the Gemini path, where it was
       * a retry loop; on OpenAI the answer is more useful shown than acted on,
       * because a redraw costs another design and might land somewhere worse.
       *
       * NEVER BLOCKS DELIVERY. An unreadable check means unknown, and unknown
       * must not throw away work somebody paid for.
       */
      const verified = alreadyMissing
        ? { ok: alreadyMissing.length === 0, missing: alreadyMissing }
        : await checkWords(png as Buffer<ArrayBuffer>, mustSay)

      // KEEP IT. Until now a design existed only in the tab that made it —
      // pressing Make again wiped the last batch and a refresh lost the lot.
      // A save failure is logged but does NOT fail the design: the customer
      // paid for an image and it is right there in the response.
      let designId: string | null = null
      if (roundId) {
        try {
          const path = `${user.id}/flyers/${roundId}/${key}.png`
          const { error: upErr } = await admin.storage
            .from('creation-assets')
            .upload(path, png, { contentType: 'image/png', upsert: true })
          if (upErr) throw upErr
          const { data: row } = await admin.from('flyer_designs').insert({
            round_id: roundId, user_id: user.id, size_id: key, label: lbl,
            width: targetW, height: targetH, image_path: path, credits: unit,
          }).select('id').single()
          designId = row?.id ?? null

          // Also list it in the shared library, the way the old flyer wizard
          // did. Without this, everything made before today shows up under My
          // Creations and everything made after it silently does not.
          //
          // The address stored is our own permanent one, NOT a signed link:
          // signed links expire, and a library full of thumbnails that work
          // today and break in a year is worse than none.
          if (designId) {
            const href = `/api/flyer-file/${designId}`
            await admin.from('creations').insert({
              user_id: user.id, type: 'flyer',
              title: `${fields.headline || 'Custom graphic'} — ${lbl}`,
              thumbnail_url: href, file_url: href,
              // What it ACTUALLY cost. Leaving this out let the column's
              // default of 1 stand, so the library reported a 200-credit design
              // as having cost a single credit.
              credits_used: unit,
            })
          }
        } catch (e) {
          console.error(`[flyer] could not save design user=${user.id} size=${size.id}`, e)
        }
      }

      return {
        sizeId: key, label: lbl, w: targetW, h: targetH, designId,
        // What the check found, said plainly. "Every word checked" is worth
        // showing precisely BECAUSE nobody else can say it.
        checked: verified.ok,
        misspelled: verified.ok ? [] : verified.missing.slice(0, 3),
        png: `data:image/png;base64,${png.toString('base64')}`,
      }
    } catch (err) {
      await refund()

      // LOG THE WHOLE THING. Only a 160-character slice ever reached the
      // browser, and nothing at all reached the server log — so when two
      // flyers failed in production there was no way to find out why from
      // either end. The full error goes to the log; the customer gets a
      // sentence they can act on.
      const raw = err instanceof Error ? err.message : String(err)
      console.error(`[flyer] generation failed user=${user.id} size=${size.id} photos=${rawPhotos.length} ref=${hasReference}:`, raw)

      // Turn the common API failures into something a person can do something
      // about. Anything unrecognised is passed through rather than flattened
      // into "failed", which tells nobody anything.
      const lower = raw.toLowerCase()
      const friendly =
        lower.includes('safety') || lower.includes('content_policy') || lower.includes('moderation')
          ? 'The wording or an uploaded photo was refused by the image service. Try rephrasing, or removing the photo.'
        // BILLING BEFORE RATE-LIMIT. "You have no credits remaining" comes back
        // as a 429, so a plain "429 → busy, try again" check catches it first
        // and tells the customer to retry a thing retrying can NEVER fix — which
        // is exactly what happened. A genuine throttle 429 says "rate limit";
        // an out-of-funds 429 says "credits"/"billing"/"quota". Check the money
        // words first so the two 429s don't get confused.
        : lower.includes('billing') || lower.includes('quota') || lower.includes('insufficient_quota')
            || lower.includes('no credits') || lower.includes('credit balance')
          ? 'The image service account is out of credit — this one is on us, not you. We’re on it; nothing was charged to you.'
        : lower.includes('rate limit') || lower.includes('429')
          ? 'The image service is busy right now. Wait a moment and press Make again.'
        : lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econnreset')
          ? 'The image service took too long to answer. Press Make again.'
        : raw.slice(0, 200)

      return { sizeId: key, label: lbl, error: friendly }
    }
  }

  const all = await Promise.all(sizes.map(one))
  const images = all.filter((r) => 'png' in r) as { sizeId: string; label: string; w: number; h: number; png: string; designId: string | null }[]
  const failed = all.filter((r) => 'error' in r) as { label: string; error: string }[]

  if (!images.length) {
    // Say WHY. "Generation failed" sends someone into the code when the answer
    // was a billing state or a content refusal.
    return NextResponse.json({ error: failed[0]?.error || 'Generation failed', failed }, { status: 502 })
  }
  return NextResponse.json({ images, ...(failed.length ? { failed } : {}), model: MODEL, charged: unit * images.length })
}
