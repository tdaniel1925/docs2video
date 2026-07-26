// STEAMPUNK INSURANCE ILLUSTRATION — assembly for the original slide pipeline.
//
// The slides are fully rendered by Gemini through the app's own slide engine
// (getStylePrompt('steampunk') + buildSimpleSlidePrompt), so nothing is drawn
// here. This composition only does what the VPS ffmpeg step does: hold each
// slide for the length of its narration, add a slow push so no frame sits dead,
// and cross-dissolve between them.
import React from 'react'
import {
  AbsoluteFill, Img, Audio, Series, staticFile, interpolate,
  useCurrentFrame, useVideoConfig,
} from 'remotion'

export const STEAM_FPS = 30
/** Measured from the VO clips, plus a beat of air at each end. */
const LEN = [247, 328, 436, 467, 379, 288]
export const STEAM_FRAMES = LEN.reduce((a, b) => a + b, 0)
/** Overlap of the cross-dissolve, in frames. */
const XF = 18

const Slide: React.FC<{ n: number; vo: number }> = ({ n, vo }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // Alternate the push direction so consecutive slides don't feel identical.
  const inward = n % 2 === 1
  const scale = interpolate(frame, [0, durationInFrames],
    inward ? [1.0, 1.06] : [1.06, 1.0])

  // Fade in over the cross-dissolve window; the previous slide is still under
  // us for that stretch, which is what makes it a dissolve rather than a cut.
  const opacity = interpolate(frame, [0, XF], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ opacity }}>
      <Audio src={staticFile(`illus-vo/${vo}.mp3`)} />
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img src={staticFile(`steampunk/${String(n).padStart(2, '0')}.jpg`)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

export const SteampunkDeck: React.FC = () => (
  // Brass-black base: it shows for the first frames of the opening dissolve,
  // and a white default would flash bright before slide one arrives.
  <AbsoluteFill style={{ backgroundColor: '#1a1410' }}>
    <Series>
      {LEN.map((len, i) => (
        <Series.Sequence
          key={i}
          durationInFrames={len}
          // Negative offset overlaps each slide with the tail of the previous
          // one so the dissolve has something to dissolve from.
          offset={i === 0 ? 0 : -XF}
        >
          <Slide n={i + 1} vo={i} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
)
