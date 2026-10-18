/*
 * THE CLIENT PAGE'S LOOK — shared by the real share page (/watch/[id]) and the
 * demo (/share-demo), so the demo can never drift from what a client sees
 * (owner, 2026-10-18: the demo and the page still looked like the old cards).
 *
 * One layout: a hero band in the presenter's brand colour (the title, who it
 * is from, who it is for), the video riding up over its edge, and beside it
 * the presenter — photo, name, the one next step and how to reach them. On a
 * phone the presenter comes straight after the video. Every colour is a
 * --wt-* property set from the brand (app/_lib/share-theme.ts); type sizes are
 * the site's scale. Corners stay at 10px (the house rule).
 */
import type { ReactNode } from 'react'

export const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)
export const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
)
export const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></svg>
)
export const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
)
export const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
)
export const IconGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
)
export const IconPlay = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)

export const WATCH_CSS = `
  .wp-root {
    min-height: 100vh;
    background: var(--wt-paper);
    color: var(--wt-ink);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wp-root a { color: inherit; }
  .wp-wrap { max-width: 1200px; margin: 0 auto; padding: 0 40px; box-sizing: border-box; }
  .wp-serif { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; }

  /* ── The hero: the brand's colour, who it is from, who it is for, the title ── */
  .wp-hero {
    background:
      radial-gradient(120% 140% at 85% -10%, color-mix(in srgb, var(--wt-hero-label) 14%, transparent) 0%, transparent 55%),
      linear-gradient(160deg, var(--wt-hero) 0%, var(--wt-hero-deep) 100%);
    color: var(--wt-hero-ink);
    padding: 28px 0 150px;
    position: relative;
    overflow: hidden;
  }
  .wp-hero::after {
    content: '';
    position: absolute; inset: auto 0 0 0; height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--wt-hero-ink) 18%, transparent), transparent);
  }
  .wp-topline { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .wp-ident { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .wp-ident-photo { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--wt-hero-ink) 70%, transparent); }
  .wp-ident-logo { height: 44px; max-width: 170px; padding: 6px 12px; box-sizing: border-box; border-radius: 8px; background: var(--wt-card); display: flex; align-items: center; flex: none; }
  .wp-ident-logo img { max-height: 32px; max-width: 146px; object-fit: contain; display: block; }
  .wp-ident-initials { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--wt-accent); color: var(--wt-on-accent); font-weight: 800; font-size: var(--fs-ui); }
  .wp-ident-name { font-weight: 700; font-size: var(--fs-ui); line-height: 1.3; }
  .wp-ident-sub { font-size: var(--fs-caption); color: var(--wt-hero-soft); line-height: 1.3; }
  .wp-for { font-size: var(--fs-caption); font-weight: 600; letter-spacing: 0.04em; color: var(--wt-hero-soft); padding: 7px 14px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--wt-hero-ink) 26%, transparent); }
  .wp-hero-text { margin-top: 64px; max-width: 860px; }
  .wp-kicker { display: block; font-size: var(--fs-caption); font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--wt-hero-label); margin-bottom: 14px; }
  .wp-title { margin: 0; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: clamp(var(--fs-h1), 6vw, calc(var(--fs-display) * 1.45)); line-height: 1.02; letter-spacing: -0.01em; overflow-wrap: anywhere; }
  .wp-hello { margin: 18px 0 0; font-size: var(--fs-lead); line-height: 1.5; color: var(--wt-hero-soft); max-width: 640px; }
  .wp-hello strong { color: var(--wt-hero-ink); font-weight: 600; }

  /* ── Below the hero: the video rides up over its edge ── */
  .wp-body { margin-top: -112px; position: relative; padding-bottom: 56px; }
  .wp-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    grid-template-areas: "player side" "main side";
    column-gap: 36px;
    align-items: start;
  }
  .wp-a-player { grid-area: player; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
  .wp-col-main { grid-area: main; min-width: 0; display: flex; flex-direction: column; gap: 40px; padding-top: 40px; }
  .wp-col-side { grid-area: side; position: sticky; top: 24px; align-self: start; }

  .wp-video-wrap { background: black; border-radius: 10px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.32), 0 6px 18px rgba(0,0,0,0.18); }
  .wp-video-wrap video { width: 100%; display: block; max-height: 70vh; background: black; }
  .wp-poster { position: relative; aspect-ratio: 16 / 9; display: grid; place-items: center; background-size: cover; background-position: center; }
  .wp-poster-play { width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; background: var(--wt-accent); color: var(--wt-on-accent); box-shadow: 0 10px 30px rgba(0,0,0,0.35); }

  .wp-music { display: flex; align-items: center; gap: 10px; font-size: var(--fs-caption); color: var(--wt-ink-soft); padding: 0 2px; }
  .wp-music button { background: none; border: none; cursor: pointer; padding: 2px; display: flex; color: inherit; }
  .wp-music input { flex: 1; max-width: 140px; accent-color: var(--wt-accent-ink); }

  .wp-paid { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: var(--wt-accent-tint); color: var(--wt-ink); font-weight: 700; font-size: var(--fs-ui); }

  /* ── Section headings ── */
  .wp-label { display: block; font-size: var(--fs-caption); font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--wt-accent-ink); margin-bottom: 10px; }
  .wp-h2 { margin: 0 0 18px; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: var(--fs-h2); line-height: 1.15; color: var(--wt-ink); }

  /* ── A note from the presenter ── */
  .wp-note { position: relative; padding: 4px 0 0 56px; }
  .wp-note::before { content: '\\201C'; position: absolute; left: 0; top: -14px; font-family: 'Instrument Serif', Georgia, serif; font-size: calc(var(--fs-display) * 1.6); line-height: 1; color: var(--wt-accent-ink); }
  .wp-note p { margin: 0; font-family: 'Instrument Serif', Georgia, serif; font-size: var(--fs-big); line-height: 1.4; color: var(--wt-ink); white-space: pre-wrap; }
  .wp-note-by { margin-top: 12px; font-size: var(--fs-small); color: var(--wt-ink-soft); font-weight: 600; }

  /* ── In this video: chapters and the pages ── */
  .wp-chapters { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--wt-line); }
  .wp-chapter { border-bottom: 1px solid var(--wt-line); }
  .wp-chapter button { width: 100%; display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 14px 4px; background: none; border: 0; cursor: pointer; text-align: left; font-family: inherit; color: var(--wt-ink); font-size: var(--fs-body); }
  .wp-chapter button:hover { background: color-mix(in srgb, var(--wt-accent-tint) 60%, transparent); }
  .wp-chapter-time { font-variant-numeric: tabular-nums; font-size: var(--fs-small); color: var(--wt-ink-faint); font-weight: 600; }
  .wp-chapter.is-on button { background: var(--wt-accent-tint); font-weight: 700; }
  .wp-chapter.is-on .wp-chapter-time { color: var(--wt-accent-ink); }
  .wp-chapter-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--wt-accent-ink); opacity: 0; }
  .wp-chapter.is-on .wp-chapter-dot { opacity: 1; }
  .wp-pages { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .wp-page { position: relative; padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--wt-card); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .wp-page.is-on { border-color: var(--wt-accent-ink); }
  .wp-page img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
  .wp-page-num { position: absolute; left: 6px; bottom: 6px; padding: 1px 7px; border-radius: 4px; background: rgba(0,0,0,0.65); color: white; font-size: var(--fs-caption); font-weight: 700; }

  /* ── Cards: quote, answers ── */
  .wp-card { background: var(--wt-card); border: 1px solid var(--wt-line); border-radius: 10px; padding: 28px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .wp-quote-line { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--wt-line); font-size: var(--fs-body); }
  .wp-quote-line span:last-child { font-weight: 700; white-space: nowrap; }
  .wp-quote-total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 18px; }
  .wp-quote-total-label { font-weight: 700; font-size: var(--fs-body); }
  .wp-quote-total-value { font-family: 'Instrument Serif', Georgia, serif; font-size: var(--fs-h1); color: var(--wt-ink); }
  .wp-quote-actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
  .wp-answer { padding: 18px 0; border-top: 1px solid var(--wt-line); }
  .wp-answer:first-child { border-top: 0; padding-top: 0; }
  .wp-answer-q { margin: 0 0 6px; font-size: var(--fs-body); font-weight: 700; color: var(--wt-ink); }
  .wp-answer-a { margin: 0; font-size: var(--fs-body); line-height: 1.65; color: var(--wt-ink-soft); white-space: pre-wrap; }
  .wp-answer-by { margin: 8px 0 0; font-size: var(--fs-caption); color: var(--wt-ink-faint); }
  .wp-fine { margin: 14px 0 0; font-size: var(--fs-caption); line-height: 1.5; color: var(--wt-ink-faint); }

  /* ── Buttons ── */
  .wp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 20px; border-radius: 10px; font-family: inherit; font-size: var(--fs-ui); font-weight: 700; text-decoration: none; cursor: pointer; border: 1px solid var(--wt-line); background: var(--wt-card); color: var(--wt-ink); transition: transform 0.12s, box-shadow 0.15s, border-color 0.15s; box-sizing: border-box; }
  .wp-btn:hover { border-color: var(--wt-accent-ink); }
  .wp-btn:focus-visible { outline: 3px solid var(--wt-accent-ink); outline-offset: 2px; }
  .wp-btn--main { background: var(--wt-accent); border-color: var(--wt-accent); color: var(--wt-on-accent); box-shadow: 0 8px 22px color-mix(in srgb, var(--wt-accent) 32%, transparent); }
  .wp-btn--main:hover { transform: translateY(-1px); border-color: var(--wt-accent); }
  .wp-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
  .wp-btn--grow { flex: 1 1 200px; }

  /* ── The presenter ── */
  .wp-presenter { background: var(--wt-card); border: 1px solid var(--wt-line); border-radius: 10px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06); }
  .wp-presenter-photo { width: 100%; aspect-ratio: 4 / 3.3; object-fit: cover; object-position: 50% 22%; display: block; background: var(--wt-accent-tint); }
  .wp-presenter-logo { display: grid; place-items: center; padding: 34px 24px; background: var(--wt-accent-tint); border-bottom: 1px solid var(--wt-line); }
  .wp-presenter-logo img { max-height: 64px; max-width: 220px; object-fit: contain; display: block; }
  .wp-presenter-initials { display: grid; place-items: center; height: 150px; background: var(--wt-hero); color: var(--wt-hero-ink); font-family: 'Instrument Serif', Georgia, serif; font-size: calc(var(--fs-display) * 1.3); }
  .wp-presenter-body { padding: 22px 22px 24px; display: flex; flex-direction: column; gap: 18px; }
  .wp-presenter-name { margin: 0; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: var(--fs-h2); line-height: 1.1; color: var(--wt-ink); }
  .wp-presenter-sub { margin: 4px 0 0; font-size: var(--fs-small); color: var(--wt-ink-soft); }
  .wp-next { display: flex; flex-direction: column; gap: 10px; }
  .wp-next .wp-btn { width: 100%; }
  .wp-contact { list-style: none; margin: 0; padding: 16px 0 0; border-top: 1px solid var(--wt-line); display: flex; flex-direction: column; gap: 10px; }
  .wp-contact a { display: flex; align-items: center; gap: 10px; font-size: var(--fs-small); color: var(--wt-ink-soft); text-decoration: none; overflow-wrap: anywhere; }
  .wp-contact a:hover { color: var(--wt-accent-ink); }
  .wp-contact svg { color: var(--wt-accent-ink); flex: none; }

  /* ── Downloads, disclosures, footer ── */
  .wp-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .wp-textlink { display: inline-block; font-size: var(--fs-small); font-weight: 600; color: var(--wt-ink-soft); cursor: pointer; padding: 8px 0; border: none; background: none; text-decoration: underline; font-family: inherit; }
  .wp-textlink:hover { color: var(--wt-ink); }
  .wp-disclosures-panel { background: var(--wt-card); border: 1px solid var(--wt-line); border-radius: 10px; padding: 24px 28px; margin-top: 8px; max-height: 480px; overflow-y: auto; }
  .wp-disclosures-heading { font-size: var(--fs-small); font-weight: 700; color: var(--wt-ink); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  .wp-disclosures-text { font-size: var(--fs-caption); line-height: 1.7; color: var(--wt-ink-soft); margin: 0 0 6px; }
  .wp-disclosures-divider { border: none; border-top: 1px solid var(--wt-line); margin: 16px 0; }
  .wp-footer { text-align: center; padding: 28px 0 36px; border-top: 1px solid var(--wt-line); }
  .wp-footer a, .wp-footer span { font-size: var(--fs-caption); color: var(--wt-ink-faint); text-decoration: none; font-weight: 600; letter-spacing: 0.04em; }
  .wp-footer a:hover { color: var(--wt-ink-soft); }

  /* ── Loading, not found ── */
  .wp-center-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .wp-not-found { text-align: center; padding: 40px 16px; max-width: 480px; }
  .wp-not-found h1 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: var(--fs-h1); margin: 0 0 10px; }
  .wp-not-found p { font-size: var(--fs-body); color: var(--wt-ink-soft); margin: 0 0 4px; }

  /* ── The lead card and the question form ── */
  .wp-lead-card { position: fixed; bottom: 0; left: 0; right: 0; z-index: 200; background: var(--wt-card); border-top: 1px solid var(--wt-line); box-shadow: 0 -8px 30px rgba(0,0,0,0.10); padding: 20px 24px; animation: wpSlideUp 0.4s ease-out; }
  .wp-lead-inner { max-width: 560px; margin: 0 auto; }
  .wp-lead-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .wp-lead-title { font-size: var(--fs-body); font-weight: 700; color: var(--wt-ink); }
  .wp-lead-close { background: none; border: none; cursor: pointer; padding: 4px; color: var(--wt-ink-faint); }
  .wp-lead-close:hover { color: var(--wt-ink); }
  .wp-lead-form { display: flex; gap: 8px; flex-wrap: wrap; }
  .wp-input { flex: 1; min-width: 140px; min-height: 44px; padding: 10px 12px; box-sizing: border-box; border: 1px solid var(--wt-line); border-radius: 8px; font: inherit; font-size: var(--fs-ui); color: var(--wt-ink); background: var(--wt-card); outline: none; }
  .wp-input:focus { border-color: var(--wt-accent-ink); box-shadow: 0 0 0 3px var(--wt-accent-tint); }
  .wp-lead-success { font-size: var(--fs-ui); color: var(--wt-ink); font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .wp-lead-error { font-size: var(--fs-caption); color: var(--error-text); margin-top: 6px; }
  .wp-modal-back { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; background: rgba(10,12,16,0.55); backdrop-filter: blur(6px); padding: 24px 16px; overflow-y: auto; }
  .wp-modal { width: 100%; max-width: 460px; margin: auto; background: var(--wt-card); border-radius: 10px; padding: 26px; box-shadow: 0 30px 80px rgba(0,0,0,0.3); display: flex; flex-direction: column; gap: 10px; }
  .wp-modal h2 { margin: 0; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: var(--fs-h2); color: var(--wt-ink); }
  .wp-modal p { margin: 0; font-size: var(--fs-small); color: var(--wt-ink-soft); line-height: 1.5; }
  .wp-modal textarea { resize: vertical; }
  .wp-promo { max-width: 640px; margin: 0 auto 40px; padding: 28px 32px; border-radius: 10px; background: var(--wt-card); border: 1px solid var(--wt-line); text-align: center; }
  .wp-promo-title { font-family: 'Instrument Serif', Georgia, serif; font-size: var(--fs-h2); color: var(--wt-ink); margin-bottom: 6px; }
  .wp-promo p { font-size: var(--fs-body); color: var(--wt-ink-soft); margin: 0 0 18px; }
  @keyframes wpSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes wpSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

  /* ── Phones and tablets: one column; the presenter straight after the video ── */
  @media (max-width: 960px) {
    .wp-grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "player" "side" "main"; row-gap: 28px; }
    .wp-col-side { position: static; }
    .wp-col-main { padding-top: 8px; }
    .wp-presenter { display: grid; grid-template-columns: 150px minmax(0, 1fr); }
    .wp-presenter-photo { aspect-ratio: auto; height: 100%; min-height: 180px; }
    .wp-presenter-logo, .wp-presenter-initials { height: 100%; min-height: 150px; padding: 16px; border-bottom: 0; border-right: 1px solid var(--wt-line); }
  }
  @media (max-width: 640px) {
    .wp-wrap { padding: 0 18px; }
    .wp-hero { padding: 20px 0 96px; }
    .wp-hero-text { margin-top: 40px; }
    .wp-hello { font-size: var(--fs-body); }
    .wp-body { margin-top: -72px; }
    .wp-for { display: none; }
    .wp-presenter { display: block; }
    .wp-presenter-photo { aspect-ratio: 16 / 11; height: auto; min-height: 0; }
    .wp-presenter-logo, .wp-presenter-initials { min-height: 0; height: auto; padding: 26px 18px; border-right: 0; border-bottom: 1px solid var(--wt-line); }
    .wp-presenter-initials { height: 120px; }
    .wp-note { padding-left: 40px; }
    .wp-note p { font-size: var(--fs-lead); }
    .wp-card { padding: 20px; }
    .wp-quote-actions .wp-btn { flex: 1 1 100%; }
  }
`

/** The full stop after a sentence ending in a name — none when the name already ends in one ("Avery & Co."). */
export const endStop = (name: string) => (/[.!?]$/.test(name.trim()) ? '' : '.')

/** Who the page is from, as the hero and the presenter panel show it. */
export type WatchIdentity = {
  /** person: lead with the photo; company: lead with the logo. */
  kind: 'person' | 'company' | null
  name: string
  secondary: string
  /** A person's photo or a company's logo. */
  image: string | null
  initials: string
}

/** The hero: who it is from, who it is for, what it is, the title. */
export function WatchHero({ who, forLine, kicker, title, hello }: { who: WatchIdentity | null; forLine?: string | null; kicker: string; title?: string | null; hello?: ReactNode }) {
  return (
    <header className="wp-hero" data-testid="watch-hero">
      <div className="wp-wrap">
        <div className="wp-topline">
          {who ? (
            <div className="wp-ident">
              {who.image && who.kind === 'company'
                // eslint-disable-next-line @next/next/no-img-element -- the brand's own logo
                ? <span className="wp-ident-logo"><img src={who.image} alt={who.name} /></span>
                : who.image
                  // eslint-disable-next-line @next/next/no-img-element -- the presenter's own photo
                  ? <img src={who.image} alt={who.name} className="wp-ident-photo" />
                  : who.initials ? <span className="wp-ident-initials" aria-hidden="true">{who.initials}</span> : null}
              {/* A company's logo already says its name; the name beside it would say it twice. */}
              {who.image && who.kind === 'company' ? (
                who.secondary ? <div className="wp-ident-sub">{who.secondary}</div> : null
              ) : (
                <div>
                  <div className="wp-ident-name">{who.name}</div>
                  {who.secondary ? <div className="wp-ident-sub">{who.secondary}</div> : null}
                </div>
              )}
            </div>
          ) : <span />}
          {forLine ? <span className="wp-for">{forLine}</span> : null}
        </div>
        <div className="wp-hero-text">
          <span className="wp-kicker">{kicker}</span>
          {title ? <h1 className="wp-title">{title}</h1> : null}
          {hello ? <p className="wp-hello">{hello}</p> : null}
        </div>
      </div>
    </header>
  )
}

/** The presenter: photo (or logo), name, the next step, and how to reach them. */
export function PresenterPanel({ who, next, contact }: { who: WatchIdentity; next: ReactNode; contact: { email?: string; phone?: string; website?: string; websiteLabel?: string } }) {
  const showImage = who.image
  return (
    <section className="wp-presenter" aria-label={`From ${who.name}`} data-testid="watch-presenter">
      {showImage && who.kind === 'company'
        // eslint-disable-next-line @next/next/no-img-element -- the brand's own logo
        ? <div className="wp-presenter-logo"><img src={showImage} alt={who.name} /></div>
        : showImage
          // eslint-disable-next-line @next/next/no-img-element -- the presenter's own photo
          ? <img src={showImage} alt={who.name} className="wp-presenter-photo" />
          : who.initials ? <div className="wp-presenter-initials" aria-hidden="true">{who.initials}</div> : null}
      <div className="wp-presenter-body">
        <div>
          <h2 className="wp-presenter-name">{who.name}</h2>
          {who.secondary ? <p className="wp-presenter-sub">{who.secondary}</p> : null}
        </div>
        {next}
        {contact.email || contact.phone || contact.website ? (
          <ul className="wp-contact">
            {contact.phone ? <li><a href={`tel:${contact.phone}`}><IconPhone />{contact.phone}</a></li> : null}
            {contact.email ? <li><a href={`mailto:${contact.email}`}><IconMail />{contact.email}</a></li> : null}
            {contact.website ? <li><a href={contact.website} target="_blank" rel="noopener noreferrer"><IconGlobe />{contact.websiteLabel || contact.website}</a></li> : null}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

/** "In this video": the chapters, each one a jump. */
export function ChapterList({ items, active, onPick }: { items: { time: string; title: string }[]; active: number; onPick?: (i: number) => void }) {
  return (
    <ol className="wp-chapters">
      {items.map((c, i) => (
        <li key={i} className={`wp-chapter${i === active ? ' is-on' : ''}`}>
          <button type="button" onClick={() => onPick?.(i)} aria-current={i === active ? 'step' : undefined}>
            <span className="wp-chapter-time">{c.time}</span>
            <span>{c.title}</span>
            <span className="wp-chapter-dot" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
  )
}
