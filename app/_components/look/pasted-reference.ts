/*
 * A PICTURE PASTED ON THE LOOK STEP, CARRIED TO THE LOOK SCREEN.
 *
 * The Look step (create step 4) takes a paste anywhere on the page and opens
 * the look screen, where the picture is read as the reference. It travels in
 * this tab's sessionStorage, shrunk first, and is taken (and removed) once.
 */
import { shrinkImageForUpload } from '../../_lib/shrink-image'

const KEY = 'd2v-pasted-reference'

export async function holdPastedReference(f: File): Promise<void> {
  try {
    const small = await shrinkImageForUpload(f, 2000)
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(small) })
    sessionStorage.setItem(KEY, url)
  } catch { /* too big for the tab or storage blocked: the look screen opens without it, and a paste there still works */ }
}

/** The picture held for the look screen, once; null if none. */
export async function takePastedReference(): Promise<File | null> {
  try {
    const url = sessionStorage.getItem(KEY)
    if (!url) return null
    sessionStorage.removeItem(KEY)
    const blob = await (await fetch(url)).blob()
    return new File([blob], 'Pasted picture', { type: blob.type || 'image/png' })
  } catch { return null }
}
