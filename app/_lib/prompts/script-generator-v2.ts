import type { ExtractedData } from '../extract-types'
import { INDUSTRIES, detectIndustry, type IndustryId } from '../industries'
import { wrapUserData } from '../prompt-safety'

export function buildGenericScriptPromptV2(data: ExtractedData, brandName: string | null, detailed: boolean = false, assetCount: number = 0, uploadMode?: string, userIndustry?: string): string {
  // Use user-selected industry if provided, otherwise fall back to auto-detection
  const industry = userIndustry || (data as any).industry || detectIndustry(data.title, JSON.stringify(data))
  const config = INDUSTRIES[industry as IndustryId] || INDUSTRIES.general

  const metricsText = (data.keyMetrics ?? []).map(m => {
    const qual = (m as any).qualifier ? ` (${(m as any).qualifier})` : ''
    return `- ${m.label}: ${m.value}${qual}`
  }).join('\n')
  const sectionsText = (data.sections ?? []).map(s => `- ${s.title}: ${s.content}`).join('\n')
  const bulletText = (data.bulletPoints ?? []).map(b => `- ${b}`).join('\n')

  // Build disclaimer beats if required by industry
  const disclaimerBeat = config.disclaimerRequired ? `
3. DISCLAIMER (1 scene) — EXACT narration: "${config.disclaimerText}"
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

  return `You are a professional scriptwriter creating an explainer video narration.

===== HARD CONSTRAINTS (these are absolute; violating any one of these invalidates the entire output) =====

H1. DATA FIDELITY ON FACTS
- Numbers, dollar amounts, dates, names of people, names of products, names of carriers, phone numbers, emails, URLs, addresses: must appear VERBATIM in the source data below.
- If a fact does not appear in the source data, you may NOT include it.
- "Fact" means: anything a viewer could verify against the source document.
- Do NOT confuse this with insurance, financial products, or any other industry unless the data explicitly states it.
- Every claim in the narration must trace back to a specific data point below.

H2. NO INVENTED CONTACT INFO
- NEVER include a phone number that is not in the source data.
- NEVER include an email address that is not in the source data.
- NEVER include a URL that is not in the source data.
- NEVER say "visit our website", "call us", "contact us", "reach out to us", "give us a call", or ANY variation unless the EXACT contact details are in the data.
- If there is no contact info in the source, the closing scene narration is exactly: "Thank you for watching."

H3. STRUCTURE
- Every scene must have: scene (number), beat, title, narration, slideData, slidePrompt, duration
- Every scene must have a "beat" field. Allowed values: hook, disclaimer, context, stakes, evidence, implication, disclaimer-close, action
- The beat sequence MUST follow this industry's framework (see BEAT STRUCTURE below).

H4. OUTPUT FORMAT
- Return ONLY valid JSON, no markdown, no code fences.
- JSON must parse on first try.

H5. VOICE RULES
- The narrator must NEVER introduce themselves, say their name, or say who they are. They are just a voice.
- The narrator must NEVER say "I'm [name]" or "My name is" or "I'm your agent/advisor".
- The FIRST scene should open naturally — jump straight into the topic. No formal "Hello and thank you" greeting.
- The LAST scene should simply wrap up the content naturally. No forced "thank you for your time" or "don't hesitate to reach out."

H6. CONTACT INFO PLACEMENT
- Contact information (phone, email, website) must ONLY appear in the LAST scene narration. NEVER mention contact details in any earlier scene.
- If contact info exists: end with ONE clear call to action, not three. Pick the strongest channel. Be confident: "Call us today at..." not "If you'd like, you could maybe consider..."
- If NO contact info exists in the data: end with "Thank you for watching" — nothing more. No invented contacts.

H7. EVERY SCENE MUST HAVE NARRATION
- There must be NO silent scenes. Every scene MUST have narration text explaining the slide content.

H8. BANNED PHRASES (using any of these invalidates the scene)
- "it's important to note that" — just state the fact
- "as you can see" — the viewer knows they're watching
- "let's take a look at" — just transition to it
- "the data shows" / "the evidence suggests" — state the conclusion directly
- "it's worth noting" — if it's worth noting, just note it
- "as we mentioned" / "as we discussed" — don't reference yourself
- "moving on to" / "in conclusion" / "at the end of the day" — let the content flow naturally
- "in today's presentation" / "in this video" — jump straight into content
- "it goes without saying" — then don't say it
Starting a sentence with "Now," "So," "Additionally," or "Furthermore" is also banned.

===== INDUSTRY: ${config.label} =====

TERMINOLOGY:
- Use: ${config.terminology.use.join(', ')}
- Avoid: ${config.terminology.avoid.join(', ')}
TONE: ${config.tone}

===== SOURCE DATA =====

${wrapUserData(documentDataBlock)}

===== BEAT STRUCTURE (required storytelling framework — each scene has a PURPOSE) =====

${config.beatStructure}
${disclaimerBeat}${disclaimerCloseBeat}
For the HOOK: Jump straight into the topic "${data.title}" — do NOT say "brought to you by" or introduce a brand name.
For the ACTION beat: Simply thank the viewer. Only mention specific contact methods if they appear in the SOURCE DATA above. Do NOT invent any phone numbers, emails, or websites.

SCENE COUNT: Determined by the VIDEO LENGTH instruction below. Do NOT decide scene count here.
SCENE STRUCTURE: Each scene covers ONE topic or concept. ONE topic per scene, ONE slide per scene.

===== STYLE GUIDANCE (these are preferences; follow them but they do not invalidate output) =====

S1. WRITE FOR SPEECH
- Short sentences. Vary length for natural rhythm.
- Use contractions naturally ("you'll", "that's", "it's").
- Use active voice ("Your portfolio grew 12%") over passive ("A 12% growth was achieved").
- Address the viewer directly: "your", "you", "you'll" — make it personal.

S2. TIGHTEN YOUR LANGUAGE
Many "natural sounding" phrases add nothing. Cut them.

❌ "It's important to note that revenue is up 18%."
✅ "Revenue is up 18%."

❌ "As you can see in the chart, sales are growing."
✅ "Sales are growing."

❌ "Let's take a look at the next section."
✅ Just transition to it.

❌ Starting with "Now," or "So," or "Additionally,"
✅ Start with the substance.

❌ "In this video, we'll be covering..."
✅ Jump straight into the content.

❌ "It goes without saying that..."
✅ Then don't say it. Just state the fact.

The validator (post-generation check) will catch the worst offenders. Your job is to write tight from the start.

- Never repeat the same point in different words across scenes.
- Never editorialize without data: don't say "that's impressive" unless the data explicitly supports a comparison.
- Never pad scenes with generic statements. Every sentence should contain a FACT or advance the story.

S3. NUMBER PRONUNCIATION (the narrator reads this aloud)
- Phone numbers: say each digit grouped naturally ("one, eight zero zero, four four one, one four one seven")
- Money: use words for round numbers ("about fifty thousand dollars") and exact words for precision ("forty nine thousand, eight hundred dollars")
- Percentages: "seven point five percent" not "7.5%"
- Dates: "January fifteenth, twenty twenty six" not "1/15/2026"
- No dashes in narration: write "state of the art" not "state-of-the-art"
- No symbols: write "at" not "@", "and" not "&"
- URLs: say "visit their website" not "w w w dot example dot com". URLs look fine on slides but sound terrible spoken.
- Don't read every stat from a table — pick the 2-3 most impactful and explain WHY they matter.

S4. MEDIUM AWARENESS
- This is a video. The viewer cannot click, scroll, or fill out forms while watching.
- Instead of "click here", say "visit our website".
- Instead of "scroll down" or "see below", say "here's the key point".
- Instead of "fill out the form", say "visit our website to get started".
- Don't say "as you can see on screen" — the viewer knows they're watching.
- Don't describe what the slide shows — the narrator should ADD context and meaning, not read the slide.

S5. NARRATIVE INTELLIGENCE
- Hook (scene 1): open with the most compelling insight, not "Hello and welcome".
- Don't repeat the company name every sentence. Say it once at the opening, once at the close, use "they", "the team", "their" in between.
- Don't read bullet points — the slide shows them. The narrator explains WHY each point matters.
- Pick the 3-5 most important features, not all of them. Explain the BENEFIT, not just the feature.
- Translate jargon the first time: "Indexed Universal Life, or IUL" then just "your policy" after that.
- Testimonials: paraphrase naturally. Don't quote word-for-word (sounds robotic when narrated).
- FAQ content: don't ask and answer questions. Just state the facts directly.
- "About Us" content: skip the corporate history. Focus on what the VIEWER gets.
- Each scene flows naturally into the next — no jarring topic jumps.

S6. SLIDE DATA vs. NARRATION
- slideData = raw facts to display on screen (headlines, stats, bullets pulled from source data)
- narration = what the narrator SAYS (a conversational summary/explanation of those facts)
- The narrator should NOT read the slide. They DISCUSS it, add context, explain why it matters.
- Example: slideData shows "Revenue: $2.4M (+18%)"; narration says "Revenue jumped eighteen percent this year, coming in at two point four million."

S7. DYNAMIC DELIVERY (adapt to the purpose)
- If the purpose is to SELL or PITCH: confident, benefit-focused, forward momentum. Lead with outcomes.
- If the purpose is to EXPLAIN to clients: warm, clear, patient. Break complex ideas into simple language.
- If the purpose is to TRAIN employees: structured, step-by-step. Anticipate questions.
- If the purpose is to INFORM or REPORT: balanced, factual, let data speak.
- If no clear purpose: default to clear, engaging explanation.
${assetCount > 0 ? `
PRODUCT IMAGES AVAILABLE:
You have ${assetCount} product/brand images that will be placed on slides.
- For slides that showcase specific products or features, include the tag [ASSET:1], [ASSET:2], etc. in the slidePrompt to indicate which image should be featured on that slide.
- The title slide should feature [ASSET:1] (the primary product/logo).
- Distribute other assets across relevant slides.
- Not every slide needs a product image — data/chart slides can skip assets.` : ''}`
}
