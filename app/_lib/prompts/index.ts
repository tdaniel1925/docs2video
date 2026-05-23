import { buildInsuranceScriptPrompt, buildGenericScriptPrompt } from './script-generator-v1'
import { buildGenericScriptPromptV2 } from './script-generator-v2'
import { buildInsuranceScriptPromptV2 } from './script-generator-insurance-v2'
import { buildStrategicAnalysisPrompt } from './strategic-analysis-v1'
import { buildBrandAnalysisPrompt } from './brand-analysis-v1'
import { THEME_PROMPT, EXTRACTION_PROMPT, CONTENT_STRUCTURING_SYSTEM_PROMPT } from './extraction-v1'
import { buildScriptChatSystemPrompt } from './script-chat-v1'

export const PROMPT_REGISTRY = {
  script_generation_insurance: { v1: buildInsuranceScriptPrompt, v2: buildInsuranceScriptPromptV2 },
  script_generation_generic: { v1: buildGenericScriptPrompt, v2: buildGenericScriptPromptV2 },
  strategic_analysis: { v1: buildStrategicAnalysisPrompt },
  brand_analysis: { v1: buildBrandAnalysisPrompt },
  extraction_url: { v1: EXTRACTION_PROMPT },
  extraction_theme: { v1: THEME_PROMPT },
  extraction_content: { v1: CONTENT_STRUCTURING_SYSTEM_PROMPT },
  script_chat: { v1: buildScriptChatSystemPrompt },
} as const

export const DEFAULT_PROMPT_VERSIONS = {
  script_generation_insurance: 'v1',
  script_generation_generic: 'v1',
  strategic_analysis: 'v1',
  brand_analysis: 'v1',
  extraction_url: 'v1',
  extraction_theme: 'v1',
  extraction_content: 'v1',
  script_chat: 'v1',
} as const

export type PromptCategory = keyof typeof DEFAULT_PROMPT_VERSIONS
export type PromptVersions = typeof DEFAULT_PROMPT_VERSIONS

export function getPrompt<K extends keyof typeof PROMPT_REGISTRY>(
  category: K,
  version?: string
) {
  const v = version ?? (DEFAULT_PROMPT_VERSIONS as any)[category] ?? 'v1'
  const builder = (PROMPT_REGISTRY[category] as any)[v]
  if (!builder) throw new Error(`Unknown prompt: ${String(category)} v${v}`)
  return builder
}

// Re-export for convenience
export { buildInsuranceScriptPrompt, buildGenericScriptPrompt } from './script-generator-v1'
export { buildGenericScriptPromptV2 } from './script-generator-v2'
export { buildInsuranceScriptPromptV2 } from './script-generator-insurance-v2'
export { buildStrategicAnalysisPrompt } from './strategic-analysis-v1'
export { buildBrandAnalysisPrompt } from './brand-analysis-v1'
export { THEME_PROMPT, EXTRACTION_PROMPT, CONTENT_STRUCTURING_SYSTEM_PROMPT } from './extraction-v1'
export { buildScriptChatSystemPrompt } from './script-chat-v1'
