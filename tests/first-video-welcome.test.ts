import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// The "Make your first video" film pop-up (owner, 2026-11-16: "a make your first
// video pop-up that will show up when a new user first logs in").
const read = (p: string) => readFileSync(resolve(p), 'utf8')
const page = read('app/(dashboard)/dashboard/page.tsx')
const pop = read('app/(dashboard)/dashboard/_home/FirstVideoWelcome.tsx')

describe('first-video pop-up', () => {
  it('opens by itself only for an account with no project that has not seen it', () => {
    // inside the no-project welcome line, auto-open driven by the account flag
    const welcome = page.indexOf('{!home.hasAnyProject && (\n          <p className={s.welcome}>'.replace(/\n/g, page.includes('\r\n') ? '\r\n' : '\n'))
    const at = page.indexOf('<FirstVideoWelcome autoOpen={!user.user_metadata?.welcome_video_seen} />')
    expect(welcome).toBeGreaterThan(-1)
    expect(at).toBeGreaterThan(welcome)
  })
  it('closing it marks it seen on the account, once', () => {
    expect(pop).toContain("auth.updateUser({ data: { welcome_video_seen: true } })")
    expect(pop).toMatch(/onClose=\{close\}/)
    expect(pop).toMatch(/if \(marked\.current\) return/)
  })
  it('plays the film from the app itself, with a way to start right away', () => {
    expect(pop).toContain("src: '/help/make-your-first-video.mp4'")
    expect(existsSync(resolve('public/help/make-your-first-video.mp4'))).toBe(true)
    expect(existsSync(resolve('public/help/make-your-first-video.jpg'))).toBe(true)
    expect(pop).toContain('href="/create?source=upload"')
  })
  it('the welcome line no longer says Make it is on step 3 (there are eight)', () => {
    expect(page).not.toContain('on step 3.')
    expect(page).not.toContain('GETTING_STARTED_VIDEO')
  })
})
