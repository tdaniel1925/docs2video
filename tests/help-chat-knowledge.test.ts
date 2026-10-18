import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * The help assistant answers from a written prompt. It kept teaching a
 * retired "Starter pack", "+ Create" and a "Presenter step" long after the
 * app had changed, and typed its own prices. Its words now come from the
 * shared tables; these checks keep the old ones out.
 */
const src = readFileSync(path.join(__dirname, '..', 'app', 'api', 'help-chat', 'route.ts'), 'utf8')
const prompt = src.slice(src.indexOf('const SYSTEM_KNOWLEDGE'), src.indexOf('export async function POST'))

describe('help assistant knowledge', () => {
  it('has no retired names or steps', () => {
    for (const old of ['Starter pack', '+ Create', 'New Creation', 'Brand profiles', 'Presenter step', "Style step", 'approve the Brief']) {
      expect(prompt, `the help prompt still says "${old}"`).not.toContain(old)
    }
  })

  it('describes the result page as it is now (phase 4)', () => {
    for (const now of ['Ready to send', 'What’s left', 'Ask for a change', 'Who watched', 'Download', 'Send to someone else', 'Copy the email']) {
      expect(prompt, `the help prompt doesn't mention "${now}"`).toContain(now)
    }
    // Only ever mentioned as gone — never as a button to press.
    expect(prompt).not.toMatch(/click (the )?"?(Edit Video|Send to Client|Copy Link)/i)
    expect(prompt).toContain("CREDIT_COSTS['slide-scene-fix']")
  })

  it('reads prices and pack names from the tables instead of typing them', () => {
    expect(prompt).toContain('CREDIT_PACKS.map')
    expect(prompt).toContain('CREDIT_COSTS.videoStandard')
    expect(prompt).toContain("planLine('pro')")
    expect(prompt, 'a plan price is typed by hand').not.toMatch(/\$(79|199|499)\b/)
  })
})
