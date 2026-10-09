// Guards for the 2026-10-09 sound + cover-branding fix.
//  1. Voice is never halved: every ffmpeg `amix` in the render service (and the
//     remotion scripts) keeps normalize=0.
//  2. Music ducks: 0.20 between lines, 0.08 under the voice, looped to the end.
//  3. Drawn slides: Ken Burns + cross-fades with the SAME timing as before.
//  4. Our platform name never becomes a client video's preparer/company/brand.
//  5. "vs" only for a real comparison; a date gets a calendar, not a shield.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { resolvePreparerName, PLATFORM_NAME_RE } from '../app/_lib/personalize'
import { isRealComparison } from '../remotion/src/slides/compare'
import { glyphFor } from '../remotion/src/components/infographic/layoutPicker'
import { sceneVoiceWindows, explainerMusicDuck } from '../remotion/src/lib/audio'

const ROOT = path.resolve(__dirname, '..')
const req = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mix: any = req(path.join(ROOT, 'render-service/audio-mix.js'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const drawn: any = req(path.join(ROOT, 'render-service/drawn-assembly.js'))
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

describe('voice is never halved by amix', () => {
  const files = [
    ...readdirSync(path.join(ROOT, 'render-service')).filter((f) => f.endsWith('.js')).map((f) => `render-service/${f}`),
    ...readdirSync(path.join(ROOT, 'remotion/scripts')).filter((f) => f.endsWith('.mjs') || f.endsWith('.js')).map((f) => `remotion/scripts/${f}`),
  ]
  it('every amix=… filter says normalize=0', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = read(f)
      for (const m of src.matchAll(/amix=[^\]'"`]*/g)) if (!/normalize=0/.test(m[0])) bad.push(`${f}: ${m[0]}`)
    }
    expect(bad).toEqual([])
  })
  it('the shipped music mix keeps the voice at 1.0 and loops the music', () => {
    const f = mix.musicBedFilter({ segments: [[1, 3]], duration: 10 })
    expect(f).toContain('normalize=0')
    expect(f).not.toMatch(/\[narr\][^;]*volume=0/)
    expect(f).toContain('atrim=0:10')
  })
  it('server.js routes all music mixes through audio-mix.js', () => {
    const s = read('render-service/server.js')
    expect(s).toContain("require('./audio-mix')")
    expect(s.match(/mixMusicUnderVoice\(/g)?.length).toBeGreaterThanOrEqual(4)
    expect(s).not.toMatch(/amix=inputs=2:duration=first:dropout_transition=3\[a\]/)
  })
  it('the Docker image ships the new modules', () => {
    const d = read('render-service/Dockerfile')
    expect(d).toContain('COPY audio-mix.js')
    expect(d).toContain('COPY drawn-assembly.js')
    expect(read('render-service/build-context.sh')).toContain('audio-mix.js drawn-assembly.js')
  })
})

describe('music ducking envelope', () => {
  it('reads talking segments out of silencedetect', () => {
    const log = '[silencedetect] silence_start: 2.5\n[silencedetect] silence_end: 3.4 | silence_duration: 0.9\n[silencedetect] silence_start: 8.0\n'
    expect(mix.parseSpeech(log, 10)).toEqual([[0, 2.5], [3.4, 8]])
  })
  it('joins short pauses so the music does not pump between words', () => {
    expect(mix.mergeSegments([[0, 2], [2.5, 4], [6, 7]])).toEqual([[0, 4], [6, 7]])
  })
  it('0.20 between lines, 0.08 under the voice, eased in between', () => {
    const segs = [[2, 5], [8, 10]]
    expect(mix.duckLevelAt(0.5, segs)).toBeCloseTo(0.2)
    expect(mix.duckLevelAt(3.5, segs)).toBeCloseTo(0.08)
    expect(mix.duckLevelAt(6.5, segs)).toBeCloseTo(0.2)
    const mid = mix.duckLevelAt(1.85, segs)
    expect(mid).toBeGreaterThan(0.08); expect(mid).toBeLessThan(0.2)
  })
  it('the ffmpeg expression matches the same maths', () => {
    const expr: string = mix.duckVolumeExpr([[2, 5]])
    expect(expr.startsWith('0.2-0.12*min(1,')).toBe(true)
    expect(mix.duckVolumeExpr([])).toBe('0.2')
  })
  it('Remotion explainers use the same levels', () => {
    const w = sceneVoiceWindows([{ durationInFrames: 300, audio: 'a.mp3' }, { durationInFrames: 300, audio: 'b.mp3' }], 100)
    expect(w[0].start).toBe(100)
    const duck = explainerMusicDuck(w, 800)
    expect(duck(250)).toBeCloseTo(0.08)
    expect(duck(395)).toBeGreaterThan(0.08)   // the gap before scene 2
    expect(duck(60)).toBeCloseTo(0.2)
  })
  it('every explainer engine plays its music through the ducked, looped bed', () => {
    for (const f of ['remotion/src/DirectedVideo.tsx', 'remotion/src/v3/V3Video.tsx', 'remotion/src/editorial/EditorialVideo.tsx', 'remotion/src/components/infographic/InfographicVideo.tsx']) {
      const s = read(f)
      expect(s, f).toMatch(/<(MusicBed|DuckedMusic)\b/)
      expect(s, f).not.toMatch(/<Audio[^>]*staticFile\((music|'dir-music\.mp3')\)/)
    }
  })
})

describe('Drawn slides: Ken Burns + cross-fades', () => {
  it('keeps each slide on screen for its voice + 0.8 s, and the voice starts with its slide', () => {
    const t = drawn.drawnTimeline([6, 0, 4])
    expect(t.durations).toEqual([6.8, 5, 4.8])
    expect(t.starts).toEqual([0, 6.8, 11.8])
    expect(t.total).toBeCloseTo(16.6)
    expect(t.voice).toEqual([[0, 6], [11.8, 15.8]])
    // the picture of every slide but the last runs XFADE longer (fade over the next start)
    expect(t.clipLengths).toEqual([6.8 + drawn.XFADE, 5 + drawn.XFADE, 4.8])
  })
  it('cross-fades at each slide start and lays the voice in order', () => {
    const f: string = drawn.joinFilter({ durations: [6.8, 5, 4.8], audio: [3, -1, 4] })
    expect(f).toContain('xfade=transition=fade:duration=0.5:offset=6.8')
    expect(f).toContain('offset=11.8')
    expect(f).toContain('anullsrc')
    expect(f).toContain('concat=n=3:v=0:a=1[aout]')
  })
  it('zooms slowly (at most 4%) and stays centred', () => {
    const k: string = drawn.kenBurnsFilter(0, 6)
    expect(k).toContain("z='1+0.04*on/180'")
    expect(k).toContain("x='iw/2-(iw/zoom/2)'")
    expect(drawn.kenBurnsFilter(1, 6)).toContain("z='1.04-0.04*on/180'")
  })
  it('server.js uses it for the Drawn slides look', () => {
    expect(read('render-service/server.js')).toMatch(/if \(useFal\) \{[\s\S]{0,400}assembleDrawnSlides/)
  })
})

describe('client cover never shows our brand', () => {
  it('falls back to the agent\'s own name, else nothing', () => {
    expect(resolvePreparerName({ brandName: 'Rivera Insurance' })).toBe('Rivera Insurance')
    expect(resolvePreparerName({ brandName: '', profile: { company_name: null, full_name: 'Dana Reyes' } })).toBe('Dana Reyes')
    expect(resolvePreparerName({ profile: { company_name: 'Reyes Group', full_name: 'Dana Reyes' } })).toBe('Reyes Group')
    expect(resolvePreparerName({})).toBeNull()
    expect(resolvePreparerName({ brandName: 'Docs2Video', profile: { full_name: 'Dana Reyes' } })).toBe('Dana Reyes')
    expect(resolvePreparerName({ companyName: 'docs2video.com' })).toBeNull()
    expect(resolvePreparerName({ brandName: 'Rivera', hideName: true })).toBeNull()
    expect(PLATFORM_NAME_RE.test('Text2Art')).toBe(true)
  })

  // Every file that builds a client video's props: no fallback to our name.
  const VIDEO_FILES = [
    ...readdirSync(path.join(ROOT, 'render-service')).filter((f) => f.endsWith('.js')).map((f) => `render-service/${f}`),
    'app/_lib/personalize.ts', 'app/_lib/v3-render.ts', 'app/_lib/editorial-render.ts', 'app/_lib/first-scene-preview-server.ts',
    'app/_lib/drawn-slides.ts', 'app/_lib/presenter.ts', 'app/api/generate-video/route.ts',
    'remotion/src/DirectedVideo.tsx', 'remotion/src/v3/V3Video.tsx', 'remotion/src/v3/DesignFrame.tsx', 'remotion/src/editorial/EditorialVideo.tsx',
    'remotion/src/editorial/EditorialScenes.tsx', 'remotion/src/components/infographic/InfographicVideo.tsx', 'remotion/src/cinematic/Glass.tsx', 'remotion/src/cinematic/LogoScenes.tsx',
  ].filter((f) => existsSync(path.join(ROOT, f)))
  it('no `|| \'docs2video\'` style fallback in any video builder', () => {
    const bad: string[] = []
    const re = /(\|\||\?\?|:)\s*['"`](docs\s*2\s*video|text\s*2\s*art)(\.com|\.app)?['"`]/gi
    for (const f of VIDEO_FILES) for (const m of read(f).matchAll(re)) bad.push(`${f}: ${m[0]}`)
    expect(bad).toEqual([])
  })
  it('generate-video reads the agent\'s profile name and resolves the preparer through the helper', () => {
    const r = read('app/api/generate-video/route.ts')
    expect(r).toMatch(/\.select\('[^']*full_name[^']*'\)/)
    expect(r).toContain('resolvePreparerName({')
  })
  it('the free preview cover with no brand says nothing about us', () => {
    const src = read('render-service/server.js')
    const pure = src.slice(src.indexOf('// ==== PURE HELPERS (BEGIN) ===='), src.indexOf('// ==== PURE HELPERS (END) ===='))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const H: any = new Function(`${pure}\nreturn { previewDirectedJob }`)()
    const slides = req(path.join(ROOT, 'render-service/slides.js'))
    const j = H.previewDirectedJob({
      scenes: [{ role: 'cover', title: 'Your plan', narration: 'Hello.' }, { role: 'content', title: 'Numbers', narration: 'Here are the numbers.' }, { role: 'closing', title: 'Thanks', narration: 'Thank you.' }],
      preparer: '', recipient: 'David Reese',
    }, { planFromSuppliedScenes: slides.planFromSuppliedScenes, buildBrandPalette: slides.buildBrandPalette })
    expect(JSON.stringify(j.props)).not.toMatch(/docs\s*2\s*video/i)
    expect(j.props.plan.chrome.recipient).toBe('David Reese')
  })
})

describe('small visual fixes', () => {
  it('"vs" only between things really compared', () => {
    expect(isRealComparison([{ label: 'Monthly premium', value: '$184/month' }, { label: 'Covered until', value: 'Age 95' }])).toBe(false)
    expect(isRealComparison([{ label: 'Premium', value: '$184/mo' }, { label: 'Death benefit', value: '$500,000' }])).toBe(false)
    expect(isRealComparison([{ label: 'Today', value: '$184/mo' }, { label: 'At renewal', value: '$212/month' }])).toBe(true)
    expect(isRealComparison([{ label: 'Before', value: '12%' }, { label: 'After', value: '4%' }])).toBe(true)
    expect(isRealComparison([{ label: 'Plan A', value: 'Term' }, { label: 'Plan B', value: 'Whole life' }])).toBe(true)
    expect(isRealComparison([{ label: 'A', value: '1' }, { label: 'B', value: '2' }, { label: 'C', value: '3' }])).toBe(false)
  })
  it('a date gets a calendar, protection keeps the shield', () => {
    expect(glyphFor('Covered until')).toBe('calendar')
    expect(glyphFor('Coverage until age 95')).toBe('calendar')
    expect(glyphFor('Renews')).toBe('calendar')
    expect(glyphFor('Death benefit')).toBe('shield')
    expect(glyphFor('Monthly premium')).toBe('coin')
  })
  it('Root.tsx and DirectedVideo never fall back to stale public/*.json', () => {
    const root = read('remotion/src/Root.tsx')
    for (const f of ['v3.json', 'editorial.json', 'infographic.json']) expect(root).not.toContain(`staticFile('${f}')`)
    expect(read('remotion/src/DirectedVideo.tsx')).not.toContain("staticFile('dir-plan.json')")
  })
})
