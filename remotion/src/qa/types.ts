/**
 * One QA scenario: a real production composition, fed worst-case content,
 * scanned at the frames where each scene has finished animating in.
 */
export type QACase = {
  /** Unique; letters, digits and dashes only. Prefix with the engine: "infographic-kpis-long". */
  id: string
  /** The production component, exactly as the render service uses it. */
  component: React.FC<any>
  /** Props as the render service would pass them (no audio needed). */
  props: Record<string, unknown>
  durationInFrames: number
  /** Frames to scan — pick each scene's settled moment, not mid-entrance. */
  frames: number[]
  width?: number
  height?: number
  fps?: number
}
