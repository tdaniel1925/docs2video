import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('F13: Content-driven scene count', () => {
  const scriptGenPath = path.resolve(__dirname, '../app/_lib/script-generator.ts')
  const scriptGenContent = fs.readFileSync(scriptGenPath, 'utf-8')

  it('does not contain forced "10 scenes" minimum', () => {
    expect(scriptGenContent).not.toContain('less than 10 scenes')
    expect(scriptGenContent).not.toContain('at least 10 scenes')
    expect(scriptGenContent).not.toContain('minimum of 10 scenes')
  })

  it('contains content-driven scene count instruction', () => {
    expect(scriptGenContent).toContain('Use as many scenes as the content requires')
    expect(scriptGenContent).toContain('Let the source data dictate scene count')
  })

  it('v2 prompts delegate scene count to VIDEO LENGTH instruction', () => {
    const v2Path = path.resolve(__dirname, '../app/_lib/prompts/script-generator-v2.ts')
    const v2Content = fs.readFileSync(v2Path, 'utf-8')
    expect(v2Content).toContain('SCENE COUNT: Determined by the VIDEO LENGTH instruction below')
  })

  it('insurance v2 prompt delegates scene count to VIDEO LENGTH instruction', () => {
    const insV2Path = path.resolve(__dirname, '../app/_lib/prompts/script-generator-insurance-v2.ts')
    const insV2Content = fs.readFileSync(insV2Path, 'utf-8')
    expect(insV2Content).toContain('SCENE COUNT: Determined by the VIDEO LENGTH instruction below')
  })
})
