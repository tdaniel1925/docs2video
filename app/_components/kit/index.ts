// THE KIT — one set of parts for every screen (styles in app/kit.css).
// Move a screen onto these instead of writing inline styles; see the comment
// at the top of each file for when to use which.
export { default as Button } from './Button'
// Not from Button.tsx: that file is client-only, and server pages call this.
export { kitButtonClass, type ButtonVariant } from './button-class'
export { default as Card, CardIcon, CardTitle, CardText, CardGo } from './Card'
export { default as Choices, type Choice } from './Choices'
export { default as Note, type NoteTone } from './Note'
export { default as Tabs, type Tab } from './Tabs'
export { default as Chip, type ChipTone } from './Chip'
export { default as EmptyState } from './EmptyState'
export { default as Dialog } from './Dialog'
