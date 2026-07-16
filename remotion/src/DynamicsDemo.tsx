import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import {
  Layer, MorphCut, ParticleLogo, ParticleField, LiquidCounter, GrowBars,
  ChartRoad, Cursor, PhysicsWord, BeatWord, ShatterWord,
} from './lib/dynamics'

const { fontFamily: BLACK } = loadArchivoBlack()
const { fontFamily: GROTESK } = loadSpaceGrotesk()
const FPS = 30
const s = (n: number) => Math.round(n * FPS)

const BG = '#0a0e17', ACC = '#38bdf8', ACC2 = '#f59e0b', RED = '#ef4444'

// simple label for each demo section
const Tag: React.FC<{ t: string }> = ({ t }) => (
  <div style={{ position: 'absolute', top: 50, left: 60, fontFamily: GROTESK, fontWeight: 700, fontSize: 26, color: ACC, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{t}</div>
)

// ---- 1. PARTICLE ASSEMBLE ----
const D1: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #12203a, ${BG})` }}>
    <Tag t="Particle Assembly" />
    <ParticleField color={ACC} count={30} kind="data" />
    <ParticleLogo color={ACC} count={110} at={6} span={30} mode="in">
      <div style={{ fontFamily: BLACK, fontSize: 150, color: '#fff', textShadow: `0 0 40px ${ACC}` }}>NEXUS</div>
    </ParticleLogo>
  </AbsoluteFill>
)

// ---- 2. MORPH CUT (square → circle → triangle) ----
const Shape: React.FC<{ kind: string; c: string }> = ({ kind, c }) => {
  const common = { width: 260, height: 260, background: `linear-gradient(135deg, ${c}, ${c}66)`, boxShadow: `0 0 50px ${c}88` } as React.CSSProperties
  if (kind === 'circle') return <div style={{ ...common, borderRadius: '50%' }} />
  if (kind === 'tri') return <div style={{ width: 0, height: 0, borderLeft: '150px solid transparent', borderRight: '150px solid transparent', borderBottom: `260px solid ${c}`, filter: `drop-shadow(0 0 40px ${c})` }} />
  return <div style={{ ...common, borderRadius: 24 }} />
}
const D2: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #1a1230, ${BG})` }}>
      <Tag t="Match-Cut Morph" />
      {frame < 30 && <MorphCut at={12} from={<Shape kind="square" c={ACC2} />} to={<Shape kind="circle" c={RED} />} />}
      {frame >= 30 && <MorphCut at={36} from={<Shape kind="circle" c={RED} />} to={<Shape kind="tri" c={ACC} />} />}
    </AbsoluteFill>
  )
}

// ---- 3. DATA AS SPECTACLE (liquid counter + growing bars + chart) ----
const D3: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 30%, #0c2030, ${BG})` }}>
      <Tag t="Data As Spectacle" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <LiquidCounter to={8400000} prefix="$" color={ACC} size={150} startAt={4} dur={34} font={BLACK} />
        <GrowBars values={[40, 62, 55, 78, 90, 72, 110, 130]} color={ACC} color2={ACC2} w={900} h={240} startAt={18} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0 }}>
        <ChartRoad points={[20, 35, 30, 50, 62, 55, 80, 95, 88, 120]} color={ACC2} w={1920} h={200} startAt={20} dur={40} />
      </div>
    </AbsoluteFill>
  )
}

// ---- 4. PHYSICS TYPE (drop + bounce, beat-pop, shatter) ----
const D4: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #2a1020, ${BG})`, justifyContent: 'center', alignItems: 'center' }}>
      <Tag t="Physics Kinetic Type" />
      {frame < 26 && <PhysicsWord text="IMPACT" color="#fff" size={200} at={4} font={BLACK} />}
      {frame >= 26 && frame < 56 && <BeatWord words={['STOP', 'THE', 'SCROLL']} beats={[28, 36, 44]} hot="scroll" hotColor={ACC2} size={120} font={BLACK} />}
      {frame >= 56 && <ShatterWord text="BOOM" color={RED} size={220} shatterAt={64} font={BLACK} />}
    </AbsoluteFill>
  )
}

// ---- 5. 3D PARALLAX PUSH ----
const D5: React.FC = () => (
  <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
    <Tag t="3D Parallax Push" />
    {/* far layer */}
    <Layer depth={0.1} drift={[-2, 0]}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: BLACK, fontSize: 500, color: '#141c2e' }}>10X</div>
      </AbsoluteFill>
    </Layer>
    {/* mid layer */}
    <Layer depth={0.5} drift={[3, -1]}>
      <ParticleField color={ACC} count={26} kind="dust" />
    </Layer>
    {/* near layer */}
    <Layer depth={1} drift={[-4, 2]}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 90, color: '#fff', textShadow: `0 0 40px ${ACC}` }}>Depth is <span style={{ color: ACC }}>everything.</span></div>
      </AbsoluteFill>
    </Layer>
  </AbsoluteFill>
)

const SECTIONS = [D1, D2, D3, D4, D5]
const SEC = s(3.2)
export const DYNAMICS_FRAMES = SECTIONS.length * SEC

export const DynamicsDemo: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    {SECTIONS.map((C, i) => (
      <Sequence key={i} from={i * SEC} durationInFrames={SEC}>
        <C />
        <FadeEdge />
      </Sequence>
    ))}
  </AbsoluteFill>
)

const FadeEdge: React.FC = () => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [0, 8, SEC - 8, SEC], [1, 0, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ background: BG, opacity: o, pointerEvents: 'none' }} />
}
