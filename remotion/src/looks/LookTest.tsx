import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion'
import { LOOKS, type LookName } from './Looks'
import { Odometer } from '../charts/Odometer'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'

loadPlayfair()

/** Quick proof: a look's background + the odometer number + real music. */
export const LookTest: React.FC<{ look: LookName; value: number; label: string }> = ({ look, value, label }) => {
  const frame = useCurrentFrame()
  const L = LOOKS[look]
  const P = L.palette
  return (
    <AbsoluteFill>
      <Audio src={staticFile('music/bed-warm-128.wav')} volume={0.5} />
      <L.Background frame={frame} palette={P} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 44, letterSpacing: '0.24em', color: P.accent, textTransform: 'uppercase' }}>{label}</div>
        <Odometer value={value} at={10} size={200} color={P.text} prefix="$" />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
export const LOOKTEST_FRAMES = 120
