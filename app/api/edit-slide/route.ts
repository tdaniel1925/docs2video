import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { CREDIT_COSTS } from '../../_lib/credits'
import { runCharged } from '../../_lib/credit-charge'
import { rateLimit, getRateLimitKey, LIMITS } from '../../_lib/rate-limit'
import { fetchOurStorageImage, isOurStorageUrl } from '../../_lib/our-storage-image'

export const runtime = 'nodejs'
export const maxDuration = 120

const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview'

let _genai: GoogleGenAI | null = null
function getGenai() {
  if (!_genai) _genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
  return _genai
}

/**
 * POST /api/edit-slide — the older scene editor's per-slide AI edit
 * ("Edit" → type a change → Apply).
 *
 * Body: { videoId, sceneIndex, slideUrl, editInstruction }
 * Returns: { image: <public storage URL of the edited slide> }
 *
 * Fixed 2026-10-07 (found in overhaul phase 4):
 *  - it used to pass the slide's WEB ADDRESS to Gemini as if it were the
 *    picture's bytes, so every edit failed. The picture is now downloaded
 *    here — only from our own storage (no fetching addresses a user makes
 *    up) — and sent as real image data;
 *  - it used to be free. It now costs CREDIT_COSTS['scene-edit'] (one image
 *    edit), taken before the AI call and given back if anything fails;
 *  - it used to return the new picture as a huge data: URL, which then went
 *    back up in the Save & Regenerate request. The result is now saved to
 *    storage and its address returned.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = rateLimit(getRateLimitKey(user.id, 'generation'), LIMITS.generation.limit, LIMITS.generation.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
  }

  let body: { videoId?: unknown; sceneIndex?: unknown; slideUrl?: unknown; editInstruction?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const videoId = typeof body.videoId === 'string' ? body.videoId : ''
  const sceneIndex = Number.isInteger(body.sceneIndex) ? (body.sceneIndex as number) : -1
  const slideUrl = typeof body.slideUrl === 'string' ? body.slideUrl : ''
  const editInstruction = typeof body.editInstruction === 'string' ? body.editInstruction.trim().slice(0, 1000) : ''

  if (!videoId || sceneIndex < 0 || !slideUrl || !editInstruction) {
    return NextResponse.json({ error: 'Missing slide picture or edit instruction' }, { status: 400 })
  }
  // Only pictures from our own storage — refused before any download or charge.
  if (!isOurStorageUrl(slideUrl)) {
    return NextResponse.json({ error: 'That slide picture can’t be edited here.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: video } = await admin.from('videos').select('id').eq('id', videoId).eq('user_id', user.id).single()
  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 })

  // Download first: a broken picture link is not worth a charge-and-refund.
  let picture: Awaited<ReturnType<typeof fetchOurStorageImage>>
  try {
    picture = await fetchOurStorageImage(slideUrl)
  } catch (err) {
    console.error('[edit-slide] could not read slide picture:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'We couldn’t read that slide picture. Please try again.' }, { status: 502 })
  }

  // Charge before the AI call; runCharged gives the credits back if anything
  // below throws or answers with an error.
  return runCharged(
    { userId: user.id, amount: CREDIT_COSTS['scene-edit'], action: 'scene-edit', description: 'Edit one slide picture' },
    async () => {
      const response = await getGenai().models.generateContent({
        model: IMAGE_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Here is an existing presentation slide. Make the following change and return the modified slide:

EDIT INSTRUCTION: ${editInstruction}

RULES:
- Keep everything else EXACTLY the same — same layout, same data, same colors, same style
- Only modify what was specifically requested
- Output must be EXACTLY 1920x1080 pixels, 16:9 landscape
- DO NOT add any logos, brand marks, or human faces
- Maintain all text content that wasn't asked to change`,
              },
              { inlineData: { mimeType: picture.mimeType, data: picture.data.toString('base64') } },
            ],
          },
        ],
        config: {
          responseFormat: { image: { aspectRatio: '16:9', imageSize: '4K' } },
        } as any,
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []
      const out = parts.find((p) => p.inlineData?.data)?.inlineData
      if (!out?.data) {
        return NextResponse.json({ error: 'The AI did not return a new slide. Your credits were returned — try wording it differently.' }, { status: 502 })
      }

      const contentType = out.mimeType || 'image/png'
      const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png'
      const path = `${user.id}/${videoId}/edits/slide_${sceneIndex}_${Date.now()}.${ext}`
      const { error: upErr } = await admin.storage.from('videos').upload(path, Buffer.from(out.data, 'base64'), { contentType, upsert: false })
      if (upErr) {
        console.error('[edit-slide] upload failed:', upErr.message)
        return NextResponse.json({ error: 'We couldn’t save the new slide. Your credits were returned.' }, { status: 500 })
      }
      const { data: pub } = admin.storage.from('videos').getPublicUrl(path)
      return NextResponse.json({ image: pub.publicUrl, charged: CREDIT_COSTS['scene-edit'] })
    },
  )
}
