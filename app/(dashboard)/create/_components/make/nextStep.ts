/**
 * Where to go after the brand step: step 4, "The look", once the story is
 * written — otherwise the story step first, so nobody lands on the look and
 * the price before there is anything to make.
 */
export function nextStepAfterBrand(videoId: string, draft: unknown): string {
  const scenes = (draft as { scenes?: unknown } | null | undefined)?.scenes
  const id = encodeURIComponent(videoId)
  return Array.isArray(scenes) && scenes.length > 0 ? `/create/style?id=${id}` : `/create/story?id=${id}`
}
