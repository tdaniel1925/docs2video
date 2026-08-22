import { NextResponse } from 'next/server'
import OpenAI, { toFile } from 'openai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits, addTopupCredits, costForUser } from '../../_lib/credits'

// =============================================================================
// Change ONE PART of a finished design.
//
// Until now a design was a dead image. If it came back 90% right — good layout,
// good lettering, wrong sandwich — the only move was to redraw the whole thing
// and hope, which costs another full design and risks losing the parts that
// were already good. That is where people gave up and opened Canva.
//
// The image API accepts a MASK: the picture, plus a second image marking which
// region may be repainted. Everything outside that region comes back untouched,
// pixel for pixel. So "circle the burger, say add lettuce" is not a stretch —
// it is what the endpoint is for.
//
// Charged as one design, because that is exactly what it costs us.
// =============================================================================

export const runtime = 'nodejs'
export const maxDuration = 300

let _ai: OpenAI | null = null
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' }))
const MODEL = process.env.FLYER_IMAGE_MODEL || 'gpt-image-2'

/**
 * Is this instruction really about changing WORDS?
 *
 * Paint-editing repaints a region as a fresh picture — it cannot reliably edit
 * letters, and when pushed to, it invents imagery to fill the space. A text
 * change belongs in the chat (retype + Make redraws the design). We catch the
 * common ways people phrase a wording change and bounce them to that path.
 */
function looksLikeTextChange(s: string): boolean {
  const t = s.toLowerCase()
  // Direct mentions of text/wording/spelling.
  if (/\b(text|word|words|wording|spelling|spelled|headline|caption|title|says?|say|type|font|letter|letters|phrase|sentence|copy)\b/.test(t)) return true
  // "change X to Y" / "replace X with Y" / "make it say Y" patterns.
  if (/\b(change|replace|swap|rename|edit|update|correct|fix)\b.*\b(to|with|into|for|say)\b/.test(t)) return true
  if (/\bmake it (say|read)\b/.test(t)) return true
  // Quoted words are almost always literal copy to place.
  if (/["'“”].+["'“”]/.test(s)) return true
  return false
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    /** Which saved design to edit. */
    designId?: string
    /**
     * The region to repaint, as a PNG data URL the same shape as the design:
     * OPAQUE where the picture must stay, TRANSPARENT where it may be redrawn.
     * That is the API's convention and it is the opposite of what most people
     * assume, which is why the browser side builds it explicitly rather than
     * sending whatever the brush happened to draw.
     */
    maskDataUrl?: string
    /** What to do inside that region. */
    instruction?: string
    /**
     * PLACE-AN-IMAGE MODE (no AI). A logo or QR code to paste onto the finished
     * design at an exact spot — the AI never touches it, so a QR still scans.
     * x/y/w are fractions (0–1) of the design: where the top-left goes and how
     * wide it is. role decides the treatment (a QR gets a white quiet-zone).
     */
    overlayDataUrl?: string
    overlayRole?: 'logo' | 'qr'
    x?: number
    y?: number
    w?: number
  } | null

  const designId = String(body?.designId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(designId)) return NextResponse.json({ error: 'Which design?' }, { status: 400 })

  // Two modes: paste an image (logo/QR) at a spot, or paint-and-repaint a region.
  const overlay = String(body?.overlayDataUrl ?? '')
  const isOverlay = overlay.startsWith('data:image')

  const instruction = String(body?.instruction ?? '').trim().slice(0, 400)
  const mask = String(body?.maskDataUrl ?? '')

  if (!isOverlay) {
    if (!instruction) return NextResponse.json({ error: 'Say what to change in that area.' }, { status: 400 })
    if (!mask.startsWith('data:image')) return NextResponse.json({ error: 'Draw over the part you want changed first.' }, { status: 400 })

    // PAINTING IS FOR PICTURES, NOT WORDS.
    //
    // The image editor repaints the masked hole from scratch. Ask it to "change
    // the word 'working' to something else" and it does not edit letters — it
    // invents whatever fills the space (a customer asked to swap a word and got
    // a yoga-class flyer and a sticky note painted onto the wall). Changing text
    // reliably means re-drawing the design with the new words, which is what the
    // chat + Make does. So we catch a text-change instruction here and send the
    // person to the right tool instead of charging them for garbage.
    if (looksLikeTextChange(instruction)) {
      return NextResponse.json({
        error: 'Painting can\'t change words — it only edits pictures, and text always comes out garbled. To fix the wording: close this window, type the new words in the chat on the right (for example: change the headline to "…"), and press Make. Your design is redrawn with the new text, clean and sharp.',
        code: 'use_chat_for_text',
      }, { status: 422 })
    }
  }

  const admin = createAdminClient()

  // OWNERSHIP THROUGH THE ROUND, not just the design id. Without the join a
  // guessed id would let anyone repaint — and re-download — somebody else's
  // work, which may carry a real client's name and phone number.
  const { data: design } = await admin
    .from('flyer_designs')
    .select('id, round_id, size_id, label, width, height, image_path, flyer_rounds!inner(user_id)')
    .eq('id', designId)
    .eq('flyer_rounds.user_id', user.id)
    .maybeSingle()

  if (!design) return NextResponse.json({ error: 'That design is not yours, or no longer exists.' }, { status: 404 })

  const unit = costForUser('flyer', user.id)
  const check = await checkCredits(user.id, unit)
  if (!check.allowed) {
    return NextResponse.json({
      error: `Not enough credits. A change costs ${unit.toLocaleString()} and you have ${check.remaining.toLocaleString()}.`,
      needed: unit, remaining: check.remaining,
    }, { status: 402 })
  }
  await deductCredits(user.id, unit, 'flyer', undefined, 'Changed part of a design')

  // One key per attempt, so a retry after a genuine failure is not swallowed
  // as a duplicate of the first refund.
  const started = Date.now()
  const refund = async () => {
    try {
      await addTopupCredits(user.id, unit, `refund:flyer-edit:${designId}`, {
        idempotencyKey: `refund:flyer-edit:${designId}:${started}`,
      })
    } catch (e) {
      console.error(`[flyer-edit] REFUND FAILED user=${user.id} design=${designId}`, e)
    }
  }

  try {
    const sharp = (await import('sharp')).default

    const { data: file, error: dlErr } = await admin.storage.from('creation-assets').download(design.image_path)
    if (dlErr || !file) { await refund(); return NextResponse.json({ error: 'Could not read that design.' }, { status: 500 }) }
    const original = Buffer.from(await file.arrayBuffer())

    const meta = await sharp(original).metadata()
    const w = meta.width ?? 1024, h = meta.height ?? 1024

    // ── PLACE-AN-IMAGE MODE (logo / QR) — pixel-exact paste, no AI ──
    if (isOverlay) {
      const role = body?.overlayRole === 'qr' ? 'qr' : 'logo'
      // Clamp the position/size to sane bounds (fractions of the design).
      const fx = Math.min(0.98, Math.max(0, Number(body?.x ?? 0.5)))
      const fy = Math.min(0.98, Math.max(0, Number(body?.y ?? 0.5)))
      const fw = Math.min(0.6, Math.max(0.05, Number(body?.w ?? 0.18)))
      const boxW = Math.round(w * fw)
      const raw = Buffer.from(overlay.split(',')[1] ?? '', 'base64')

      let tile: Buffer
      if (role === 'qr') {
        // white quiet-zone + crisp (nearest) resize, like the generate path
        const pad = Math.round(boxW * 0.08)
        const qr = await sharp(raw).resize(boxW - pad * 2, boxW - pad * 2, { fit: 'contain', background: '#fff', kernel: 'nearest' }).png().toBuffer()
        tile = await sharp({ create: { width: boxW, height: boxW, channels: 4, background: '#ffffff' } })
          .composite([{ input: qr, gravity: 'centre' }]).png().toBuffer()
      } else {
        // a logo keeps its own aspect, transparent background preserved
        tile = await sharp(raw).resize(boxW, null, { fit: 'inside' }).png().toBuffer()
      }
      const tMeta = await sharp(tile).metadata()
      const left = Math.min(w - (tMeta.width ?? boxW), Math.max(0, Math.round(w * fx)))
      const top = Math.min(h - (tMeta.height ?? boxW), Math.max(0, Math.round(h * fy)))

      const placed = await sharp(original)
        .composite([{ input: tile, top, left }])
        .withMetadata({ density: meta.density ?? 72 })
        .png()
        .toBuffer()

      const path = `${user.id}/flyer/${crypto.randomUUID()}.png`
      await admin.storage.from('creation-assets').upload(path, placed, { contentType: 'image/png', upsert: true })
      const { data: row } = await admin.from('flyer_designs').insert({
        round_id: design.round_id, user_id: user.id,
        size_id: design.size_id, label: design.label,
        width: design.width, height: design.height,
        image_path: path, credits_used: unit,
      }).select('id').maybeSingle()

      return NextResponse.json({
        designId: row?.id ?? null,
        png: `data:image/png;base64,${placed.toString('base64')}`,
      })
    }

    // THE API ONLY ACCEPTS THREE EDIT SIZES. images.edit rejects arbitrary
    // dimensions — only 1024x1024, 1024x1536 (portrait) or 1536x1024 (landscape).
    // A 1640x624 Facebook cover sent as "1640x624" was silently refused, which
    // showed up to the customer as "try a larger area" — nothing they could act
    // on, and the real reason a spot-edit on any non-square design always failed.
    // So: pick the supported size whose SHAPE is closest, send the image + mask
    // stretched to exactly that, then scale the result back to the true size.
    const editSize: '1024x1024' | '1024x1536' | '1536x1024' =
      w / h > 1.2 ? '1536x1024' : h / w > 1.2 ? '1024x1536' : '1024x1024'
    const [ew, eh] = editSize.split('x').map(Number)

    const imageForEdit = await sharp(original).resize(ew, eh, { fit: 'fill' }).png().toBuffer()

    // THE MASK MUST MATCH WHAT WE SEND. The browser draws over the small on-screen
    // preview; resize the mask to the same edit size as the image, not the design's
    // true pixels (that mismatch is what the API rejected).
    const maskPng = await sharp(Buffer.from(mask.split(',')[1] ?? '', 'base64'))
      .resize(ew, eh, { fit: 'fill' })
      .png()
      .toBuffer()

    const res = await ai().images.edit({
      model: MODEL,
      prompt:
        `Make a small, local, photorealistic edit to ONLY the masked area: ${instruction}\n\n` +
        'Everything outside the masked area must stay exactly as it is — same layout, same lettering, same colours. ' +
        'Blend the change into its surroundings so the edit is invisible: matching light, matching shadow, matching grain and style. ' +
        'The edit must be a natural continuation of what is already there in that spot. ' +
        'DO NOT invent or add any new objects, posters, flyers, signs, notes, stickers, labels, logos, cards, screens or artwork. ' +
        'DO NOT add, move, respell or restyle any text or lettering anywhere in the image. ' +
        'If the instruction cannot be done as a subtle photographic change to the masked spot, leave that area unchanged rather than inventing something to fill it.',
      image: await toFile(imageForEdit, 'design.png', { type: 'image/png' }),
      mask: await toFile(maskPng, 'mask.png', { type: 'image/png' }),
      size: editSize,
      quality: 'high',
      n: 1,
    })

    const b64 = res.data?.[0]?.b64_json
    if (!b64) { await refund(); return NextResponse.json({ error: 'Nothing came back — you were not charged.' }, { status: 502 }) }

    const edited = await sharp(Buffer.from(b64, 'base64'))
      .resize(meta.width, meta.height, { fit: 'fill' })
      .withMetadata({ density: meta.density ?? 72 })
      .png()
      .toBuffer()

    // SAVED AS A NEW DESIGN, never over the top of the old one. The change may
    // be worse, and a customer who cannot go back to what they had would rather
    // we had not offered the button.
    const path = `${user.id}/flyer/${crypto.randomUUID()}.png`
    await admin.storage.from('creation-assets').upload(path, edited, { contentType: 'image/png', upsert: true })

    const { data: row } = await admin.from('flyer_designs').insert({
      round_id: design.round_id, user_id: user.id,
      size_id: design.size_id, label: design.label,
      width: design.width, height: design.height,
      image_path: path, credits_used: unit,
    }).select('id').maybeSingle()

    return NextResponse.json({
      designId: row?.id ?? null,
      png: `data:image/png;base64,${edited.toString('base64')}`,
    })
  } catch (e) {
    await refund()
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[flyer-edit]', msg)
    return NextResponse.json(
      { error: 'That change could not be made — you were not charged. Try drawing a slightly larger area.' },
      { status: 502 },
    )
  }
}
