import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData, VideoScene } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'
import { INDUSTRIES, detectIndustry, type IndustryId } from './industries'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function buildInsuranceScriptPrompt(data: ExtractedPolicyData, brandName: string | null, detailed: boolean = false, assetCount: number = 0): string {
  const cvSummary = (data.cashValueProjections ?? [])
    .map(p => `Year ${p.year}: Guaranteed ${formatCurrency(p.guaranteed)}, Illustrated ${formatCurrency(p.current)}`)
    .join('\n  ')

  const svSummary = (data.surrenderValueProjections ?? [])
    .map(p => `Year ${p.year}: Guaranteed ${formatCurrency(p.guaranteed)}, Current ${formatCurrency(p.current)}`)
    .join('\n  ')

  return `You are a professional scriptwriter creating a life insurance policy explainer video narration.

POLICY DATA:
- Policy Type: ${data.policyType}
- Insured: ${data.insuredName}, Age ${data.insuredAge ?? 'N/A'}
- Death Benefit: ${formatCurrency(data.deathBenefit)}
- Annual Premium: ${formatCurrency(data.annualPremium)}
- Payment Mode: ${data.paymentMode}
${data.loanRate ? `- Loan Rate: ${data.loanRate}%` : ''}
- Cash Value Projections:
  ${cvSummary}
${svSummary ? `- Surrender Value Projections:\n  ${svSummary}` : ''}
- Riders: ${(data.riders ?? []).join(', ') || 'None'}
- Additional Notes: ${(data.additionalNotes ?? []).join(', ') || 'None'}
${brandName ? `- Agent/Agency: ${brandName}` : ''}

CARRIER NAME RULE (CRITICAL — LEGAL REQUIREMENT):
- NEVER mention the insurance carrier name anywhere in the narration.
- Do NOT say "${data.carrier}" or any specific carrier/company name.
- Instead, use natural phrases like "this carrier", "your carrier", "the issuing carrier", or "this particular carrier".
- Example: Instead of "your policy from Prudential", say "your ${data.policyType} policy from this carrier".
- This must sound natural and conversational — not awkward or evasive.
- This is a legal requirement to avoid the appearance of carrier endorsement.

VOICE RULES (CRITICAL):
- The narrator must NEVER introduce themselves, say their name, or say who they are. They are just a voice.
- The narrator must NEVER say "I'm [name]" or "My name is" or "I'm your agent/advisor"
- If the client/viewer has a specific name in the data, the FIRST scene should start with: "Hello ${data.insuredName}, thank you for your time."
- If there is NO client name, the FIRST scene should start with: "Hello, and thank you for your time."
- After the greeting, go straight into the content. No introductions about who is presenting.
- The LAST scene should end with: "Thank you for your time. If you have any questions, please don't hesitate to reach out."

BEAT STRUCTURE (follow this storytelling framework — each scene has a PURPOSE):
Every scene must have a "beat" field indicating its storytelling role. Use this exact structure:

1. HOOK (1 scene) — Open with the greeting per VOICE RULES, then immediately state something compelling: a key benefit, a surprising number, or a thought-provoking question about the policy. Make the viewer want to keep watching.
   ${brandName ? `Mention that this presentation is brought by ${brandName}.` : ''}

2. DISCLAIMER (1 scene) — EXACT narration: "Before we begin, please note: this video is intended for educational and informational purposes only. It explains general concepts related to life insurance illustrations. It is not legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Any non-guaranteed values shown are subject to change. Please review all policy materials and consult with your licensed insurance professional before making any decisions."

3. CONTEXT (1-2 scenes) — Set the stage: who is this policy for, what type of policy, the big picture of what it provides. Client overview and policy summary.

4. STAKES (1-2 scenes) — Why this matters. What the death benefit means for the family. The real-world impact of this coverage. Make it emotional but factual.

5. EVIDENCE (3-8 scenes) — The deep dive. This is the bulk of the video. Walk through:
   - Premium breakdown (how much, how often, value received)
   - Cash value growth year by year (guaranteed vs illustrated)
   ${data.surrenderValueProjections.length > 0 ? '- Surrender values and what they mean' : ''}
   ${data.loanRate ? `- Policy loans and the ${data.loanRate}% loan rate` : ''}
   ${data.riders.length > 0 ? '- Each rider and what protection it provides' : ''}
   Break complex data across MULTIPLE scenes. One concept per scene. Use specific numbers.

6. IMPLICATION (1-2 scenes) — What this all means for the viewer. Connect the data back to their life. "By year 20, your cash value exceeds your total premiums paid — your policy is essentially paying for itself."

7. DISCLAIMER-CLOSE (1 scene) — Closing legal disclaimer. EXACT narration: "As a reminder, this video is for educational purposes only and does not constitute financial advice. Policy guarantees depend on the issuing carrier's claims-paying ability, and non-guaranteed values may change. Please review your official policy documents and consult with your licensed professional."

8. ACTION (1 scene) — Clear next step. What should the viewer do now? End with the closing per VOICE RULES.
   ${brandName ? `Direct them to contact ${brandName}.` : 'Direct them to contact their agent.'}

SCENE COUNT: Use 8-16 scenes total. The EVIDENCE section should expand based on how much data is in the document. Simple policies = fewer evidence scenes. Complex ones with many riders and projections = more.

Each scene's narration should be 20-40 seconds (roughly 50-100 words). Each scene must cover ONE clear concept.

TONE: Professional but warm, like a trusted financial advisor explaining to a client over coffee. Use plain language — no insurance jargon. Make the client feel informed and confident. Write like a storyteller, not a summarizer.${assetCount > 0 ? `

PRODUCT IMAGES AVAILABLE:
You have ${assetCount} product/brand images that will be placed on slides.
- For slides that showcase specific products or features, include the tag [ASSET:1], [ASSET:2], etc. in the slidePrompt to indicate which image should be featured on that slide.
- The title slide should feature [ASSET:1] (the primary product/logo).
- Distribute other assets across relevant slides.
- Not every slide needs a product image — data/chart slides can skip assets.` : ''}`
}

function buildGenericScriptPrompt(data: ExtractedData, brandName: string | null, detailed: boolean = false, assetCount: number = 0): string {
  const industry = (data as any).industry || detectIndustry(data.title, JSON.stringify(data))
  const config = INDUSTRIES[industry as IndustryId] || INDUSTRIES.general

  const metricsText = (data.keyMetrics ?? []).map(m => `- ${m.label}: ${m.value}`).join('\n')
  const sectionsText = (data.sections ?? []).map(s => `- ${s.title}: ${s.content}`).join('\n')
  const bulletText = (data.bulletPoints ?? []).map(b => `- ${b}`).join('\n')

  // Build disclaimer scenes if required by industry
  const disclaimerBeat = config.disclaimerRequired ? `
2. DISCLAIMER (1 scene) — EXACT narration: "${config.disclaimerText}"
` : ''

  const disclaimerCloseBeat = config.disclaimerRequired ? `
7. DISCLAIMER-CLOSE (1 scene) — Closing disclaimer. EXACT narration: "${config.closingDisclaimerText}"
` : ''

  return `You are a professional scriptwriter creating an explainer video narration about the following document/content.

CRITICAL RULE — DATA FIDELITY:
- ONLY use information that appears in the DOCUMENT DATA below.
- Do NOT invent, assume, or add any facts, numbers, names, or details not explicitly provided.
- Do NOT confuse this with insurance, financial products, or any other industry unless the data explicitly states it.
- If the data says it's about a business deal, proposal, training, marketing plan, etc. — treat it ONLY as that. Never add insurance terminology, policy details, or financial product language.
- Every claim in the narration must trace back to a specific data point below.

INDUSTRY: ${config.label}
TERMINOLOGY: Use these terms: ${config.terminology.use.join(', ')}. Avoid: ${config.terminology.avoid.join(', ')}
TONE: ${config.tone}

DOCUMENT DATA:
- Title: ${data.title}
${data.subtitle ? `- Subtitle: ${data.subtitle}` : ''}
${data.source ? `- Source: ${data.source}` : ''}
${brandName ? `- Presented by: ${brandName}` : ''}

Key Metrics:
${metricsText || '(none)'}

Sections:
${sectionsText || '(none)'}

Key Points:
${bulletText || '(none)'}

Additional Notes: ${(data as any).additionalNotes?.join(', ') || 'None'}

VOICE RULES (CRITICAL):
- The narrator must NEVER introduce themselves, say their name, or say who they are. They are just a voice.
- The narrator must NEVER say "I'm [name]" or "My name is" or "I'm your agent/advisor"
- The FIRST scene should start with: "Hello, and thank you for your time."
- After the greeting, go straight into the content. No introductions about who is presenting.
- The LAST scene should end with: "Thank you for your time. If you have any questions, please don't hesitate to reach out."

BEAT STRUCTURE (follow this storytelling framework — each scene has a PURPOSE):
Every scene must have a "beat" field indicating its storytelling role. Use this exact structure:

${config.beatStructure}
${disclaimerBeat}${disclaimerCloseBeat}
   ${brandName ? `For the HOOK: Mention that this presentation is brought by ${brandName}.` : ''}
   Introduce the topic: "${data.title}"
   For the ACTION beat: ${config.ctaText}
   ${brandName ? `Direct them to contact ${brandName}.` : 'Encourage the viewer to take the next step.'}

SCENE COUNT: Use 8-16 scenes total. The EVIDENCE section should expand based on how much content is in the document. Simple documents = fewer evidence scenes. Complex ones with many sections = more.

Each scene's narration should be 20-40 seconds (roughly 50-100 words). Each scene must cover ONE clear concept.
${assetCount > 0 ? `
PRODUCT IMAGES AVAILABLE:
You have ${assetCount} product/brand images that will be placed on slides.
- For slides that showcase specific products or features, include the tag [ASSET:1], [ASSET:2], etc. in the slidePrompt to indicate which image should be featured on that slide.
- The title slide should feature [ASSET:1] (the primary product/logo).
- Distribute other assets across relevant slides.
- Not every slide needs a product image — data/chart slides can skip assets.` : ''}`
}

export async function generateDemoScript(
  brandData: {
    companyName: string
    description: string
    services: string[]
    uniqueSellingPoints: string[]
    tagline: string | null
  },
  colors: { primary: string; secondary: string; accent: string; background: string; text: string }
): Promise<VideoScene[]> {
  const servicesText = (brandData.services ?? []).length > 0 ? brandData.services.join(', ') : 'various services'
  const uspsText = (brandData.uniqueSellingPoints ?? []).length > 0 ? brandData.uniqueSellingPoints.join(', ') : ''

  const prompt = `You are a professional scriptwriter creating a SHORT demo explainer video about a company.

COMPANY INFO:
- Name: ${brandData.companyName}
- Tagline: ${brandData.tagline ?? 'N/A'}
- Description: ${brandData.description}
- Services: ${servicesText}
${uspsText ? `- What makes them different: ${uspsText}` : ''}

VOICE RULES (CRITICAL):
- The narrator must NEVER introduce themselves.
- Start scene 1 with: "Welcome to ${brandData.companyName}."
- End the last scene with: "Visit ${brandData.companyName} to learn more."

INSTRUCTIONS:
- Create EXACTLY 3 scenes
- Each scene should be 15-20 seconds of narration (roughly 35-50 words)
- Total video should be approximately 45-60 seconds
- Scene 1: Company intro — who they are and what they do
- Scene 2: Key services or value proposition — what makes them stand out
- Scene 3: Call to action — why the viewer should engage

TONE: Professional but warm. Plain language. Make the company sound confident and approachable.

Return ONLY valid JSON array (no markdown, no code fences):
[
  {
    "scene": 1,
    "title": "scene title",
    "narration": "full narration text",
    "slidePrompt": "brief description of what this slide should show visually",
    "duration": estimated seconds
  }
]`

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
  })

  const text = response.text?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  try {
    const scenes = JSON.parse(cleaned) as VideoScene[]
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid script format')
    }
    return scenes.slice(0, 4) // Hard cap at 4 scenes for demo
  } catch {
    throw new Error(`Failed to parse demo script: ${text.slice(0, 200)}`)
  }
}

// Map voice IDs to natural descriptions for script tone matching
function getVoiceDescription(voiceId?: string): string | null {
  if (!voiceId) return null
  const map: Record<string, string> = {
    nova: 'warm female voice',
    shimmer: 'warm female voice',
    onyx: 'deep male voice',
    echo: 'deep male voice',
    alloy: 'neutral voice',
    fable: 'expressive British male voice',
  }
  return map[voiceId] ?? null
}

export async function generateScript(
  data: ExtractedPolicyData | ExtractedData,
  brandName: string | null,
  colors: { primary: string; secondary: string; accent: string; background: string; text: string },
  detailed: boolean = false,
  assetCount: number = 0,
  voiceId?: string,
  brandTone?: string,
  contactInfo?: { phone?: string; email?: string; calendly?: string },
  purpose?: string,
): Promise<VideoScene[]> {
  const isInsurance = isInsuranceData(data)
  const promptBody = isInsurance
    ? buildInsuranceScriptPrompt(data as ExtractedPolicyData, brandName, detailed, assetCount ?? 0)
    : buildGenericScriptPrompt(data as ExtractedData, brandName, detailed, assetCount ?? 0)

  // Build additional prompt sections based on new parameters
  const additionalSections: string[] = []

  if (purpose) {
    additionalSections.push(`VIDEO PURPOSE (CRITICAL): The user wants this video to "${purpose}". This is the primary objective — shape the entire narrative, tone, emphasis, and call-to-action around accomplishing this goal. Every scene should serve this purpose. Prioritize information that supports this goal and de-emphasize anything that doesn't.`)
  }

  const voiceDesc = getVoiceDescription(voiceId)
  if (voiceDesc) {
    additionalSections.push(`VOICE STYLE: The narration will be read by a ${voiceDesc}. Write the script to match this voice's natural speaking style.`)
  }

  if (brandTone) {
    additionalSections.push(`BRAND TONE: The brand's voice is ${brandTone}. Match this tone throughout the narration.`)
  }

  if (contactInfo && (contactInfo.phone || contactInfo.email || contactInfo.calendly)) {
    const parts: string[] = []
    if (contactInfo.phone) parts.push(contactInfo.phone)
    if (contactInfo.email) parts.push(contactInfo.email)
    const contactText = parts.length > 0 ? `Include the agent's contact details: ${parts.join(' ')}. ` : ''
    const calendlyText = contactInfo.calendly ? 'Say "You can schedule a call directly from this page."' : ''
    additionalSections.push(`CONTACT INFO FOR CTA: ${contactText}${calendlyText}`)
  }

  const additionalBlock = additionalSections.length > 0 ? '\n\n' + additionalSections.join('\n\n') : ''

  const prompt = `${promptBody}${additionalBlock}

Return ONLY valid JSON array (no markdown, no code fences):
[
  {
    "scene": 1,
    "beat": "hook",
    "title": "scene title",
    "narration": "full narration text the voice will read",
    "slidePrompt": "brief visual description — what should this slide LOOK like? Describe the visual concept, icons, or imagery. Do NOT include narration text here.",
    "duration": estimated seconds
  }
]

The "beat" field must be one of: "hook", "disclaimer", "disclaimer-close", "context", "stakes", "evidence", "implication", "action"
The "slidePrompt" should describe the VISUAL CONCEPT for the slide image — NOT repeat the narration. Example: "A family protected under a shield icon with a large dollar amount" NOT "The death benefit is $500,000."`

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
  })

  const text = response.text?.trim() ?? ''
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  try {
    const scenes = JSON.parse(cleaned) as VideoScene[]
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid script format')
    }
    return scenes
  } catch {
    throw new Error(`Failed to parse script: ${text.slice(0, 200)}`)
  }
}
