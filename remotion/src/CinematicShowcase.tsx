import { AbsoluteFill, Series } from 'remotion'
import { FPS, IHOSTPOKER, type Theme } from './tokens'
import { CinematicHero } from './scenes/CinematicHero'

const D = 5 * FPS

/** Showcase of subject-aware cinematic hero scenes (Path A: subject on one
 *  side, text in the clean zone opposite). */
export const CinematicShowcase: React.FC<{ theme: Theme }> = ({ theme }) => {
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={D}>
          <CinematicHero theme={theme} durationInFrames={D} image="hero-1.png" focalSide="right" eyebrow="Houston · Since 2003" title="The night they'll never forget" subtitle="Real tables. Trained dealers. Pure energy." accentWordIndex={4} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={D}>
          <CinematicHero theme={theme} durationInFrames={D} image="hero-2.png" focalSide="left" eyebrow="Fully managed" title="We run the whole floor" subtitle="You enjoy the party — we handle every hand." accentWordIndex={3} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={D}>
          <CinematicHero theme={theme} durationInFrames={D} image="hero-3.png" focalSide="right" eyebrow="The payoff" title="Where every guest wins" subtitle="An experience built for everyone." accentWordIndex={3} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}

export const CINEMATIC_FRAMES = D * 3
export const CINEMATIC_THEME = IHOSTPOKER
