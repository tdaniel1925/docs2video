// Standalone entry for local walk-through test renders (bundles only it).
import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { WalkthroughVideo, walkthroughMetadata, type WalkthroughProps } from './walkthrough/WalkthroughVideo'
registerRoot(() => (
  <Composition id="WalkthroughVideo" component={WalkthroughVideo} defaultProps={{ pages: [], scenes: [], cover: { title: '' }, closing: { title: '' } } as WalkthroughProps}
    calculateMetadata={walkthroughMetadata} fps={30} width={1920} height={1080} durationInFrames={30} />
))
