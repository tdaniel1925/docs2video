import OpenAI from 'openai'
import type { ExtractedPolicyData, VideoScene } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'
import { detectIndustry, classifyIndustryLLM } from './industries'
import { getPrompt } from './prompts'
import { fitSourceData } from './source-data-fitter'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
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

  // PASS 1: Deep analysis — understand the business before writing the script
  const intentMap: Record<string, string> = {
    sales: 'This is a SALES VIDEO. The viewer is a potential buyer. Lead with the PROBLEM they have, not your product. Show the cost of NOT acting. Present benefits (not features), then pricing AFTER value is established. End with one specific CTA — not "contact us" but "book a 15-minute call" or "start your free trial." Use social proof before asking for the sale.',
    educate: 'This is an EDUCATIONAL VIDEO. The viewer wants to UNDERSTAND something. Start with why this matters to THEM. Explain concepts using analogies they already know. Every fact should answer "so what?" — why does this matter? End with what they can DO with this knowledge.',
    train: 'This is a TRAINING VIDEO. The viewer needs to LEARN a process. Start with WHY this matters to their job. Show each step with context (not just "do this" but "do this BECAUSE..."). Anticipate where they will get confused. End with what they should do Monday morning.',
    report: 'This is a DATA REPORT VIDEO. The viewer is a decision-maker. Don\'t read every number — pick the 3-5 that drive decisions. For each metric, explain: what it means, is it good or bad, and what should we do about it. Lead with the headline ("revenue is up 18%"), then support it.',
    proposal: 'This is a PROPOSAL VIDEO. The viewer is deciding whether to hire/buy from you. Lead with their problem (show you understand it). Present your approach as the obvious solution. Prove it with past results. Address "why you and not someone else?" End with specific next steps and timeline.',
  }
  const intentGuidance = intentMap[(data as any)?.intentType || ''] || purpose ? `VIDEO PURPOSE: ${purpose}` : 'Create an informative overview of this content.'

  let deepAnalysis = ''
  try {
    const analysisResponse = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: (() => {
          const { fitted, wasTruncated, droppedSections } = fitSourceData(data, 30000)
          if (wasTruncated) {
            console.warn(`[script-gen] Source data truncated for strategic analysis. Dropped: ${droppedSections.join(', ')}`)
          }
          return getPrompt('strategic_analysis', process.env.PROMPT_VERSION_OVERRIDE || undefined)(
            intentGuidance,
            JSON.stringify(fitted),
            {
              phone: contactInfo?.phone,
              email: contactInfo?.email,
              calendly: contactInfo?.calendly,
              website: (contactInfo as any)?.website,
            },
          )
        })(),
      }],
      temperature: 0.3,
    })
    deepAnalysis = analysisResponse.choices[0]?.message?.content?.trim() ?? ''
    console.log(`[script-gen] Deep analysis: ${deepAnalysis.length} chars`)
  } catch (err) {
    console.error('[script-gen] Deep analysis failed, proceeding without:', err instanceof Error ? err.message : 'unknown')
  }

  // Use PROMPT_VERSION_OVERRIDE env var to opt-in to newer prompt versions
  const promptVersion = process.env.PROMPT_VERSION_OVERRIDE || undefined
  const genericPromptBuilder = getPrompt('script_generation_generic', promptVersion)

  const insurancePromptBuilder = getPrompt('script_generation_insurance', promptVersion)

  const promptBody = isInsurance
    ? insurancePromptBuilder(data as ExtractedPolicyData, brandName, detailed, assetCount ?? 0)
    : genericPromptBuilder(data as ExtractedData, brandName, detailed, assetCount ?? 0, uploadMode, industry)

  // Build additional prompt sections based on new parameters
  const additionalSections: string[] = []

  // Inject deep analysis as the primary content guide
  if (deepAnalysis) {
    additionalSections.push(`STRATEGIC BRIEF (USE THIS AS YOUR PRIMARY GUIDE — cover ALL these points in the script):\n${deepAnalysis}`)
  }

  // Detail level OVERRIDES the base scene count
  if (detailLevel === 'quick') {
    additionalSections.push(`VIDEO LENGTH: HIGHLIGHTS — 3-4 scenes, under 60 seconds. Only the top 2-3 key points. Keep narration brief.`)
  } else if (detailLevel === 'detailed') {
    additionalSections.push(`VIDEO LENGTH: DETAILED — This must be a LONG, THOROUGH video. Requirements:
- Cover EVERY data point, metric, section, and detail in the source
- Each scene should have 100-200 words of narration — explain thoroughly, give context, provide examples
- Do NOT summarize — EXPAND on each point. Explain what it means, why it matters, how it works
- If a section has multiple sub-points, give each sub-point its own scene
- Add context scenes: explain background, industry context, why the viewer should care
- Use as many scenes as the content requires. A 1-page document might need 4 scenes. A 50-page document might need 12. Let the source data dictate scene count, not a fixed minimum.
- This should feel like a comprehensive training walkthrough, not a summary`)
  } else {
    additionalSections.push(`VIDEO LENGTH: STANDARD — Cover all major points with reasonable depth. 6-12 scenes. Each scene should fully explain its topic.`)
  }

  // Every scene MUST have narration
  additionalSections.push(`CRITICAL: Every scene MUST have narration text. There must be NO silent scenes. If a scene has a slide, it MUST have narration explaining that slide. The number of audio clips must EXACTLY match the number of scenes.`)

  // Slide-audio sync: narration must match its own slide
  additionalSections.push(`SLIDE-AUDIO SYNC RULES (CRITICAL FOR VIDEO QUALITY):
- Each scene's narration must ONLY describe content that appears on THAT scene's slide. Never preview, tease, or introduce the next slide's topic.
- Do NOT say things like "next we'll look at..." or "coming up..." or "let's move on to..." — the slide transition handles that automatically.
- The narration should START by addressing what the viewer is ALREADY seeing on screen, not what they're about to see.
- If a scene covers "Key Metrics", every word of that scene's narration must be about those metrics — not about the previous or next topic.
- BAD: "Now let's take a look at your key metrics" (viewer hasn't seen the metrics slide yet when this plays)
- GOOD: "Here are the key metrics that matter most" (viewer is already looking at the metrics slide)
- Each scene must be self-contained: introduce its topic, explain it, and wrap it up WITHOUT referencing other scenes.`)

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

  if (contactInfo && (contactInfo.phone || contactInfo.email || contactInfo.calendly || (contactInfo as any)?.website)) {
    const parts: string[] = []
    if (contactInfo.phone) parts.push(`Phone: ${contactInfo.phone}`)
    if (contactInfo.email) parts.push(`Email: ${contactInfo.email}`)
    if ((contactInfo as any)?.website) parts.push(`Website: ${(contactInfo as any).website}`)
    if (contactInfo.calendly) parts.push('Booking link available on the share page')
    additionalSections.push(`CONTACT INFO (MUST be included in the closing scene narration AND on the closing slide):
${parts.join('\n')}
The narrator should mention these naturally in the last scene. Display them on the closing slide.
For phone numbers in narration: spell out naturally ("five five five, one two three, four five six seven")
For websites in narration: just say "visit their website" — the URL will be on the slide.`)
  }

  const additionalBlock = additionalSections.length > 0 ? '\n\n' + additionalSections.join('\n\n') : ''

  // Podcast mode: generate dialogue with speaker tags
  if (narrationStyle === 'podcast') {
    // Determine conversation style based on content type
    const detectedIndustry = industry || await classifyIndustryLLM((data as any).title || '', JSON.stringify(data))
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
- Each scene covers one topic in the conversation
- Scenes are cuts in one continuous conversation, not separate topics
- Scene count and length determined by the VIDEO LENGTH instruction below

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
    "narration": "what the narrator SAYS — a conversational explanation of the slideData, NOT a repeat of it. Must ONLY discuss THIS slide's content — never preview or introduce the next slide.",
    "slidePrompt": "brief visual concept for the slide background/style",
    "duration": estimated seconds
  }
]

FIELD RULES:
- "slideData.headline": short title for the slide (2-5 words). This headline ANCHORS the narration — every word in this scene's narration must relate to this headline.
- "slideData.stats": key metrics WITH their values from the document data — use for numbers, percentages, dollar amounts. Omit if no stats for this scene.
- "slideData.bullets": 2-4 specific facts from the document to display as text. Omit for cover/closing slides.
- "narration": what the speaker says — conversational, explains the data, does NOT just read the bullets. Must be SELF-CONTAINED: introduce the topic, explain it, and wrap up WITHOUT referencing other scenes.
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

    // Post-parse: strip forward-looking phrases that break slide-audio sync
    const forwardPhrases = /\b(next,?\s+we('ll|\s+will)\s+(look|see|explore|cover|discuss|examine)|coming up|let's\s+(move|turn|shift)\s+(on\s+)?to|in\s+the\s+next\s+(slide|scene|section)|up\s+next|moving\s+on\s+to|now\s+let's\s+(take\s+a\s+)?look\s+at)\b/gi
    for (const scene of scenes) {
      if (scene.narration) {
        scene.narration = scene.narration.replace(forwardPhrases, '').replace(/\s{2,}/g, ' ').trim()
      }
    }

    return scenes
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Failed to parse script: ${text.slice(0, 200)}`)
    }
    throw e
  }
}
