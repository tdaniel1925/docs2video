import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { makeCover, capturePageViaService } from '../app/_lib/video-thumbnail-make'

/*
 * New presentations get their first screen as a thumbnail automatically
 * (2026-10-19). The sweep runs on Vercel, which has no browser, so the render
 * service draws the page (/page-still), and only our own stored presentations.
 */
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isOurPresentationUrl } = require('../render-service/page-still.js') as { isOurPresentationUrl: (u: unknown, base: string) => boolean }

const SB = 'https://abc.supabase.co'
const ID = '0a1cb90c-2215-496d-9687-1faf13212071'
const PAGE = `${SB}/storage/v1/object/public/videos/presentations/${ID}.html`

function fakeAdmin() {
  const saved: Record<string, unknown>[] = []
  const admin = {
    storage: { from: () => ({
      upload: async () => ({ error: null }),
      getPublicUrl: (p: string) => ({ data: { publicUrl: `${SB}/storage/v1/object/public/videos/${p}` } }),
    }) },
    from: () => ({ update: (row: Record<string, unknown>) => { saved.push(row); return { eq: () => ({ eq: async () => ({ error: null }) }) } } }),
  }
  return { admin, saved }
}
const png = () => sharp({ create: { width: 1280, height: 720, channels: 3, background: '#223344' } }).png().toBuffer()

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('the render service draws only our own presentations', () => {
  it('accepts our stored presentation pages, any ?v=', () => {
    expect(isOurPresentationUrl(PAGE, SB)).toBe(true)
    expect(isOurPresentationUrl(`${PAGE}?v=123`, SB)).toBe(true)
  })
  it('refuses any other address', () => {
    for (const u of [
      'https://evil.example/presentations/x.html',
      `http://abc.supabase.co/storage/v1/object/public/videos/presentations/${ID}.html`,
      `${SB}/storage/v1/object/public/videos/other/${ID}.html`,
      `${SB}/storage/v1/object/public/videos/presentations/../secret.html`,
      `${SB}/storage/v1/object/public/videos/presentations/${ID}.mp4`,
      `https://abc.supabase.co.evil.example/storage/v1/object/public/videos/presentations/${ID}.html`,
      'not a url', '', null,
    ]) expect(isOurPresentationUrl(u, SB), String(u)).toBe(false)
  })
  it('has the endpoint, behind the shared secret, and ships the module in the image', () => {
    const s = read('render-service/server.js')
    expect(s).toMatch(/app\.post\('\/page-still', authCheck,/)
    expect(s).toMatch(/isOurPresentationUrl\(url, SUPABASE_URL\)/)
    expect(s).toMatch(/page\.setContent\(String\(html\)/)
    expect(read('render-service/Dockerfile')).toMatch(/^COPY page-still\.js \.\/$/m)
    expect(read('render-service/build-context.sh')).toMatch(/kit\.js video-upload\.js page-still\.js Dockerfile/)
  })
})

describe('the sweep makes a presentation’s cover through the render service', () => {
  it('asks /page-still with the secret and the page address', async () => {
    vi.stubEnv('VIDEO_ASSEMBLY_URL', 'https://render.example')
    vi.stubEnv('VIDEO_ASSEMBLY_SECRET', 's3cret')
    const body = await png()
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(body), { status: 200, headers: { 'Content-Type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await capturePageViaService(PAGE)
    expect(out.length).toBe(body.length)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://render.example/page-still')
    expect((init.headers as Record<string, string>)['x-api-secret']).toBe('s3cret')
    expect(JSON.parse(String(init.body))).toEqual({ url: PAGE })
  })

  it('a refused page throws (the sweep notes it and moves on)', async () => {
    vi.stubEnv('VIDEO_ASSEMBLY_URL', 'https://render.example')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"Not one of our presentations"}', { status: 400 })))
    await expect(capturePageViaService(PAGE)).rejects.toThrow(/page-still 400/)
  })

  it('makeCover draws a page plan without being handed a browser', async () => {
    vi.stubEnv('VIDEO_ASSEMBLY_URL', 'https://render.example')
    const body = await png()
    const fetchMock = vi.fn(async () => new Response(new Uint8Array(body), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { admin, saved } = fakeAdmin()
    const cover = await makeCover(admin as never, { id: ID, user_id: 'u1', status: 'completed', video_url: PAGE })
    expect(cover).toMatch(/_cover\.jpg\?v=/)
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toMatch(/\/page-still$/)
    expect(saved[0].thumbnail_url).toBe(cover)
  })

  it('a backfill’s own browser still wins when given', async () => {
    const capture = vi.fn(async () => png())
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { admin } = fakeAdmin()
    await makeCover(admin as never, { id: ID, user_id: 'u1', status: 'completed', video_url: PAGE }, { capturePage: capture })
    expect(capture).toHaveBeenCalledWith(PAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
