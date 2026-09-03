import { AbsoluteFill, Img, useCurrentFrame, interpolate } from 'remotion'
import { staticFile } from '../../lib/asset'
import { PremiumBackground } from '../../PremiumBackground'
import { FONTS, TYPE, type Theme } from '../../tokens'
import { KineticText } from '../../KineticText'
import { Particles } from '../Particles'
import { settleProgress } from '../../helpers'

/** A fake "illustration explained" video player (play btn, progress, waveform)
 *  + a transcript checklist + a testimonial. Headline above. */
export const VideoPlayerScene: React.FC<{
  eyebrow?: string
  title: string
  accentWordIndex?: number
  posterImage: string
  transcript: string[]
  quote: string
  theme: Theme
  durationInFrames: number
}> = ({ eyebrow, title, accentWordIndex, posterImage, transcript, quote, theme, durationInFrames }) => {
  const frame = useCurrentFrame()
  const accent = theme.accents[0]
  const ebP = settleProgress(frame, 2)
  const cardP = settleProgress(frame, 14)
  const playW = interpolate(frame, [24, durationInFrames - 10], [4, 92], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill>
      <PremiumBackground theme={theme} />
      <Particles accent={accent} count={30} />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '70px 110px' }}>
        {eyebrow ? <div style={{ opacity: ebP, fontFamily: FONTS.body, fontWeight: 800, letterSpacing: 8, fontSize: TYPE.label, color: accent, textTransform: 'uppercase', marginBottom: 18 }}>{eyebrow}</div> : null}
        <div style={{ marginBottom: 40 }}>
          <KineticText text={title} startFrame={6} fontFamily={FONTS.display} fontWeight={900} fontSize={TYPE.hero * 0.46} color="#FFFFFF" accentColor={accent} accentWordIndex={accentWordIndex} align="left" lineHeight={0.98} />
        </div>

        <div style={{ display: 'flex', gap: 36, opacity: cardP, transform: `translateY(${(1 - cardP) * 40}px)` }}>
          {/* player */}
          <div style={{ flex: 1.6, background: theme.glass, border: `1px solid ${theme.glassEdge}`, borderRadius: 20, overflow: 'hidden', backdropFilter: 'blur(20px)', boxShadow: `0 24px 70px rgba(0,0,0,0.5)` }}>
            <div style={{ position: 'relative', height: 360 }}>
              <Img src={staticFile(posterImage)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 90, height: 90, borderRadius: '50%', background: `${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${accent}` }}>
                  <div style={{ width: 0, height: 0, borderTop: '20px solid transparent', borderBottom: '20px solid transparent', borderLeft: '32px solid #06121A', marginLeft: 8 }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.subhead, color: '#FFFFFF', marginBottom: 14 }}>▶ Your Illustration Explained</div>
              <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ width: `${playW}%`, height: '100%', background: accent, boxShadow: `0 0 12px ${accent}` }} />
              </div>
              {/* waveform */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 40, marginTop: 16 }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: `${20 + 70 * Math.abs(Math.sin((frame + i * 9) / 14))}%`, background: i / 40 * 100 < playW ? accent : 'rgba(255,255,255,0.18)', borderRadius: 2 }} />
                ))}
              </div>
            </div>
          </div>
          {/* transcript checklist + testimonial */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: theme.glass, border: `1px solid ${theme.glassEdge}`, borderRadius: 16, padding: 24, backdropFilter: 'blur(20px)' }}>
              {transcript.map((tline, i) => {
                const p = settleProgress(frame, 22 + i * 8)
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: i < transcript.length - 1 ? 14 : 0, opacity: p }}>
                    <div style={{ color: accent, fontSize: 22 }}>✓</div>
                    <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.label + 4, color: '#FFFFFF' }}>{tline}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ background: theme.glass, border: `1px solid ${theme.glassEdge}`, borderRadius: 16, padding: 24, backdropFilter: 'blur(20px)' }}>
              <div style={{ fontFamily: FONTS.body, fontStyle: 'italic', fontSize: TYPE.subhead, color: '#FFFFFF', lineHeight: 1.3 }}>“{quote}”</div>
              <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: TYPE.label, color: accent, marginTop: 12 }}>— Happy Client</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
