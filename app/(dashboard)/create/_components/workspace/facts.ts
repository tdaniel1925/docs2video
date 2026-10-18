// Names for the choices on the create screens, worked out from ids. Pure (no
// React, no network) so a test can check them.

import { VOICE_OPTIONS } from '../../../../_lib/types'
import { PRES_LOOKS, VIDEO_LOOKS } from '../make/looks'

export function lookName(output: string | null | undefined, look: string | null | undefined): string | null {
  if (!look) return null
  if (output === 'interactive' || output === 'deck') return PRES_LOOKS.find((l) => l.id === look)?.name ?? null
  return VIDEO_LOOKS.find((l) => l.id === look)?.name ?? null
}

export function voiceName(id: string | null | undefined): string | null {
  return VOICE_OPTIONS.find((v) => v.id === id)?.name ?? null
}

/**
 * Step 3's one settings line: "Sarah · music on · standard". A presentation
 * has no music and no length choice, so it reads "Sarah · presentation".
 */
export function settingsLine(opts: { output: string; voiceId: string; aiMusic: boolean; length: string | null }): string {
  const parts = [voiceName(opts.voiceId) ?? 'Sarah']
  if (opts.output === 'interactive') parts.push('presentation')
  else {
    parts.push(opts.aiMusic ? 'music on' : 'music off')
    if (opts.length) parts.push(opts.length.toLowerCase())
  }
  return parts.join(' · ')
}
