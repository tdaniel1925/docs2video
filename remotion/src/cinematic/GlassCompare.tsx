import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'
import { loadFont as loadMont } from '@remotion/google-fonts/Montserrat'
import { GlassPanel, PersistentFrame, LowerThird, type GlassStyle, type GPalette } from './Glass'
import { Odometer } from '../charts/Odometer'
import { LineChart } from '../charts/Charts'
import { LOOKS } from '../looks/Looks'

loadMont()
const NOIR = LOOKS.noir.palette as GPalette

// side-by-side style prop drives which glass treatment to show.
export const GlassCompare: React.FC<{ style: GlassStyle; mode: 'figure' | 'chart' }> = ({ style, mode }) => {
  const P = NOIR
  return (
    <AbsoluteFill style={{ background: P.bg }}>
      {/* cinematic backdrop (reuse a generated one), graded dark */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img src={staticFile('dir-bd-1.png')} style={{ width: '112%', height: '112%', left: '-6%', top: '-6%', position: 'absolute', objectFit: 'cover', filter: 'brightness(0.44) saturate(0.9) contrast(1.06)' }} />
        <AbsoluteFill style={{ background: 'radial-gradient(125% 125% at 50% 45%, transparent 45%, rgba(0,0,0,0.72))' }} />
      </AbsoluteFill>

      {/* persistent chrome: company text (logo would slot here if provided) */}
      <PersistentFrame palette={P} company="BotMakers" recipient="Mr. Client" footer="Illustration — not a guarantee · docs2video.com" total={200} />

      {/* the data, inside glass */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        {mode === 'figure' ? (
          <GlassPanel at={10} style={style} palette={P} pad={70}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 34, letterSpacing: '0.22em', color: P.accent, textTransform: 'uppercase', marginBottom: 20 }}>Death Benefit</div>
              <Odometer value={176204} at={16} size={150} color={P.text} prefix="$" />
            </div>
          </GlassPanel>
        ) : (
          <GlassPanel at={10} style={style} palette={P} pad={54}>
            <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 30, letterSpacing: '0.16em', color: P.accent, textTransform: 'uppercase', marginBottom: 22, textAlign: 'center' }}>Growth Potential</div>
            <LineChart
              series={[{ name: 'Cash Value', color: P.accent, points: [[0, 0], [10, 116371]], width: 8, area: true }, { name: '0% Floor', color: P.muted, points: [[0, 0], [20, 0]], dashed: true, width: 5 }]}
              xMax={20} yMax={145000} palette={P as any} at={20} xTicks={[1, 5, 10, 20]} xLabel="YEARS"
              annotate={{ x: 10, y: 116371, label: 'Year 10', value: '$116,371' }}
            />
          </GlassPanel>
        )}
      </AbsoluteFill>

      {/* lower-third caption to show that treatment too */}
      <LowerThird text="Built To Last" sub="A legacy for the people who matter." at={24} palette={P} size={70} />
    </AbsoluteFill>
  )
}
export const GLASS_FRAMES = 110
