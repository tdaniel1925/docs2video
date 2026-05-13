import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData, VideoScene } from './types'
import type { ExtractedData } from './extract-types'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function buildInsuranceScriptPrompt(data: ExtractedPolicyData, brandName: string | null, detailed: boolean = false): string {
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

INSTRUCTIONS:
- Analyze the document content carefully. Create as many scenes as needed to thoroughly cover ALL the material.
- Use your best judgment on scene count: simple documents may need 5-8 scenes, complex ones may need 12-20 scenes.
- Maximum 20 scenes. Each scene's narration should be 20-40 seconds (roughly 50-100 words).
- Break complex topics into multiple focused slides rather than cramming too much into one.
- Each scene should cover ONE clear concept or data point.
- The FIRST scene MUST be a title/cover scene that:
  - Opens with the greeting per VOICE RULES above
  - States what this presentation is about (without naming the carrier)
  - Sets a warm, professional tone
  ${brandName ? `- Mentions that this presentation is brought to them by ${brandName}` : ''}
- The SECOND scene MUST be a disclaimer slide with this EXACT narration: "Before we begin, please note: this video is intended for educational and informational purposes only. It explains general concepts related to life insurance illustrations. It is not legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Any non-guaranteed values shown are subject to change. Please review all policy materials and consult with your licensed insurance professional before making any decisions."
- The LAST scene MUST be a closing/contact scene that:
  - Summarizes the key takeaways
  - Ends with the closing per VOICE RULES above
  ${brandName ? `- Directs them to contact ${brandName}` : '- Directs them to contact their agent'}
- Between the disclaimer and closing, create enough scenes to thoroughly cover:
  - Client overview and policy summary
  - Death benefit explanation (what it means for the family)
  - Premium breakdown (how much, how often, value received)
  - Cash value growth (walk through projections year by year, explain guaranteed vs illustrated — use MULTIPLE slides if there are many projection years)
  ${data.surrenderValueProjections.length > 0 ? '- Surrender values and what they mean (separate slide for each key milestone)' : ''}
  ${data.loanRate ? `- Policy loans and the ${data.loanRate}% loan rate` : ''}
  ${data.riders.length > 0 ? '- Each rider and what protection it provides (one slide per rider if multiple)' : ''}
  - Any additional important features

TONE: Professional but warm, like a trusted financial advisor explaining to a client over coffee. Use plain language — no insurance jargon. Make the client feel informed and confident.`
}

function buildGenericScriptPrompt(data: ExtractedData, brandName: string | null, detailed: boolean = false): string {
  const metricsText = (data.keyMetrics ?? []).map(m => `- ${m.label}: ${m.value}`).join('\n')
  const sectionsText = (data.sections ?? []).map(s => `- ${s.title}: ${s.content}`).join('\n')
  const bulletText = (data.bulletPoints ?? []).map(b => `- ${b}`).join('\n')

  return `You are a professional scriptwriter creating an explainer video narration about the following document/content.

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

INSTRUCTIONS:
- Analyze the document content carefully. Create as many scenes as needed to thoroughly cover ALL the material.
- Use your best judgment on scene count: simple documents may need 5-8 scenes, complex ones may need 12-20 scenes.
- Maximum 20 scenes. Each scene's narration should be 20-40 seconds (roughly 50-100 words).
- Break complex topics into multiple focused slides rather than cramming too much into one.
- Each scene should cover ONE clear concept or data point.
- The FIRST scene MUST be a title/cover scene that:
  - Opens with the greeting per VOICE RULES above
  - Introduces the topic ("${data.title}")
  - Sets the context for the viewer
  - Sets a warm, professional tone
  ${brandName ? `- Mentions that this presentation is brought to them by ${brandName}` : ''}
- The LAST scene MUST be a closing/contact scene that:
  - Summarizes the key takeaways
  - Provides a clear call-to-action
  ${brandName ? `- Directs them to contact ${brandName}` : '- Encourages the viewer to take the next step'}
  - Ends with the closing per VOICE RULES above
- Between the first and last scene, create enough scenes to cover:
  - Overview of the key metrics and data
  - Each major section or topic area (give each section its own slide)
  - Key takeaways and findings
  - Any important data tables or charts (break into multiple slides if needed)
  - Any important caveats or additional context

TONE: Professional but warm, like a knowledgeable presenter explaining to an engaged audience. Use plain language. Make the viewer feel informed and confident.`
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

export async function generateScript(
  data: ExtractedPolicyData | ExtractedData,
  brandName: string | null,
  colors: { primary: string; secondary: string; accent: string; background: string; text: string },
  detailed: boolean = false
): Promise<VideoScene[]> {
  const isInsurance = 'deathBenefit' in data
  const promptBody = isInsurance
    ? buildInsuranceScriptPrompt(data as ExtractedPolicyData, brandName, detailed)
    : buildGenericScriptPrompt(data as ExtractedData, brandName, detailed)

  const prompt = `${promptBody}

Return ONLY valid JSON array (no markdown, no code fences):
[
  {
    "scene": 1,
    "title": "scene title",
    "narration": "full narration text the voice will read",
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
    return scenes
  } catch {
    throw new Error(`Failed to parse script: ${text.slice(0, 200)}`)
  }
}
