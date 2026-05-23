import type { ExtractedPolicyData } from '../types'
import type { ExtractedData } from '../extract-types'
import { INDUSTRIES, detectIndustry, type IndustryId } from '../industries'
import { wrapUserData } from '../prompt-safety'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function buildInsuranceScriptPrompt(data: ExtractedPolicyData, brandName: string | null, detailed: boolean = false, assetCount: number = 0): string {
  const cvSummary = (data.cashValueProjections ?? [])
    .map(p => `Year ${p.year}: Guaranteed ${formatCurrency(p.guaranteed)}, Illustrated ${formatCurrency(p.current)}`)
    .join('\n  ')

  const svSummary = (data.surrenderValueProjections ?? [])
    .map(p => `Year ${p.year}: Guaranteed ${formatCurrency(p.guaranteed)}, Current ${formatCurrency(p.current)}`)
    .join('\n  ')

  const policyDataBlock = `- Policy Type: ${data.policyType}
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
${brandName ? `- Agent/Agency: {{BRAND_NAME}}` : ''}`

  return `You are a professional scriptwriter creating a life insurance policy explainer video narration.

POLICY DATA:
${wrapUserData(policyDataBlock)}

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

3. CONTEXT — Set the stage: who is this policy for, what type of policy, the big picture. Use as many scenes as needed.

4. STAKES — Why this matters. What the death benefit means for the family. Real-world impact. Make it emotional but factual.

5. EVIDENCE — The deep dive. This is the bulk of the video. Walk through:
   - Premium breakdown (how much, how often, value received)
   - Cash value growth year by year (guaranteed vs illustrated)
   ${data.surrenderValueProjections.length > 0 ? '- Surrender values and what they mean' : ''}
   ${data.loanRate ? `- Policy loans and the ${data.loanRate}% loan rate` : ''}
   ${data.riders.length > 0 ? '- Each rider and what protection it provides' : ''}
   Use as many scenes as needed. One concept per scene. Use specific numbers. Be thorough.

6. IMPLICATION — What this all means for the viewer. Connect the data back to their life.

7. DISCLAIMER-CLOSE (1 scene) — Closing legal disclaimer. EXACT narration: "As a reminder, this video is for educational purposes only and does not constitute financial advice. Policy guarantees depend on the issuing carrier's claims-paying ability, and non-guaranteed values may change. Please review your official policy documents and consult with your licensed professional."

8. ACTION (1 scene) — Clear next step. What should the viewer do now? End with the closing per VOICE RULES.
   ${brandName ? `Direct them to contact {{BRAND_NAME}}.` : 'Direct them to contact their agent.'}

SCENE COUNT: Determined by the VIDEO LENGTH instruction below. Do NOT decide scene count here.

SCENE STRUCTURE: Each scene covers ONE topic or concept. Scenes can be any length needed. ONE topic per scene, ONE slide per scene.

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

export function buildGenericScriptPrompt(data: ExtractedData, brandName: string | null, detailed: boolean = false, assetCount: number = 0, uploadMode?: string, userIndustry?: string): string {
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

  const documentDataBlock = `- Title: ${data.title}
${data.subtitle ? `- Subtitle: ${data.subtitle}` : ''}
${data.source ? `- Source: ${data.source}` : ''}
${brandName ? `- Presented by: {{BRAND_NAME}}` : ''}

Key Metrics:
${metricsText || '(none)'}

Sections:
${sectionsText || '(none)'}

Key Points:
${bulletText || '(none)'}

Additional Notes: ${(data as any).additionalNotes?.join(', ') || 'None'}`

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
${wrapUserData(documentDataBlock)}

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

SCENE COUNT: Determined by the VIDEO LENGTH instruction below. Do NOT decide scene count here.

SCENE STRUCTURE: Each scene covers ONE topic or concept. Scenes can be any length needed. ONE topic per scene, ONE slide per scene.

NARRATION QUALITY (CRITICAL — this will be read aloud by a voice-over artist):
- Write for the EAR, not the eye. Read every sentence aloud in your head. If it sounds stilted, rewrite it.
- Short, punchy sentences. Vary rhythm. Use contractions: "you'll", "that's", "it's"
- BANNED PHRASES (never use these): "it's important to note", "as you can see", "let's take a look at", "the data shows", "the evidence suggests", "it's worth noting", "as we mentioned", "moving on to", "in conclusion", "it goes without saying", "at the end of the day", "in this video", "in today's presentation"
- Never start with "Now,", "So,", "Additionally,", "Furthermore,"
- Use active voice: "This saves you 40%" not "A savings of 40% can be achieved"

NUMBER & DATA PRONUNCIATION (the narrator reads these aloud):
- Phone numbers: say EACH DIGIT with natural grouping. "1-866-752-8002" becomes "one, eight six six, seven five two, eight zero zero two". NEVER read as a whole number.
- Money: "twenty five thousand dollars" not "$25,000". Round numbers can be short: "about fifty thousand"
- Percentages: "seven point five percent" not "7.5%"
- Decimals: "one point one" not "1.1"
- Dates: "January fifteenth, twenty twenty six" not "1/15/2026"
- Dashes and hyphens: NEVER write a literal dash. "state-of-the-art" becomes "state of the art". "24/7" becomes "twenty four seven"
- Symbols: NEVER include @, #, &, /, \, |. Write as words: "at" not "@", "and" not "&"
- URLs: say "visit their website" not "w w w dot example dot com". URLs look fine on slides but sound terrible spoken.
- Don't read every stat from a table — pick the 2-3 most impactful and explain WHY they matter

MEDIUM AWARENESS (this is a VIDEO, not a website):
- NEVER say "click here", "scroll down", "fill out the form below", "see below", "the link above", "submit your information" — these are web actions
- INSTEAD say "visit our website", "give us a call", "reach out to us", "get in touch"
- If source says "fill out the form" → say "visit our website to get started"
- If source says "click here to learn more" → say "learn more at our website"
- The viewer CANNOT interact with the video — don't ask them to do things they can't do while watching
- Don't say "as you can see on screen" — the viewer knows they're watching
- Don't describe what the slide shows — the narrator should ADD context and meaning, not read the slide

NARRATIVE INTELLIGENCE:
- Open with a HOOK, not a greeting. "What if your money could grow tax free?" beats "Hello, today we'll discuss..."
- Don't repeat the company name every sentence — say it once at the opening, once at the close. Use "they", "the team", "their" in between.
- Don't read bullet points — the slide shows them. The narrator explains WHY each point matters.
- Pick the 3-5 most important features, not all of them. Explain the BENEFIT, not just the feature.
- Translate jargon the first time: "Indexed Universal Life, or IUL" then just "your policy" after that
- Testimonials: paraphrase naturally. Don't quote word-for-word (sounds robotic when narrated).
- FAQ content: don't ask and answer questions. Just state the facts directly.
- "About Us" content: skip the corporate history. Focus on what the VIEWER gets.
- Each scene flows naturally into the next — no jarring topic jumps

CONTACT INFO RULES:
- Contact information (phone, email, website) must ONLY appear in the LAST scene narration. NEVER mention contact details in any earlier scene.
- If contact info exists: end with ONE clear call to action, not three. Pick the strongest: a phone call OR a website visit. Be confident: "Call us today at..." not "If you'd like, you could maybe consider..."
- If NO contact info exists in the data: end with "Thank you for watching" — nothing more. No invented contacts.
- Don't end with "Thank you for watching" if there IS real contact info — end with the CTA instead.

FILLER & REDUNDANCY:
- Never repeat the same point in different words across scenes
- Never use filler: "It's important to note that", "As a matter of fact", "The truth is", "Believe it or not"
- Never editorialize without data: don't say "that's impressive" or "that's remarkable" unless the data explicitly supports a comparison
- Never pad scenes with generic statements. Every sentence should contain a FACT or advance the story.

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
