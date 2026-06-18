import { AbsoluteFill, Series } from 'remotion'
import { FPS, PREMIUM, type Theme } from '../tokens'
import { FullScreenScene } from './FullScreenScene'
import { MessagesScene } from './scenes/MessagesScene'
import { ProductUIScene } from './scenes/ProductUIScene'
import { MetricScene } from './scenes/MetricScene'
import { VideoPlayerScene } from './scenes/VideoPlayerScene'

const S = 5 * FPS

/** Recreation of the "87 Pages" 6-slide storyboard. Theme is a prop so the same
 *  content can be re-styled by industry/brand (proves the styling model). */
export const Storyboard87: React.FC<{ theme?: Theme }> = ({ theme = PREMIUM }) => {
  const T = theme
  return (
  <AbsoluteFill>
    <Series>
      {/* 1 — Problem hook */}
      <Series.Sequence durationInFrames={S}>
        <FullScreenScene theme={T} durationInFrames={S} image="sb-pages.png" placement="center"
          eyebrow="01 · The Problem" title="87 Pages. One Chance To Explain It Clearly." accentWordIndex={7}
          body="Insurance illustrations are packed with detail. Your clients just need clarity." kenBurns="in" />
      </Series.Sequence>
      {/* 2 — The struggle (floating messages) */}
      <Series.Sequence durationInFrames={S}>
        <MessagesScene theme={T} durationInFrames={S} image="sb-agent.png"
          eyebrow="02 · The Struggle" title="The Same Explanation. Again. And Again." accentWordIndex={2}
          messages={['Can you explain page 43?', 'What does this rider do?', "I'm confused."]} />
      </Series.Sequence>
      {/* 3 — The solution (product UI) */}
      <Series.Sequence durationInFrames={S}>
        <ProductUIScene theme={T} durationInFrames={S}
          eyebrow="03 · The Solution" title="Upload The Illustration. Let AI Do The Explaining." accentWordIndex={3}
          fileName="illustration.pdf" />
      </Series.Sequence>
      {/* 4 — Metrics */}
      <Series.Sequence durationInFrames={S}>
        <MetricScene theme={T} durationInFrames={S}
          eyebrow="04 · AI Breakdown" title="Complex Becomes Clear." accentWordIndex={2}
          metrics={[
            { icon: '🛡️', value: 500, prefix: '$', suffix: '/mo', label: 'Premium', sublabel: 'Affordable protection' },
            { icon: '❤️', value: 750000, prefix: '$', label: 'Death Benefit', sublabel: 'Financial security' },
            { icon: '📈', value: 82400, prefix: '$', label: 'Cash Value · Yr 10', sublabel: 'Tax-advantaged growth' },
          ]} />
      </Series.Sequence>
      {/* 5 — Client experience (video player) */}
      <Series.Sequence durationInFrames={S}>
        <VideoPlayerScene theme={T} durationInFrames={S} posterImage="sb-client.png"
          eyebrow="05 · Client Experience" title="Confusion Becomes Clarity Creates Action." accentWordIndex={4}
          transcript={['Overview', 'Key benefits', 'Cash value', 'Riders', 'Next steps']}
          quote="This is the clearest explanation I've ever seen." />
      </Series.Sequence>
      {/* 6 — Closing CTA */}
      <Series.Sequence durationInFrames={S}>
        <FullScreenScene theme={T} durationInFrames={S} image="sb-close.png" placement="center"
          eyebrow="06 · Let's Make It Simple" title="Stop Explaining. Start Closing." accentWordIndex={2}
          body="Docs2Video turns complex documents into clear, engaging videos that win more cases." kenBurns="in" />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
  )
}

export const SB87_FRAMES = S * 6
