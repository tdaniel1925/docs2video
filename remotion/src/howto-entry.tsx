// Standalone entry for the Docs2Video "Make your first video" film: bundles only
// what it imports, so nothing else in Root.tsx can block its renders.
import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { D2vHowTo, D2V_HOWTO_FRAMES, FPS } from './showcase/D2vHowTo'

const HowToRoot: React.FC = () => (
  <Composition id="D2vHowTo" component={D2vHowTo} fps={FPS} width={1920} height={1080} durationInFrames={D2V_HOWTO_FRAMES} />
)
registerRoot(HowToRoot)
