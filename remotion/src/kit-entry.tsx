// Standalone entry for local scene-kit / film-engine test renders (bundles only KitVideo).
import { registerRoot, Composition } from 'remotion'
import { KitVideo, kitMetadata, type KitVideoProps } from './kit/KitVideo'
import { KIT_LOOKS } from './kit/spec'
registerRoot(() => (
  <Composition id="KitVideo" component={KitVideo} defaultProps={{ plan: { version: 1, title: '', look: KIT_LOOKS['animated-slides'], brand: {}, scenes: [] } } as KitVideoProps}
    calculateMetadata={kitMetadata} fps={30} width={1920} height={1080} durationInFrames={30} />
))
