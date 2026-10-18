'use client'

import Link from 'next/link'
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'

/*
 * THE BUTTON. One look per job (classes in app/kit.css):
 *   primary   — the one thing to do on this screen (navy, white words)
 *   secondary — anything else you can press
 *   quiet     — words only ("Cancel", "How to use")
 *
 * `price` puts the cost ON the button — "Make it — 1,000 credits" — so the
 * customer never has to hunt for what pressing it spends. Pass the price as
 * read from pricing.ts / credits.ts; never type one.
 *
 * `disabledReason` is shown under a disabled button and tied to it for screen
 * readers. A grey button with no reason leaves people stuck ("why can't I?").
 *
 * With `href` it renders a link that looks like a button (a link can't be
 * disabled, so the reason is ignored there).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

type Common = {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  /** Fill the width of the parent. */
  full?: boolean
  /** e.g. "1,000 credits" — shown after the label as " — 1,000 credits". */
  price?: ReactNode
  children: ReactNode
  className?: string
}

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & {
  href?: undefined
  /** Why it can't be pressed right now. Only shown while disabled. */
  disabledReason?: ReactNode
}

type AsLink = Common & {
  href: string
  /** Opens in a new tab (for files and pages outside the app). */
  external?: boolean
  'aria-label'?: string
  onClick?: () => void
}

export function kitButtonClass(variant: ButtonVariant = 'primary', size: 'md' | 'sm' = 'md', full = false, extra = '') {
  return ['kit-btn', `kit-btn--${variant}`, size === 'sm' ? 'kit-btn--sm' : '', full ? 'kit-btn--full' : '', extra]
    .filter(Boolean).join(' ')
}

function Label({ children, price }: { children: ReactNode; price?: ReactNode }) {
  return (
    <>
      <span className="kit-btn-label">{children}</span>
      {/* The space keeps the words apart when read out ("Make it — 1,000
          credits", not "Make it— 1,000 credits"); the gap does it on screen. */}
      {price != null && price !== '' && <>{' '}<span className="kit-btn-price">— {price}</span></>}
    </>
  )
}

export default function Button(props: AsButton | AsLink) {
  const reasonId = useId()

  if (props.href !== undefined) {
    const { href, external, variant, size, full, price, children, className, onClick } = props as AsLink
    const cls = kitButtonClass(variant, size, full, className)
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={props['aria-label']} onClick={onClick}>
          <Label price={price}>{children}</Label>
        </a>
      )
    }
    return (
      <Link href={href} className={cls} aria-label={props['aria-label']} onClick={onClick}>
        <Label price={price}>{children}</Label>
      </Link>
    )
  }

  const { variant, size, full, price, children, className, disabledReason, type = 'button', ...rest } = props as AsButton
  const showReason = !!rest.disabled && disabledReason != null && disabledReason !== ''
  const button = (
    <button
      {...rest}
      type={type}
      className={kitButtonClass(variant, size, full, className)}
      aria-describedby={showReason ? reasonId : rest['aria-describedby']}
    >
      <Label price={price}>{children}</Label>
    </button>
  )
  if (!showReason) return button
  return (
    <span className={full ? 'kit-btn-wrap kit-btn-wrap--full' : 'kit-btn-wrap'}>
      {button}
      <span id={reasonId} className="kit-btn-reason">{disabledReason}</span>
    </span>
  )
}
