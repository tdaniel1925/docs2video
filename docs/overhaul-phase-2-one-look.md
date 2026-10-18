# Overhaul Phase 2 — One look

Plan for phase 2 of the Docs2Video overhaul (report: https://claude.ai/code/artifact/8a9fe3c5-63c4-4430-a14c-3f7593a730d6).
Owner decision 2026-10-06: the app, the share page and the marketing site all use the
redesign's colours — warm cream, mint and navy. Today they use four different sets.

## Step 1 — the colour names

Change what the existing names point at, so every screen that already uses a name moves at
once. Add role names for the two jobs `--mint` does today (it is cyan, used 201 times for
both fills and text — mint is too pale for text on cream, so the roles must split).

| Name | Today | New | Job |
|---|---|---|---|
| `--bg` | #F0F4F8 | #F4F1EC | page |
| `--bg-soft` | #F7F9FB | #FBF9F5 | soft panels |
| `--bg-card` | #FFFFFF | #FFFFFF | cards |
| `--surface` | #EDF1F5 | #F1EDE6 | wells, inputs |
| `--surface-raised` | #E4EAF0 | #E9E3D8 | hover, pressed |
| `--ink` | #002B63 | #0B2545 | headings, main button |
| `--ink-soft` | #2A4A77 | #4B5563 | body text |
| `--ink-light` | #6B84A3 | #5B6270 | quiet text (≥ 4.5:1 on cream) |
| `--border` | #D4DCE4 | #D6CFC2 | lines |
| `--border-light` | #E8EDF2 | #E6E0D5 | quiet lines |
| `--accent` (new) | — | #C7E8A8 | fills, progress, selected |
| `--accent-ink` (new) | — | #2F6B3A | accent words on light |
| `--accent-soft` (new) | — | #EEF7E4 | tints (also defines the missing `--mint-soft` / `--mint-light`) |
| `--link` (new) | — | #1F5FA8 | links, focus ring |
| `--gold` / `--gold-soft` (new) | — | #9A6200 / #FFF6E0 | money only: credit chip, prices (One Dollar Decks' rule) |
| `--success` / `-bg` | #2A9AAD / #E3F5F8 | #2F6B3A / #EEF7E4 | done |
| `--warning`, `--error` | keep | keep | |

Then every `var(--mint)` is re-pointed by its job: a fill → `--accent`, words → `--accent-ink`.
The main button becomes navy with white words (the marketing site's), not navy with cyan.

## Step 2 — typed colours

676 colours are typed by hand in the dashboard and share page. The most common map straight
onto names: #E2E8F0 (50) → `--border-light`, #1B3A5C / #3BB5C8 (share page navy/teal, 22 + 16)
→ `--ink` / `--accent-ink`, the reds (#B91C1C, #DC2626, #C03A1F, #FEF2F2, #FECACA) → `--error*`,
#94A3B8 → `--ink-light`. Replace by script, screen by screen, and check each screen by eye.

## Step 3 — one kit

One CSS file of parts, used everywhere instead of inline styles: Button (with a price slot),
Card, Choices, Note (info / ok / warn / stop), Make bar, Making screen, Versions, Tabs.
Base text 15px, corners ≤ 10px, light by default (dark later, same names).

## Step 4 — frame and home

Top bar: New, Library, Clients, Brands + credit chip (gold) + avatar. Home: start cards
(document, website, idea, commercial), then today's clients, then projects. A "How to use"
button on every screen.

## Done when

- One colour set: no `--mk-*` / share-page / app split; `--mint` gone.
- Typed colours in the dashboard and share page under 50 (from 676), inline styles falling.
- The Playwright battery and `npm run qa:overflow:gate` pass; contrast ≥ 4.5:1 for all text.
