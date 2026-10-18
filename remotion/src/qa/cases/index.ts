import type { QACase } from '../types'
import { cases as infographic } from './infographic'
import { cases as v3 } from './v3'
import { cases as editorial } from './editorial'
import { cases as directed } from './directed'
import { cases as commercial } from './commercial'
import { cases as aurora } from './aurora'
import { cases as visualdirector } from './visualdirector'
import { cases as kit } from './kit'
import { cases as selftest } from './selftest'

// One file per engine, so each can be worked on without touching the others.
export const ALL_CASES: QACase[] = [
  ...infographic, ...v3, ...editorial, ...directed, ...commercial, ...aurora, ...visualdirector, ...kit,
  // Broken on purpose; the runner requires the guard to catch every fault in it.
  ...selftest,
]
