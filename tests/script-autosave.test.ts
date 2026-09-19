import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * THE SCRIPT EDITOR SAVES WHAT IT SAYS IT SAVED.
 *
 * Found in the full-codebase review. autoSave wrapped the write in
 * `if (!isWizard)` and called setSavedScene OUTSIDE that block. The wizard is
 * the PAID flow. So nothing was written, and the green tick appeared anyway,
 * after every single edit.
 *
 * A customer could rewrite the narration on twelve scenes, watch a tick
 * confirm each one, refresh, and lose all of it. The interface was not merely
 * failing — it was actively telling them their work was safe while discarding
 * it, which is worse than no feedback at all.
 *
 * The beforeunload net had the same guard, so the paid flow had no net either:
 * an edit inside the 800ms debounce died with the tab.
 *
 * These read the source, because the real thing being asserted is a
 * RELATIONSHIP between two statements — that the tick cannot be reached
 * without a write. A unit test of autoSave in isolation would have passed
 * against the bug.
 */
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
/** Source minus comments — these notes name the very bug they forbid. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const page = code(read('app/(dashboard)/create/script/page.tsx'))
const beacon = code(read('app/api/videos/draft/beacon/route.ts'))
const types = read('app/_lib/types.ts')

/** autoSave, from its declaration to the end of the callback. */
const autoSave = page.slice(page.indexOf('const autoSave = useCallback'), page.indexOf('const autoSave = useCallback') + 1800)

describe('the paid flow actually saves', () => {
  it('writes to the draft in wizard mode', () => {
    /* The reported bug: this branch did not exist. The wizard keeps scenes in
       the draft row, and the mechanism was already there — the generator
       PATCHes scenes the same way. Editing never used it. */
    expect(autoSave, 'the wizard branch is gone again')
      .toMatch(/if \(isWizard\)/)
    expect(autoSave).toMatch(/method: 'PATCH'/)
    expect(autoSave).toMatch(/updates: \{ scenes: updatedScenes \}/)
  })

  it('never shows the tick without a write', () => {
    /*
     * THE HEART OF IT. setSavedScene must be unreachable unless a save
     * happened. Both failure paths return before it, so its position in the
     * function is what proves this.
     */
    const tick = autoSave.indexOf('setSavedScene(sceneIdx)')
    expect(tick, 'setSavedScene vanished').toBeGreaterThan(-1)
    expect(autoSave.indexOf("method: 'PATCH'"), 'the tick fires before the save')
      .toBeLessThan(tick)
    expect(autoSave.indexOf('localStorage.setItem'), 'the tick fires before the local save')
      .toBeLessThan(tick)
  })

  it('waits for the save before claiming it', () => {
    /* A tick shown before the round trip is the same lie one step smaller. */
    expect(autoSave).toMatch(/const doSave = async \(\)/)
    expect(autoSave).toMatch(/await fetch\('\/api\/videos\/draft'/)
  })

  it('stops at a failure instead of ticking anyway', () => {
    /* Two returns — one per branch — so a failed save can never fall through
       to setSavedScene. */
    const returns = autoSave.match(/^\s+return$/gm) ?? []
    expect(returns.length, 'a failure path no longer returns early')
      .toBeGreaterThanOrEqual(2)
    expect(autoSave).toMatch(/if \(!res\.ok\) throw new Error/)
  })

  it('says so out loud when saving is broken', () => {
    /* The opposite failure has to be louder than a tick is quiet: the work is
       still on screen and can still be copied out. */
    expect(autoSave).toMatch(/setSaveError\(/)
    expect(page, 'the warning is never rendered').toMatch(/\{saveError && \(/)
    expect(page, 'the warning is not announced to a screen reader').toMatch(/role="alert"/)
  })

  it('shows the warning beside the scenes, not at the foot of the page', () => {
    /*
     * It has to sit with the thing at risk.
     *
     * Anchored on the RENDERED list, not on `scenes.map(` — that string also
     * appears inside addBookends at the top of the file, and matching it
     * there made this test fail against correct code. Caught by running it.
     */
    const rendered = page.indexOf('{scenes.map((scene: any, i: number)')
    expect(rendered, 'the scene list markup moved').toBeGreaterThan(-1)
    expect(page.indexOf('{saveError && ('), 'the warning moved below the editor')
      .toBeLessThan(rendered)
  })
})

describe('closing the tab does not lose the last edit', () => {
  const unload = page.slice(page.indexOf('const handleUnload'), page.indexOf('const handleUnload') + 900)

  it('covers the wizard too', () => {
    /* This was `if (scenes.length > 0 && !isWizard)`, so the paid flow had no
       net at all — an edit inside the 800ms debounce died with the tab. */
    expect(unload, 'the wizard is excluded from the safety net again')
      .not.toMatch(/&& !isWizard/)
    expect(unload).toMatch(/if \(isWizard\)/)
  })

  it('uses a beacon, because a fetch dies with the page', () => {
    /* A browser tearing the page down kills in-flight fetches. A beacon is
       queued by the browser and sent regardless — that is the whole reason
       the API exists. */
    expect(unload).toMatch(/navigator\.sendBeacon/)
  })
})

describe('the beacon endpoint is safe to leave unattended', () => {
  /*
   * Nobody sees this run and nothing can read its response, so it has to be
   * stricter than the route it sits beside — not looser.
   */
  it('checks ownership, because the service-role client ignores row security', () => {
    expect(beacon).toMatch(/video\.user_id !== user\.id/)
    expect(beacon).toMatch(/if \(!user\)/)
  })

  it('accepts only the one field the unload handler sends', () => {
    /* PATCH merges whatever it is handed, which is right for a deliberate
       save from a live page and wrong for an unattended one. */
    expect(beacon).toMatch(/if \(!Array\.isArray\(scenes\)/)
    expect(beacon).toMatch(/draft_data: \{ \.\.\.existing, scenes \}/)
  })

  it('never creates a row, only updates one', () => {
    expect(beacon, 'the beacon can now create drafts').not.toMatch(/\.insert\(/)
    expect(beacon).toMatch(/\.update\(/)
  })

  it('cannot throw', () => {
    /* An unhandled rejection here would be completely invisible. */
    expect(beacon).toMatch(/try \{/)
    expect(beacon).toMatch(/catch \(err\)/)
  })
})

describe('the field the editor depends on is in the type', () => {
  it('declares scenes on the draft', () => {
    /*
     * The loader read draft.scenes and the type did not have it — an
     * undocumented extra riding along in draft_data, which is part of how
     * the editor came to skip writing it without anything complaining.
     */
    const draft = types.slice(types.indexOf('export interface WizardDraft'))
    expect(draft.slice(0, 3000)).toMatch(/scenes\?: VideoScene\[\]/)
  })
})
