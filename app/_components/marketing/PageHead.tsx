// A public sub-page's head (SiteChrome). Its own file, with no server imports, so client pages can use it.
/** A sub-page's head: the small spaced label, the big capitals with a blue second half, a line under it. */
export function PageHead({ kicker, title, blue, sub, children }: { kicker?: string; title: React.ReactNode; blue?: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="hp-pagehead">
      {kicker && <span className="hp-kicker">✦ {kicker}</span>}
      <h1 className="hp-h2">{title}{blue ? <> <span className="hp-blue">{blue}</span></> : null}</h1>
      {sub && <p className="hp-soft hp-measure">{sub}</p>}
      {children}
    </div>
  )
}
