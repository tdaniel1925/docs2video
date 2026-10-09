// The free-font list (spec.ts KIT_FONTS), wired to @remotion/google-fonts.
// Importing a module costs nothing; a font is only downloaded when a look
// actually uses it (useKitFonts), and only the weights spec.ts lists.
import { loadFont as PlusJakartaSans } from '@remotion/google-fonts/PlusJakartaSans'
import { loadFont as Inter } from '@remotion/google-fonts/Inter'
import { loadFont as Montserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as SourceSans3 } from '@remotion/google-fonts/SourceSans3'
import { loadFont as DMSans } from '@remotion/google-fonts/DMSans'
import { loadFont as Manrope } from '@remotion/google-fonts/Manrope'
import { loadFont as Outfit } from '@remotion/google-fonts/Outfit'
import { loadFont as SpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk'
import { loadFont as Archivo } from '@remotion/google-fonts/Archivo'
import { loadFont as WorkSans } from '@remotion/google-fonts/WorkSans'
import { loadFont as Figtree } from '@remotion/google-fonts/Figtree'
import { loadFont as Poppins } from '@remotion/google-fonts/Poppins'
import { loadFont as Fraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as PlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as Lora } from '@remotion/google-fonts/Lora'
import { loadFont as DMSerifDisplay } from '@remotion/google-fonts/DMSerifDisplay'
import { loadFont as InstrumentSerif } from '@remotion/google-fonts/InstrumentSerif'
import { loadFont as LibreBaskerville } from '@remotion/google-fonts/LibreBaskerville'
import { loadFont as Merriweather } from '@remotion/google-fonts/Merriweather'
import { loadFont as Oswald } from '@remotion/google-fonts/Oswald'
import { KIT_FONTS, type FontId } from './spec'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOADERS: Record<string, (style?: any, opts?: any) => { fontFamily: string }> = {
  PlusJakartaSans, Inter, Montserrat, SourceSans3, DMSans, Manrope, Outfit, SpaceGrotesk, Archivo, WorkSans,
  Figtree, Poppins, Fraunces, PlayfairDisplay, Lora, DMSerifDisplay, InstrumentSerif, LibreBaskerville, Merriweather, Oswald,
}

const loaded = new Map<FontId, string>()

/** Loads (once) and returns the CSS family for a free font. */
export function kitFont(id: FontId): string {
  const hit = loaded.get(id)
  if (hit) return hit
  const spec = KIT_FONTS[id]
  const fallback = spec.kind === 'serif' ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif'
  let family = `"${spec.family}", ${fallback}`
  try {
    const r = LOADERS[spec.module]('normal', { weights: [...spec.weights], subsets: ['latin'] })
    family = `${r.fontFamily}, ${fallback}`
  } catch {
    // An unknown weight/subset: load everything rather than draw the fallback.
    try { family = `${LOADERS[spec.module]().fontFamily}, ${fallback}` } catch { /* fallback stays */ }
  }
  loaded.set(id, family)
  return family
}
