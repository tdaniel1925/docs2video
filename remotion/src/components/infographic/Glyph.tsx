/**
 * Tiny inline-SVG glyph set. No icon-font dependency (fonts can fail to load in
 * headless Chrome and leave tofu boxes). Stroke-based, inherits a single color,
 * sized by `size`. Keyed by semantic name so the generator/layout-picker can
 * request one by intent ("shield" for protection, "growth" for value, etc.).
 */
export type GlyphName =
  | 'shield' | 'growth' | 'coin' | 'doc' | 'clock' | 'check' | 'heart'
  | 'chart' | 'lock' | 'star' | 'flow' | 'people' | 'spark' | 'dot'

const PATHS: Record<GlyphName, React.ReactNode> = {
  shield: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z" />,
  growth: <><path d="M4 16l5-5 4 4 7-8" /><path d="M16 7h4v4" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5h3.5a1.5 1.5 0 010 3H10" /></>,
  doc: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9 12h7M9 16h7" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  check: <path d="M5 13l4 4L19 7" />,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" />,
  chart: <><path d="M4 20V4M4 20h16" /><rect x="7" y="12" width="3" height="5" /><rect x="12" y="8" width="3" height="9" /><rect x="17" y="5" width="3" height="12" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  star: <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9L12 3z" />,
  flow: <><circle cx="5" cy="12" r="2" /><circle cx="19" cy="12" r="2" /><path d="M7 12h10" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0" /><path d="M16 6a3 3 0 010 6M21 20a6 6 0 00-5-5.9" /></>,
  spark: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />,
  dot: <circle cx="12" cy="12" r="4" />,
}

export const Glyph: React.FC<{ name: GlyphName; size?: number; color: string; strokeWidth?: number }> = ({
  name, size = 48, color, strokeWidth = 1.8,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {PATHS[name] ?? PATHS.dot}
  </svg>
)
