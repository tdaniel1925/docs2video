import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion'
import { PremiumBackground } from '../../PremiumBackground'
import { FONTS, TYPE, TEXT_SHADOW, type Theme } from '../../tokens'
import { KineticText } from '../../KineticText'
import { Particles } from '../Particles'
import { settleProgress } from '../../helpers'

/** A fake Docs2Video product-UI panel: brand bar + uploading file + progress +
 *  format chips. Looks like a real SaaS. Headline on the left. */
export const ProductUIScene: React.FC<{
  eyebrow?: string
  title: string
  accentWordIndex?: number
  fileName: string
  theme: Theme
  durationInFrames: number
}> = ({ eyebrow, title, accentWordIndex, fileName, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const accent = theme.accents[0]
  const cardP = settleProgress(frame, 14)
  const ebP = settleProgress(frame, 2)
  const pct = Math.round(interpolate(frame, [24, durationInFrames - 10], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))

  return (
    <AbsoluteFill>
      <PremiumBackground theme={theme} />
      <Particles accent={accent} count={36} />

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '0 110px', gap: 70 }}>
        {/* Left: headline */}
        <div style={{ flex: 1 }}>
          {eyebrow ? <div style={{ opacity: ebP, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 22, textShadow: TEXT_SHADOW }}>{eyebrow}</div> : null}
          <KineticText text={title} startFrame={6} fontFamily={FONTS.display} fontWeight={900} fontSize={TYPE.hero * 0.5} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align="left" lineHeight={0.98} />
        </div>

        {/* Right: glass product panel */}
        <div style={{ flex: 1, opacity: cardP, transform: `translateY(${(1 - cardP) * 40}px)`, background: theme.glass, border: `1px solid ${theme.glassEdge}`, backdropFilter: 'blur(24px)', borderRadius: 24, padding: 40, boxShadow: `0 30px 90px rgba(0,0,0,0.5), 0 0 ${40 * cardP}px ${accent}22` }}>
          {/* brand bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <div style={{ width: 16, height: 16, borderRadius: 5, background: accent, boxShadow: `0 0 14px ${accent}` }} />
            <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 30, color: '#FFFFFF' }}>Docs2Video</div>
          </div>
          {/* upload zone */}
          <div style={{ border: `2px dashed ${theme.glassEdge}`, borderRadius: 16, padding: '36px 28px', textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⬆️</div>
            <div style={{ fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.subhead, color: '#FFFFFF' }}>{fileName}</div>
            <div style={{ fontFamily: FONTS.body, fontSize: TYPE.label, color: theme.textMuted, marginTop: 6 }}>87 Pages · 12.4 MB</div>
          </div>
          {/* progress */}
          <div style={{ height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${theme.accents[1]}, ${accent})`, boxShadow: `0 0 16px ${accent}` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONTS.body, fontSize: TYPE.label, color: theme.textMuted, marginBottom: 28 }}>
            <span>Analyzing…</span><span style={{ color: accent, fontWeight: 700 }}>{pct}%</span>
          </div>
          {/* format chips */}
          <div style={{ display: 'flex', gap: 12 }}>
            {['PDF', 'DOCX', 'PPT', 'XLS'].map((c, i) => (
              <div key={c} style={{ opacity: settleProgress(frame, 30 + i * 4), padding: '8px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.glassEdge}`, fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.label, color: '#FFFFFF' }}>{c}</div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
