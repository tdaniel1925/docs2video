import { NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, addTopupCredits, costForUser } from '../../_lib/credits'
import { FLYER_TEMPLATES, FLYER_SIZES, flyerPrompt, apiSize } from '../../_lib/flyer-engine'
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
    /** The customer's own photographs, as data URLs, with what each one is. */
    photos?: { dataUrl: string; role: PhotoRole }[]
    /** A design to copy the LOOK of. Mutually exclusive with a template style —
     *  both are an art direction, and two at once produce a muddle of neither. */
    referenceDataUrl?: string
    /** Which press of Make this belongs to, so the history groups correctly.
     *  Minted by the browser: the page fires one request per size and they all
     *  have to land in the same round. */
    roundId?: string
    /** Which project chat this belongs to. Minted by the browser. */
    chatId?: string
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

  // The customer's own photographs. Capped at three: past that the model starts
  // dropping one silently, which is worse than refusing a fourth up front.
  const rawPhotos = (body?.photos ?? []).slice(0, 3)
  const roles = rawPhotos.map((p) => p.role)

  // A reference design, if there is one, goes FIRST — the prompt refers to it
  // as image 1 and numbers the photographs after it.
  const ref = String(body?.referenceDataUrl ?? '')
  const hasReference = ref.startsWith('data:image')
  const toPrepare = hasReference
    ? [{ dataUrl: ref }, ...rawPhotos]
    : rawPhotos

  // Prepare them ONCE, not per size. Every ticked size needs the same files,
  // and re-decoding a 5 MB upload six times is pure waste.
  let files: Awaited<ReturnType<typeof toFile>>[] = []
  try {
    const sharp = (await import('sharp')).default
    files = await Promise.all(toPrepare.map(async (p, i) => {
      const b64 = String(p.dataUrl).split(',')[1] ?? ''
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
      return toFile(buf, name, { type: 'image/png' })
    }))
  } catch (err) {
    return NextResponse.json({
      error: 'Could not read one of the photos. Try a JPEG or PNG.',
      detail: err instanceof Error ? err.message.slice(0, 120) : undefined,
    }, { status: 400 })
  }

  const one = async (size: typeof FLYER_SIZES[number]) => {
    const prompt = flyerPrompt(template, fields, size, roles, hasReference) + (note ? `\n\nALSO: ${note}` : '')

    // Charge BEFORE generating, refund if it fails — the same order the video
    // pipeline uses. Charging afterwards would let a hammered page run several
    // generations against a balance that only covered one.
    if (!(await deductCredits(user.id, unit, 'flyer', undefined, `Flyer — ${size.label}`))) {
      return { sizeId: size.id, label: size.label, error: 'Not enough credits' }
    }
    // Put the credits back for THIS design only. Deliberately not
    // refundVideoCredits: that one writes to the videos table and keys off a
    // video id, and passing a non-video key there silently swallows the refund.
    const refund = async () => {
      try {
        await addTopupCredits(user.id, unit, `refund:flyer:${roundId ?? 'adhoc'}:${size.id}`, {
          action: 'refund_flyer',
          idempotencyKey: `refund:flyer:${roundId ?? Date.now()}:${size.id}`,
        })
      } catch (e) {
        // A failed refund must be findable later — it is money.
        console.error(`[flyer] REFUND FAILED user=${user.id} size=${size.id} amount=${unit}`, e)
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
      const res = files.length
        ? await ai().images.edit({
            model: MODEL, prompt, image: files.length === 1 ? files[0] : files,
            size: apiSize(size).size as '1024x1024', quality: 'high', n: 1,
          })
        : await ai().images.generate({
            model: MODEL, prompt, size: apiSize(size).size as '1024x1024', quality: 'high', n: 1,
          })
      const b64 = res.data?.[0]?.b64_json
      if (!b64) { await refund(); return { sizeId: size.id, label: size.label, error: 'no image returned' } }

      const sharp = (await import('sharp')).default
      // Print comes out at 300 dpi — the size the printer asked for, not half
      // of it. The generation is capped by a pixel budget rather than by this,
      // so a big poster is scaled up to its true dimensions.
      const targetW = size.unit === 'in' ? Math.round(size.w * 300) : size.w
      const targetH = size.unit === 'in' ? Math.round(size.h * 300) : size.h
      const src = Buffer.from(b64, 'base64')

      // EVERY SIZE IS ITS OWN ORIGINAL DESIGN, generated at its own aspect
      // ratio. For all but one shape this resize is a pure scale — the aspect
      // already matches, so not a pixel of the design is cut.
      //
      // The exception is the 4:1 LinkedIn strip, which exceeds the API's 3:1
      // limit. That one is composed as a band inside a 3:1 frame, with the
      // prompt naming the band and asking for empty space around it, so the
      // trim takes only the margin it was told to leave.
      const png = await sharp(src)
        .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()

      // KEEP IT. Until now a design existed only in the tab that made it —
      // pressing Make again wiped the last batch and a refresh lost the lot.
      // A save failure is logged but does NOT fail the design: the customer
      // paid for an image and it is right there in the response.
      let designId: string | null = null
      if (roundId) {
        try {
          const path = `${user.id}/flyers/${roundId}/${size.id}.png`
          const { error: upErr } = await admin.storage
            .from('creation-assets')
            .upload(path, png, { contentType: 'image/png', upsert: true })
          if (upErr) throw upErr
          const { data: row } = await admin.from('flyer_designs').insert({
            round_id: roundId, user_id: user.id, size_id: size.id, label: size.label,
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
              title: `${fields.headline || 'Custom graphic'} — ${size.label}`,
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
        sizeId: size.id, label: size.label, w: targetW, h: targetH, designId,
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
        : lower.includes('rate limit') || lower.includes('429')
          ? 'The image service is busy right now. Wait a moment and press Make again.'
        : lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econnreset')
          ? 'The image service took too long to answer. Press Make again.'
        : lower.includes('billing') || lower.includes('quota') || lower.includes('insufficient_quota')
          ? 'The image service account has a billing problem — this one is on us, not you.'
        : raw.slice(0, 200)

      return { sizeId: size.id, label: size.label, error: friendly }
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
