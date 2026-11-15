// Styles for the "Ready to send" panel. Colours come only from the app's own
// variables in globals.css (so it matches the rest of the app); corners stay
// at 10px or less (house rule — circles and the switch track excepted).
export const READY_TO_SEND_CSS = `
.rts { margin-bottom: 32px; }
.rts-title { font-size: var(--fs-h1); font-weight: 800; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 4px; line-height: 1.15; }
.rts-title em { font-family: var(--font-serif); font-style: italic; font-weight: 400; }
.rts-sub { font-size: var(--fs-ui); color: var(--ink-soft); margin: 0 0 18px; }
.rts-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: var(--space-5); align-items: start; }
@media (max-width: 960px) { .rts-layout { grid-template-columns: minmax(0, 1fr); } }

.rts-browser { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; box-shadow: var(--shadow-sm); min-width: 0; }
.rts-browser-bar { display: flex; align-items: center; gap: var(--space-2); padding: 9px 12px; background: var(--surface); border-bottom: 1px solid var(--border-light); }
.rts-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--border); flex-shrink: 0; }
.rts-url { flex: 1; min-width: 0; margin-left: 8px; padding: 4px 10px; background: var(--bg-card); border-radius: 6px; font-size: var(--fs-caption); color: var(--ink-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rts-open { font-size: var(--fs-caption); font-weight: 700; color: var(--mint-darker); text-decoration: none; white-space: nowrap; flex-shrink: 0; }
.rts-page { padding: 18px; background: var(--bg-soft); }
.rts-page-title { font-size: var(--fs-lead); font-weight: 800; color: var(--ink); margin-bottom: 12px; text-align: center; }
.rts-greeting { padding: 10px 14px; border-radius: 10px; background: var(--accent-soft); border: 1px solid var(--accent); color: var(--ink); font-weight: 600; font-size: var(--fs-ui); text-align: center; }
.rts-note { padding: 10px 14px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-light); color: var(--ink-soft); font-size: var(--fs-small); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.rts-page-main { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: var(--space-4); align-items: start; }
.rts-page-main.single { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 640px) { .rts-page-main { grid-template-columns: minmax(0, 1fr); } }
.rts-media { aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: var(--ink); border: 1px solid var(--border-light); }
.rts-side { display: flex; flex-direction: column; gap: var(--space-2); }
.rts-fake-btn { display: flex; align-items: center; justify-content: center; min-height: 38px; padding: 6px 10px; border-radius: 10px; font-size: var(--fs-small); font-weight: 700; text-align: center; cursor: default; user-select: none; }
/* Words on the mint fill are navy: white on pale mint can't be read. */
.rts-fake-btn.primary { background: var(--accent); color: var(--ink); }
.rts-fake-btn.dark { background: var(--ink); color: var(--on-ink); }
.rts-fake-btn.outline { background: var(--bg-card); color: var(--ink); border: 1px solid var(--border); }
.rts-fake-btn.small { min-height: 32px; font-size: var(--fs-caption); margin-top: 6px; }
.rts-quote { padding: 10px 12px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-light); }
.rts-quote-label { font-size: var(--fs-caption); font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-light); }
.rts-quote-total { font-size: var(--fs-lead); font-weight: 800; color: var(--ink); margin-top: 2px; }

.rts-panel { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 10px; padding: 20px; min-width: 0; }
.rts-eyebrow { font-size: var(--fs-caption); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-light); margin-bottom: 6px; }
.rts-rows { margin-top: 14px; border-top: 1px solid var(--border-light); }
.rts-row { padding: 12px 0; border-bottom: 1px solid var(--border-light); }
.rts-row-label { font-size: var(--fs-ui); font-weight: 600; color: var(--ink); }
.rts-row-hint { font-size: var(--fs-caption); color: var(--ink-light); margin-top: 3px; line-height: 1.45; }
.rts-row-hint a { color: var(--mint-darker); font-weight: 600; }
.rts-error { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: var(--error-bg); color: var(--error-text); font-size: var(--fs-small); line-height: 1.45; }
.rts-sent { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: var(--success-bg); color: var(--ink); font-size: var(--fs-small); }
.rts-state { font-size: var(--fs-caption); font-weight: 700; color: var(--ink-light); flex-shrink: 0; }
.rts-state.on { color: var(--mint-darker); }
.rts-link { background: none; border: none; padding: 4px; font: inherit; font-size: var(--fs-small); font-weight: 600; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }

.rts-link--small { font-size: var(--fs-small); padding: 4px 0; margin-top: 4px; }
.rts-from { margin-top: 8px; text-align: center; }
/* Icon + words on one line (lucide icons, 16px). */
.rts-inline-icon { display: inline-block; vertical-align: -3px; }
.rts-icon-link { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); }
/* The Library's Send button lands here (#send) — clear of the sticky bar. */
.rts { scroll-margin-top: 88px; }
.rts-alt { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--space-1) var(--space-2); margin-top: 10px; }
.rts-dot-sep { color: var(--ink-light); }
.rts-center { text-align: center; }

/* What's left — chips above Send. Dashed edge = "still to do"; navy words. */
.rts-left { margin: 0 0 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border-light); }
.rts-left-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
.rts-left-chip { display: inline-flex; align-items: center; min-height: 32px; padding: 4px 10px; border-radius: 8px; border: 1px dashed var(--border); background: var(--bg-soft); color: var(--ink); font: inherit; font-size: var(--fs-small); font-weight: 600; text-decoration: none; cursor: pointer; }
.rts-left-chip:hover { border-color: var(--accent-ink); background: var(--accent-soft); }
.rts-left-chip:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.rts-left-done { margin: 0; color: var(--accent-ink); font-weight: 600; }

/* Email | Text tabs, and the Text tab's phone preview. */
.rts-text { margin-top: 14px; }
.rts-tabs { margin: 0 0 14px; }
.rts-gap { margin-top: 12px; }
.rts-phone { margin-top: 4px; padding: 12px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border-light); display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); }
.rts-phone-from { align-self: center; font-size: var(--fs-caption); font-weight: 700; color: var(--ink-light); }
.rts-bubble-pic { display: block; width: 72%; max-width: 240px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 10px; border: 1px solid var(--border-light); background: var(--ink); }
.rts-bubble { max-width: 88%; padding: 9px 12px; border-radius: 10px; border-bottom-left-radius: 3px; background: var(--bg-card); color: var(--ink); border: 1px solid var(--border-light); font-size: var(--fs-small); line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
.rts-phone-meta { font-size: var(--fs-caption); color: var(--ink-light); }
.rts-consent { display: flex; gap: var(--space-3); align-items: flex-start; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-soft); cursor: pointer; font-size: var(--fs-small); color: var(--ink); }
.rts-consent input { margin-top: 3px; accent-color: var(--accent-ink); width: 18px; height: 18px; flex-shrink: 0; }
.rts-consent:has(input:focus-visible) { outline: 2px solid var(--link); outline-offset: 2px; }

.rts-switch { position: relative; flex-shrink: 0; width: 40px; height: 24px; padding: 0; border: none; border-radius: 12px; background: var(--border); cursor: pointer; transition: background 0.15s; }
.rts-switch.on { background: var(--ink); }
.rts-switch:disabled { opacity: 0.5; cursor: not-allowed; }
.rts-switch:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.rts-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--bg-card); box-shadow: 0 1px 2px rgba(0,0,0,0.2); transition: left 0.15s; }
.rts-switch.on .rts-knob { left: 19px; }

/* LAYOUT D (2026-11-15): their page is the editor, one column; the send bar stays at the bottom of the screen. */
.rts-d { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-4); }
.rts-d .rts-page-main { grid-template-columns: minmax(0, 1fr) 230px; }
@media (max-width: 640px) { .rts-d .rts-page-main { grid-template-columns: minmax(0, 1fr); } }
.rts-note--edit { outline: 2px dashed var(--link); outline-offset: 3px; }
.rts-note-input { width: 100%; border: 0; background: transparent; color: var(--ink); font: inherit; font-size: var(--fs-ui); line-height: 1.5; resize: vertical; padding: 0; min-height: 44px; }
.rts-note-input:focus { outline: none; }
.rts-note--edit:focus-within { outline-style: solid; }
.rts-piece { display: flex; flex-direction: column; gap: 4px; }
.rts-piece-cap { font-size: var(--fs-caption); color: var(--ink-light); line-height: 1.4; }
.rts-piece-cap a { color: var(--mint-darker); font-weight: 600; }
.rts-piece-x { align-self: flex-start; background: none; border: 0; padding: 2px 0; font: inherit; font-size: var(--fs-caption); font-weight: 600; color: var(--ink-light); text-decoration: underline; cursor: pointer; }
.rts-ghost { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 10px 12px; border-radius: 10px; border: 2px dashed var(--border); background: transparent; color: var(--ink); font: inherit; font-size: var(--fs-small); font-weight: 700; text-align: left; text-decoration: none; cursor: pointer; }
.rts-ghost small { font-weight: 500; color: var(--ink-light); font-size: var(--fs-caption); }
.rts-ghost:hover { border-color: var(--link); background: var(--accent-soft); }
.rts-ghost:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.rts-ghost:disabled { opacity: 0.6; cursor: not-allowed; }
.rts-ghost--line { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
.rts-d-extra { margin-top: 0; }
.rts-bar { position: sticky; bottom: 12px; z-index: 5; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; box-shadow: 0 -8px 28px rgba(0,0,0,0.18); display: flex; flex-direction: column; gap: var(--space-2); }
.rts-bar-row { display: flex; flex-wrap: wrap; gap: var(--space-3) var(--space-4); align-items: center; justify-content: space-between; }
.rts-bar-who { flex: 1 1 320px; min-width: 0; }
.rts-bar-fields { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.rts-bar-fields .input { flex: 1 1 200px; min-width: 0; }
.rts-bar-go { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.rts-bar-go .rts-alt { margin-top: 0; justify-content: flex-end; }
.rts-bar .rts-from { margin-top: 0; text-align: left; }
@media (max-width: 640px) { .rts-bar-go { align-items: stretch; width: 100%; } .rts-bar-go .btn { width: 100%; } }

/* LAYOUT F (2026-11-15): the video, one line to send, quiet links; a side panel to customize their page. */
.rts-f { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-3); }
.rts-f .rts-title { margin-bottom: 4px; }
.rts-f-media { width: 100%; }
.rts-f-send { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); align-items: center; }
.rts-f-send .input { flex: 1 1 240px; min-width: 0; }
.rts-f-send .btn { flex: 0 0 auto; }
.rts-f-who { flex: 1 1 300px; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.rts-f-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; }
.rts-f-link { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; padding: 6px 2px; font: inherit; font-size: var(--fs-small); font-weight: 600; color: var(--ink-soft); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.rts-f-link:hover { color: var(--ink); }
.rts-f-link--accent { color: var(--link); }
.rts-f-link:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }
.rts-drawer-dim { position: fixed; inset: 0; z-index: 60; background: rgba(5, 10, 25, 0.45); display: flex; justify-content: flex-end; }
.rts-drawer { width: min(420px, 100%); height: 100%; overflow-y: auto; background: var(--bg-card); border-left: 1px solid var(--border); box-shadow: -20px 0 40px rgba(0,0,0,0.3); padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: var(--space-4); }
.rts-drawer-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.rts-drawer-head h3 { margin: 0; font-size: var(--fs-lead); color: var(--ink); }
.rts-drawer-why { margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--bg-soft); border: 1px solid var(--border-light); color: var(--ink-soft); font-size: var(--fs-small); line-height: 1.55; }
.rts-drawer-why strong { color: var(--ink); }
.rts-drawer-sec { display: flex; flex-direction: column; gap: var(--space-2); }
.rts-drawer-pieces { display: flex; flex-direction: column; gap: var(--space-3); }
.rts-drawer-foot { margin-top: auto; display: flex; justify-content: flex-end; gap: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--border-light); }
`