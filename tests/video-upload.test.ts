import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fitBitrateKbps, STORAGE_MAX_BYTES } = require('../render-service/video-upload.js')

// 2026-10-17: a 3.5-minute Drawn-slides video (58.6 MB) rendered for 16 minutes
// then failed at "Upload failed: The object exceeded the maximum allowed size".
const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('saving finished videos', () => {
  it('stays under Supabase’s 50 MB project cap', () => {
    expect(STORAGE_MAX_BYTES).toBeLessThan(50 * 1024 * 1024)
  })

  it('picks a bitrate that fits the length', () => {
    const kbps = fitBitrateKbps(210)
    expect(((kbps + 128) * 1000 * 210) / 8).toBeLessThan(STORAGE_MAX_BYTES)
    expect(fitBitrateKbps(60)).toBeGreaterThan(fitBitrateKbps(600))
    expect(fitBitrateKbps(0)).toBe(0)
  })

  it('every render path saves through uploadVideo (no raw, unchecked mp4 uploads)', () => {
    for (const f of ['render-service/server.js', 'render-service/present-export.js']) {
      expect(read(f), f).not.toMatch(/\.upload\([^)]*contentType: 'video\/mp4'/)
    }
    expect(read('render-service/server.js')).toContain("require('./video-upload')")
    expect(read('render-service/build-context.sh')).toContain('video-upload.js')
  })

  it('the Drawn-slides join is fast and says what it is doing', () => {
    const a = read('render-service/drawn-assembly.js')
    expect(a).toContain("'-preset', 'veryfast', '-crf', '22'")
    expect(a).toContain('if (onJoin) await onJoin()')
    expect(read('render-service/server.js')).toContain('Joining the slides together...')
  })
})

describe('render service image', () => {
  // 2026-10-17: video-upload.js was bundled but not COPYed by the Dockerfile, so
  // the new container crashed on start ("Cannot find module './video-upload'").
  it('every local module a server file requires is copied into the image and the bundle', () => {
    const fs = require('fs') as typeof import('fs')
    const dir = join(root, 'render-service')
    const dockerfile = read('render-service/Dockerfile')
    const bundle = read('render-service/build-context.sh')
    for (const f of fs.readdirSync(dir).filter((x: string) => x.endsWith('.js'))) {
      for (const m of fs.readFileSync(join(dir, f), 'utf8').matchAll(/require\('\.\/([a-z0-9-]+)'\)/g)) {
        expect(dockerfile, `${m[1]}.js missing from Dockerfile COPY`).toContain(`COPY ${m[1]}.js`)
        expect(bundle, `${m[1]}.js missing from build-context.sh`).toContain(`${m[1]}.js`)
      }
    }
  })
})
