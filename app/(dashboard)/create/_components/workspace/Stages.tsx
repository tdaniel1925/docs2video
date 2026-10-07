/**
 * HONEST WAITING — a list of the real stages, ticked off as each one really
 * finishes. It replaces percentages that a timer used to make up (step 1's
 * reading bar climbed on its own whether anything happened or not).
 *
 * `detail` is shown under the stage that's running, exactly as the server
 * wrote it ("Drawing scene 3 of 6").
 */
export type Stage = { key: string; label: string }

export default function Stages({ stages, current, detail, label }: { stages: Stage[]; current: number; detail?: string | null; label: string }) {
  return (
    <ol className="ws-stages" aria-label={label}>
      {stages.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'todo'
        return (
          <li key={s.key} className={`ws-stage is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="ws-stage-mark" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
            <span>
              {s.label}
              {state === 'now' && detail ? <span className="ws-stage-detail">{detail}</span> : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
