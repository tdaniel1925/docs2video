/**
 * MOTION LOOK — proof-of-concept sample.
 *
 * Demonstrates the proposed "Motion" style: real stock footage (Pexels)
 * underneath the existing brand/typography layer, made cohesive by ONE unified
 * grade applied to every clip:
 *   - darken + slight desaturation + brand-navy duotone wash  → six clips from
 *     six different shoots read as one cinematographer's work
 *   - 0.85x speed + slow push-in                              → cinematic weight
 *   - animated film grain + vignette                          → shot-on-film feel
 *   - TWO cuts per scene on an editorial rhythm               → real edit, not a
 *     screensaver
 *   - glass panel kicker/title (brand gold accent)            → sharp text stays
 *     an overlay, never baked into footage
 *
 * Content mirrors a real produced video ("You Belong Here") so the comparison
 * against the current static-image look is apples-to-apples.
 */
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FPS } from '../tokens'

export type MotionScene = {
  kicker: string
  title: string
  metric?: { value: string; label: string }
  /** Two stock clips per scene — cut halfway for edit rhythm. */
  clips: [string, string]
}

export type MotionSampleProps = {
  brandDeep: string   // duotone/scrim base (navy)
  brandAccent: string // kicker/rule/metric (gold)
  scenes: MotionScene[]
}

const SCENE_SEC = 8
export const SCENE_FRAMES = SCENE_SEC * FPS
export const MOTION_SAMPLE_FRAMES = SCENE_FRAMES * 3

export const MOTION_DEFAULT: MotionSampleProps = {
  brandDeep: '#12264a',
  brandAccent: '#E8B84B',
  scenes: [
    {
      kicker: 'YOU BELONG HERE',
      title: 'A Home for Every Jew',
      clips: [
        'https://videos.pexels.com/video-files/7803504/7803504-hd_1920_1080_25fps.mp4',
        'https://videos.pexels.com/video-files/8379037/8379037-hd_1920_1080_25fps.mp4',
      ],
    },
    {
      kicker: 'PROGRAMS',
      title: 'Six Programs, One Community',
      metric: { value: '6', label: 'PROGRAMS' },
      clips: [
        'https://videos.pexels.com/video-files/32778876/13973090_1920_1080_30fps.mp4',
        'https://videos.pexels.com/video-files/29430344/12670228_1920_1080_30fps.mp4',
      ],
    },
    {
      kicker: 'ENROLL NOW',
      title: 'Hebrew School — Enroll Now',
      clips: [
        'https://videos.pexels.com/video-files/8799141/8799141-hd_1920_1080_24fps.mp4',
        'https://videos.pexels.com/video-files/7516716/7516716-hd_1920_1080_30fps.mp4',
      ],
    },
  ],
}

/** One stock clip with the unified brand grade + slow push-in. */
const GradedClip: React.FC<{ src: string; cutFrames: number; brandDeep: string; pushFrom: number }> = ({ src, cutFrames, brandDeep, pushFrom }) => {
  const frame = useCurrentFrame()
  // Slow push-in across the cut — alternate direction per cut for variety.
  const scale = interpolate(frame, [0, cutFrames], [pushFrom, pushFrom > 1.08 ? 1.05 : 1.14], {
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <OffthreadVideo
          src={src}
          muted
          playbackRate={0.85}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            // THE grade: this one line of color science is what makes mixed
            // stock read as a single shoot.
            filter: 'brightness(0.78) saturate(0.82) contrast(1.06)',
          }}
        />
      </AbsoluteFill>
      {/* Brand duotone wash — pulls every clip's palette toward the brand navy. */}
      <AbsoluteFill style={{ background: brandDeep, mixBlendMode: 'color', opacity: 0.32 }} />
      {/* Directional scrim so the text panel always sits on quiet pixels. */}
      <AbsoluteFill style={{ background: `linear-gradient(75deg, ${brandDeep}E6 0%, ${brandDeep}66 38%, transparent 62%)` }} />
      {/* Vignette. */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />
    </AbsoluteFill>
  )
}

/** Animated film grain — re-seeded every 4 frames (cheap, cacheable). */
const Grain: React.FC = () => {
  const frame = useCurrentFrame()
  const seed = Math.floor(frame / 4) % 5
  return (
    <AbsoluteFill
      style={{
        opacity: 0.06,
        mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed}'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '240px 240px',
      }}
    />
  )
}

const ScenePanel: React.FC<{ scene: MotionScene; brandAccent: string }> = ({ scene, brandAccent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 120 } })
  const y = interpolate(enter, [0, 1], [36, 0])
  // Fade the panel (and scene) out over the last 8 frames for a soft handoff.
  const exit = interpolate(frame, [SCENE_FRAMES - 8, SCENE_FRAMES], [1, 0], { extrapolateLeft: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 110px 96px', opacity: exit }}>
      <div style={{ transform: `translateY(${y}px)`, opacity: enter, maxWidth: 860 }}>
        <div style={{
          display: 'inline-block', padding: '34px 44px', borderRadius: 10,
          background: 'rgba(8, 16, 34, 0.55)', backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 700,
            letterSpacing: '0.28em', color: brandAccent, marginBottom: 14,
          }}>{scene.kicker}</div>
          <div style={{ width: 54, height: 3, background: brandAccent, marginBottom: 18, borderRadius: 2 }} />
          <div style={{
            fontFamily: 'Archivo, Inter, sans-serif', fontSize: 58, fontWeight: 800,
            lineHeight: 1.08, color: '#FFFFFF', letterSpacing: '-0.01em',
          }}>{scene.title}</div>
          {scene.metric && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 22 }}>
              <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: 64, fontWeight: 800, color: brandAccent, lineHeight: 1 }}>
                {scene.metric.value}
              </span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.85)' }}>
                {scene.metric.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  )
}

const SceneBlock: React.FC<{ scene: MotionScene; brandDeep: string; brandAccent: string }> = ({ scene, brandDeep, brandAccent }) => {
  const half = Math.floor(SCENE_FRAMES / 2)
  return (
    <AbsoluteFill>
      {/* Two cuts per scene — the edit rhythm that makes it feel produced. */}
      <Sequence from={0} durationInFrames={half}>
        <GradedClip src={scene.clips[0]} cutFrames={half} brandDeep={brandDeep} pushFrom={1.05} />
      </Sequence>
      <Sequence from={half} durationInFrames={SCENE_FRAMES - half}>
        <GradedClip src={scene.clips[1]} cutFrames={SCENE_FRAMES - half} brandDeep={brandDeep} pushFrom={1.12} />
      </Sequence>
      {/* Text panel lives ABOVE the cuts, persisting across both. */}
      <ScenePanel scene={scene} brandAccent={brandAccent} />
      <Grain />
    </AbsoluteFill>
  )
}

export const MotionSample: React.FC<MotionSampleProps> = (props) => {
  const p = props.scenes?.length ? props : MOTION_DEFAULT
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {p.scenes.map((scene, i) => (
        <Sequence key={i} from={i * SCENE_FRAMES} durationInFrames={SCENE_FRAMES}>
          <SceneBlock scene={scene} brandDeep={p.brandDeep} brandAccent={p.brandAccent} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
