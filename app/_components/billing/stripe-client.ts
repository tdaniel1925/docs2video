'use client'

// The 'pure' entry loads Stripe.js only when a payment form opens (the
// default entry injects it on every page that imports this file).
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Appearance, Stripe } from '@stripe/stripe-js'

/*
 * Browser side of IN-APP payments (2026-10-14). Every payment form in the app
 * (plans, credit packs, the AI Social add-on, the trial card step, "Add a
 * card", "Update card") is Stripe's Payment Element inside our own page.
 */

let promise: Promise<Stripe | null> | null = null

/** Stripe.js, loaded once. Null when the publishable key isn't set. */
export function getStripePromise(): Promise<Stripe | null> {
  if (!promise) {
    const key = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim()
    // A failed load (network blip, blocker) is forgotten so the next try
    // loads again, and answers null so the form can say so plainly.
    promise = key
      ? loadStripe(key).catch((err) => { console.warn('[stripe] Stripe.js did not load:', err); promise = null; return null })
      : Promise.resolve(null)
  }
  return promise
}

const token = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** Stripe's form, dressed in OUR colours — read from the live theme tokens,
 *  so light and dark both match (Stripe's frame can't read CSS variables). */
export function stripeAppearance(): Appearance {
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: token('--accent-ink', '#2F6B3A'),
      colorBackground: token('--bg-card', dark ? '#19222F' : '#FFFFFF'),
      colorText: token('--ink', dark ? '#F4F1EC' : '#0B2545'),
      colorTextSecondary: token('--ink-soft', '#4B5563'),
      colorDanger: token('--error-text', '#B42318'),
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      borderRadius: '8px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': { border: `1px solid ${token('--border', '#D6CFC2')}`, boxShadow: 'none' },
      '.Tab': { border: `1px solid ${token('--border', '#D6CFC2')}`, boxShadow: 'none' },
    },
  }
}

export const STRIPE_FONTS = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap' }]

/** Plain words for whatever Stripe said went wrong. */
export function plainPaymentError(err: { code?: string | null; decline_code?: string | null; message?: string; type?: string; paymentFailed?: { declineCode?: string | null } } | null | undefined): string {
  if (!err) return 'The payment didn’t go through. Please try again.'
  const decline = err.decline_code || err.paymentFailed?.declineCode || ''
  const code = err.code || ''
  if (decline === 'insufficient_funds') return 'Your card was declined for not enough money. Try another card.'
  if (decline === 'lost_card' || decline === 'stolen_card') return 'Your card was declined. Please use another card.'
  if (code === 'expired_card' || decline === 'expired_card') return 'That card has expired. Please use another card.'
  if (code === 'incorrect_cvc' || decline === 'incorrect_cvc') return 'The security code (CVC) is wrong. Please check it and try again.'
  if (code === 'incorrect_number' || code === 'invalid_number') return 'The card number isn’t right. Please check it.'
  if (code === 'payment_intent_authentication_failure' || code === 'setup_intent_authentication_failure') return 'Your bank’s security check wasn’t completed, so nothing was charged. Please try again.'
  if (code === 'card_declined' || code === 'paymentFailed' || decline) return 'Your card was declined. Please try another card, or call your bank.'
  if (err.type === 'validation_error' && err.message) return err.message
  return 'The payment didn’t go through. Please try again.'
}

/** "$79" or "$12.34" from cents. */
export function money(cents: number | null | undefined): string {
  if (cents == null) return '—'
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100)
}

/** "Oct 14, 2026" */
export function day(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}
