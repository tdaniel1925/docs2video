import OpenAI from 'openai'
import type { ExtractedPolicyData, VideoScene } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'
import { INDUSTRIES, detectIndustry, type IndustryId } from './industries'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

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
${brandName ? `- Agent/Agency: {{BRAND_NAME}}` : ''}

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

1. HOOK (1 scene) — Open with the greeting per VOICE RULES, then immediately state something compelling: a key benefit, a surprising number, or a thought-provoking question about the policy. Make the viewer want to keep watching. Do NOT say "brought to you by" — just dive into the content.

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
   ${brandName ? `Direct them to contact {{BRAND_NAME}}.` : 'Direct them to contact their agent.'}

SCENE COUNT: Use 8-16 scenes total. The EVIDENCE section should expand based on how much data is in the document. Simple policies = fewer evidence scenes. Complex ones with many riders and projections = more.

Each scene's narration should be 10-20 seconds (roughly 25-50 words). Each scene must cover ONE specific fact or data point — not a broad topic. More scenes with tight focus beats fewer scenes with long narration. A 3-minute video should have 15-20 scenes.

TONE: Professional but warm, like a trusted financial advisor explaining to a client over coffee. Use plain language — no insurance jargon. Make the client feel informed and confident.

NARRATION QUALITY (CRITICAL — this will be read aloud by a voice actor):
- Write for the EAR, not the eye. Read every sentence aloud in your head — if it sounds stilted, rewrite it.
- Use short, punchy sentences. Break up long ones. Vary sentence length for natural rhythm.
- Use contractions naturally: "you'll" not "you will", "that's" not "that is", "it's" not "it is"
- Avoid filler phrases: remove "it's important to note that", "as you can see", "let's take a look at", "as we mentioned"
- Never start a sentence with "Now," or "So," or "Additionally," — these sound robotic when spoken
- Use active voice: "Your policy grows to $50,000" not "The cash value is projected to grow to $50,000"
- Address the viewer directly: "your", "you", "you'll" — make it personal
- Numbers should sound natural when spoken: "about fifty thousand dollars" not "$49,847.23"
- Each scene should flow naturally into the next — no jarring transitions
- Write like a storyteller, not a summarizer. Every scene should have a point, not just list facts.${assetCount > 0 ? `

PRODUCT IMAGES AVAILABLE:
You have ${assetCount} product/brand images that will be placed on slides.
- For slides that showcase specific products or features, include the tag [ASSET:1], [ASSET:2], etc. in the slidePrompt to indicate which image should be featured on that slide.
- The title slide should feature [ASSET:1] (the primary product/logo).
- Distribute other assets across relevant slides.
- Not every slide needs a product image — data/chart slides can skip assets.` : ''}`
}

function buildGenericScriptPrompt(data: ExtractedData, brandName: string | null, detailed: boolean = false, assetCount: number = 0, uploadMode?: string, userIndustry?: string): string {
  // Use user-selected industry if provided, otherwise fall back to auto-detection
  const industry = userIndustry || (data as any).industry || detectIndustry(data.title, JSON.stringify(data))
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
${brandName ? `- Presented by: {{BRAND_NAME}}` : ''}

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
- The FIRST scene should open naturally — jump straight into the topic. No formal "Hello and thank you" greeting.
- The LAST scene should simply wrap up the content naturally. No forced "thank you for your time" or "don't hesitate to reach out."

DATA INTEGRITY (ABSOLUTE RULE — VIOLATION = FAILURE):
- ONLY state facts, numbers, names, and claims that appear VERBATIM in the DOCUMENT DATA above
- ZERO TOLERANCE for invented information. If you add ANY fact not in the data, the entire script is invalid.
- NEVER include ANY phone number unless it appears EXACTLY in the document data above. No +44, no 1-800, no (555) numbers. NONE.
- NEVER include ANY website URL unless it appears EXACTLY in the document data above. No .com, .co.uk, .org guesses. NONE.
- NEVER include ANY email address unless it appears EXACTLY in the document data above
- NEVER say "visit our website", "call us", "contact us", "reach out to us", "give us a call", or ANY variation unless the EXACT contact details are in the data
- If there is no contact info in the data, the closing scene should simply say "Thank you for watching" — NOTHING MORE
- NEVER guess at product names, pricing, locations, team sizes, years in business, or any other detail
- Before including any number, name, or claim — verify it exists word-for-word in the DOCUMENT DATA section above

BEAT STRUCTURE (follow this storytelling framework — each scene has a PURPOSE):
Every scene must have a "beat" field indicating its storytelling role. Use this exact structure:

${config.beatStructure}
${disclaimerBeat}${disclaimerCloseBeat}
   For the HOOK: Jump straight into the topic "${data.title}" — do NOT say "brought to you by" or introduce a brand name.
   For the ACTION beat: Simply thank the viewer. Only mention specific contact methods if they appear in the DOCUMENT DATA above. Do NOT invent any phone numbers, emails, or websites.

${uploadMode === 'narrate' || uploadMode === 'redesign'
  ? `SCENE COUNT: Create EXACTLY ${Math.max(data.sections?.length || 1, 5)} scenes — one scene for EVERY section and topic in the document. Do NOT summarize, combine, or skip any content. Every piece of information must be covered.`
  : `SCENE COUNT: Use ${Math.max(4, Math.min(16, (data.sections?.length || 3) + 3))} scenes. Match the number of scenes to the amount of content — short documents get fewer scenes (4-6), detailed documents get more (8-16). Do NOT pad with filler content.`}

Each scene's narration should be 10-20 seconds (roughly 25-50 words). Each scene must cover ONE specific fact or data point — not a broad topic. More scenes with tight focus beats fewer scenes with long narration. A 3-minute video should have 15-20 scenes.

NARRATION QUALITY (CRITICAL — this will be read aloud):
- Write for the EAR, not the eye. If it sounds stilted when read aloud, rewrite it.
- Short, punchy sentences. Vary rhythm. Use contractions: "you'll", "that's", "it's"
- BANNED PHRASES (never use these): "it's important to note", "as you can see", "let's take a look at", "the data shows", "the evidence suggests", "it's worth noting", "as we mentioned", "moving on to", "in conclusion"
- Never start with "Now,", "So,", "Additionally,", "Furthermore,"
- Use active voice: "This saves you 40%" not "A savings of 40% can be achieved"
- Numbers spoken naturally: "about two hundred thousand" not "$198,447"
- Vary how you reference the company: use the company name, "they", "the team", "the platform", "their" — never the same reference twice in a row
- Never assume or editorialize — don't say "that's impressive" or "that's a lot" unless the data explicitly supports a comparison
- Each scene flows naturally into the next

DYNAMIC DELIVERY (adapt to the purpose):
- If the purpose is to SELL or PITCH: confident, benefit-focused, forward momentum. Lead with outcomes. "This means you get..." / "The result is..."
- If the purpose is to EXPLAIN to clients: warm, clear, patient. Break complex ideas into simple language. "Here's how this works..." / "What this means for you..."
- If the purpose is to TRAIN employees: structured, step-by-step. Anticipate questions. "The first step is..." / "The key thing to remember here..."
- If the purpose is to INFORM or REPORT: balanced, factual, let data speak. "Revenue came in at..." / "The platform processes..."
- If no clear purpose: default to clear, engaging explanation

SLIDE DATA vs NARRATION (CRITICAL — these are DIFFERENT):
- The "slideData" field contains RAW FACTS to display on screen: headlines, stats, bullet points pulled directly from the document data
- The "narration" field contains what the speaker SAYS — a conversational summary/explanation of that data
- The narrator should NOT read the slide. They DISCUSS it, add context, explain why it matters
- Example: slideData shows "Revenue: $2.4M (+18%)" → narrator says "Revenue jumped eighteen percent this year, coming in at two point four million."
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

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })

  const text = response.choices[0]?.message?.content?.trim() ?? ''
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
  uploadMode?: string,
  industry?: string,
  detailLevel?: 'quick' | 'standard' | 'detailed',
  narrationStyle?: 'solo' | 'podcast',
): Promise<VideoScene[]> {
  const isInsurance = isInsuranceData(data)
  const promptBody = isInsurance
    ? buildInsuranceScriptPrompt(data as ExtractedPolicyData, brandName, detailed, assetCount ?? 0)
    : buildGenericScriptPrompt(data as ExtractedData, brandName, detailed, assetCount ?? 0, uploadMode, industry)

  // Build additional prompt sections based on new parameters
  const additionalSections: string[] = []

  // Detail level OVERRIDES the base scene count
  if (detailLevel === 'quick') {
    additionalSections.push(`VIDEO LENGTH (OVERRIDE): HIGHLIGHTS MODE — Create exactly 3-4 scenes total. IGNORE any other scene count instructions. Keep it under 60 seconds. Only the most important 2-3 data points.`)
  } else if (detailLevel === 'detailed') {
    additionalSections.push(`VIDEO LENGTH (OVERRIDE): DETAILED MODE — Create 15-25 scenes. IGNORE any other scene count instructions. Cover EVERY data point, metric, and section. Each scene covers ONE specific fact. Target 5-10 minutes.`)
  } else {
    additionalSections.push(`VIDEO LENGTH (OVERRIDE): STANDARD MODE — Create 8-14 scenes. IGNORE any other scene count instructions. Cover all major points.`)
  }

  // Every scene MUST have narration
  additionalSections.push(`CRITICAL: Every scene MUST have narration text. There must be NO silent scenes. If a scene has a slide, it MUST have narration explaining that slide. The number of audio clips must EXACTLY match the number of scenes.`)

  if (purpose) {
    additionalSections.push(`VIDEO PURPOSE (CRITICAL): The user wants this video to "${purpose}". This is the primary objective — shape the entire narrative, tone, emphasis, and call-to-action around accomplishing this goal. Every scene should serve this purpose. Prioritize information that supports this goal and de-emphasize anything that doesn't.`)
  }

  if (narrationStyle !== 'podcast') {
    const voiceDesc = getVoiceDescription(voiceId)
    if (voiceDesc) {
      additionalSections.push(`VOICE STYLE: The narration will be read by a ${voiceDesc}. Write the script to match this voice's natural speaking style.`)
    }
  }

  if (brandTone) {
    additionalSections.push(`BRAND TONE (OVERRIDES INDUSTRY DEFAULT): The brand's actual voice is "${brandTone}". This takes priority over the industry tone above. Match this specific tone throughout the narration — the brand knows its audience better than a generic industry setting.`)
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

  // Podcast mode: generate dialogue with speaker tags
  if (narrationStyle === 'podcast') {
    // Determine conversation style based on content type
    const detectedIndustry = industry || detectIndustry((data as any).title || '', JSON.stringify(data))
    const seriousIndustries = ['insurance', 'finance', 'legal', 'healthcare', 'medical']
    const isSerious = seriousIndustries.includes(detectedIndustry)

    const speakerConfig = isSerious
      ? {
          speaker1: { name: 'Alex', voice: 'ash', instructions: 'Speak as a clear, professional narrator. Warm but authoritative. Steady pace, confident delivery.' },
          speaker2: { name: 'Jordan', voice: 'shimmer', instructions: 'Speak as a thoughtful co-narrator. Professional, clear, and engaged. Ask purposeful questions that advance the topic.' },
        }
      : {
          speaker1: { name: 'Alex', voice: 'coral', instructions: 'Speak as an engaging, professional narrator. Warm and clear. Present information with energy but not forced enthusiasm.' },
          speaker2: { name: 'Jordan', voice: 'ash', instructions: 'Speak as a knowledgeable co-narrator. Professional and direct. Ask smart questions and add context.' },
        }

    const podcastPrompt = `${promptBody}${additionalBlock}

NARRATION FORMAT: TWO NARRATORS IN ONE FLOWING CONVERSATION
This is ONE continuous conversation between two people, broken into scenes.

CRITICAL: Write the ENTIRE conversation first as a natural flowing dialogue, THEN divide it into scenes. Each scene should feel like a continuation of the previous one — not a fresh start.

SPEAKERS:
- "${speakerConfig.speaker1.name}" — ${speakerConfig.speaker1.instructions}
- "${speakerConfig.speaker2.name}" — ${speakerConfig.speaker2.instructions}

CONVERSATION FLOW RULES (MOST IMPORTANT):
- The conversation must flow like ONE talk, not separate segments
- Use transition phrases between scenes: "and speaking of...", "that actually connects to...", "building on that...", "the other thing I wanted to mention..."
- ${speakerConfig.speaker2.name} should reference what ${speakerConfig.speaker1.name} said earlier: "you mentioned earlier that...", "going back to what you said about..."
- Vary who leads — sometimes ${speakerConfig.speaker2.name} introduces a new topic
- Include natural connective tissue: "right", "exactly", "mm-hmm", "that makes sense"
- The opening should set context for the whole conversation: "${speakerConfig.speaker1.name}, let's talk about..."
- The closing should feel like a natural wrap-up, not a forced ending

TONE:
- Professional but warm — like two smart colleagues briefing each other
- Natural contractions ("that's", "it's", "they've")
- Short sentences, clear delivery, good pacing
- No robotic phrases: "the data shows", "it's worth noting", "as we can see"
- No forced casual: "check this out", "that's wild", "no way"

SCENE PACING:
- Each scene = 10-15 seconds (2-3 exchanges)
- Scenes are cuts in one continuous conversation, not separate topics
- A 3-minute video = 15-20 scenes. 5-minute = 25-30 scenes.

DATA INTEGRITY (ABSOLUTE RULE — VIOLATION = FAILURE):
- ONLY discuss facts that appear VERBATIM in the DOCUMENT DATA above
- ZERO TOLERANCE for invented info. If you add ANY fact not in the data, the entire script is invalid.
- NEVER include ANY phone number, website URL, or email unless it appears EXACTLY in the document data. No guessing. NONE.
- NEVER say "call us", "visit our website", "reach out" or any variation unless EXACT contact details are in the data
- If there is no contact info in the data, just say "Thank you for watching" — NOTHING MORE
- Before including any number, name, or claim — verify it exists word-for-word in the DOCUMENT DATA

DIALOGUE RULES:
- 2-3 exchanges per scene, alternating speakers
- Keep each line 1-2 sentences — short, punchy, conversational
- The "narration" field = ALL dialogue as plain text WITHOUT speaker names
- The "dialogue" array = individual lines with speaker/voice/instructions tags

Return ONLY valid JSON array (no markdown, no code fences):
[
  {
    "scene": 1,
    "beat": "hook",
    "title": "scene title",
    "slideData": {
      "headline": "title for the slide",
      "stats": [{ "label": "Metric Name", "value": "$1.2M" }],
      "bullets": ["Key fact from the document", "Another specific data point"]
    },
    "narration": "combined text of all dialogue WITHOUT speaker names",
    "dialogue": [
      { "speaker": "${speakerConfig.speaker1.name}", "voice": "${speakerConfig.speaker1.voice}", "instructions": "${speakerConfig.speaker1.instructions}", "text": "what this speaker says" },
      { "speaker": "${speakerConfig.speaker2.name}", "voice": "${speakerConfig.speaker2.voice}", "instructions": "${speakerConfig.speaker2.instructions}", "text": "what this speaker says" }
    ],
    "slidePrompt": "brief visual concept for slide background/style",
    "duration": estimated seconds
  }
]

FIELD RULES:
- "slideData": RAW FACTS for the slide — pulled directly from document data. Stats with values, bullet points with specific facts.
- "narration": what the speakers say — a conversational discussion of the slideData. NOT a repeat of it.
- "dialogue": individual lines with speaker tags. The speakers DISCUSS the data, they don't read it.
- "slidePrompt": visual concept only (e.g. "growth chart on dark background") — NOT content text
- "beat": one of "hook", "disclaimer", "disclaimer-close", "context", "stakes", "evidence", "implication", "action"`

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: podcastPrompt }],
      temperature: 0.7,
    })

    const text = response.choices[0]?.message?.content?.trim() ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    try {
      const scenes = JSON.parse(cleaned) as VideoScene[]
      if (!Array.isArray(scenes) || scenes.length === 0) {
        throw new Error('Invalid script format')
      }
      return scenes
    } catch {
      throw new Error(`Failed to parse podcast script: ${text.slice(0, 200)}`)
    }
  }

  // Solo narrator mode (default)
  const prompt = `${promptBody}${additionalBlock}

Return ONLY valid JSON array (no markdown, no code fences):
[
  {
    "scene": 1,
    "beat": "hook",
    "title": "scene title",
    "slideData": {
      "headline": "title for the slide",
      "stats": [{ "label": "Metric Name", "value": "$1.2M" }],
      "bullets": ["Key fact from the document", "Another specific data point"]
    },
    "narration": "what the narrator SAYS — a conversational explanation of the slideData, NOT a repeat of it",
    "slidePrompt": "brief visual concept for the slide background/style",
    "duration": estimated seconds
  }
]

FIELD RULES:
- "slideData.headline": short title for the slide (2-5 words)
- "slideData.stats": key metrics WITH their values from the document data — use for numbers, percentages, dollar amounts. Omit if no stats for this scene.
- "slideData.bullets": 2-4 specific facts from the document to display as text. Omit for cover/closing slides.
- "narration": what the speaker says — conversational, explains the data, does NOT just read the bullets
- "slidePrompt": visual concept only (e.g. "dark background with growth chart icon") — NOT content text
- "beat": one of "hook", "disclaimer", "disclaimer-close", "context", "stakes", "evidence", "implication", "action"`

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })

  const text = response.choices[0]?.message?.content?.trim() ?? ''
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
