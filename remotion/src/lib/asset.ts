import { staticFile as remotionStaticFile } from 'remotion'

/**
 * Per-video files: on the VPS they are staged into remotion/public and resolved
 * with Remotion's staticFile(); on Lambda the bundle is fixed at deploy time, so
 * the render script uploads them to S3 and passes `assetBase` (a URL prefix) in
 * the props. Root compositions call setAssetBase(props.assetBase) and every
 * production component imports `staticFile` from THIS module instead of remotion.
 * Files that ship inside the bundle (sfx, music beds, fonts) always stay local.
 */
let base = ''
const BUNDLED = ['sfx/', 'music/', 'fonts/']
export const setAssetBase = (b?: string | null) => { base = b || '' }
export function asset(path: string | undefined | null, b?: string | null): string {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const clean = path.replace(/^\//, '')
  const useBase = b === undefined ? base : (b || '')
  if (useBase && !BUNDLED.some((d) => clean.startsWith(d))) return `${useBase.replace(/\/$/, '')}/${clean}`
  return remotionStaticFile(clean)
}
export const staticFile = (path: string) => asset(path)
