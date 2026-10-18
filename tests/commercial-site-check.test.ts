import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// A mistyped website ("botmakersa.ai", 2026-10-09) used to start a commercial
// that died on the render service with "fetch failed". The route now checks
// the name exists BEFORE charging and says so in plain words.
const src = fs.readFileSync(path.join(__dirname, '..', 'app/api/generate-commercial/route.ts'), 'utf8')

describe('commercial: website address is checked first', () => {
  it('looks the name up and answers site_not_found', () => {
    expect(src).toMatch(/from 'node:dns\/promises'/)
    expect(src).toMatch(/code: 'site_not_found'/)
  })
  it('checks before the credit check', () => {
    expect(src.indexOf("site_not_found")).toBeLessThan(src.indexOf('checkCredits(user.id'))
  })
})
