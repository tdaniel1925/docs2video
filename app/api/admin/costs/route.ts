import { NextResponse } from 'next/server'
import { createClient } from '../../../_lib/supabase/server'
import { createAdminClient } from '../../../_lib/supabase/admin'

export const runtime = 'nodejs'
export const maxDuration = 30

// Estimated API costs per action
const COST_PER_ACTION: Record<string, number> = {
  // Script generation (Claude Sonnet)
  'script_generation': 0.05,
  'video_generation': 0.05,
  // Slide generation (Gemini 3 Pro Image) — per slide
  'slide_generation': 0.04,
  // TTS (OpenAI TTS-HD) — per scene
  'tts_generation': 0.02,
  // Music (Lyria 3 Pro)
  'music_generation': 0.01,
  // Extraction (gpt-4o-mini via VPS)
  'extraction': 0.01,
  // Strategic analysis (Claude Sonnet)
  'strategic_analysis': 0.03,
}

// Average slides per detail level
const AVG_SLIDES: Record<string, number> = { quick: 4, standard: 7, detailed: 10 }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()

  // Check admin
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Get all completed videos with creation dates
    const { data: videos } = await admin
      .from('videos')
      .select('id, created_at, output_type, detail_level, status, user_id, title, script')
      .in('status', ['completed', 'failed'])
      .order('created_at', { ascending: false })
      .limit(500)

    // Get credit transactions for revenue tracking
    const { data: transactions } = await admin
      .from('credit_transactions')
      .select('id, user_id, amount, action, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    // Get user count
    const { count: totalUsers } = await admin.from('profiles').select('id', { count: 'exact', head: true })

    // Calculate costs
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const allVideos = videos || []
    const recentVideos = allVideos.filter(v => new Date(v.created_at) > thirtyDaysAgo)
    const weekVideos = allVideos.filter(v => new Date(v.created_at) > sevenDaysAgo)

    // Estimate cost per video
    function estimateVideoCost(v: any): number {
      const slides = AVG_SLIDES[v.detail_level || 'standard'] || 7
      const sceneCount = v.script?.length || slides
      return (
        COST_PER_ACTION.extraction +
        COST_PER_ACTION.strategic_analysis +
        COST_PER_ACTION.script_generation +
        (COST_PER_ACTION.slide_generation * sceneCount) +
        (COST_PER_ACTION.tts_generation * sceneCount) +
        COST_PER_ACTION.music_generation
      )
    }

    const totalCostAllTime = allVideos.reduce((sum, v) => sum + estimateVideoCost(v), 0)
    const totalCost30d = recentVideos.reduce((sum, v) => sum + estimateVideoCost(v), 0)
    const totalCost7d = weekVideos.reduce((sum, v) => sum + estimateVideoCost(v), 0)
    const avgCostPerVideo = allVideos.length > 0 ? totalCostAllTime / allVideos.length : 0

    // Cost breakdown by provider
    const breakdown = {
      anthropic: recentVideos.length * (COST_PER_ACTION.script_generation + COST_PER_ACTION.strategic_analysis),
      google: recentVideos.reduce((sum, v) => {
        const slides = AVG_SLIDES[v.detail_level || 'standard'] || 7
        return sum + (COST_PER_ACTION.slide_generation * slides) + COST_PER_ACTION.music_generation
      }, 0),
      openai: recentVideos.reduce((sum, v) => {
        const slides = AVG_SLIDES[v.detail_level || 'standard'] || 7
        return sum + (COST_PER_ACTION.tts_generation * slides) + COST_PER_ACTION.extraction
      }, 0),
    }

    // Daily costs (last 30 days)
    const dailyCosts: Record<string, { count: number; cost: number }> = {}
    for (const v of recentVideos) {
      const day = v.created_at.slice(0, 10)
      if (!dailyCosts[day]) dailyCosts[day] = { count: 0, cost: 0 }
      dailyCosts[day].count++
      dailyCosts[day].cost += estimateVideoCost(v)
    }

    // Top users by cost
    const userCosts: Record<string, { count: number; cost: number }> = {}
    for (const v of recentVideos) {
      if (!userCosts[v.user_id]) userCosts[v.user_id] = { count: 0, cost: 0 }
      userCosts[v.user_id].count++
      userCosts[v.user_id].cost += estimateVideoCost(v)
    }
    const topUsers = Object.entries(userCosts)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .map(([userId, data]) => ({ userId, ...data }))

    // Credit revenue (deductions = usage = revenue)
    const deductions = (transactions || []).filter(t => t.amount < 0 && new Date(t.created_at) > thirtyDaysAgo)
    const totalCreditsUsed30d = deductions.reduce((sum, t) => sum + Math.abs(t.amount), 0)

    return NextResponse.json({
      summary: {
        totalVideosAllTime: allVideos.length,
        totalVideos30d: recentVideos.length,
        totalVideos7d: weekVideos.length,
        totalCostAllTime: Math.round(totalCostAllTime * 100) / 100,
        totalCost30d: Math.round(totalCost30d * 100) / 100,
        totalCost7d: Math.round(totalCost7d * 100) / 100,
        avgCostPerVideo: Math.round(avgCostPerVideo * 100) / 100,
        totalCreditsUsed30d,
        totalUsers: totalUsers || 0,
      },
      breakdown,
      dailyCosts: Object.entries(dailyCosts).sort((a, b) => a[0].localeCompare(b[0])).map(([date, data]) => ({ date, ...data })),
      topUsers,
      costPerAction: COST_PER_ACTION,
    })
  } catch (err) {
    console.error('[admin/costs] Error:', err)
    return NextResponse.json({ error: 'Failed to load cost data' }, { status: 500 })
  }
}
