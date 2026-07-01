import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '../../../../../_lib/supabase/admin'
import { generateScript } from '../../../../../_lib/script-generator'
import { generateSlide } from '../../../../../_lib/gemini'
import { compositeSlide } from '../../../../../_lib/composite'
import { synthesizeSpeech } from '../../../../../_lib/tts'
import type { ExtractedData } from '../../../../../_lib/extract-types'
import { requireAdmin } from '../../../../../_lib/admin'
import { videoServiceUrl } from '../../../../../_lib/video-service'

export const runtime = 'nodejs'
export const maxDuration = 800

const VIDEO_ASSEMBLY_URL = videoServiceUrl()
// No committed fallback secret (review S1) — an unset env now fails the VPS
// call loudly instead of silently using a publicly-known value.
const VIDEO_ASSEMBLY_SECRET = (process.env.VIDEO_ASSEMBLY_SECRET || '').trim().replace(/[\r\n]/g, '')

function buildCampaignPrompt(contact: { name: string; company?: string; industry?: string }, campaign: { discount_code: string; discount_pct: number; discount_months: number }): string {
  return `You are creating a 60-second personalized marketing video for a prospective customer.

PROSPECT INFO:
- Name: ${contact.name}
- Company: ${contact.company || 'their company'}
- Industry: ${contact.industry || 'their industry'}

PRODUCT: Docs2Video — turns any document into narrated explainer videos, slide decks, and infographics using AI.

DISCOUNT OFFER: ${campaign.discount_pct}% off for ${campaign.discount_months} months, code: ${campaign.discount_code}

BEAT STRUCTURE:
1. HOOK: "Hi ${contact.name}. We built something for ${contact.industry || 'professionals'} like you at ${contact.company || 'your company'}."
2. PROBLEM: Address a pain point specific to their industry (documents nobody reads, complex reports, client confusion)
3. SOLUTION: Docs2Video does it in minutes — upload any document, get a narrated branded video
4. PROOF: Mention industry-specific use cases
5. OFFER: "We're offering ${contact.company || 'you'} an exclusive ${campaign.discount_pct}% discount for ${campaign.discount_months} months. Use code ${campaign.discount_code}."
6. CTA: "Your first 2 videos are free. Click below to get started."

Keep it under 90 seconds total. Warm, professional, personalized tone.`
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch campaign
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Fetch pending contacts
  const { data: contacts } = await admin
    .from('campaign_contacts')
    .select('*')
    .eq('campaign_id', id)
    .eq('video_status', 'pending')

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No pending contacts to generate videos for' }, { status: 400 })
  }

  // Run the per-contact generation in the BACKGROUND so the request returns
  // immediately; the UI polls campaign detail for live per-contact status.
  // Each contact's linked video already writes progress_pct/progress_detail.
  waitUntil(generateAll(admin, user.id, campaign, contacts))
  return NextResponse.json({ success: true, started: contacts.length })
}

async function generateAll(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  campaign: any,
  contacts: any[],
) {
  for (const contact of contacts) {
    try {
      // Mark as generating
      await admin.from('campaign_contacts').update({ video_status: 'generating' }).eq('id', contact.id)

      // Create video record
      const { data: video, error: videoErr } = await admin
        .from('videos')
        .insert({
          user_id: userId,
          title: `Campaign: ${contact.name} at ${contact.company || 'Prospect'}`,
          voice_id: 'nova',
          status: 'pending',
          is_trial: false,
        })
        .select()
        .single()

      if (videoErr || !video) throw new Error(videoErr?.message || 'Failed to create video record')

      // Link video to contact
      await admin.from('campaign_contacts').update({ video_id: video.id }).eq('id', contact.id)

      // Build campaign-specific prompt as ExtractedData
      const campaignPrompt = buildCampaignPrompt(contact, campaign)
      const policyData: ExtractedData = {
        title: `Personalized Video for ${contact.name}`,
        subtitle: null,
        source: null,
        keyMetrics: [],
        sections: [
          {
            title: 'Campaign Video',
            content: campaignPrompt,
          },
        ],
        bulletPoints: [],
        additionalNotes: [],
      }

      // Generate script
      await admin.from('videos').update({ status: 'scripting', progress_detail: 'Writing personalized script...', progress_pct: 5 }).eq('id', video.id)

      const colors = { primary: '#1B365D', secondary: '#4A90D9', accent: '#FFB347', background: '#0a1628', text: '#FFFFFF' }
      const scenes = await generateScript(policyData, 'Docs2Video', colors, false)
      await admin.from('videos').update({ script: scenes, status: 'generating_audio', progress_pct: 15 }).eq('id', video.id)

      // Generate audio
      const audioBuffers: Buffer[] = []
      for (let i = 0; i < scenes.length; i++) {
        const buf = await synthesizeSpeech(scenes[i].narration, 'nova')
        audioBuffers.push(buf)
      }
      await admin.from('videos').update({ status: 'generating_slides', progress_pct: 35 }).eq('id', video.id)

      // Generate slides using 'luxury' style (mapped to 'black-label' which is the luxury style)
      const slideBuffers: Buffer[] = []
      const effectiveStyleId = 'black-label'

      // Generate slide 1 first for consistency
      let buf0 = await generateSlide(
        policyData, 0, effectiveStyleId as any,
        'Docs2Video', null, colors,
        scenes[0].slidePrompt, false, {},
        null, undefined, scenes.length
      )
      buf0 = await compositeSlide(buf0, null, null, true, scenes.length === 1, null, 'Docs2Video', colors.primary, {})
      slideBuffers.push(buf0)

      // Generate remaining slides
      for (let i = 1; i < scenes.length; i++) {
        let buf = await generateSlide(
          policyData, i, effectiveStyleId as any,
          'Docs2Video', null, colors,
          scenes[i].slidePrompt, false, {},
          null, [slideBuffers[0]], scenes.length
        )
        buf = await compositeSlide(buf, null, null, false, i === scenes.length - 1, null, 'Docs2Video', colors.primary, {})
        slideBuffers.push(buf)
      }

      await admin.from('videos').update({ status: 'assembling', progress_pct: 75 }).eq('id', video.id)

      // Assemble video via VPS
      const http = await import('http')
      const vpsUrl = new URL(`${VIDEO_ASSEMBLY_URL}/assemble`)
      const bodyStr = JSON.stringify({
        slides: slideBuffers.map(b => b.toString('base64')),
        audios: audioBuffers.map(b => b.toString('base64')),
        videoId: video.id,
        userId: userId,
      })

      const vpsResult = await new Promise<{ ok: boolean; status: number; data: any }>((resolve, reject) => {
        const req = http.request({
          hostname: vpsUrl.hostname,
          port: parseInt(vpsUrl.port || '4000'),
          path: vpsUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': VIDEO_ASSEMBLY_SECRET,
            'Content-Length': Buffer.byteLength(bodyStr),
          },
          timeout: 660000,
        }, (res) => {
          let data = ''
          res.on('data', (chunk: string) => { data += chunk })
          res.on('end', () => {
            try {
              resolve({ ok: res.statusCode === 200, status: res.statusCode ?? 500, data: JSON.parse(data) })
            } catch {
              resolve({ ok: false, status: res.statusCode ?? 500, data: { error: data } })
            }
          })
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('VPS timeout')) })
        req.write(bodyStr)
        req.end()
      })

      if (!vpsResult.ok) throw new Error(vpsResult.data?.error || `VPS returned ${vpsResult.status}`)

      const assemblyResult = vpsResult.data as { videoUrl: string; thumbnailUrl: string; totalDuration: number }

      // Upload slides
      const slideUrls: string[] = []
      for (let i = 0; i < slideBuffers.length; i++) {
        const slidePath = `${userId}/${video.id}/slide_${i}.png`
        await admin.storage.from('videos').upload(slidePath, slideBuffers[i], { contentType: 'image/png', upsert: true })
        const { data: slideUrl } = admin.storage.from('videos').getPublicUrl(slidePath)
        slideUrls.push(slideUrl.publicUrl)
      }

      // Update video as completed
      await admin.from('videos').update({
        video_url: assemblyResult.videoUrl,
        thumbnail_url: assemblyResult.thumbnailUrl,
        duration: assemblyResult.totalDuration,
        status: 'completed',
        slide_urls: slideUrls,
        progress_pct: 100,
        progress_detail: null,
      }).eq('id', video.id)

      // Mark contact as ready for review
      await admin.from('campaign_contacts').update({ video_status: 'review' }).eq('id', contact.id)

    } catch (err) {
      console.error(`[campaign-generate] Error for contact ${contact.id}:`, err)
      // Mark FAILED (not back to pending) so the row is visible + retryable.
      await admin.from('campaign_contacts').update({ video_status: 'failed' }).eq('id', contact.id)
    }
  }
}
