import React from 'react'
import { AbsoluteFill, Img, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadBangers } from '@remotion/google-fonts/Bangers'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { Panel, PanelReveal, SpeechBubble, CaptionBox, Burst, MotionLines, Halftone, InkFlash, ComicPage } from './lib/comic'
import { makeMusicDuck, type VoWindow } from './lib/audio'
import { MusicBed } from './lib/musicbed'

const { fontFamily: COMIC } = loadBangers()        // comic display font
const { fontFamily: BLACK } = loadArchivoBlack()
const FPS = 30
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ============================================================================
 * DOCS2VIDEO — MOTION COMIC. A stylized ink graphic-novel ad. Consistent hero
 * "Maya" (reference-based generation) across 6 story panels: buried in docs →
 * ignored → discovers Docs2Video → uploads → video plays → closes the deal.
 * Uses the comic engine (panels, bubbles, POW bursts, halftone, ink flashes).
 * ==========================================================================*/

const PAGE = '#e6dfce', TEAL = '#0d8a7e', INK = '#0a0a0a', GOLD = '#f5cf45', RED = '#e0392f'
const P = (n: string) => `comic/gen/${n}.png`

const s = (sec: number) => Math.round(sec * FPS)
type Beat = { dur: number; vo?: string; el: React.ReactNode }
// VO: 1:3.53 2:2.28 3:5.06 4:6.59 5:4.69 6:4.78 7:2.88 8:4.23 9:5.25
const BEATS: Beat[] = [
  // 1 — meet Maya (single panel, caption)
  { dur: s(3.53 + 0.3), vo: 'cm-1', el: <Page>
      <PanelReveal at={2} kind="slam"><Full src={P('p1-desk')} dur={s(3.83)} focus="50% 40%" /></PanelReveal>
      <CaptionBox text="Meet Maya." at={6} x={7} y={10} font={COMIC} size={34} />
      <SpeechBubble text="Not again!" at={s(1.4)} x={80} y={22} w={240} tail="bl" font={COMIC} size={30} />
    </Page> },
  // 2 — buried under docs
  { dur: s(2.28 + 0.5), vo: 'cm-2', el: <Page>
      <PanelReveal at={0} kind="pop"><Full src={P('p1-desk')} dur={s(2.78)} focus="40% 55%" /></PanelReveal>
      <MotionLines at={4} focal={[50, 50]} />
      <Burst word="UGH!" at={s(0.6)} x={26} y={30} color={GOLD} ink={RED} font={COMIC} />
      <CaptionBox text="Buried under docs nobody reads." at={4} x={7} y={10} font={COMIC} size={26} color={GOLD} />
    </Page> },
  // 3 — ignored, deals slipping (bubble in the TOP-RIGHT corner, tail toward her)
  { dur: s(5.06 + 0.3), vo: 'cm-3', el: <Page>
      <PanelReveal at={2} kind="slideL"><Full src={P('p2-ignored')} dur={s(5.36)} focus="50% 40%" /></PanelReveal>
      <SpeechBubble text="Ignored again?!" at={s(1.4)} x={76} y={20} w={360} tail="bl" color="#fff" font={COMIC} size={32} />
      <CaptionBox text="Her deals — slipping away." at={s(3.0)} x={7} y={84} font={COMIC} size={26} color={GOLD} />
    </Page> },
  // 4 — DISCOVERS Docs2Video (the turn — big burst) — new shorter VO (4.23s)
  { dur: s(4.23 + 0.4), vo: 'cm-4', el: <Page>
      <PanelReveal at={2} kind="slam"><Full src={P('p3-discover')} dur={s(4.63)} focus="50% 42%" /></PanelReveal>
      <MotionLines at={s(1.2)} focal={[55, 40]} color={TEAL} />
      <Burst word="DOCS2VIDEO!" at={s(1.6)} x={50} y={80} color={TEAL} ink="#fff" font={COMIC} />
    </Page> },
  // 5 — uploads a doc, AI writes a story
  { dur: s(4.69 + 0.3), vo: 'cm-5', el: <Page>
      <PanelReveal at={0} kind="slideR"><Full src={P('p4-upload')} dur={s(4.99)} focus="50% 45%" /></PanelReveal>
      <MotionLines at={s(0.6)} focal={[60, 45]} color={TEAL} />
      <CaptionBox text="Drop in a doc — AI writes a real story!" at={s(1.2)} font={COMIC} size={24} color={GOLD} />
    </Page> },
  // 6 — branded video plays (bubble TOP-LEFT corner, clear of the subject)
  { dur: s(4.78 + 0.3), vo: 'cm-6', el: <Page>
      <PanelReveal at={2} kind="pop"><Full src={P('p5-video')} dur={s(5.08)} focus="50% 45%" /></PanelReveal>
      <SpeechBubble text="A video they actually watch!" at={s(1.4)} x={26} y={20} w={400} tail="br" color="#fff" font={COMIC} size={28} />
    </Page> },
  // 7 — DEAL CLOSED (win — big burst)
  { dur: s(2.88 + 0.5), vo: 'cm-7', el: <Page>
      <PanelReveal at={0} kind="slam"><Full src={P('p6-win')} dur={s(3.38)} focus="50% 40%" /></PanelReveal>
      <MotionLines at={2} focal={[50, 45]} color={GOLD} />
      <Burst word="DEAL CLOSED!" at={s(0.5)} x={50} y={80} color={GOLD} ink={RED} font={COMIC} />
    </Page> },
  // 8 — brand
  { dur: s(4.23 + 0.3), vo: 'cm-8', el: <BrandPage /> },
  // 9 — CTA
  { dur: s(5.25 + 1.4), vo: 'cm-9', el: <CTAPage /> },
]

// full-bleed comic panel with a thick ink border inset from the paper edge
function Full({ src, dur, focus }: { src: string; dur: number; focus?: string }) {
  return (
    <AbsoluteFill style={{ padding: 44 }}>
      <Panel src={src} dur={dur} focus={focus} border={10} borderColor={INK} push={0.09} style={{ width: '100%', height: '100%', borderRadius: 6 }} />
    </AbsoluteFill>
  )
}
function Page({ children }: { children: React.ReactNode }) {
  return <ComicPage bg={PAGE}>{children}<Halftone opacity={0.1} size={6} /></ComicPage>
}

function BrandPage() {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 4, fps, config: { damping: 12, stiffness: 160 } })
  return (
    <ComicPage bg={INK}>
      <MotionLines at={2} focal={[50, 50]} color={TEAL} count={50} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24 }}>
        <div style={{ transform: `scale(${0.7 + clamp(pop, 0, 1) * 0.3})` }}>
          <Img src={staticFile('comic/logo.png')} style={{ width: 560, height: 'auto', filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.4))' }} />
        </div>
        <div style={{ fontFamily: COMIC, fontSize: 52, color: '#fff', textAlign: 'center', opacity: clamp((frame - 16) / 10, 0, 1), textShadow: `3px 3px 0 ${TEAL}` }}>Turn any document into a video that sells!</div>
      </AbsoluteFill>
      <Halftone opacity={0.14} size={7} color="#fff" />
    </ComicPage>
  )
}

function CTAPage() {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const btn = spring({ frame: frame - 8, fps, config: { damping: 11, stiffness: 200 } })
  const url = interpolate(frame, [40, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pulse = 1 + Math.sin(frame * 0.14) * 0.03
  return (
    <ComicPage bg={PAGE}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26 }}>
        <Img src={staticFile('comic/logo.png')} style={{ width: 440, height: 'auto', filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.3))' }} />
        <div style={{ fontFamily: COMIC, fontSize: 60, color: INK, textAlign: 'center', textShadow: `3px 3px 0 ${GOLD}` }}>Be the hero of your next pitch!</div>
        <div style={{ marginTop: 6, opacity: clamp(btn, 0, 1), transform: `scale(${(0.7 + clamp(btn, 0, 1) * 0.3) * pulse}) rotate(-2deg)` }}>
          <div style={{ background: TEAL, color: '#fff', fontFamily: COMIC, fontSize: 42, padding: '18px 52px', borderRadius: 10, border: `4px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}` }}>START FREE — 2,000 CREDITS</div>
        </div>
        <div style={{ fontFamily: BLACK, fontSize: 26, color: INK, opacity: url, letterSpacing: '0.04em' }}>docs2video.com</div>
      </AbsoluteFill>
      <Halftone opacity={0.1} size={6} />
    </ComicPage>
  )
}

const STARTS: number[] = []; { let t = 0; for (const b of BEATS) { STARTS.push(t); t += b.dur } }
export const comicDuration = STARTS[STARTS.length - 1] + BEATS[BEATS.length - 1].dur + 6
const MUSIC_FRAMES = Math.round(47.96 * FPS)   // 48s covers the full video — no loop

export const CommercialDocs2VideoComic: React.FC = () => {
  const total = comicDuration
  const voWin = BEATS.map((b, i) => b.vo ? { start: STARTS[i], end: STARTS[i] + b.dur } : null).filter(Boolean) as VoWindow[]
  // fade-out ONLY at the very end (no mid-video dips); music now fully covers the video
  const musicDuck = makeMusicDuck(voWin, total, { loud: 0.22, duck: 0.09, ramp: 16, fadeInEnd: 12, fadeOutStart: total - 12, fadeOutEnd: total - 2 })
  return (
    <AbsoluteFill style={{ background: PAGE }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={STARTS[i]} durationInFrames={b.dur + 4}>
          {b.el}
          {/* ink-flash page-turn on each new page */}
          {i > 0 && <InkFlash at={0} />}
        </Sequence>
      ))}
      <MusicBed src="comic/music.mp3" musicFrames={MUSIC_FRAMES} volume={musicDuck} />
      {BEATS.map((b, i) => b.vo ? (
        <Sequence key={'vo' + i} from={STARTS[i]}><Audio src={staticFile(`comic/${b.vo}.mp3`)} volume={1.0} /></Sequence>
      ) : null)}
      {/* comic SFX — whoosh + impact on the burst beats */}
      {[STARTS[1], STARTS[3], STARTS[6]].map((st, i) => (
        <Sequence key={'x' + i} from={st + s(0.4)} durationInFrames={26}><Audio src={staticFile('sfx/impact.wav')} volume={0.4} /></Sequence>
      ))}
    </AbsoluteFill>
  )
}
