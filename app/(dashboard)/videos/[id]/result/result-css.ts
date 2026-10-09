// Styles for the result page's own parts (header, menus, the change bar,
// "Who watched", the More-for-this area, Fix-a-Scene). Colours are only the
// names in app/globals.css; corners stay at 10px or less (house rule —
// circles excepted). The send panel keeps its own sheet (ready-to-send-css).
export const RESULT_CSS = `
.res-page { max-width: 1400px; margin: 0 auto; }
.res-head { margin-bottom: 20px; }
.res-head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
.res-head-title { min-width: 0; flex: 1 1 320px; }
.res-title { font-size: var(--fs-h2); font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px; cursor: pointer; display: inline-flex; align-items: center; gap: var(--space-2); max-width: 100%; }
.res-title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res-title-pen { opacity: 0.45; flex-shrink: 0; }
.res-rename { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: 4px; }
.res-rename .input { flex: 1 1 260px; font-size: var(--fs-h3); font-weight: 700; }
.res-meta { font-size: var(--fs-ui); color: var(--ink-light); display: flex; align-items: center; gap: var(--space-1); flex-wrap: wrap; }
.res-brand { display: inline-flex; align-items: center; gap: var(--space-1); }
.res-brand-dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.res-head-actions { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.res-gap { margin-top: 14px; }

.res-menu { width: 280px; }
.res-menu--left { left: 0; right: auto; }
@media (max-width: 520px) { .res-menu { right: auto; left: 0; width: min(280px, calc(100vw - 32px)); } }
.res-menu-item { align-items: flex-start; justify-content: flex-start; }
.res-menu-icon { flex-shrink: 0; margin-top: 2px; color: var(--ink-soft); }
.res-menu-text { flex: 1; }
.res-menu-word { display: inline-flex; align-items: center; gap: var(--space-3); }
.res-menu-item:disabled { opacity: 0.5; cursor: default; }
.res-menu-label { display: block; font-weight: 600; }
.res-menu-hint { display: block; font-size: var(--fs-small); color: var(--ink-light); margin-top: 1px; }
.res-danger { color: var(--error-text); }

.res-toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 300; width: min(560px, calc(100vw - 32px)); box-shadow: var(--shadow); border-radius: 10px; }
.res-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 20px; margin-bottom: 24px; min-width: 0; }
.res-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.res-h2 { font-size: var(--fs-h3); font-weight: 800; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 4px; }
.res-hint a { color: var(--link); font-weight: 600; }
.res-hint { font-size: var(--fs-small); color: var(--ink-light); line-height: 1.5; margin: 0; }
.res-empty { font-size: var(--fs-ui); color: var(--ink-soft); margin: 12px 0 0; padding: 14px; border: 1px dashed var(--border); border-radius: 10px; text-align: center; }
.res-center { display: flex; align-items: center; justify-content: center; gap: var(--space-3); padding: 28px 0; color: var(--ink-soft); }
.res-stack { display: flex; flex-direction: column; gap: var(--space-3); }

/* Ask for a change */
.res-scope { display: inline-flex; gap: var(--space-1); padding: 4px; margin: 12px 0 10px; border-radius: 10px; background: var(--surface); }
.res-scope-btn { min-height: 36px; padding: 6px 14px; border: 0; border-radius: 8px; background: none; font: inherit; font-size: var(--fs-ui); font-weight: 600; color: var(--ink-soft); cursor: pointer; }
.res-scope-btn.on { background: var(--bg-card); color: var(--ink); box-shadow: var(--shadow-sm); }
.res-scope-btn:disabled { opacity: 0.5; cursor: default; }
.res-scope-btn:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.res-scenes { display: flex; gap: var(--space-2); overflow-x: auto; padding: 2px 2px 8px; margin-bottom: 10px; }
.res-scene { position: relative; flex: 0 0 auto; border: 1.5px solid var(--border-light); border-radius: 10px; background: var(--bg-card); }
.res-scene.on { border-color: var(--accent-ink); background: var(--accent-soft); }
.res-scene-pick { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); width: 168px; padding: 6px; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; color: var(--ink); }
.res-scene-pick:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 8px; }
.res-scene-thumb { width: 156px; height: 88px; object-fit: cover; border-radius: 6px; display: block; }
.res-scene-text { display: flex; gap: var(--space-2); align-items: baseline; min-width: 0; width: 100%; }
.res-scene-time { font-family: ui-monospace, monospace; font-size: var(--fs-caption); color: var(--ink-light); flex-shrink: 0; }
.res-scene-label { font-size: var(--fs-small); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.res-scene-zoom { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border: 0; border-radius: 6px; background: color-mix(in srgb, var(--ink) 70%, transparent); color: var(--on-ink); cursor: pointer; font-size: var(--fs-small); line-height: 1; }
.res-zoom-img { display: block; width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px; }
.res-suggest { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: 10px; }
.res-suggest-chip { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 34px; padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font: inherit; font-size: var(--fs-small); font-weight: 600; color: var(--ink); cursor: pointer; }
.res-suggest-chip:hover { border-color: var(--accent-ink); }
.res-suggest-chip.on { border-color: var(--accent-ink); background: var(--accent-soft); }
.res-suggest-chip:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.res-free { font-size: var(--fs-caption); font-weight: 700; color: var(--accent-ink); }
.res-cost { font-size: var(--fs-caption); font-weight: 700; color: var(--gold); }
.res-change-text { width: 100%; resize: vertical; line-height: 1.5; }
.res-change-go { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-top: 12px; }
.res-changes { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-light); }
.res-changes ul { list-style: none; margin: 0 0 6px; padding: 0; }
.res-change-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: 8px 0; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; }
.res-change-what { font-size: var(--fs-ui); color: var(--ink); min-width: 0; }

/* The older scene editor, opened from the bar */
.res-older-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); flex-wrap: wrap; margin-bottom: 14px; }
.res-older-actions { display: flex; gap: var(--space-2); }
@media (max-width: 767px) {
  .res-older-body > div { flex-direction: column !important; }
  .res-older-body > div > div { width: 100% !important; max-height: none !important; }
}

/* Who watched */
.res-stats { display: flex; gap: var(--space-4); font-size: var(--fs-ui); color: var(--ink-soft); }
.res-stats strong { color: var(--ink); font-size: var(--fs-lead); }
.res-viewers { list-style: none; margin: 12px 0 0; padding: 0; }
.res-viewer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-2) var(--space-5); padding: 12px 0; border-top: 1px solid var(--border-light); }
@media (max-width: 640px) { .res-viewer { grid-template-columns: minmax(0, 1fr); } }
.res-viewer-who { min-width: 0; overflow-wrap: anywhere; }
.res-viewer-far { font-size: var(--fs-ui); color: var(--ink); margin-top: 4px; }
.res-qbar { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-1); height: 10px; max-width: 260px; }
.res-q { border-radius: 3px; background: var(--border); }
.res-q.on { background: var(--accent-ink); }
.res-clicks { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: 6px; }

/* More for this */
.res-more .kit-tabs { margin: 10px 0 16px; }
.res-post { border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.res-post-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--border-light); }
.res-post-body { padding: 12px; font-size: var(--fs-ui); line-height: 1.6; color: var(--ink); white-space: pre-wrap; }

/* Fix-a-Scene (inside the kit dialog) */
.fix-find { margin-bottom: 14px; padding: 12px; border-radius: 10px; background: var(--accent-soft); border: 1px solid var(--accent); }
.fix-label { display: block; font-size: var(--fs-small); font-weight: 700; color: var(--ink); margin-bottom: 6px; }
.fix-row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.fix-row .input { flex: 1 1 200px; }
.fix-eyebrow { font-size: var(--fs-caption); font-weight: 700; color: var(--ink-light); text-transform: uppercase; letter-spacing: 0.05em; margin: 4px 0 8px; }
.fix-list { display: flex; flex-direction: column; gap: var(--space-2); }
.fix-scene { display: flex; gap: var(--space-3); align-items: center; text-align: left; padding: 8px; border-radius: 10px; border: 1px solid var(--border-light); background: var(--bg-card); cursor: pointer; font: inherit; color: var(--ink); }
.fix-scene:hover { border-color: var(--accent-ink); }
.fix-thumb { width: 96px; height: 54px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.fix-thumb--big { width: 120px; height: 68px; }
.fix-thumb--empty { background: var(--border); display: flex; align-items: center; justify-content: center; font-size: var(--fs-caption); color: var(--ink-light); }
.fix-scene-title { font-size: var(--fs-body); font-weight: 700; color: var(--ink); }
.fix-scene-words { font-size: var(--fs-small); color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fix-scene-words--full { white-space: normal; margin-top: 4px; line-height: 1.4; }
.fix-chosen { display: flex; gap: var(--space-3); align-items: center; margin: 8px 0 14px; }
.fix-kinds { display: flex; gap: var(--space-2); margin-bottom: 14px; flex-wrap: wrap; }
.fix-kind { padding: 9px 12px; border-radius: 8px; cursor: pointer; font: inherit; font-size: var(--fs-small); font-weight: 700; border: 1.5px solid var(--border-light); background: var(--bg-card); color: var(--ink); }
.fix-kind.on { border: 2px solid var(--accent-ink); background: var(--accent-soft); }
.fix-kind:disabled { opacity: 0.5; cursor: not-allowed; }
.fix-free { color: var(--accent-ink); font-weight: 600; }
.fix-cost { color: var(--ink-light); font-weight: 600; }
.fix-preview { margin-bottom: 14px; padding: 12px; border-radius: 10px; background: var(--accent-soft); border: 1px solid var(--accent); }
.fix-error { color: var(--error-text); font-size: var(--fs-small); margin: 0 0 12px; }
.fix-actions { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
`
