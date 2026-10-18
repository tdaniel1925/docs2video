'use client'

import type { CrewCard, CrewKey } from './crew-steps'

/*
 * THE CREW, DRAWN. Each card is a little scene of its job — and only the crew
 * member on set moves (styles: .crew-* in app/globals.css; still for anyone
 * who asked for less motion). Colours come from currentColor, set by the
 * card's state.
 */
function Scene({ k }: { k: CrewKey }) {
  const common = { width: 140, height: 104, viewBox: '0 0 140 104', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (k) {
    case 'director':
      return (
        <svg {...common}>
          {/* the director in a chair, reading the script */}
          <circle cx="40" cy="26" r="11" />
          <path d="M28 20c4-6 20-6 24 0" />
          <path d="M22 76c2-16 9-26 18-26s16 10 18 26" />
          <path d="M18 76h44M24 76l-6 20M56 76l6 20M30 86h20" />
          <rect x="74" y="34" width="34" height="44" rx="2" />
          <path className="crew-flip" d="M74 34h17v44H74z" fill="var(--bg-card)" />
          <path d="M80 46h22M80 54h22M80 62h14" />
          <path d="M58 58l16-8" />
        </svg>
      )
    case 'designer':
      return (
        <svg {...common}>
          {/* an easel, the scene drawing itself, a pencil moving */}
          <rect x="20" y="10" width="100" height="64" rx="4" />
          <path className="crew-draw" d="M32 62l18-22 14 12 18-24 24 34" />
          <circle className="crew-pop" cx="100" cy="26" r="6" />
          <path d="M60 74l-12 24M80 74l12 24M70 74v24" />
          <g className="crew-pencil"><path d="M108 70l14-14 6 6-14 14-8 2z" /></g>
        </svg>
      )
    case 'voice':
      return (
        <svg {...common}>
          {/* a studio mic, headphones, the voice as bars */}
          <rect x="22" y="14" width="22" height="38" rx="11" />
          <path d="M14 44c0 14 8 22 19 22s19-8 19-22M33 66v16M20 82h26" />
          <path d="M14 30c0-14 9-22 19-22s19 8 19 22" />
          <g>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect key={i} className="crew-bar" style={{ animationDelay: `${(i % 3) * 0.18 + i * 0.05}s` }} x={66 + i * 11} y={24} width={6} height={52} rx={3} fill="currentColor" stroke="none" />
            ))}
          </g>
        </svg>
      )
    case 'composer':
      return (
        <svg {...common}>
          {/* a stave, notes rising and falling, a baton */}
          <path d="M10 34h120M10 46h120M10 58h120M10 70h120" opacity=".55" />
          {[{ x: 36, y: 66 }, { x: 64, y: 54 }, { x: 92, y: 60 }, { x: 116, y: 48 }].map((n, i) => (
            <g key={i} className="crew-note" style={{ animationDelay: `${i * 0.3}s` }}>
              <ellipse cx={n.x} cy={n.y} rx="7" ry="5.5" fill="currentColor" />
              <path d={`M${n.x + 6} ${n.y}V${n.y - 32}`} />
            </g>
          ))}
          <path className="crew-baton" d="M14 96l26-20" />
        </svg>
      )
    case 'camera':
      return (
        <svg {...common}>
          {/* a film camera on a tripod, reels turning, the red light */}
          <g className="crew-spin"><circle cx="44" cy="24" r="14" /><path d="M44 10v28M30 24h28" /></g>
          <g className="crew-spin"><circle cx="78" cy="24" r="14" /><path d="M78 10v28M64 24h28" /></g>
          <rect x="28" y="40" width="70" height="36" rx="5" />
          <path d="M98 52l22-12v36l-22-12" />
          <circle className="crew-rec" cx="38" cy="50" r="4" fill="var(--danger)" stroke="none" />
          <path d="M50 76l-12 24M76 76l12 24M63 76v24" />
        </svg>
      )
    case 'editor':
      return (
        <svg {...common}>
          {/* a timeline being cut, a clapperboard snapping */}
          <rect x="10" y="16" width="120" height="18" rx="3" />
          <rect x="10" y="42" width="120" height="18" rx="3" />
          <path d="M40 16v18M78 16v18M108 16v18M28 42v18M62 42v18M96 42v18" />
          <path className="crew-scan" d="M20 10v56" stroke="var(--cta, currentColor)" />
          <rect x="44" y="76" width="52" height="22" rx="2" />
          <path className="crew-clap" d="M44 76l50-8" />
          <path d="M54 76l6-8M68 76l6-8M82 76l6-8" opacity=".6" />
        </svg>
      )
  }
}

export function Crew({ cards, headline }: { cards: CrewCard[]; headline: string }) {
  return (
    <section className="crew" aria-label="Your film crew">
      <p className="crew-head">Your crew is <em>{headline}</em></p>
      <ol className="crew-grid">
        {cards.map((c) => (
          <li key={c.key} className="crew-card" data-state={c.state} data-crew={c.key}>
            <div className="crew-scene"><Scene k={c.key} /></div>
            <span className="crew-row">
              <b className="crew-role">{c.n} · {c.role}</b>
              <span className="crew-badge">{c.state === 'on' ? 'On set now' : c.state === 'done' ? 'Done ✓' : 'Up next'}</span>
            </span>
            <span className="crew-line">{c.line}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
