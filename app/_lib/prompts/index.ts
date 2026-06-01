import { buildGenericScriptPromptV2 } from './script-generator-v2'
import { buildInsuranceScriptPromptV2 } from './script-generator-insurance-v2'
import { buildStrategicAnalysisPromptV2 } from './strategic-analysis-v2'
import { buildBrandAnalysisPrompt } from './brand-analysis-v1'
import { THEME_PROMPT, EXTRACTION_PROMPT, CONTENT_STRUCTURING_SYSTEM_PROMPT } from './extraction-v1'
import { buildScriptChatSystemPrompt } from './script-chat-v1'

// Prompt registry — V2 is the only version for script gen and strategic analysis.
// V1 was retired on 2026-06-01 after confirming V2 is a superset.
export const PROMPT_REGISTRY = {
  script_generation_insurance: buildInsuranceScriptPromptV2,
  script_generation_generic: buildGenericScriptPromptV2,
  strategic_analysis: buildStrategicAnalysisPromptV2,
  brand_analysis: buildBrandAnalysisPrompt,
  extraction_url: EXTRACTION_PROMPT,
  extraction_theme: THEME_PROMPT,
  extraction_content: CONTENT_STRUCTURING_SYSTEM_PROMPT,
  script_chat: buildScriptChatSystemPrompt,
} as const

export type PromptCategory = keyof typeof PROMPT_REGISTRY

// getPrompt — version parameter kept for API compatibility but ignored (only V2 exists)
export function getPrompt<K extends keyof typeof PROMPT_REGISTRY>(
  category: K,
  _version?: string
) {
  const builder = PROMPT_REGISTRY[category]
  if (!builder) throw new Error(`Unknown prompt: ${String(category)}`)
  return builder
}

// Default prompt versions — exported for backward compat (script-generator.ts references it)
export const DEFAULT_PROMPT_VERSIONS = {
  script_generation_insurance: 'v2',
  script_generation_generic: 'v2',
  strategic_analysis: 'v2',
  brand_analysis: 'v1',
  extraction_url: 'v1',
  extraction_theme: 'v1',
  extraction_content: 'v1',
  script_chat: 'v1',
} as const

// Re-exports
export { buildGenericScriptPromptV2 } from './script-generator-v2'
export { buildInsuranceScriptPromptV2 } from './script-generator-insurance-v2'
export { buildStrategicAnalysisPromptV2 } from './strategic-analysis-v2'
export { buildBrandAnalysisPrompt } from './brand-analysis-v1'
export { THEME_PROMPT, EXTRACTION_PROMPT, CONTENT_STRUCTURING_SYSTEM_PROMPT } from './extraction-v1'
export { buildScriptChatSystemPrompt } from './script-chat-v1'
