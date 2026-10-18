import { registerRoot } from 'remotion'
import { QARoot } from './QARoot'

// Entry point for the overflow QA only (scripts/overflow-qa.mjs). Never
// deployed: the render service bundles src/index.ts.
registerRoot(QARoot)
