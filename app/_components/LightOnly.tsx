/**
 * Keeps a screen light when the viewer picked dark mode (UI round C).
 * Dark mode reaches only the screens that were checked in dark; the rest
 * (admin, Text2Art's design screens, the logo and graphics makers…) drop
 * this invisible marker, and globals.css ("DARK MODE") leaves the whole
 * page light while it is there. Remove it from a screen once that screen
 * has been converted to the colour names and looked at in dark.
 */
export default function LightOnly() {
  return <span data-light-only hidden />
}
