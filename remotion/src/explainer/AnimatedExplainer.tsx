import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, staticFile, Img } from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { fitText } from '@remotion/layout-utils'
import { Person, DocObject, ChartObject, CheckObject, SendObject } from './Figures'
import { STORYBOARD, STORY_TOTAL, shotStarts, type Shot, type ActorSpec, type PropSpec, type Entrance } from './director'

const { fontFamily: ARCHIVO } = loadArchivo()
const { fontFamily: INTER } = loadInter()

export const EXPLAINER_FRAMES = STORY_TOTAL // ~930 = 31s
const BG_TOP = '#eaf2fb'
const BG_BOT = '#d6e6f5'
const INK = '#1a2230'

// Resolve an entrance to an [x offset, y offset, opacity, scale] over local time.
function entranceXform(entrance: Entrance, t: number, fps: number) {
  const s = spring({ frame: t, fps, config: { damping: 15, stiffness: 110, mass: 0.9 } })
  switch (entrance) {
    case 'walkInLeft': return { dx: (1 - s) * -700, dy: 0, op: interpolate(t, [0, 10], [0, 1], { extrapolateRight: 'clamp' }), sc: 1, walk: 1 - s }
    case 'walkInRight': return { dx: (1 - s) * 700, dy: 0, op: interpolate(t, [0, 10], [0, 1], { extrapolateRight: 'clamp' }), sc: 1, walk: 1 - s }
    case 'riseUp': return { dx: 0, dy: (1 - s) * 200, op: s, sc: 1, walk: 0 }
    case 'slideDown': return { dx: 0, dy: (1 - s) * -260, op: s, sc: 1, walk: 0 }
    case 'popIn': return { dx: 0, dy: 0, op: interpolate(t, [0, 6], [0, 1], { extrapolateRight: 'clamp' }), sc: 0.3 + s * 0.7, walk: 0 }
  }
}

// Map an action to rig params (arm angles / head tilt) at local time.
function actionRig(action: ActorSpec['action'], t: number, actionAt: number, fps: number) {
  const a = Math.max(0, t - actionAt)
  const p = spring({ frame: a, fps, config: { damping: 12, stiffness: 150 } })
  const idle = t * 0.09
  switch (action) {
    case 'point': return { leftArm: -0.6, rightArm: interpolate(p, [0, 1], [-0.6, 0.9]), headTilt: interpolate(p, [0, 1], [0, 6]), idle }
    case 'wave': { const w = Math.sin(a * 0.5) * 0.4; return { leftArm: -0.6, rightArm: 0.8 + w, headTilt: -4, idle } }
    case 'present': return { leftArm: interpolate(p, [0, 1], [-0.6, 0.5]), rightArm: interpolate(p, [0, 1], [-0.6, 0.5]), headTilt: interpolate(p, [0, 1], [0, 4]), idle }
    case 'handoff': return { leftArm: -0.6, rightArm: interpolate(p, [0, 1], [-0.6, 0.7]), headTilt: 3, idle }
    case 'react': { const r = Math.sin(a * 0.3) * 0.15; return { leftArm: interpolate(p, [0, 1], [-0.6, 0.3]) + r, rightArm: interpolate(p, [0, 1], [-0.6, 0.3]) - r, headTilt: interpolate(p, [0, 1], [0, -8]), idle } }
    case 'celebrate': { const c = Math.sin(a * 0.35) * 0.2; return { leftArm: 0.9 + c, rightArm: 0.9 - c, headTilt: Math.sin(a * 0.3) * 5, idle } }
    default: return { leftArm: -0.6, rightArm: -0.6, headTilt: 0, idle }
  }
}

const Prop: React.FC<{ spec: PropSpec; localFrame: number }> = ({ spec, localFrame }) => {
  const { fps } = useVideoConfig()
  const e = entranceXform(spec.entrance, localFrame, fps)!
  // guard equal-range animate ([30,30] = a static prop that never morphs)
  const prog = spec.animate && spec.animate[1] > spec.animate[0]
    ? interpolate(localFrame, spec.animate, [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0
  const bob = Math.sin(localFrame * 0.05) * 8
  const el = spec.kind === 'doc' ? <DocObject morph={prog} scale={spec.scale} />
    : spec.kind === 'chart' ? <ChartObject grow={prog} scale={spec.scale} />
    : spec.kind === 'check' ? <CheckObject draw={prog} scale={spec.scale} />
    : <SendObject scale={spec.scale} />
  return (
    <div style={{ position: 'absolute', left: spec.x, top: spec.y, transform: `translate(-50%,-50%) translate(${e.dx}px, ${e.dy + bob}px) scale(${e.sc})`, opacity: e.op }}>
      {el}
    </div>
  )
}

const Actor: React.FC<{ spec: ActorSpec; localFrame: number }> = ({ spec, localFrame }) => {
  const { fps } = useVideoConfig()
  const e = entranceXform(spec.entrance, localFrame, fps)!
  const rig = actionRig(spec.action, localFrame, spec.actionAt, fps)
  // walk cycle: bob legs while entering
  const walkBob = e.walk > 0.02 ? Math.sin(localFrame * 0.6) * 6 : 0
  return (
    <div style={{ position: 'absolute', left: spec.x, top: spec.y, transform: `translate(-50%,-100%) translate(${e.dx}px, ${e.dy + walkBob}px) scale(${e.sc * spec.scale}) ${spec.flip ? 'scaleX(-1)' : ''}`, opacity: e.op }}>
      <Person skin={spec.skin} shirt={spec.shirt} leftArm={rig.leftArm} rightArm={rig.rightArm} headTilt={rig.headTilt} idle={rig.idle} />
    </div>
  )
}

const Caption: React.FC<{ shot: Shot }> = ({ shot }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig()
  const { fontSize: fit } = fitText({ text: shot.caption, withinWidth: 1600, fontFamily: ARCHIVO, fontWeight: 800 })
  const size = Math.min(78, fit * 0.94)
  const s = spring({ frame: frame - shot.captionAt, fps, config: { damping: 15, stiffness: 170 } })
  return (
    <div style={{ position: 'absolute', top: 120, width: '100%', textAlign: 'center' }}>
      <div style={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: size, color: shot.captionColor || INK, opacity: s, transform: `translateY(${(1 - s) * 22}px)`, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{shot.caption}</div>
    </div>
  )
}

const ShotScene: React.FC<{ shot: Shot }> = ({ shot }) => {
  const frame = useCurrentFrame()
  const out = interpolate(frame, [shot.durationInFrames - 12, shot.durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) })
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {shot.props.map((p, i) => <Prop key={`p${i}`} spec={p} localFrame={frame} />)}
      {shot.actors.map((a, i) => <Actor key={`a${i}`} spec={a} localFrame={frame} />)}
      <Caption shot={shot} />
    </AbsoluteFill>
  )
}

export const AnimatedExplainer: React.FC = () => {
  const starts = shotStarts()
  const frame = useCurrentFrame()
  // moving ground shadow + subtle parallax dots for "alive" stage
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG_TOP}, ${BG_BOT})` }}>
      {/* soft decorative blobs (parallax) */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: '#c7ddf2', left: -120 + Math.sin(frame * 0.01) * 20, top: 120, filter: 'blur(4px)', opacity: 0.5 }} />
      <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: '#fce4c0', right: -80 + Math.cos(frame * 0.008) * 18, bottom: 60, filter: 'blur(4px)', opacity: 0.55 }} />
      {/* ground line */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 180, height: 3, background: 'rgba(45,106,159,0.18)' }} />

      {STORYBOARD.map((shot, i) => (
        <Sequence key={shot.id} from={starts[i]} durationInFrames={shot.durationInFrames}>
          <ShotScene shot={shot} />
        </Sequence>
      ))}

      {/* logo chrome */}
      <Img src={staticFile('d2v-logo.png')} style={{ position: 'absolute', top: 40, left: 54, height: 44, opacity: 0.9 }} />
    </AbsoluteFill>
  )
}
