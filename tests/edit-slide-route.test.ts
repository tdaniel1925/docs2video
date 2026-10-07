import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/*
 * The older scene editor's per-slide AI edit (/api/edit-slide).
 * Found in overhaul phase 4: it sent the slide's web address to Gemini as if
 * it were the picture's bytes (so it always failed) and it never charged.
 * These run the REAL route with the money, storage and AI calls mocked — no
 * paid AI call is ever made.
 */

const SB = 'https://ourproj.supabase.co'
const OUR_SLIDE = `${SB}/storage/v1/object/public/videos/user-1/vid-1/slide_0.png`
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

const calls: string[] = []
const h = vi.hoisted(() => ({
  generateContent: vi.fn(),
  upload: vi.fn(),
  checkCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent: h.generateContent } },
}))
vi.mock('../app/_lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } }),
}))
vi.mock('../app/_lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const q: any = { select: () => q, eq: () => q, single: async () => ({ data: { id: 'vid-1' } }) }
      return q
    },
    storage: {
      from: () => ({
        upload: h.upload,
        getPublicUrl: (p: string) => ({ data: { publicUrl: `${SB}/storage/v1/object/public/videos/${p}` } }),
      }),
    },
  }),
}))
vi.mock('../app/_lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, remaining: 9 }),
  getRateLimitKey: () => 'k',
  LIMITS: { generation: { limit: 10, windowMs: 1000 } },
}))
vi.mock('../app/_lib/credits', async (orig) => {
  const real: any = await orig()
  return {
    ...real,
    checkCredits: h.checkCredits,
    deductCredits: h.deductCredits,
    refundCredits: h.refundCredits,
  }
})

import { CREDIT_COSTS } from '../app/_lib/credits'
import { isOurStorageUrl, fetchOurStorageImage, ForeignImageError } from '../app/_lib/our-storage-image'

const fetchMock = vi.fn()

function req(body: Record<string, unknown>) {
  return new Request('http://localhost/api/edit-slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
const good = { videoId: 'vid-1', sceneIndex: 0, slideUrl: OUR_SLIDE, editInstruction: 'make the title blue' }

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SB
  calls.length = 0
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    calls.push(`fetch ${url}`)
    return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } })
  })
  h.checkCredits.mockReset().mockImplementation(async () => { calls.push('check'); return { allowed: true, remaining: 5000 } })
  h.deductCredits.mockReset().mockImplementation(async (_u: string, amount: number, action: string) => { calls.push(`deduct ${amount} ${action}`); return true })
  h.refundCredits.mockReset().mockImplementation(async (_u: string, amount: number) => { calls.push(`refund ${amount}`); return true })
  h.upload.mockReset().mockImplementation(async () => { calls.push('upload'); return { error: null } })
  h.generateContent.mockReset().mockImplementation(async (args: any) => {
    calls.push('ai')
    const img = args.contents[0].parts.find((p: any) => p.inlineData).inlineData
    calls.push(`ai-got ${img.mimeType} ${img.data}`)
    return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG.toString('base64') } }] } }] }
  })
})
afterEach(() => { vi.unstubAllGlobals() })

async function post(body: Record<string, unknown>) {
  const { POST } = await import('../app/api/edit-slide/route')
  const res = await POST(req(body))
  return { status: res.status, data: await res.json() }
}

describe('/api/edit-slide', () => {
  it('sends the picture DATA (not its address) to the AI, charging first', async () => {
    const { status, data } = await post(good)
    expect(status).toBe(200)
    const cost = CREDIT_COSTS['scene-edit']
    expect(calls).toEqual([
      `fetch ${OUR_SLIDE}`,
      'check',
      `deduct ${cost} scene-edit`,
      'ai',
      `ai-got image/png ${PNG.toString('base64')}`,
      'upload',
    ])
    // The new slide comes back as a storage address, not a giant data: URL.
    expect(data.image).toMatch(new RegExp(`^${SB}/storage/v1/object/public/videos/user-1/vid-1/edits/slide_0_`))
    expect(data.charged).toBe(cost)
  })

  it('refunds when the AI call throws', async () => {
    h.generateContent.mockImplementation(async () => { calls.push('ai'); throw new Error('boom') })
    const { status } = await post(good)
    expect(status).toBe(500)
    expect(calls).toEqual([`fetch ${OUR_SLIDE}`, 'check', `deduct ${CREDIT_COSTS['scene-edit']} scene-edit`, 'ai', `refund ${CREDIT_COSTS['scene-edit']}`])
  })

  it('refunds when the AI returns no picture', async () => {
    h.generateContent.mockImplementation(async () => { calls.push('ai'); return { candidates: [] } })
    const { status } = await post(good)
    expect(status).toBe(502)
    expect(calls.at(-1)).toBe(`refund ${CREDIT_COSTS['scene-edit']}`)
  })

  it('refunds when saving the new picture fails', async () => {
    h.upload.mockImplementation(async () => { calls.push('upload'); return { error: { message: 'nope' } } })
    const { status } = await post(good)
    expect(status).toBe(500)
    expect(calls.at(-1)).toBe(`refund ${CREDIT_COSTS['scene-edit']}`)
  })

  it('refuses foreign picture addresses before downloading or charging anything', async () => {
    for (const slideUrl of [
      'http://169.254.169.254/latest/meta-data/',
      'https://evil.example.com/slide.png',
      `${SB.replace('https', 'http')}/storage/v1/object/public/videos/a.png`,
      `https://ourproj.supabase.co.evil.com/storage/v1/object/public/videos/a.png`,
      `${SB}/rest/v1/profiles`,
      'data:image/png;base64,AAAA',
    ]) {
      const { status } = await post({ ...good, slideUrl })
      expect(status, slideUrl).toBe(400)
    }
    expect(calls).toEqual([])
  })

  it('does not charge when the picture cannot be downloaded', async () => {
    fetchMock.mockImplementation(async () => { calls.push('fetch'); return new Response('x', { status: 404 }) })
    const { status } = await post(good)
    expect(status).toBe(502)
    expect(calls).toEqual(['fetch'])
  })

  it('does not run the AI when the user cannot pay', async () => {
    h.checkCredits.mockImplementation(async () => { calls.push('check'); return { allowed: false, remaining: 10 } })
    const { status } = await post(good)
    expect(status).toBe(402)
    expect(calls).not.toContain('ai')
  })
})

describe('our-storage-image guard', () => {
  beforeEach(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = SB })

  it('allows only our project storage over https', () => {
    expect(isOurStorageUrl(OUR_SLIDE)).toBe(true)
    expect(isOurStorageUrl(`${SB}/storage/v1/object/sign/videos/a.png?token=x`)).toBe(true)
    expect(isOurStorageUrl('https://other.supabase.co/storage/v1/object/public/videos/a.png')).toBe(false)
    expect(isOurStorageUrl(`https://user:pw@ourproj.supabase.co/storage/v1/object/public/videos/a.png`)).toBe(false)
    expect(isOurStorageUrl(`https://ourproj.supabase.co:8443/storage/v1/object/public/videos/a.png`)).toBe(false)
    expect(isOurStorageUrl(null)).toBe(false)
  })

  it('never makes a request for a foreign address, refuses redirects, and checks the bytes', async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) => {
      expect(init?.redirect).toBe('error')
      return new Response('<html>not a picture</html>', { status: 200 })
    })
    await expect(fetchOurStorageImage('https://evil.example.com/a.png', { fetchImpl: f as any })).rejects.toBeInstanceOf(ForeignImageError)
    expect(f).not.toHaveBeenCalled()
    await expect(fetchOurStorageImage(OUR_SLIDE, { fetchImpl: f as any })).rejects.toThrow(/not a picture/)
  })
})

describe('the window and the help match the price table', () => {
  const ROOT = path.join(__dirname, '..')
  const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

  it('the editor sends the address + video, shows the price from credits.ts, and hides the dead Redo', () => {
    const editor = read('app/(dashboard)/videos/[id]/change/OlderEditor.tsx')
    expect(editor).toContain("editSlideCost={CREDIT_COSTS['scene-edit']}")
    expect(editor).toMatch(/slideUrl: currentSlide/)
    expect(editor).not.toContain('currentSlideBase64')
    expect(editor).not.toContain('onRedoSlide')
    const se = read('app/_components/ScriptEditor.tsx')
    expect(se).toMatch(/Apply · \$\{editSlideCost\.toLocaleString\(\)\} credits/)
  })

  it('Save & Regenerate only downloads pictures from our storage', () => {
    const rr = read('app/api/re-render/route.ts')
    expect(rr).toContain('isOurStorageUrl(u)')
    expect(rr).toContain('fetchOurStorageImage(url')
    expect(rr).not.toMatch(/await fetch\(url\b/)
  })

  it('the help article prices the picture edit from credits.ts', () => {
    expect(read('app/(dashboard)/help/making-changes/page.tsx')).toContain("n(CREDIT_COSTS['scene-edit'])")
  })
})
