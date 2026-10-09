// Styles for the result page's own parts (header, menus, the change bar,
// "Who watched", the More-for-this area, Fix-a-Scene). Colours are only the
// names in app/globals.css; corners stay at 10px or less (house rule —
// circles excepted). The send panel keeps its own sheet (ready-to-send-css).
export const RESULT_CSS = `
.res-page { max-width: 1400px; margin: 0 auto; }
.res-head { margin-bottom: 20px; }
.res-head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.res-head-title { min-width: 0; flex: 1 1 320px; }
.res-title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; max-width: 100%; }
.res-title-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.res-title-pen { opacity: 0.45; flex-shrink: 0; }
.res-rename { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.res-rename .input { flex: 1 1 260px; font-size: 20px; font-weight: 700; }
.res-meta { font-size: 14px; color: var(--ink-light); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.res-brand { display: inline-flex; align-items: center; gap: 4px; }
.res-brand-dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.res-head-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.res-gap { margin-top: 14px; }

.res-menu { width: 280px; }
.res-menu--left { left: 0; right: auto; }
@media (max-width: 520px) { .res-menu { right: auto; left: 0; width: min(280px, calc(100vw - 32px)); } }
.res-menu-item { align-items: flex-start; justify-content: flex-start; }
.res-menu-icon { flex-shrink: 0; margin-top: 2px; color: var(--ink-soft); }
.res-menu-text { flex: 1; }
.res-menu-word { display: inline-flex; align-items: center; gap: 10px; }
.res-menu-item:disabled { opacity: 0.5; cursor: default; }
.res-menu-label { display: block; font-weight: 600; }
.res-menu-hint { display: block; font-size: 12.5px; color: var(--ink-light); margin-top: 1px; }
.res-danger { color: var(--error-text); }

.res-toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 300; width: min(560px, calc(100vw - 32px)); box-shadow: var(--shadow); border-radius: 10px; }
.res-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 20px; margin-bottom: 24px; min-width: 0; }
.res-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.res-h2 { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 4px; }
.res-hint a { color: var(--link); font-weight: 600; }
.res-hint { font-size: 13px; color: var(--ink-light); line-height: 1.5; margin: 0; }
.res-empty { font-size: 14px; color: var(--ink-soft); margin: 12px 0 0; padding: 14px; border: 1px dashed var(--border); border-radius: 10px; text-align: center; }
.res-center { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 28px 0; color: var(--ink-soft); }
.res-stack { display: flex; flex-direction: column; gap: 12px; }

/* Ask for a change */
.res-scope { display: inline-flex; gap: 4px; padding: 4px; margin: 12px 0 10px; border-radius: 10px; background: var(--surface); }
.res-scope-btn { min-height: 36px; padding: 6px 14px; border: 0; border-radius: 8px; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
.res-scope-btn.on { background: var(--bg-card); color: var(--ink); box-shadow: var(--shadow-sm); }
.res-scope-btn:disabled { opacity: 0.5; cursor: default; }
.res-scope-btn:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.res-scenes { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 8px; margin-bottom: 10px; }
.res-scene { position: relative; flex: 0 0 auto; border: 1.5px solid var(--border-light); border-radius: 10px; background: var(--bg-card); }
.res-scene.on { border-color: var(--accent-ink); background: var(--accent-soft); }
.res-scene-pick { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; width: 168px; padding: 6px; border: 0; background: none; font: inherit; text-align: left; cursor: pointer; color: var(--ink); }
.res-scene-pick:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 8px; }
.res-scene-thumb { width: 156px; height: 88px; object-fit: cover; border-radius: 6px; display: block; }
.res-scene-text { display: flex; gap: 6px; align-items: baseline; min-width: 0; width: 100%; }
.res-scene-time { font-family: ui-monospace, monospace; font-size: 11px; color: var(--ink-light); flex-shrink: 0; }
.res-scene-label { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.res-scene-zoom { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border: 0; border-radius: 6px; background: color-mix(in srgb, var(--ink) 70%, transparent); color: var(--on-ink); cursor: pointer; font-size: 13px; line-height: 1; }
.res-zoom-img { display: block; width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px; }
.res-suggest { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.res-suggest-chip { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font: inherit; font-size: 13.5px; font-weight: 600; color: var(--ink); cursor: pointer; }
.res-suggest-chip:hover { border-color: var(--accent-ink); }
.res-suggest-chip.on { border-color: var(--accent-ink); background: var(--accent-soft); }
.res-suggest-chip:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.res-free { font-size: 12px; font-weight: 700; color: var(--accent-ink); }
.res-cost { font-size: 12px; font-weight: 700; color: var(--gold); }
.res-change-text { width: 100%; resize: vertical; line-height: 1.5; }
.res-change-go { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.res-changes { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-light); }
.res-changes ul { list-style: none; margin: 0 0 6px; padding: 0; }
.res-change-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; }
.res-change-what { font-size: 14px; color: var(--ink); min-width: 0; }

/* The older scene editor, opened from the bar */
.res-older-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.res-older-actions { display: flex; gap: 8px; }
@media (max-width: 767px) {
  .res-older-body > div { flex-direction: column !important; }
  .res-older-body > div > div { width: 100% !important; max-height: none !important; }
}

/* Who watched */
.res-stats { display: flex; gap: 14px; font-size: 14px; color: var(--ink-soft); }
.res-stats strong { color: var(--ink); font-size: 18px; }
.res-viewers { list-style: none; margin: 12px 0 0; padding: 0; }
.res-viewer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px 20px; padding: 12px 0; border-top: 1px solid var(--border-light); }
@media (max-width: 640px) { .res-viewer { grid-template-columns: minmax(0, 1fr); } }
.res-viewer-who { min-width: 0; overflow-wrap: anywhere; }
.res-viewer-far { font-size: 14px; color: var(--ink); margin-top: 4px; }
.res-qbar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; height: 10px; max-width: 260px; }
.res-q { border-radius: 3px; background: var(--border); }
.res-q.on { background: var(--accent-ink); }
.res-clicks { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }

/* More for this */
.res-more .kit-tabs { margin: 10px 0 16px; }
.res-post { border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; }
.res-post-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--border-light); }
.res-post-body { padding: 12px; font-size: 14px; line-height: 1.6; color: var(--ink); white-space: pre-wrap; }

/* Fix-a-Scene (inside the kit dialog) */
.fix-find { margin-bottom: 14px; padding: 12px; border-radius: 10px; background: var(--accent-soft); border: 1px solid var(--accent); }
.fix-label { display: block; font-size: 13.5px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
.fix-row { display: flex; gap: 8px; flex-wrap: wrap; }
.fix-row .input { flex: 1 1 200px; }
.fix-eyebrow { font-size: 12px; font-weight: 700; color: var(--ink-light); text-transform: uppercase; letter-spacing: 0.05em; margin: 4px 0 8px; }
.fix-list { display: flex; flex-direction: column; gap: 8px; }
.fix-scene { display: flex; gap: 12px; align-items: center; text-align: left; padding: 8px; border-radius: 10px; border: 1px solid var(--border-light); background: var(--bg-card); cursor: pointer; font: inherit; color: var(--ink); }
.fix-scene:hover { border-color: var(--accent-ink); }
.fix-thumb { width: 96px; height: 54px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.fix-thumb--big { width: 120px; height: 68px; }
.fix-thumb--empty { background: var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--ink-light); }
.fix-scene-title { font-size: 15px; font-weight: 700; color: var(--ink); }
.fix-scene-words { font-size: 13px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fix-scene-words--full { white-space: normal; margin-top: 4px; line-height: 1.4; }
.fix-chosen { display: flex; gap: 12px; align-items: center; margin: 8px 0 14px; }
.fix-kinds { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.fix-kind { padding: 9px 12px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; border: 1.5px solid var(--border-light); background: var(--bg-card); color: var(--ink); }
.fix-kind.on { border: 2px solid var(--accent-ink); background: var(--accent-soft); }
.fix-kind:disabled { opacity: 0.5; cursor: not-allowed; }
.fix-free { color: var(--accent-ink); font-weight: 600; }
.fix-cost { color: var(--ink-light); font-weight: 600; }
.fix-preview { margin-bottom: 14px; padding: 12px; border-radius: 10px; background: var(--accent-soft); border: 1px solid var(--accent); }
.fix-error { color: var(--error-text); font-size: 13px; margin: 0 0 12px; }
.fix-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
`
