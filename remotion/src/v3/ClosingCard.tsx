import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from 'remotion'
import { FONTS, TYPE, type Theme } from '../tokens'
import { settleProgress } from '../helpers'
import { CinematicGrade } from './CinematicGrade'
import { FilmOverlay } from '../FilmOverlay'
import { resolveLogo, type LogoSource } from '../components/infographic/BrandLogo'
import { parseMetric, renderMetric } from '../components/infographic/format'

/**
 * Cinematic CLOSING card: a styled glass panel over the film image with the
 * brand LOGO + company name, a "Thank you" headline, an optional headline VALUE,
 * and the CONTACT line (phone / email / website). The matching narration says
 * the contact aloud. Everything is optional — it renders cleanly with whatever
 * real data exists (never fabricated).
 */
export const ClosingCard: React.FC<{
  image?: string
  theme: Theme
  brandName?: string
  logo?: LogoSource
  headline?: string          // e.g. "Thank You" / "Your Next Step"
  cta?: string               // a short call to action line
  value?: { label: string; value: string }   // optional closing figure
  contact?: { phone?: string; email?: string; website?: string }
  /** Presenter (Person profile): a circular headshot + name/role at the top. */
  presenter?: { name?: string; role?: string; photo?: string }
  durationInFrames: number
}> = ({ image, theme, brandName, logo, headline, cta, value, contact, presenter, durationInFrames }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = theme.accents[1] ?? theme.accents[0]
  const logoSrc = resolveLogo(logo, theme.mode)

  // Gentle Ken Burns on the bg.
  const tLin = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp' })
  const scale = 1.08 + tLin * 0.1

  const panelP = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90, mass: 1 } })
  const headP = settleProgress(frame, 12)
  const ctaP = settleProgress(frame, 24)
  const contactP = settleProgress(frame, 36)
  const countP = interpolate(frame, [20, 20 + fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })

  const contactLines = [contact?.phone, contact?.email, contact?.website].filter(Boolean) as string[]

  return (
    <AbsoluteFill style={{ backgroundColor: theme.ink, overflow: 'hidden' }}>
      {image ? (
        <AbsoluteFill style={{ transform: `scale(${scale})` }}>
          <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(120% 120% at 50% 40%, ${theme.inkSoft} 0%, ${theme.ink} 75%)` }} />
      )}
      <CinematicGrade accent={theme.accents[0]} intensity={1.5} />
      {/* Centered darkening so the card always reads. */}
      <AbsoluteFill style={{ background: 'radial-gradient(120% 120% at 50% 50%, rgba(4,7,12,0.55) 0%, rgba(4,7,12,0.86) 100%)' }} />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 120px' }}>
        <div style={{
          opacity: Math.min(1, panelP * 1.4), transform: `translateY(${(1 - panelP) * 24}px)`,
          background: 'rgba(8,12,20,0.55)', backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
          padding: '56px 72px', display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', gap: 22, maxWidth: 1200,
        }}>
          {/* Presenter headshot (Person profile) — a circular portrait with an
              accent ring, sitting above the name/role. Takes precedence over the
              logo when present (people present as themselves, not a company). */}
          {presenter?.photo ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Img src={staticFile(presenter.photo)} style={{ width: 132, height: 132, borderRadius: '50%', objectFit: 'cover', border: `5px solid #FFFFFF`, outline: `2px solid ${accent}`, boxShadow: `0 0 26px ${accent}66` }} />
              {presenter.name ? (
                <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: 44, color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 1 }}>{presenter.name}</div>
              ) : null}
              {presenter.role ? (
                <div style={{ fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 2, fontSize: TYPE.label * 0.74, color: accent, textTransform: 'uppercase' }}>{presenter.role}</div>
              ) : null}
            </div>
          ) : logoSrc ? (
            <Img src={staticFile(logoSrc)} style={{ height: 84, width: 'auto', objectFit: 'contain' }} />
          ) : brandName ? (
            <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: 56, color: '#FFFFFF', letterSpacing: -1 }}>{brandName}</div>
          ) : null}

          {/* Thank-you / headline */}
          {headline ? (
            <div style={{ opacity: headP, transform: `translateY(${(1 - headP) * 12}px)`, fontFamily: FONTS.display, fontWeight: 900, fontSize: TYPE.title * 0.78, color: '#FFFFFF', lineHeight: 1.02 }}>
              {headline}
            </div>
          ) : null}

          {/* Optional closing value */}
          {value?.value ? (
            <div style={{ opacity: ctaP, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <div style={{ fontFamily: FONTS.display, fontWeight: 900, fontSize: TYPE.hero * 0.5, color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>
                {renderMetric(parseMetric(value.value), countP)}
              </div>
              <div style={{ fontFamily: FONTS.body, fontWeight: 700, letterSpacing: 3, fontSize: TYPE.label * 0.78, color: theme.textMuted, textTransform: 'uppercase' }}>{value.label}</div>
            </div>
          ) : null}

          {/* CTA line */}
          {cta ? (
            <div style={{ opacity: ctaP, fontFamily: FONTS.body, fontWeight: 500, fontSize: TYPE.subhead * 0.78, color: '#EAF1FB', lineHeight: 1.4, maxWidth: 900 }}>{cta}</div>
          ) : null}

          {/* Contact line */}
          {contactLines.length ? (
            <div style={{ opacity: contactP, display: 'flex', gap: 0, flexDirection: 'column', alignItems: 'center', marginTop: 8, paddingTop: 22, borderTop: `1px solid rgba(255,255,255,0.12)` }}>
              <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center', fontFamily: FONTS.body, fontWeight: 600, fontSize: TYPE.body * 0.62, color: accent }}>
                {contactLines.map((c, i) => <span key={i}>{c}</span>)}
              </div>
            </div>
          ) : null}
        </div>
      </AbsoluteFill>

      <FilmOverlay accent={accent} letterbox grain={0.06} />
    </AbsoluteFill>
  )
}
