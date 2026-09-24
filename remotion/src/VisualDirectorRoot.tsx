import { Composition } from 'remotion'
import { VisualDirectorVideo, visualDirectorMetadata, type VisualDirectorProps } from './VisualDirectorVideo'

export const VisualDirectorRoot = () => <Composition
  id="VisualDirectorVideo"
  component={VisualDirectorVideo}
  defaultProps={{ sourceFile: 'visual-director-source.mp4', sourceUrl: '', durationSeconds: 10, aspect: '16:9', captions: true, scenes: [], words: [], logo: null } as VisualDirectorProps}
  calculateMetadata={visualDirectorMetadata}
  fps={30}
  width={1920}
  height={1080}
  durationInFrames={300}
/>
