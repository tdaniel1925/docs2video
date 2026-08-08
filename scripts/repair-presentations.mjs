// Repair EXISTING interactive presentations and slide decks in production.
//
//   node scripts/repair-presentations.mjs           (dry run — reports only)
//   node scripts/repair-presentations.mjs --apply   (writes)
//
// Two things the generator fix cannot reach, because finished decks are baked
// HTML in storage and finished rows are already written:
//
//   1. videos.script is empty for every presentation (the generator only filled
//      draft_data.scenes), so the dashboard shows "SLIDES (0)". Backfill script
//      from draft_data.scenes.
//
//   2. The published HTML carries the old CSS: flex-centered slides that
//      overflow through their padding (bullets under the nav pill, titles under
//      the corner block) and a disclaimer that runs beneath the nav. Patch the
//      stored files with the same three replacements the generator now emits.
//      String-exact: a file that doesn't contain the old CSS verbatim is left
//      untouched and reported, never half-patched.
//
// Dry run by default because this touches customer deliverables in production.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const APPLY = process.argv.includes('--apply');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const OLD_SEC = '.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(58px,10vh,92px) 6vw 104px;';
const NEW_SEC = '.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:clamp(88px,12vh,110px) 6vw 128px;';
const OLD_WRAP = '.wrap{position:relative;width:100%;max-width:1020px;margin:0 auto;text-align:center}';
const NEW_WRAP = '.wrap{position:relative;width:100%;max-width:1020px;margin:auto;text-align:center}';
const OLD_DISC = '.disc{position:fixed;left:34px;right:34px;bottom:6px;z-index:35;font-family:var(--font);font-size:10.5px;line-height:1.45;color:color-mix(in srgb,var(--soft) 72%,transparent);text-align:left;pointer-events:none;max-width:62ch}';
const NEW_DISC = '.disc{position:fixed;left:34px;bottom:6px;z-index:35;font-family:var(--font);font-size:10.5px;line-height:1.45;color:color-mix(in srgb,var(--soft) 78%,transparent);text-align:left;pointer-events:none;max-width:min(62ch,calc(50vw - 190px))}';

const { data: rows, error } = await db
  .from('videos')
  .select('id, title, output_type, status, script, draft_data, video_url')
  .in('output_type', ['interactive', 'deck'])
  .eq('status', 'completed');
if (error) { console.error(error.message); process.exit(1); }

console.log(`${rows.length} completed presentation(s)/deck(s)${APPLY ? '' : '   [DRY RUN — pass --apply to write]'}\n`);

let fixedScript = 0, patchedHtml = 0, skipped = 0;
for (const v of rows) {
  const scenes = Array.isArray(v.draft_data?.scenes) ? v.draft_data.scenes : [];
  const needsScript = scenes.length > 0 && !(Array.isArray(v.script) && v.script.length > 0);
  const notes = [];

  if (needsScript) {
    notes.push(`script <- ${scenes.length} scenes`);
    if (APPLY) {
      const r = await db.from('videos').update({ script: scenes }).eq('id', v.id);
      if (r.error) notes.push('WRITE FAILED: ' + r.error.message);
      else fixedScript++;
    }
  }

  // Patch the stored HTML. The path is by convention presentations/{id}.html —
  // derive it from the row id, not by parsing the public URL.
  const path = `presentations/${v.id}.html`;
  const dl = await db.storage.from('videos').download(path);
  if (dl.error) {
    notes.push('no stored html (' + dl.error.message + ')');
  } else {
    let html = await dl.data.text();
    const hasOld = html.includes(OLD_SEC);
    if (hasOld) {
      html = html.split(OLD_SEC).join(NEW_SEC).split(OLD_WRAP).join(NEW_WRAP).split(OLD_DISC).join(NEW_DISC);
      notes.push('html: CSS patched');
      if (APPLY) {
        const up = await db.storage.from('videos').upload(path, Buffer.from(html), {
          contentType: 'text/html; charset=utf-8', upsert: true,
        });
        if (up.error) notes.push('UPLOAD FAILED: ' + up.error.message);
        else patchedHtml++;
      }
    } else if (html.includes(NEW_SEC)) {
      notes.push('html: already patched');
    } else {
      // Different vintage of the generator — do not guess at it.
      notes.push('html: CSS not recognised, left untouched');
      skipped++;
    }
  }

  console.log(`  ${String(v.output_type).padEnd(11)} ${String(v.title || v.id).slice(0, 40).padEnd(42)} ${notes.join(' | ') || 'ok'}`);
}

console.log(`\n${APPLY ? 'APPLIED' : 'WOULD APPLY'}: ${APPLY ? fixedScript : 'script backfill where noted'}${APPLY ? ' script backfills, ' + patchedHtml + ' html patches' : ''}${skipped ? `, ${skipped} unrecognised (untouched)` : ''}`);
