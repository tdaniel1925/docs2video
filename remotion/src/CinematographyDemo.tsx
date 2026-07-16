import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion'
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { CamBreath, CamMove, CamPunch, DepthStage, DepthLayer, WeightyEntry, FlowThrough, EmergeFromDepth } from './lib/cinematography'
import { ParticleField } from './lib/dynamics'

const { fontFamily: G } = loadSpaceGrotesk()
const FPS = 30
const s = (n: number) => Math.round(n * FPS)
const BG = '#0a0f1c', ACC = '#38bdf8', ACC2 = '#f59e0b'
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// a labeled card used in both halves
const Card: React.FC<{ t: string; c?: string; size?: number }> = ({ t, c = '#fff', size = 90 }) => (
  <div style={{ background: '#141c2e', border: `1px solid ${c}44`, borderRadius: 20, padding: '40px 64px', fontFamily: G, fontWeight: 700, fontSize: size, color: c, boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${c}22` }}>{t}</div>
)

// =================== BEFORE — our current "beat → hold" ====================
const Before: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const tag = <div style={{ position: 'absolute', top: 50, left: 60, fontFamily: G, fontWeight: 700, fontSize: 26, color: '#64748b', letterSpacing: '0.2em' }}>BEFORE — beat · hold</div>
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #101a30, ${BG})`, justifyContent: 'center', alignItems: 'center' }}>
      {tag}
      {/* simple push-in that resets; card springs in and sits */}
      <div style={{ transform: `scale(${1 + interpolate(frame, [0, s(3.2)], [0, 0.06], { extrapolateRight: 'clamp' })})` }}>
        <div style={{ transform: `scale(${clamp(spring({ frame, fps, config: { damping: 14, stiffness: 180 } }), 0, 1)})` }}>
          <Card t="MOVEMENT" c={ACC} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// =================== AFTER — flowing cinematography ========================
const After: React.FC = () => {
  const frame = useCurrentFrame()
  const tag = <div style={{ position: 'absolute', top: 50, left: 60, fontFamily: G, fontWeight: 700, fontSize: 26, color: ACC, letterSpacing: '0.2em', zIndex: 10 }}>AFTER — flowing camera · depth · weight</div>
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #101a30, ${BG})`, overflow: 'hidden' }}>
      {tag}
      {/* perpetual handheld breath over everything */}
      <CamBreath intensity={1.3}>
        {/* a continuous camera move: arrive (push in + drift) then punch on the beat */}
        <CamMove keys={[{ at: 0, scale: 1.25, x: 8, y: 4 }, { at: s(2.2), scale: 1.0, x: 0, y: 0 }, { at: s(3.2), scale: 1.08, x: -3, y: 0 }]}>
          <CamPunch at={s(2.0)} amount={0.07}>
            {/* deep parallax stage */}
            <DepthStage travelX={-10} push={0.2}>
              {/* far layer — giant faint word */}
              <DepthLayer depth={0.1} float={1}>
                <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontFamily: G, fontWeight: 700, fontSize: 460, color: '#0e1830' }}>FLOW</div>
                </AbsoluteFill>
              </DepthLayer>
              {/* mid layer — particles */}
              <DepthLayer depth={0.5} float={1.4}>
                <ParticleField color={ACC} count={26} kind="data" />
              </DepthLayer>
              {/* near layer — the card flies in with WEIGHT (overshoot + shadow lag) */}
              <DepthLayer depth={1} float={0.6}>
                <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
                  <WeightyEntry at={s(0.5)} from="bottom" distance={500}>
                    <Card t="MOVEMENT" c={ACC} />
                  </WeightyEntry>
                </AbsoluteFill>
              </DepthLayer>
            </DepthStage>
          </CamPunch>
        </CamMove>
      </CamBreath>
    </AbsoluteFill>
  )
}

// =============== FLOW-THROUGH TRANSITION (scenes connect) ==================
const SceneA: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #1a1030, ${BG})` }}>
      <div style={{ position: 'absolute', top: 50, left: 60, fontFamily: G, fontWeight: 700, fontSize: 26, color: '#94a3b8', letterSpacing: '0.2em', zIndex: 10 }}>SCENES FLOW INTO EACH OTHER</div>
      <CamBreath intensity={1}>
        <FlowThrough startAt={s(2.0)} dur={s(0.9)}>
          <DepthStage push={0.18}>
            <DepthLayer depth={0.3} float={1.2}><ParticleField color={ACC2} count={20} kind="data" /></DepthLayer>
            <DepthLayer depth={1} float={0.5}>
              <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
                <WeightyEntry at={s(0.3)} from="scale"><Card t="PUSH" c={ACC2} size={120} /></WeightyEntry>
              </AbsoluteFill>
            </DepthLayer>
          </DepthStage>
        </FlowThrough>
      </CamBreath>
    </AbsoluteFill>
  )
}
const SceneB: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, #0e2436, ${BG})` }}>
    <CamBreath intensity={1}>
      <EmergeFromDepth dur={s(0.8)}>
        <DepthStage push={0.16}>
          <DepthLayer depth={0.3} float={1.2}><ParticleField color={ACC} count={20} kind="data" /></DepthLayer>
          <DepthLayer depth={1} float={0.5}>
            <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
              <WeightyEntry at={s(0.2)} from="scale"><Card t="THROUGH" c={ACC} size={120} /></WeightyEntry>
            </AbsoluteFill>
          </DepthLayer>
        </DepthStage>
      </EmergeFromDepth>
    </CamBreath>
  </AbsoluteFill>
)

const SEC = s(3.4)
export const CINEMA_FRAMES = SEC * 4

export const CinematographyDemo: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <Sequence from={0} durationInFrames={SEC}><Before /></Sequence>
    <Sequence from={SEC} durationInFrames={SEC}><After /></Sequence>
    {/* the flow-through pair, overlapping so B emerges as A pushes through */}
    <Sequence from={SEC * 2} durationInFrames={SEC}><SceneA /></Sequence>
    <Sequence from={Math.round(SEC * 2 + s(2.6))} durationInFrames={SEC}><SceneB /></Sequence>
  </AbsoluteFill>
)
