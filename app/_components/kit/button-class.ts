/*
 * THE BUTTON'S CLASSES, for anything that should look like a kit button but
 * isn't one (a form's submit, a plain link). Kept out of Button.tsx on
 * purpose: that file is 'use client', and a server page calling a function
 * from a client file fails at request time ("Attempted to call
 * kitButtonClass() from the server") — the dashboard did, 2026-10-18.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

export function kitButtonClass(variant: ButtonVariant = 'primary', size: 'md' | 'sm' = 'md', full = false, extra = '') {
  return ['kit-btn', `kit-btn--${variant}`, size === 'sm' ? 'kit-btn--sm' : '', full ? 'kit-btn--full' : '', extra]
    .filter(Boolean).join(' ')
}
