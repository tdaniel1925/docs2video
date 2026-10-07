import Link from 'next/link'
import type { ReactNode } from 'react'

/*
 * THE CARD — a white panel with a quiet edge (app/kit.css).
 * With `href`, the whole card is one link: the start cards on Home. One big
 * target reads as one choice; a card with a small button inside reads as two.
 * Works in server and client components (no hooks).
 */
type CardProps = {
  children: ReactNode
  className?: string
  /** Makes the whole card a link. */
  href?: string
  /** Read out for a link card when the visible words aren't enough. */
  'aria-label'?: string
  as?: 'div' | 'section' | 'article' | 'li'
}

export default function Card({ children, className = '', href, as: Tag = 'div', ...rest }: CardProps) {
  if (href) {
    return (
      <Link href={href} className={`kit-card kit-card--link ${className}`.trim()} aria-label={rest['aria-label']}>
        {children}
      </Link>
    )
  }
  return <Tag className={`kit-card ${className}`.trim()}>{children}</Tag>
}

/** The parts inside a card, so every card is laid out the same way. */
export function CardIcon({ children }: { children: ReactNode }) {
  return <span className="kit-card-icon" aria-hidden="true">{children}</span>
}
export function CardTitle({ children, as: Tag = 'h3' }: { children: ReactNode; as?: 'h2' | 'h3' | 'h4' | 'p' }) {
  return <Tag className="kit-card-title">{children}</Tag>
}
export function CardText({ children }: { children: ReactNode }) {
  return <p className="kit-card-text">{children}</p>
}
/** "Start →" at the foot of a link card (decoration: the card is the link). */
export function CardGo({ children }: { children: ReactNode }) {
  return <span className="kit-card-go" aria-hidden="true">{children}</span>
}
