/**
 * Where to go after the brand page (or an old voice-step link): step 3,
 * "Make it yours", once the story is written — otherwise the story step
 * first, so nobody lands on the price before there is anything to make.
 */
export function nextStepAfterBrand(videoId: string, draft: unknown): string {
  const scenes = (draft as { scenes?: unknown } | null | undefined)?.scenes
  const id = encodeURIComponent(videoId)
  return Array.isArray(scenes) && scenes.length > 0 ? `/create/theme?id=${id}` : `/create/script?id=${id}`
}
