import { NextResponse } from 'next/server'
import { createClient } from '../../_lib/supabase/server'
import { createAdminClient } from '../../_lib/supabase/admin'
import { checkCredits, deductCredits } from '../../_lib/credits'
import { GoogleGenAI } from '@google/genai'
import { createPost, listAccounts, isZernioConfigured, type ZernioPlatform } from '../../_lib/zernio'

export const runtime = 'nodejs'
export const maxDuration = 120

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const PLATFORMS = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'] as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const { action } = body as { action: string }
  const admin = createAdminClient()

  // OWN IT OR YOU CAN'T TOUCH IT. These actions take a campaignId/postId from
  // the request and read/generate/publish through the admin client, which
  // bypasses row-level security — so ownership MUST be checked here by hand.
  // Without this, any logged-in user could read, spend on, or publish another
  // user's campaign just by guessing its id. Returns true only if the campaign
  // belongs to the caller.
  const ownsCampaign = async (campaignId: string): Promise<boolean> => {
    if (!campaignId) return false
    const { data } = await admin.from('social_campaigns').select('user_id').eq('id', campaignId).single()
    return data?.user_id === user.id
  }

  // Generate campaign plan
  if (action === 'generate-plan') {
    const { businessName, businessDescription, goal, platforms, duration, frequency, tone } = body as {
      businessName: string
      businessDescription: string
      goal: string
      platforms: string[]
      duration: '1week' | '2weeks' | '1month'
      frequency: 'daily' | '3xweek' | 'weekly'
      tone: string
    }

    if (!businessName?.trim() || !businessDescription?.trim()) {
      return NextResponse.json({ error: 'Business name and description required' }, { status: 400 })
    }

    const durationDays = duration === '1week' ? 7 : duration === '2weeks' ? 14 : 30
    const postsPerWeek = frequency === 'daily' ? 7 : frequency === '3xweek' ? 3 : 1
    const totalPosts = Math.ceil((durationDays / 7) * postsPerWeek)

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: `You are a social media strategist. Create a content calendar for a social media campaign.

BUSINESS: "${businessName}" — ${businessDescription}
GOAL: ${goal}
PLATFORMS: ${platforms.join(', ')}
DURATION: ${durationDays} days
FREQUENCY: ${postsPerWeek} posts per week
TONE: ${tone}
TOTAL POSTS NEEDED: ${totalPosts}

Generate a content calendar with exactly ${totalPosts} posts. Each post should be unique and build toward the campaign goal.

Return ONLY valid JSON (no markdown, no code fences):
{
  "campaignName": "catchy campaign name",
  "campaignDescription": "1-2 sentence description",
  "posts": [
    {
      "dayOffset": 0,
      "platform": "instagram",
      "type": "tip | stat | quote | behind-the-scenes | cta | educational | testimonial | carousel | story",
      "caption": "The full post caption with line breaks and hashtags",
      "imagePrompt": "Detailed description of the image to generate — be specific about layout, colors, text overlays, style",
      "bestTime": "09:00",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}

RULES:
- Vary content types across the calendar — mix tips, stats, CTAs, educational, etc.
- Each post should work for its specific platform (Instagram = visual, LinkedIn = professional, Twitter = concise)
- Image prompts should be detailed enough to generate compelling social media graphics
- Captions should be engaging, have clear CTAs, and include relevant hashtags
- Space posts evenly across the duration
- Start with awareness/intro posts, build to engagement, end with conversion/CTA posts
- bestTime should be optimal posting times for each platform` }],
        }],
      })

      const text = response.text?.trim() ?? ''
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

      try {
        const plan = JSON.parse(cleaned)
        return NextResponse.json(plan)
      } catch {
        return NextResponse.json({ error: 'Failed to generate plan. Please try again.' }, { status: 500 })
      }
    } catch (err) {
      console.error('[social-campaign] Plan error:', err)
      return NextResponse.json({ error: 'Failed to generate campaign plan' }, { status: 500 })
    }
  }

  // Save campaign and generate images for approved posts
  if (action === 'start-campaign') {
    const { campaignName, posts, businessName, primaryColor, referenceImage } = body as {
      campaignName: string
      posts: { dayOffset: number; platform: string; type: string; caption: string; imagePrompt: string; bestTime: string; hashtags: string[] }[]
      businessName: string
      primaryColor?: string
      referenceImage?: string
    }

    if (!posts?.length) {
      return NextResponse.json({ error: 'No posts to schedule' }, { status: 400 })
    }

    // Charge 1 credit per post before creating the campaign + generating images
    // (admin/beta bypass handled inside deductCredits). Matches the UI's
    // "Launch Campaign (N credits)".
    const COST = posts.length
    const credit = await checkCredits(user.id, COST)
    if (!credit.allowed) {
      return NextResponse.json({ error: `Not enough credits. Need ${COST}, have ${credit.remaining}.` }, { status: 402 })
    }
    if (!(await deductCredits(user.id, COST, 'social_campaign'))) {
      return NextResponse.json({ error: 'Credit deduction failed. Please try again.' }, { status: 402 })
    }

    // Save campaign
    const { data: campaign, error: campError } = await admin
      .from('social_campaigns')
      .insert({
        user_id: user.id,
        name: campaignName,
        business_name: businessName,
        total_posts: posts.length,
        status: 'generating',
      })
      .select('id')
      .single()

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Save all posts as pending
    const now = new Date()
    const postRecords = posts.map(p => ({
      campaign_id: campaign.id,
      user_id: user.id,
      platform: p.platform,
      content_type: p.type,
      caption: p.caption,
      image_prompt: p.imagePrompt,
      hashtags: p.hashtags,
      scheduled_at: new Date(now.getTime() + p.dayOffset * 86400000 + parseTime(p.bestTime)).toISOString(),
      status: 'pending',
    }))

    await admin.from('social_campaign_posts').insert(postRecords)

    // Start generating images for first 3 posts (fire-and-forget for the rest)
    const origin = request.headers.get('origin') ?? `https://${request.headers.get('x-forwarded-host') ?? 'docs2video.com'}`
    const cookieHeader = request.headers.get('cookie') ?? ''

    fetch(`${origin}/api/social-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieHeader },
      body: JSON.stringify({
        action: 'generate-images',
        campaignId: campaign.id,
        businessName,
        primaryColor,
        referenceImage,
      }),
    }).catch(err => console.error('[social-campaign] Image gen trigger failed:', err))

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      totalPosts: posts.length,
      creditsRequired: posts.length,
    })
  }

  // Generate images for campaign posts (background job)
  if (action === 'generate-images') {
    const { campaignId, businessName, primaryColor, referenceImage } = body as {
      campaignId: string
      businessName: string
      primaryColor?: string
      referenceImage?: string
    }

    if (!(await ownsCampaign(campaignId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: posts } = await admin
      .from('social_campaign_posts')
      .select('id, image_prompt, platform')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true })

    if (!posts?.length) {
      return NextResponse.json({ done: true })
    }

    const PLATFORM_SIZES: Record<string, { width: number; height: number; aspect: string }> = {
      facebook: { width: 1200, height: 630, aspect: '16:9' },
      instagram: { width: 1080, height: 1080, aspect: '1:1' },
      twitter: { width: 1600, height: 900, aspect: '16:9' },
      linkedin: { width: 1200, height: 627, aspect: '16:9' },
      youtube: { width: 1280, height: 720, aspect: '16:9' },
      tiktok: { width: 1080, height: 1920, aspect: '9:16' },
    }

    // Generate images one by one
    for (const post of posts.slice(0, 5)) { // Process 5 at a time
      try {
        const size = PLATFORM_SIZES[post.platform] ?? PLATFORM_SIZES.instagram
        const prompt = `Create a professional social media graphic for ${post.platform}.

BUSINESS: ${businessName}
${primaryColor ? `BRAND COLOR: ${primaryColor}` : ''}

IMAGE DESCRIPTION: ${post.image_prompt}

RULES:
- Professional, eye-catching social media graphic
- Text must be large, bold, and readable on mobile
- Include the business name "${businessName}" subtly
- Modern, clean design — not cluttered
- Optimized for ${post.platform}
- NO human faces or photographs of people`

        const parts: any[] = [{ text: prompt }]
        if (referenceImage) {
          const match = referenceImage.match(/^data:image\/(\w+);base64,(.+)$/)
          if (match) {
            parts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } })
          }
        }

        const response = await genai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ role: 'user', parts }],
          config: { responseFormat: { image: { aspectRatio: size.aspect as any, imageSize: '1024' } } } as any,
        })

        const responseParts = response.candidates?.[0]?.content?.parts ?? []
        for (const rp of responseParts) {
          if (rp.inlineData) {
            const buffer = Buffer.from(rp.inlineData.data!, 'base64')
            const path = `${(await admin.from('social_campaigns').select('user_id').eq('id', campaignId).single()).data?.user_id}/campaigns/${campaignId}/${post.id}.png`
            await admin.storage.from('videos').upload(path, buffer, { contentType: 'image/png', upsert: true })
            const { data: urlData } = admin.storage.from('videos').getPublicUrl(path)

            await admin.from('social_campaign_posts').update({
              image_url: urlData.publicUrl,
              status: 'ready',
            }).eq('id', post.id)
            break
          }
        }
      } catch (err) {
        console.error(`[social-campaign] Image gen failed for post ${post.id}:`, err)
        await admin.from('social_campaign_posts').update({ status: 'failed' }).eq('id', post.id)
      }
    }

    // Check counts
    const { count: readyCount } = await admin
      .from('social_campaign_posts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'ready')

    const { count: pendingCount } = await admin
      .from('social_campaign_posts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    if (pendingCount === 0) {
      await admin.from('social_campaigns').update({ status: 'ready' }).eq('id', campaignId)
    }

    return NextResponse.json({ generated: readyCount, remaining: pendingCount })
  }

  // Publish a campaign post via Zernio
  if (action === 'publish-post') {
    const { postId } = body as { postId: string }
    if (!isZernioConfigured()) {
      return NextResponse.json({ error: 'Social posting not configured' }, { status: 500 })
    }

    const { data: post } = await admin
      .from('social_campaign_posts')
      .select('*')
      .eq('id', postId)
      .single()

    // The post's campaign must belong to the caller — otherwise anyone could
    // publish someone else's post through their own social account.
    if (!post || !(await ownsCampaign(post.campaign_id))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (post.status !== 'ready') {
      return NextResponse.json({ error: 'Post not ready' }, { status: 400 })
    }

    // Resolve the user's Zernio profile + the account for this post's platform.
    const { data: prof } = await admin
      .from('profiles').select('zernio_profile_id').eq('id', user.id).single()
    const profileId = prof?.zernio_profile_id
    if (!profileId) return NextResponse.json({ error: 'Connect your social accounts first.' }, { status: 400 })
    let accountId: string | undefined
    try {
      const accounts = await listAccounts(profileId)
      accountId = accounts.find((a) => a.platform === post.platform)?.accountId
    } catch { /* handled below */ }
    if (!accountId) return NextResponse.json({ error: `Your ${post.platform} account isn't connected.` }, { status: 400 })

    try {
      const result = await createPost({
        profileId,
        content: post.caption,
        platforms: [{ platform: post.platform as ZernioPlatform, accountId }],
        ...(post.image_url ? { mediaUrls: [post.image_url] } : {}),
        ...(post.scheduled_at ? { scheduledFor: post.scheduled_at, timezone: 'UTC' } : { publishNow: true }),
      })

      await admin.from('social_campaign_posts').update({
        status: 'scheduled',
        ayrshare_post_id: result.id || null, // legacy column; stores Zernio post id
      }).eq('id', postId)

      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[social-campaign] Publish error:', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to publish' }, { status: 500 })
    }
  }

  // Get campaign status
  if (action === 'get-campaign') {
    const { campaignId } = body as { campaignId: string }

    if (!(await ownsCampaign(campaignId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: campaign } = await admin
      .from('social_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    const { data: posts } = await admin
      .from('social_campaign_posts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('scheduled_at', { ascending: true })

    return NextResponse.json({ campaign, posts: posts ?? [] })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return ((h || 9) * 3600 + (m || 0) * 60) * 1000
}
