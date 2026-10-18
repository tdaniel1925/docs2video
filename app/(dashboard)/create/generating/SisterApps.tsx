/*
 * WHILE YOU WAIT: THE MAKERS' OTHER APPS (owner, 2026-10-18, layout "B": all
 * four at once beside the progress). Each opens in a new tab so the video
 * keeps building. Every line is from the app's own site — nothing invented.
 * ProPresent is One Dollar Decks' new name; until its own domain is live the
 * link goes to onedollardecks.app.
 */
export const SISTER_APPS = [
  { key: 'propresent', name: 'ProPresent', url: 'https://onedollardecks.app', head: 'Custom decks. No templates.', line: 'Any document, website or topic into a custom-designed deck — PowerPoint and PDF.' },
  { key: 'restylez', name: 'Restylez', url: 'https://restylez.app', head: 'Show us a style. Get anything.', line: 'Flyers, posts, logos and cards made in a style you like — any size.' },
  { key: 'videowiz', name: 'VideoWiz', url: 'https://videowiz.app', head: 'Record once. Edited for you.', line: 'Videos made with AI, from the team behind DemoWiz.' },
  { key: 'demowiz', name: 'DemoWiz', url: 'https://demowiz.app', head: 'One take. A finished demo.', line: 'It cuts your take, writes and voices the script, adds zooms, captions and your brand.' },
] as const

export function SisterApps() {
  return (
    <aside className="sis" aria-label="More from the makers of Docs2Video">
      <span className="sis-cap">While you wait · from the makers of Docs2Video</span>
      <div className="sis-grid">
        {SISTER_APPS.map((a) => (
          <article key={a.key} className="sis-card" data-app={a.key}>
            <div className="sis-art">
              <span className="sis-name">{a.name}</span>
              <b className="sis-head">{a.head}</b>
            </div>
            <div className="sis-body">
              <span className="sis-line">{a.line}</span>
              <a className="sis-cta" href={a.url} target="_blank" rel="noopener noreferrer">Try {a.name} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </article>
        ))}
      </div>
      <span className="sis-note">Each opens in a new tab, so your video keeps going.</span>
    </aside>
  )
}
