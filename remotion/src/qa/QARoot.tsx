import { Composition } from 'remotion'
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { ALL_CASES } from './cases'
import { OverflowGuard } from './OverflowGuard'
import type { QACase } from './types'

// The same global fonts the production root (src/Root.tsx) loads, so text is
// measured in the fonts customers actually get.
loadArchivo()
loadInter()

/** The production component plus the guard; `__qaFrames` is for the runner, not the engine. */
function guarded(C: QACase['component']): React.FC<any> {
  const Guarded: React.FC<any> = ({ __qaFrames: _frames, ...props }) => (
    <>
      <C {...props} />
      <OverflowGuard />
    </>
  )
  return Guarded
}

export const QARoot: React.FC = () => (
  <>
    {ALL_CASES.map((c) => (
      <Composition
        key={c.id}
        id={`QA-${c.id}`}
        component={guarded(c.component)}
        defaultProps={{ ...c.props, __qaFrames: c.frames }}
        durationInFrames={c.durationInFrames}
        fps={c.fps ?? 30}
        width={c.width ?? 1920}
        height={c.height ?? 1080}
      />
    ))}
  </>
)
