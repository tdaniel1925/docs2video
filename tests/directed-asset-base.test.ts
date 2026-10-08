import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// The slide-deck look (DirectedVideo) renders on Lambda, where every per-video
// file (voice, presenter photo, backdrops) lives under props.assetBase.
// Remotion REPLACES the props with whatever calculateMetadata returns, so if the
// setup step drops assetBase the render looks in the bundle's own folder and
// crashes ("Error loading image … /public/brand-presenter.png", 2026-10-08).
// Full render check: scripts/look-samples/check-directed-asset-base.ts
const src = fs.readFileSync(path.join(__dirname, '..', 'remotion/src/DirectedVideo.tsx'), 'utf8')
const meta = src.slice(src.indexOf('export const directedMetadata'), src.indexOf('export const DirectedVideo'))

describe('DirectedVideo keeps its file address through setup', () => {
  it('sets the address before measuring the voice files', () => {
    expect(meta.indexOf('setAssetBase(props?.assetBase)')).toBeGreaterThan(-1)
    expect(meta.indexOf('setAssetBase(props?.assetBase)')).toBeLessThan(meta.indexOf('getAudioDurationInSeconds'))
  })
  it('hands the address on in the props it returns for a real render', () => {
    const real = meta.slice(meta.lastIndexOf('return { durationInFrames'))
    expect(real).toMatch(/props: \{ assetBase,/)
  })
})
