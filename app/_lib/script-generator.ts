import OpenAI from 'openai'
import type { ExtractedPolicyData, VideoScene } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'
import { detectIndustry, classifyIndustryLLM, INDUSTRIES, type IndustryId } from './industries'
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

  const prompt = `You are a professional scriptwriter creating a SHORT personalized sales demo video. The video is FROM Docs2Video (an AI platform that turns documents into professional explainer videos) TO a prospect company. The goal is to show the prospect what Docs2Video can do specifically for THEIR business.

PROSPECT COMPANY INFO:
- Company Name: ${brandData.companyName}
- What they do: ${brandData.description}
- Their services: ${servicesText}
${uspsText ? `- What makes them different: ${uspsText}` : ''}

VOICE RULES (CRITICAL):
- The narrator must NEVER introduce themselves.
- This video is styled in the PROSPECT's brand colors — show them what their content COULD look like.
- Speak directly to the prospect: "you", "your clients", "your team"
- Reference their specific business by name and what they do.

INSTRUCTIONS:
- Create EXACTLY 4 scenes
- Each scene should be 15-20 seconds of narration (roughly 35-50 words)
- Total video should be approximately 60-80 seconds

- Scene 1 — THE HOOK: Start with their pain point. "${brandData.companyName}, imagine if every proposal, report, or document you sent to clients came with a video like this one — automatically." Reference what they actually do.

- Scene 2 — THE DEMO: "This video was created in under 2 minutes from your website alone. No filming, no editing, no design skills. Docs2Video's AI read your website, extracted your brand, and built this presentation automatically." Mention their specific services to make it feel personalized.

- Scene 3 — THE VALUE: Show what they could use it for specifically. If they're insurance — "Turn policy illustrations into client-ready explainers." If consulting — "Transform audit reports into executive briefings." If real estate — "Convert listings into property showcase videos." Be specific to their industry. Mention: branded share pages, AI narration, client tracking, and payment collection.

- Scene 4 — THE CTA: "Start free with 2 short videos. See how ${brandData.companyName} can close faster, communicate clearer, and stand out from the competition. Visit docs2video.com to try it now."

TONE: Confident, direct, slightly urgent. This is a sales video — make them feel like they're missing out by NOT using this. Use their company name at least 3 times across all scenes.

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

function generateFramePrompts(scene: VideoScene, stylePrompt: string, sceneIndex: number, totalScenes: number): string[] {
  const isFirst = sceneIndex === 0
  const isLast = sceneIndex === totalScenes - 1

  // Visual metaphor library
  const metaphors: Record<string, string[]> = {
    protection: ['shield materializing', 'umbrella opening in rain', 'fortress walls rising', 'safety net catching'],
    growth: ['seed growing into tree', 'sunrise over mountains', 'staircase being built upward', 'garden blooming'],
    value: ['treasure chest opening', 'gold coins stacking', 'diamond being polished', 'vault door opening'],
    time: ['hourglass flowing', 'seasons changing', 'clock hands moving', 'calendar pages flipping'],
    security: ['lock clicking shut', 'family inside warm home', 'bridge connecting two cliffs', 'anchor holding steady'],
    cost: ['balanced scale', 'piggy bank filling', 'investment seeds being planted', 'foundation being laid'],
    features: ['toolkit opening', 'Swiss army knife unfolding', 'puzzle pieces connecting', 'building blocks stacking'],
    summary: ['aerial view of completed puzzle', 'sunrise over completed city', 'family walking toward horizon', 'open door with warm light'],
  }

  // Detect metaphor from scene content
  const narrationLower = scene.narration.toLowerCase()
  let metaphorKey = 'summary'
  if (narrationLower.includes('death benefit') || narrationLower.includes('protection') || narrationLower.includes('coverage')) metaphorKey = 'protection'
  else if (narrationLower.includes('growth') || narrationLower.includes('grows') || narrationLower.includes('cash value') || narrationLower.includes('increase')) metaphorKey = 'growth'
  else if (narrationLower.includes('premium') || narrationLower.includes('cost') || narrationLower.includes('payment') || narrationLower.includes('price')) metaphorKey = 'cost'
  else if (narrationLower.includes('feature') || narrationLower.includes('rider') || narrationLower.includes('benefit') || narrationLower.includes('include')) metaphorKey = 'features'
  else if (narrationLower.includes('welcome') || narrationLower.includes('today') || narrationLower.includes('introduction') || isFirst) metaphorKey = 'security'
  else if (narrationLower.includes('contact') || narrationLower.includes('thank') || narrationLower.includes('next step') || isLast) metaphorKey = 'summary'

  const metaphorOptions = metaphors[metaphorKey]
  const chosenMetaphor = metaphorOptions[sceneIndex % metaphorOptions.length]

  const baseStyle = `${stylePrompt} 1920x1080 landscape format. Fill entire canvas edge to edge. ABSOLUTELY NO TEXT of any kind — no words, no numbers, no percentages, no labels, no titles, no logos, no brand names, no UI elements. Pure illustrated artwork only.`

  // Frame 1: Setup — establish the scene/metaphor
  const frame1 = `${baseStyle} Scene setup: ${chosenMetaphor} — the beginning. ${isFirst ? 'Opening scene.' : ''} Show the visual metaphor starting — the environment is being established. Mood is anticipatory. Pure illustration, no text.`

  // Frame 2: Reveal — the metaphor reaches its key moment
  const frame2 = `${baseStyle} Scene reveal: ${chosenMetaphor} — the main moment. The visual metaphor is now in its most impactful state. This is the hero frame — dramatic, vivid, emotionally resonant. Pure illustration, no text.`

  // Frame 3: Resolution — the metaphor completes
  const frame3 = `${baseStyle} Scene resolution: ${chosenMetaphor} — the completion. The visual metaphor reaches its fulfilling conclusion. ${isLast ? 'Warm, hopeful ending — a path forward, an open door, or a bright horizon.' : 'Warm, resolved, complete feeling.'} Pure illustration, no text.`

  return [frame1, frame2, frame3]
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
  classification?: { documentType?: string; category?: string; sensitivity?: string; tone?: string; perspective?: string; redFlags?: string[]; actionItems?: string[]; keyQuestion?: string } | null,
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

  let promptBody = isInsurance
    ? insurancePromptBuilder(data as ExtractedPolicyData, brandName, detailed, assetCount ?? 0)
    : genericPromptBuilder(data as ExtractedData, brandName, detailed, assetCount ?? 0, uploadMode, industry)

  // Replace {{BRAND_NAME}} placeholder with actual brand name
  if (brandName) {
    promptBody = promptBody.replace(/\{\{BRAND_NAME\}\}/g, brandName)
  }

  // Build additional prompt sections based on new parameters
  const additionalSections: string[] = []

  // Inject contact info so the LLM can reference it in narration
  if (contactInfo) {
    const contactParts: string[] = []
    if (contactInfo.phone) contactParts.push(`Phone: ${contactInfo.phone}`)
    if (contactInfo.email) contactParts.push(`Email: ${contactInfo.email}`)
    if ((contactInfo as any).website) contactParts.push(`Website: ${(contactInfo as any).website}`)
    if (contactInfo.calendly) contactParts.push(`Booking: ${contactInfo.calendly}`)
    if (contactParts.length > 0) {
      additionalSections.push(`CONTACT INFORMATION (use in closing scene):\n${contactParts.join('\n')}\nMention the business name "${brandName || 'the company'}" at the opening and closing. Include the above contact details naturally in the final scene.`)
    }
  }

  // Inject deep analysis as the primary content guide
  if (deepAnalysis) {
    additionalSections.push(`STRATEGIC BRIEF (USE THIS AS YOUR PRIMARY GUIDE — cover ALL these points in the script):\n${deepAnalysis}`)
  }

  // Inject document classification intelligence
  if (classification) {
    const classRules: string[] = []

    // Perspective and tone (always applied regardless of confidence)
    if (classification.perspective) {
      classRules.push(`AUDIENCE: The viewer is a ${classification.perspective}. Address them directly and explain things from their perspective.`)
    }
    if (classification.tone) {
      classRules.push(`TONE: ${classification.tone}. This overrides any default tone settings.`)
    }

    // Red flags (always applied regardless of confidence)
    if (classification.redFlags?.length) {
      classRules.push(`RED FLAGS TO ADDRESS (important things the viewer should know):\n${classification.redFlags.map(f => `- ${f}`).join('\n')}\nInclude these naturally in the narration — don't ignore them.`)
    }

    // FIX 2: Confidence gating — only apply hard rules if confidence is sufficient
    const confidence = (classification as any).confidence ?? 0.5
    if (confidence < 0.5) {
      // Low confidence: skip industry-specific hard rules, keep tone/perspective/redFlags
      classRules.push(`Note: Document type was not confidently identified. Apply general best practices.`)
    } else {
      // Confidence >= 0.5: apply sensitivity and hard rules
      if (confidence >= 0.8) {
        classRules.push(`Document type confirmed with high confidence. Strictly enforce all rules below.`)
      }

      if (classification.sensitivity === 'high') {
        classRules.push(`SENSITIVITY: HIGH. This is a regulated/sensitive document. Be precise with numbers, include appropriate disclaimers, do NOT make claims beyond what the source data supports.`)
      }

      // Key question
      if (classification.keyQuestion) {
        classRules.push(`KEY QUESTION: The video MUST answer this: "${classification.keyQuestion}". Structure the script to build toward answering this clearly.`)
      }

      // Action items — for the closing/CTA scene
      if (classification.actionItems?.length) {
        classRules.push(`ACTION ITEMS FOR CLOSING SCENE:\n${classification.actionItems.map(a => `- ${a}`).join('\n')}\nInclude these as concrete next steps in the final scene.`)
      }

      // Industry-specific hard rules
      if (classification.category === 'insurance') {
        classRules.push(`INSURANCE RULES:\n- NEVER mention the insurance carrier/company name\n- Include required disclaimers about illustrations not being guarantees\n- Projected values are NOT guaranteed — say "projected" or "estimated"\n- Focus on what the policy DOES for the client, not the carrier brand`)
      } else if (classification.category === 'healthcare') {
        classRules.push(`HEALTHCARE RULES:\n- Use patient-friendly language, avoid medical jargon\n- Do NOT make diagnostic claims\n- Explain what results MEAN, not just what they ARE\n- Be empathetic and reassuring in tone`)
      } else if (classification.category === 'legal') {
        classRules.push(`LEGAL RULES:\n- Do NOT frame content as legal advice\n- Use precise language — don't paraphrase legal terms loosely\n- Highlight key obligations and deadlines\n- Recommend consulting an attorney for specific situations`)
      } else if (classification.category === 'finance') {
        classRules.push(`FINANCIAL RULES:\n- All numbers must match the source exactly — no rounding\n- Include "past performance does not guarantee future results" where applicable\n- Explain financial terms in plain language\n- Be clear about fees, penalties, and fine print`)
      } else if (classification.category === 'real-estate' || (classification as any).industry === 'real-estate') {
        classRules.push(`REAL ESTATE RULES:\n- Highlight property features and neighborhood benefits\n- Include square footage, bedrooms, bathrooms accurately\n- Mention nearby amenities and schools\n- CTA should drive scheduling a showing or consultation`)
      } else if (classification.category === 'education' || (classification as any).industry === 'education') {
        classRules.push(`EDUCATION RULES:\n- Use clear, accessible language for all learning levels\n- Break complex concepts into digestible pieces\n- Include practical examples and applications\n- Encourage further learning and exploration`)
      } else if ((classification as any).industry === 'fitness' || (classification as any).industry === 'coaching') {
        classRules.push(`FITNESS/COACHING RULES:\n- Focus on outcomes and transformations, not just features\n- Use motivational but not pushy tone\n- Include specific results or testimonials if available\n- CTA should drive booking a session or starting a trial`)
      } else if ((classification as any).industry === 'non-profit') {
        classRules.push(`NON-PROFIT RULES:\n- Lead with mission and impact, not organization details\n- Use stories and real examples of impact\n- Be transparent about how funds are used\n- CTA should drive donations or volunteer sign-ups`)
      } else if ((classification as any).industry === 'retail' || (classification as any).industry === 'manufacturing') {
        classRules.push(`BUSINESS RULES:\n- Focus on value proposition and competitive advantages\n- Include specific product/service differentiators\n- Use customer-focused language (benefits over features)\n- CTA should drive purchasing or requesting a quote`)
      }
    }

    // FIX 1: Wire CTA from industry config into script generator
    const resolvedIndustry = ((classification as any).industry || industry || 'general') as string
    const industryConfig = INDUSTRIES[resolvedIndustry as IndustryId] ?? null
    if (industryConfig?.ctaText) {
      classRules.push(`CLOSING CTA: Use this call-to-action for the final scene: '${industryConfig.ctaText}'. Adapt it naturally to fit the content.`)
    } else {
      // Smart default CTA based on document category
      const defaultCtaMap: Record<string, string> = {
        insurance: 'Schedule a policy review today.',
        legal: 'Consult your attorney to discuss next steps.',
        healthcare: 'Schedule a follow-up appointment with your provider.',
        finance: 'Schedule a financial review to discuss your options.',
        'real-estate': 'Schedule a showing or consultation today.',
        education: 'Take the next step in your learning journey.',
        business: 'Reach out to discuss how we can help.',
      }
      const ctaCategory = classification.category || 'general'
      const defaultCta = defaultCtaMap[ctaCategory]
      if (defaultCta) {
        classRules.push(`CLOSING CTA: Use this call-to-action for the final scene: '${defaultCta}'. Adapt it naturally to fit the content.`)
      }
    }

    if (classRules.length > 0) {
      additionalSections.push(`DOCUMENT INTELLIGENCE (auto-detected rules for this ${classification.documentType || 'document'}):\n${classRules.join('\n\n')}`)
    }
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

    // Generate frame prompts for flipbook mode
    const stylePromptForFrames = '' // Will be filled by generate-video route
    for (let i = 0; i < scenes.length; i++) {
      scenes[i].framePrompts = generateFramePrompts(scenes[i], stylePromptForFrames, i, scenes.length)
      scenes[i].visualMetaphor = scenes[i].framePrompts![0].match(/Scene setup: (.+?) —/)?.[1] || 'visual story'
    }

    return scenes
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Failed to parse script: ${text.slice(0, 200)}`)
    }
    throw e
  }
}
