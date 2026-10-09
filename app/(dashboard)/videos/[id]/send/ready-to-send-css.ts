// Styles for the "Ready to send" panel. Colours come only from the app's own
// variables in globals.css (so it matches the rest of the app); corners stay
// at 10px or less (house rule — circles and the switch track excepted).
export const READY_TO_SEND_CSS = `
.rts { margin-bottom: 32px; }
.rts-title { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 4px; line-height: 1.15; }
.rts-title em { font-family: var(--font-serif); font-style: italic; font-weight: 400; }
.rts-sub { font-size: 14px; color: var(--ink-soft); margin: 0 0 18px; }
.rts-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; align-items: start; }
@media (max-width: 960px) { .rts-layout { grid-template-columns: minmax(0, 1fr); } }

.rts-browser { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; box-shadow: var(--shadow-sm); min-width: 0; }
.rts-browser-bar { display: flex; align-items: center; gap: 6px; padding: 9px 12px; background: var(--surface); border-bottom: 1px solid var(--border-light); }
.rts-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--border); flex-shrink: 0; }
.rts-url { flex: 1; min-width: 0; margin-left: 8px; padding: 4px 10px; background: var(--bg-card); border-radius: 6px; font-size: 12px; color: var(--ink-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rts-open { font-size: 12px; font-weight: 700; color: var(--mint-darker); text-decoration: none; white-space: nowrap; flex-shrink: 0; }
.rts-page { padding: 18px; background: var(--bg-soft); }
.rts-page-title { font-size: 18px; font-weight: 800; color: var(--ink); margin-bottom: 12px; text-align: center; }
.rts-greeting { padding: 10px 14px; border-radius: 10px; background: var(--accent-soft); border: 1px solid var(--accent); color: var(--ink); font-weight: 600; font-size: 14px; text-align: center; }
.rts-note { padding: 10px 14px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-light); color: var(--ink-soft); font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.rts-page-main { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 14px; align-items: start; }
.rts-page-main.single { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 640px) { .rts-page-main { grid-template-columns: minmax(0, 1fr); } }
.rts-media { aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: var(--ink); border: 1px solid var(--border-light); }
.rts-side { display: flex; flex-direction: column; gap: 8px; }
.rts-fake-btn { display: flex; align-items: center; justify-content: center; min-height: 38px; padding: 6px 10px; border-radius: 10px; font-size: 13px; font-weight: 700; text-align: center; cursor: default; user-select: none; }
/* Words on the mint fill are navy: white on pale mint can't be read. */
.rts-fake-btn.primary { background: var(--accent); color: var(--ink); }
.rts-fake-btn.dark { background: var(--ink); color: var(--on-ink); }
.rts-fake-btn.outline { background: var(--bg-card); color: var(--ink); border: 1px solid var(--border); }
.rts-fake-btn.small { min-height: 32px; font-size: 12px; margin-top: 6px; }
.rts-quote { padding: 10px 12px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-light); }
.rts-quote-label { font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-light); }
.rts-quote-total { font-size: 18px; font-weight: 800; color: var(--ink); margin-top: 2px; }

.rts-panel { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 20px; min-width: 0; }
.rts-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); margin-bottom: 6px; }
.rts-rows { margin-top: 14px; border-top: 1px solid var(--border-light); }
.rts-row { padding: 12px 0; border-bottom: 1px solid var(--border-light); }
.rts-row-label { font-size: 14px; font-weight: 600; color: var(--ink); }
.rts-row-hint { font-size: 12px; color: var(--ink-light); margin-top: 3px; line-height: 1.45; }
.rts-row-hint a { color: var(--mint-darker); font-weight: 600; }
.rts-error { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: var(--error-bg); color: var(--error-text); font-size: 12.5px; line-height: 1.45; }
.rts-sent { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: var(--success-bg); color: var(--ink); font-size: 13px; }
.rts-state { font-size: 12px; font-weight: 700; color: var(--ink-light); flex-shrink: 0; }
.rts-state.on { color: var(--mint-darker); }
.rts-link { background: none; border: none; padding: 4px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }

.rts-link--small { font-size: 12.5px; padding: 4px 0; margin-top: 4px; }
.rts-from { margin-top: 8px; text-align: center; }
/* Icon + words on one line (lucide icons, 16px). */
.rts-inline-icon { display: inline-block; vertical-align: -3px; }
.rts-icon-link { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
/* The Library's Send button lands here (#send) — clear of the sticky bar. */
.rts { scroll-margin-top: 88px; }
.rts-alt { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 8px; margin-top: 10px; }
.rts-dot-sep { color: var(--ink-light); }
.rts-center { text-align: center; }

/* What's left — chips above Send. Dashed edge = "still to do"; navy words. */
.rts-left { margin: 0 0 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border-light); }
.rts-left-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.rts-left-chip { display: inline-flex; align-items: center; min-height: 32px; padding: 4px 10px; border-radius: 8px; border: 1px dashed var(--border); background: var(--bg-soft); color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; }
.rts-left-chip:hover { border-color: var(--accent-ink); background: var(--accent-soft); }
.rts-left-chip:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.rts-left-done { margin: 0; color: var(--accent-ink); font-weight: 600; }

.rts-switch { position: relative; flex-shrink: 0; width: 40px; height: 24px; padding: 0; border: none; border-radius: 12px; background: var(--border); cursor: pointer; transition: background 0.15s; }
.rts-switch.on { background: var(--ink); }
.rts-switch:disabled { opacity: 0.5; cursor: not-allowed; }
.rts-switch:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.rts-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--bg-card); box-shadow: 0 1px 2px rgba(0,0,0,0.2); transition: left 0.15s; }
.rts-switch.on .rts-knob { left: 19px; }
`
