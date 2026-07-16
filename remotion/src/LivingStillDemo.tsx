import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from 'remotion'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { LivingStill, CamBreath } from './lib/cinematography'

const { fontFamily: G } = loadSpaceGrotesk()
const FPS = 30
const s = (n: number) => Math.round(n * FPS)

// use existing generated stills from earlier videos to prove the technique
const SCENES: { src: string; atmos: any; grade: any; label: string }[] = [
  { src: 'ihost/gen/table.png', atmos: 'dust', grade: 'warm', label: 'DUST · WARM' },
  { src: 'botmakers/gen/build.png', atmos: 'rays', grade: 'cool', label: 'LIGHT RAYS · COOL' },
  { src: 'ihost/gen/crowd.png', atmos: 'embers', grade: 'warm', label: 'EMBERS · WARM' },
  { src: 'smartviewz/gen/chaos.png', atmos: 'fog', grade: 'gritty', label: 'FOG · GRITTY' },
]

const SEC = s(3.6)
export const LIVING_FRAMES = SCENES.length * SEC

const Cap: React.FC<{ t: string }> = ({ t }) => {
  const frame = useCurrentFrame()
  const o = interpolate(frame, [4, 14, SEC - 12, SEC], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90 }}>
      <div style={{ opacity: o, fontFamily: G, fontWeight: 700, fontSize: 30, color: '#fff', letterSpacing: '0.24em', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{t}</div>
      <div style={{ opacity: o * 0.7, fontFamily: G, fontWeight: 600, fontSize: 18, color: '#cbd5e1', letterSpacing: '0.3em', marginTop: 10 }}>ONE STILL IMAGE — NO VIDEO</div>
    </AbsoluteFill>
  )
}

export const LivingStillDemo: React.FC = () => (
  <AbsoluteFill style={{ background: '#000' }}>
    {SCENES.map((sc, i) => (
      <Sequence key={i} from={i * SEC} durationInFrames={SEC}>
        <CamBreath intensity={1.1}>
          <LivingStill src={sc.src} dur={SEC} atmos={sc.atmos} grade={sc.grade} />
        </CamBreath>
        <Cap t={sc.label} />
      </Sequence>
    ))}
  </AbsoluteFill>
)
