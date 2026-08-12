'use client'

import { useEffect } from 'react'

/**
 * Let people PASTE a picture, anywhere on the page.
 *
 * Every upload in this app used to be a file button and nothing else. But the
 * realistic path is already an image on the clipboard — a logo copied out of a
 * website, a headshot copied from an email, a design copied from a stock site.
 * Making them save it to disk first, find it in a picker and open it is three
 * steps to undo something they had already done.
 *
 * BOUND TO THE WINDOW, not to a drop zone you must click first. "Click here,
 * then paste" is a step people skip, and then they report the paste as broken —
 * which is fair, because a gesture that works only after a secret prerequisite
 * does not work.
 *
 * NEVER STEALS A PASTE FROM A TEXT BOX. Copying a headline out of a document
 * and pasting it into a field has to stay a paste of text. Only fires when the
 * clipboard actually holds an image AND the cursor is not in something you type
 * into — a rich clipboard often carries both, and the text is what was meant.
 */
export function usePasteImage(onImage: (file: File) => void, active = true) {
  useEffect(() => {
    if (!active) return

    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) return

      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return

      e.preventDefault()
      onImage(file)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // No dependency list on purpose: onImage is usually written inline at the
    // call site, so a list would either go stale or need every caller to
    // remember useCallback. Re-binding one listener per render costs nothing.
  })
}

/** What to tell people the shortcut is, on the machine they are actually using. */
export function pasteKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+V'
  // userAgentData where it exists, the old property where it does not. Safari
  // still has no userAgentData, and Safari is most of the Mac traffic.
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? ''
  return /mac|iphone|ipad/i.test(platform) ? '⌘V' : 'Ctrl+V'
}
