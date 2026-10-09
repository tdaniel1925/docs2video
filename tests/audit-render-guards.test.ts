import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { makeDb, fakeClient } from './fixtures/fake-supabase'

/*
 * AUDIT 2026-10-09 — the render service side.
 *  #1  a finished render may only mark its video 'completed' while the row is
 *      still running (a failed / refunded row stays failed — no free video);
 *  #6  outside URLs (website, logo, music, photo) can't reach private,
 *      loopback or link-local (cloud metadata) addresses, on any redirect hop;
 *  #11 the classic /generate path stamps progress on every write and uses the
 *      one render queue.
 * job-guards.js is run for real against a pretend database / pretend network.
 */

const ROOT = path.resolve(__dirname, '..')
const require_ = createRequire(import.meta.url)
const guards = require_(path.join(ROOT, 'render-service/job-guards.js')) as {
  RUNNING_STATUSES: string[]
  completeIfRunning: (sb: any, id: string, fields: any, opts?: any) => Promise<boolean>
  isSafePublicUrl: (u: string, resolve?: any) => Promise<boolean>
  guardedFetch: (u: string, init?: any, opts?: any) => Promise<any>
}
const server = readFileSync(path.join(ROOT, 'render-service/server.js'), 'utf8')
const commercial = readFileSync(path.join(ROOT, 'render-service/commercial.js'), 'utf8')

describe('completeIfRunning — no "completed" on a failed or refunded video', () => {
  it('a still-running video is marked completed', async () => {
    const db = makeDb({ videos: [{ id: 'v1', status: 'assembling' }] })
    const report = vi.fn()
    expect(await guards.completeIfRunning(fakeClient(db), 'v1', { status: 'completed', video_url: 'u' }, { tag: 't', report })).toBe(true)
    expect(db.tables.videos[0]).toMatchObject({ status: 'completed', video_url: 'u' })
    expect(report).not.toHaveBeenCalled()
  })

  it('a video the app already failed + refunded stays failed, and the owner is told', async () => {
    const db = makeDb({ videos: [{ id: 'v1', status: 'failed', video_url: null }] })
    const report = vi.fn(async () => {})
    expect(await guards.completeIfRunning(fakeClient(db), 'v1', { status: 'completed', video_url: 'u' }, { tag: 't', report })).toBe(false)
    expect(db.tables.videos[0]).toMatchObject({ status: 'failed', video_url: null })
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ stage: 'late-finish', videoId: 'v1' }))
  })

  it('uses the same running list as the app', async () => {
    const { IN_PROGRESS_STATUSES } = await import('../app/_lib/video-running')
    expect([...guards.RUNNING_STATUSES].sort()).toEqual([...IN_PROGRESS_STATUSES].sort())
  })

  it('every completion write to videos in server.js goes through it', () => {
    // Lines that set status 'completed' on the videos table directly. The one
    // allowed exception: a failed scene-fix puts an already-finished video back.
    const direct = server.split('\n').filter((l) => /from\('videos'\)\.update\(\{[^}]*status: 'completed'/.test(l) && !l.includes('[fail] scene re-render'))
    expect(direct).toEqual([])
    const multi = [...server.matchAll(/await (?:sb|supabase)\.from\('videos'\)\.update\(\{\s*\n[^)]*?status: 'completed'/g)]
    expect(multi.map((m) => m[0].slice(0, 80))).toEqual([])
    expect((server.match(/completeIfRunning\(/g) || []).length).toBeGreaterThanOrEqual(9)
  })
})

describe('guardedFetch — outside URLs never reach our own network', () => {
  const publicDns = async () => [{ address: '93.184.216.34' }]
  const ok = (status = 200, headers: Record<string, string> = {}) => ({ status, ok: status < 300, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } })

  it('refuses metadata, loopback and private addresses (literal or by DNS)', async () => {
    for (const u of ['http://169.254.169.254/latest/meta-data/', 'http://169.254.170.2/v2/credentials', 'http://127.0.0.1:4000/health', 'http://10.0.0.5/', 'http://[::1]/', 'http://localhost/', 'file:///etc/passwd']) {
      expect(await guards.isSafePublicUrl(u, publicDns), u).toBe(false)
    }
    expect(await guards.isSafePublicUrl('https://evil.example/x', async () => [{ address: '192.168.1.10' }])).toBe(false)
    expect(await guards.isSafePublicUrl('https://good.example/x', publicDns)).toBe(true)
  })

  it('a public URL that redirects to the metadata address is stopped before the second request', async () => {
    const fetchFn = vi.fn(async (u: string, _init?: unknown) => u.startsWith('https://good.example') ? ok(302, { location: 'http://169.254.169.254/latest/' }) : ok())
    await expect(guards.guardedFetch('https://good.example/logo.png', {}, { resolve: publicDns, fetch: fetchFn })).rejects.toThrow(/blocked address/)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
  })

  it('a normal public file downloads', async () => {
    const fetchFn = vi.fn(async () => ok())
    const r = await guards.guardedFetch('https://good.example/music.mp3', { signal: undefined }, { resolve: publicDns, fetch: fetchFn })
    expect(r.ok).toBe(true)
  })

  it('every fetch of a URL from a request in server.js and commercial.js is guarded', () => {
    for (const v of ['musicUrl', 'logoUrl', 'presenter.photo', 'templateRefUrl', 'sourceUrl', 'a.url']) {
      expect(server.includes(`await fetch(${v},`), v).toBe(false)
    }
    expect(server).not.toMatch(/await fetch\(url, \{ signal: AbortSignal\.timeout/)
    expect(commercial).not.toMatch(/await fetch\((url|u|shotUrl), /)
    expect(commercial).toMatch(/require\('\.\/job-guards'\)/)
  })

  it('the render image ships job-guards.js (or server.js would not start)', () => {
    expect(readFileSync(path.join(ROOT, 'render-service/Dockerfile'), 'utf8')).toMatch(/COPY job-guards\.js/)
    expect(readFileSync(path.join(ROOT, 'render-service/build-context.sh'), 'utf8')).toMatch(/need_file job-guards\.js/)
  })
})

describe('classic /generate (drawn slides) — alive to the cron, one render queue (#11)', () => {
  const start = server.indexOf("app.post('/generate', authCheck")
  const body = server.slice(start, server.indexOf("app.post('/style-preview'", start))

  it('every progress write stamps progress_updated_at and only touches a running row', () => {
    const fn = body.match(/async function updateStatus\([^)]*\) \{[\s\S]*?\n {2}\}/)?.[0] || ''
    expect(fn).toMatch(/progress_updated_at: new Date\(\)\.toISOString\(\)/)
    expect(fn).toMatch(/\.in\('status', RUNNING_STATUSES\)/)
  })

  it('the pipeline runs inside the shared render queue (waiting jobs get a heartbeat)', () => {
    expect(body).toMatch(/await withRenderSlotFor\(videoId\)\(async \(\) => \{\s*\n\s*try \{/)
  })
})

describe('Remotion Lambda polling (#9)', () => {
  it('a failed progress check is retried, and a run of them gives a clear reason', () => {
    const src = readFileSync(path.join(ROOT, 'remotion/scripts/lambda-render.mjs'), 'utf8')
    expect(src).toMatch(/try \{\s*\n\s*p = await getRenderProgress/)
    expect(src).toMatch(/lost contact with render/)
  })
})
