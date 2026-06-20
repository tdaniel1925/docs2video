import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedPolicyData, VideoScene } from './types'
import { type ExtractedData, isInsuranceData } from './extract-types'
import { detectIndustry, classifyIndustryLLM, INDUSTRIES, type IndustryId } from './industries'
import { getPrompt } from './prompts'
import { fitSourceData } from './source-data-fitter'
import { withRetry } from './with-retry'

let _claude: Anthropic | null = null
function getClaude() {
  if (!_claude) _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _claude
}

/** Claude message create with transient-error retry/backoff. */
function claudeCreate(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  return withRetry(() => getClaude().messages.create(params) as Promise<Anthropic.Message>, { label: 'claude' })
}

function parseClaudeText(response: Anthropic.Message): string {
  const block = response.content[0]
  return (block?.type === 'text' ? block.text : '').trim()
}

function cleanJson(text: string): string {
  // 1) Strip any ```json / ``` fences anywhere (not just exact start/end).
  let t = text.replace(/```(?:json)?/gi, '').trim()
  // 2) Extract the JSON array/object body — fence-proof and tolerant of any
  //    prose the model adds before/after (e.g. "Here is the script:").
  const firstArr = t.indexOf('['), firstObj = t.indexOf('{')
  const start = firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstArr, firstObj)
  if (start === -1) return t
  // Match the closing bracket of the SAME type as the opener.
  const opener = t[start]
  const closer = opener === '[' ? ']' : '}'
  const end = t.lastIndexOf(closer)
  return end > start ? t.slice(start, end + 1).trim() : t.slice(start).trim()
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

  const response = await claudeCreate({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = parseClaudeText(response)
  const cleaned = cleanJson(text)

  try {
    let scenes = JSON.parse(cleaned) as VideoScene[]
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

/**
 * Split narration into chunks matching frame count.
 * Splits on sentence boundaries so each frame's audio makes sense standalone.
 */
export function splitNarration(narration: string, frameCount: number): string[] {
  if (frameCount <= 1) return [narration]

  // Split into sentences
  const sentences = narration.match(/[^.!?]+[.!?]+/g) || [narration]
  if (sentences.length <= frameCount) {
    // Not enough sentences — distribute evenly
    const chunks: string[] = []
    const perChunk = Math.max(1, Math.ceil(sentences.length / frameCount))
    for (let i = 0; i < frameCount; i++) {
      const start = i * perChunk
      const chunk = sentences.slice(start, start + perChunk).join(' ').trim()
      chunks.push(chunk || sentences[sentences.length - 1]?.trim() || narration)
    }
    return chunks
  }

  // More sentences than frames — distribute evenly by character count
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0)
  const targetPerChunk = totalChars / frameCount
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    current += sentence
    if (current.length >= targetPerChunk && chunks.length < frameCount - 1) {
      chunks.push(current.trim())
      current = ''
    }
  }
  // Push remaining
  if (current.trim()) {
    chunks.push(current.trim())
  }

  // Ensure we have exactly frameCount chunks
  while (chunks.length < frameCount) chunks.push(chunks[chunks.length - 1])
  while (chunks.length > frameCount) {
    // Merge last two
    const last = chunks.pop()!
    chunks[chunks.length - 1] += ' ' + last
  }

  return chunks
}

function generateFramePrompts(scene: VideoScene, stylePrompt: string, sceneIndex: number, totalScenes: number): string[] {
  const dataPoints = scene.narration.match(/\$[\d,]+|\d+%|\d+ (?:years?|months?)/gi)?.slice(0, 3)?.join(', ') || ''

  // Single frame prompt — driven by the actual narration content, not generic metaphors
  const frame = `${stylePrompt} 1920x1080 landscape. Fill entire canvas edge to edge. DO NOT include any logos or brand names. IMPORTANT: Keep the bottom 100 pixels of the image clean and empty (solid dark color) — a branded bar will be overlaid there. All text and visual elements must be above the 980px line.

HEADLINE: "${scene.title}"
${dataPoints ? 'KEY DATA to show prominently: ' + dataPoints : ''}

SCENE CONTENT (illustrate THIS specifically):
${scene.narration.slice(0, 400)}

Create a professional illustrated infographic that visually represents the narration above. Use relevant icons, charts, or visual elements that directly relate to the content. Every visual element should connect to what the narration is saying. Do NOT use generic imagery — make the illustration specific to this topic.`

  return [frame]
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
  // Detect insurance from multiple signals — scan content if structured fields missing
  const contentText = JSON.stringify(data).toLowerCase()
  const insuranceKeywords = ['death benefit', 'cash value', 'surrender value', 'premium payment', 'life insurance', 'universal life', 'whole life', 'term life', 'iul', 'vul', 'gul', 'annuity', 'beneficiary', 'insured', 'policyholder', 'illustration', 'guaranteed interest', 'non-guaranteed', 'cost of insurance', 'net surrender', 'policy loan', 'rider', 'accelerated death', 'waiver of premium']
  const insuranceHits = insuranceKeywords.filter(k => contentText.includes(k))
  const isInsurance = isInsuranceData(data)
    || classification?.category === 'insurance'
    || industry === 'insurance'
    || ['life_insurance_illustration', 'annuity_contract', 'health_insurance_eob', 'disability_policy', 'long_term_care'].includes(classification?.documentType || '')
    || insuranceHits.length >= 3 // 3+ insurance keywords = insurance document

  if (isInsurance) {
    console.log(`[script-gen] Insurance detected (${insuranceHits.length} keywords: ${insuranceHits.slice(0, 5).join(', ')})`)
  }

  // PASS 1: Deep analysis — understand the business before writing the script
  const intentMap: Record<string, string> = {
    sales: 'This is a SALES VIDEO. The viewer is a potential buyer. Lead with the PROBLEM they have, not your product. Show the cost of NOT acting. Present benefits (not features), then pricing AFTER value is established. End with one specific CTA — not "contact us" but "book a 15-minute call" or "start your free trial." Use social proof before asking for the sale.',
    educate: 'This is an EDUCATIONAL VIDEO. The viewer wants to UNDERSTAND something. Start with why this matters to THEM. Explain concepts using analogies they already know. Every fact should answer "so what?" — why does this matter? End with what they can DO with this knowledge.',
    train: 'This is a TRAINING VIDEO. The viewer needs to LEARN a process. Start with WHY this matters to their job. Show each step with context (not just "do this" but "do this BECAUSE..."). Anticipate where they will get confused. End with what they should do Monday morning.',
    report: 'This is a DATA REPORT VIDEO. The viewer is a decision-maker. Don\'t read every number — pick the 3-5 that drive decisions. For each metric, explain: what it means, is it good or bad, and what should we do about it. Lead with the headline ("revenue is up 18%"), then support it.',
    proposal: 'This is a PROPOSAL VIDEO. The viewer is deciding whether to hire/buy from you. Lead with their problem (show you understand it). Present your approach as the obvious solution. Prove it with past results. Address "why you and not someone else?" End with specific next steps and timeline.',
  }
  // Use the matching intent preset if present; otherwise the user's purpose;
  // otherwise a generic fallback. (Parenthesized to fix an operator-precedence
  // bug where a valid preset was always discarded whenever purpose was set.)
  let intentGuidance = intentMap[(data as any)?.intentType || '']
    || (purpose ? `VIDEO PURPOSE: ${purpose}` : 'Create an informative overview of this content.')

  // For insurance: inject carrier/product ban into strategic analysis guidance
  if (isInsurance) {
    intentGuidance += `\n\nCRITICAL INSURANCE RULE FOR THIS ANALYSIS: Do NOT mention ANY insurance carrier name, company name, or branded product name anywhere in your analysis. Use "the carrier" and "this policy" instead. Do NOT analyze the carrier's company history, financial ratings, or brand reputation. Focus ONLY on policy features, benefits, and what the numbers mean for the policyholder. If the source document mentions a company name or product name, REPLACE it with "the carrier" or "this policy" in your output.`
  }

  let deepAnalysis = ''
  try {
    const analysisResponse = await claudeCreate({
      model: 'claude-sonnet-4-6',
      // Bounded so the chained analysis+script calls fit under the function
      // timeout. A focused ~2k-token analysis is plenty to guide the script and
      // is much faster than a 4k one on large inputs.
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: (() => {
          // 12k (was 30k) — the analysis only needs the gist; feeding the whole
          // document was the main cause of the ~4-min Pass-1 + 300s timeout.
          const { fitted, wasTruncated, droppedSections } = fitSourceData(data, 12000)
          if (wasTruncated) {
            console.warn(`[script-gen] Source data truncated for strategic analysis. Dropped: ${droppedSections.join(', ')}`)
          }
          return getPrompt('strategic_analysis')(
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
    })
    deepAnalysis = parseClaudeText(analysisResponse)

    // Strip carrier/product names from the analysis so they don't leak into the script
    if (isInsurance) {
      const carrierName = (data as any).carrier || ''
      const productName = (data as any).policyType || ''
      if (carrierName && carrierName.length > 2) {
        const carrierRegex = new RegExp(carrierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        deepAnalysis = deepAnalysis.replace(carrierRegex, 'the carrier')
      }
      if (productName && productName.length > 3) {
        const genericTypes = ['iul', 'ul', 'vul', 'gul', 'universal life', 'whole life', 'term life', 'annuity']
        if (!genericTypes.includes(productName.toLowerCase())) {
          const productRegex = new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
          deepAnalysis = deepAnalysis.replace(productRegex, 'this policy')
        }
      }
    }

    console.log(`[script-gen] Deep analysis: ${deepAnalysis.length} chars`)
  } catch (err) {
    console.error('[script-gen] Deep analysis failed, proceeding without:', err instanceof Error ? err.message : 'unknown')
  }

  const genericPromptBuilder = getPrompt('script_generation_generic')
  const insurancePromptBuilder = getPrompt('script_generation_insurance')

  // Structured insurance data → full insurance prompt (carrier ban, beat structure).
  // Insurance detected by keywords but WITHOUT structured fields → generic prompt,
  // but pass the insurance flag so it applies the same carrier/product ban (otherwise
  // the carrier and product names leak into the narration — the reported bug).
  const hasStructuredInsuranceData = isInsuranceData(data)
  let promptBody = hasStructuredInsuranceData
    ? insurancePromptBuilder(data as ExtractedPolicyData, brandName, detailed, assetCount ?? 0)
    : genericPromptBuilder(data as ExtractedData, brandName, detailed, assetCount ?? 0, uploadMode, industry, isInsurance)

  // Replace {{BRAND_NAME}} placeholder with actual brand name
  if (brandName) {
    promptBody = promptBody.replace(/\{\{BRAND_NAME\}\}/g, brandName)
  }

  // Build additional prompt sections based on new parameters
  const additionalSections: string[] = []

  // Truncation warning — source data may be incomplete
  if ((data as any).truncated) {
    additionalSections.push(`DATA COMPLETENESS WARNING: The source document was too long and was truncated during extraction. Some facts, contact info, or disclaimers from the middle of the document may be missing. Do NOT assume completeness — only use facts explicitly present in the data below. If contact info seems incomplete, do NOT guess or fill in gaps.`)
  }

  // Contact info injection — single source of truth (matches H2/H6 in templates)
  // Rule: contact info ONLY in final scene; include ONLY if it exists verbatim in source; otherwise closing is exactly "Thank you for watching."
  // Do NOT mention brand name at opening — H5 says "jump straight into the topic".

  // For insurance: reinforce carrier name ban and focus on policy features
  if (isInsurance) {
    // Extract carrier/product names from whatever fields are available
    const carrierName = (data as any).carrier || (data as any).companyName || ''
    const productName = (data as any).policyType || ''

    // Scan sections/title for carrier and product names if not explicitly set
    const allText = JSON.stringify(data).toLowerCase()
    const knownCarriers = ['american general', 'corebridge', 'pacific life', 'nationwide', 'lincoln financial', 'transamerica', 'prudential', 'metlife', 'john hancock', 'securian', 'north american', 'allianz', 'midland national', 'athene', 'global atlantic', 'protective', 'penn mutual', 'minnesota life', 'great-west', 'voya', 'principal', 'mutual of omaha', 'aig', 'zurich', 'sammons', 'f&g', 'fidelity & guaranty']
    const detectedCarriers = knownCarriers.filter(c => allText.includes(c))
    const carrierList = carrierName ? [carrierName, ...detectedCarriers] : detectedCarriers
    const uniqueCarriers = [...new Set(carrierList.map(c => c.trim()).filter(c => c.length > 1))]

    // Detect branded product names from the document title and content
    // Strategy: the document title usually IS the product name for insurance illustrations
    const genericTypes = ['iul', 'ul', 'vul', 'gul', 'universal life', 'whole life', 'term life', 'variable universal life', 'indexed universal life', 'guaranteed universal life', 'annuity', 'fixed annuity', 'variable annuity', 'life insurance', 'illustration', 'policy', 'summary', 'overview', 'benefits']
    const docTitle = ((data as any).title || '').trim()
    const detectedProducts: string[] = []
    // The document title often contains the product name — extract it
    if (docTitle && docTitle.length > 3) {
      // Remove generic words to isolate the product name
      let productFromTitle = docTitle
      for (const g of genericTypes) {
        productFromTitle = productFromTitle.replace(new RegExp(`\\b${g}\\b`, 'gi'), '').trim()
      }
      // Remove carrier names already detected
      for (const c of uniqueCarriers) {
        productFromTitle = productFromTitle.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
      }
      productFromTitle = productFromTitle.replace(/[-—–:,]/g, ' ').replace(/\s{2,}/g, ' ').trim()
      if (productFromTitle.length > 2) {
        detectedProducts.push(productFromTitle)
        // Also add the full title as a variation
        detectedProducts.push(docTitle)
      }
    }
    // Also add explicit product name field if it exists
    if (productName && productName.length > 3) {
      const isGeneric = genericTypes.some(g => productName.toLowerCase() === g)
      if (!isGeneric) detectedProducts.push(productName)
    }
    // Known product name fragments as fallback
    const knownProductFragments = ['qol max', 'accumulator', 'secure lifetime', 'power protector', 'performance elite', 'rapidbuilder', 'wealthmax', 'platinum advantage', 'lifeguard', 'choicelife', 'foundation life', 'pathfinder', 'builder plus']
    for (const p of knownProductFragments) {
      if (allText.includes(p)) detectedProducts.push(p)
    }
    const uniqueProducts = [...new Set(detectedProducts.map(p => p.trim()).filter(p => p.length > 2))]

    const carrierBanText = uniqueCarriers.length > 0
      ? uniqueCarriers.map(c => `"${c}"`).join(', ')
      : 'any insurance carrier or company name'
    const productBanText = uniqueProducts.length > 0
      ? uniqueProducts.map(p => `"${p}"`).join(', ')
      : 'any branded product name'

    additionalSections.push(`INSURANCE ILLUSTRATION VIDEO — CONVERSATION STYLE:

This video is a friendly, natural conversation explaining what this policy does for the viewer. Imagine you're sitting across the table from the client, walking them through their benefits in plain English.

TONE: Warm, conversational, like a trusted advisor explaining things simply. Not a sales pitch. Not a legal document. Just a helpful walkthrough of THEIR specific numbers.

WHAT TO TALK ABOUT (focus on these):
- Their specific death benefit amount and what it means for their family
- Their premium — how much they pay and what they get for it
- Cash value growth — how their money grows over time, with their actual projected numbers
- Riders and living benefits — what extra protections they have
- How the policy works in simple terms (e.g. "your money grows when the market goes up, but you're protected when it goes down")
- What makes this type of policy different from basic term insurance

WHAT TO NEVER MENTION:
- Any company name, carrier name, or insurance brand (${carrierBanText})
- Any branded product name (${productBanText})
- Instead, just say "your policy", "this plan", "your coverage", or the generic type like "your IUL" or "your universal life policy"
- Company history, financial ratings, AM Best scores, awards — skip all of that
- Don't explain what the COMPANY does. Explain what the POLICY does for the CLIENT.

The viewer should feel like they just had a clear, personal explanation of their own policy benefits — not like they watched a corporate marketing video.`)
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

    // Carrier-name ban — ALWAYS fires regardless of confidence (compliance-critical)
    if (classification.category === 'insurance') {
      classRules.push(`INSURANCE CARRIER BAN (LEGAL — ALWAYS ENFORCED):\n- NEVER mention the insurance carrier/company name\n- Include required disclaimers about illustrations not being guarantees\n- Projected values are NOT guaranteed — say "projected" or "estimated"\n- Focus on what the policy DOES for the client, not the carrier brand`)
    }

    // FIX 2: Confidence gating — only apply industry-specific style rules if confidence is sufficient
    const confidence = (classification as any).confidence ?? 0.5
    if (confidence < 0.5) {
      // Low confidence: skip industry-specific style rules, keep tone/perspective/redFlags/carrier ban
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

      // Industry-specific style rules (carrier ban already applied above, unconditionally)
      if (classification.category === 'insurance') {
        // Carrier ban already applied above — no duplicate needed here
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
    additionalSections.push(`VIDEO LENGTH: HIGHLIGHTS (30-60 SECONDS MAX) — Requirements:
- 3-4 scenes MAXIMUM. Do NOT exceed 4 scenes.
- Each scene narration must be 20-30 words. NOT longer.
- Total narration across ALL scenes must be under 150 words (approximately 60 seconds).
- Pick only the 2-3 most impactful points. Skip everything else.
- This is a TEASER, not a summary.`)
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
    additionalSections.push(`VIDEO LENGTH: STANDARD (2-3 MINUTES MAX) — Requirements:
- 6-8 scenes MAXIMUM. Do NOT exceed 8 scenes.
- Each scene narration must be 30-50 words. NOT longer.
- Total narration across ALL scenes must be under 450 words (approximately 3 minutes at speaking pace).
- Cover the major points concisely — summarize, don't elaborate.
- If the source has many data points, pick the 5-6 most important ones. Skip the rest.
- This is a SUMMARY video, not a detailed walkthrough.`)
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

  // ── Craft rules: turn a list-of-facts into a presentable, intelligent script ──
  // These are the difference between "captions read aloud" and a real person
  // walking you through something. Grounded in the data; no invented facts.
  additionalSections.push(`NARRATIVE ARC (write the script as ONE story, not isolated blurbs):
- Before writing scenes, silently decide the SINGLE most important takeaway the viewer must remember. Make every scene serve it.
- Shape the whole video as an arc: HOOK (earn attention) → CONTEXT (orient them) → BUILD (develop the key points, rising toward the most important fact) → PAYOFF (the takeaway lands) → CLOSE (what to do next).
- The most important number/fact should feel like the climax the earlier scenes were building toward — not just another bullet.`)

  additionalSections.push(`FLOW & CONNECTIVE TISSUE (make it sound like a person talking):
- Within the strict slide-sync rules above, each scene's FIRST line should feel like a natural continuation of the moment — open by grounding the viewer in what they're seeing, in a human way ("Here's where it gets important." / "This is the part that matters for you.").
- Vary how scenes begin — never start multiple scenes the same way ("Here are…", "This is…"). Mix statements, short questions, and direct address ("you").
- Use natural spoken cadence: contractions ("you're", "that's", "it's"), occasional one-word emphasis ("Significant."), and rhetorical questions where they help ("So what does that actually mean?").
- AVOID robotic filler: "the data shows", "it's worth noting", "as we can see", "in this section". Talk TO the viewer, not AT a slide.`)

  additionalSections.push(`MAKE NUMBERS MEAN SOMETHING (the "so what"):
- Every metric or figure must be followed by its human consequence — why the viewer should care. State the number, then translate it.
- Example pattern (adapt to the real, grounded data): "$176,204 in coverage — that's enough to keep your family in their home and cover what comes next." Never the number alone.
- Prefer concrete, relatable framing over abstract restatement. A figure with no meaning attached is a wasted line.`)

  additionalSections.push(`SENTENCE RHYTHM (this is the biggest "sounds human" lever for voiceover):
- Vary sentence length deliberately: mix short, punchy lines with one longer, flowing sentence. Never make every sentence the same length — that's what makes TTS sound flat.
- Read each line aloud in your head; if it sounds like a textbook, rewrite it the way a confident person would actually say it.
- Lead with the point, then support it. Front-load the interesting part of each sentence.`)

  if (purpose) {
    additionalSections.push(`VIDEO PURPOSE (CRITICAL): The user wants this video to "${purpose}". This is the primary objective — shape the entire narrative, tone, emphasis, and call-to-action around accomplishing this goal. Every scene should serve this purpose. Prioritize information that supports this goal and de-emphasize anything that doesn't.`)
  }

  // Tone preset — pick ONE voice for the whole script based on what kind of
  // document/audience this is, so the narration is consistently right for the
  // listener (a patient hears reassurance; a client hears confident precision).
  {
    const cat = (classification?.category || industry || '').toLowerCase()
    let preset = ''
    if (['insurance', 'healthcare', 'medical'].some((k) => cat.includes(k))) {
      preset = 'REASSURING EXPERT — warm, plain-language, calm and caring. Explain like a trusted professional sitting across from someone, removing worry. No jargon; if a technical term is unavoidable, define it in plain words.'
    } else if (['finance', 'legal', 'business'].some((k) => cat.includes(k))) {
      preset = 'CONFIDENT ADVISOR — precise, credible, benefit-framed. Speak with quiet authority. Lead with what the figures mean for the listener, not just what they are.'
    } else if (['real-estate', 'sales', 'marketing'].some((k) => cat.includes(k))) {
      preset = 'ENERGETIC GUIDE — upbeat and persuasive without hype. Problem → solution framing. Make the value obvious and the next step easy.'
    } else if (['education'].some((k) => cat.includes(k))) {
      preset = 'CLEAR TEACHER — friendly, structured, encouraging. Build understanding step by step; make the listener feel capable.'
    } else {
      preset = 'WARM PROFESSIONAL — clear, friendly, and direct. Like a smart colleague explaining something they genuinely want you to get.'
    }
    additionalSections.push(`TONE PRESET (adopt this voice throughout, unless BRAND TONE below overrides it):\n${preset}`)
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

  // Single contact-info injection — consistent with template H2/H6
  if (contactInfo && (contactInfo.phone || contactInfo.email || contactInfo.calendly || (contactInfo as any)?.website)) {
    const parts: string[] = []
    if (contactInfo.phone) parts.push(`Phone: ${contactInfo.phone}`)
    if (contactInfo.email) parts.push(`Email: ${contactInfo.email}`)
    if ((contactInfo as any)?.website) parts.push(`Website: ${(contactInfo as any).website}`)
    if (contactInfo.calendly) parts.push('Booking link available on the share page')
    additionalSections.push(`CONTACT INFO (FINAL SCENE ONLY — this is the single source of truth):
${parts.join('\n')}
Rules:
- Include these ONLY in the final scene narration. NEVER mention contact details in earlier scenes.
- Use ONE clear call to action — pick the strongest channel.
- For phone numbers: spell out naturally ("five five five, one two three, four five six seven").
- For websites: say "visit their website" — the URL will be on the slide.
- If ${brandName ? `mentioning the brand, use "${brandName}"` : 'no brand name is available, skip it'}.
- If none of these contact details existed, the closing would be exactly "Thank you for watching." — but since they DO exist, use them.`)
  }

  const additionalBlock = additionalSections.length > 0 ? '\n\n' + additionalSections.join('\n\n') : ''

  // Podcast mode: generate dialogue with speaker tags
  if (narrationStyle === 'podcast') {
    // Determine conversation style based on content type
    const detectedIndustry = industry || await classifyIndustryLLM((data as any).title || '', JSON.stringify(data)).catch(() => 'general')
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

    const response = await claudeCreate({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: podcastPrompt }],
    })

    const text = parseClaudeText(response)
    const cleaned = cleanJson(text)

    try {
      let scenes = JSON.parse(cleaned) as VideoScene[]
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
- "beat": one of "hook", "disclaimer", "disclaimer-close", "context", "stakes", "evidence", "implication", "action"

OPENING SCENE (scene 1, beat "hook") — IMPORTANT:
- Start warm and friendly, like a real person greeting the viewer. Briefly welcome them, say in one sentence WHAT this video is about, and WHY it matters to them — THEN transition into the content.
- Example tone: "Welcome — in the next couple of minutes, we'll walk through your [topic] and what it means for you. Let's get started." (adapt to the real topic; never invent facts).
- Do NOT just dive straight into data on scene 1. The viewer should feel oriented and welcomed first.
- The narrator still never states their own name. Keep it natural, friendly, and relatable — not stiff or corporate.
- The COVER is an INTRODUCTION only — do NOT cite specific numbers, dollar amounts, or stats on scene 1 (those belong on their own data scenes later). Citing a figure here with nothing on screen is confusing.

CLOSING SCENE (LAST scene) — IMPORTANT:
- This is the CONTACT / wrap-up. Warmly thank the viewer, invite them to reach out, and SAY the contact details aloud if provided (e.g. "Call us at [phone] or visit [website] with any questions"). If a key value like coverage/policy amount exists, you may restate it once as reassurance.
- The slide will show the logo, contact info, and a thank-you — so the narration must MATCH that (a contact/CTA close), not introduce new topics.

NARRATION ↔ SLIDE CORRESPONDENCE (every scene):
- Each scene's narration must describe EXACTLY what is on that scene's slide — the same facts/numbers, nothing more, nothing less.
- Never narrate a number that isn't shown on that slide, and never put a number on a slide the narration doesn't mention.
- If the slide shows $176,204 as the death benefit, the narration for THAT scene talks about that figure — not a number from another scene.`

  const response = await claudeCreate({
    model: 'claude-sonnet-4-6',
    // 16k so a long, detailed multi-scene script (per-scene stats + bullets +
    // narration) never truncates mid-JSON — the cause of "Failed to parse script".
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = parseClaudeText(response)
  const cleaned = cleanJson(text)
  // If the model hit the token ceiling the JSON is truncated and unparseable —
  // make the failure explicit (clearer than a generic parse error).
  if ((response as any).stop_reason === 'max_tokens') {
    console.error('[script-generator] response truncated (max_tokens) — script too long for the cap')
  }

  try {
    let scenes = JSON.parse(cleaned) as VideoScene[]
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

    // Post-parse: strip carrier/company names from insurance narrations
    // Works even when data.carrier is missing — scans narration for known carriers
    if (isInsurance) {
      const knownCarriers = ['american general', 'corebridge financial', 'corebridge', 'pacific life', 'nationwide', 'lincoln financial', 'lincoln national', 'transamerica', 'prudential', 'metlife', 'john hancock', 'securian', 'north american', 'north american company', 'allianz', 'allianz life', 'midland national', 'athene', 'global atlantic', 'protective', 'protective life', 'penn mutual', 'minnesota life', 'great-west', 'voya', 'principal', 'mutual of omaha', 'aig', 'zurich', 'sammons', 'f&g', 'fidelity & guaranty', 'fidelity and guaranty', 'columbus life', 'western & southern', 'mass mutual', 'massmutual', 'new york life', 'guardian', 'northwestern mutual', 'state farm', 'allstate']
      const knownProducts = ['qol max', 'accumulator+', 'accumulator plus', 'secure lifetime', 'power protector', 'elite iul', 'performance elite', 'rapidbuilder', 'wealthmax', 'platinum advantage', 'lifeguard', 'choicelife', 'foundation life', 'pathfinder', 'builder plus', 'ag secure', 'vul protector']

      // Extract product name from document title (most reliable source)
      const genericTypesPost = ['iul', 'ul', 'vul', 'gul', 'universal life', 'whole life', 'term life', 'variable universal life', 'indexed universal life', 'guaranteed universal life', 'annuity', 'fixed annuity', 'variable annuity', 'life insurance', 'illustration', 'policy', 'summary', 'overview', 'benefits']
      const postDocTitle = ((data as any).title || '').trim()

      const variations: string[] = []

      // Extract product name from title by removing generic words and carrier names
      if (postDocTitle && postDocTitle.length > 3) {
        let titleProduct = postDocTitle
        for (const g of genericTypesPost) {
          titleProduct = titleProduct.replace(new RegExp(`\\b${g}\\b`, 'gi'), '').trim()
        }
        for (const c of knownCarriers) {
          titleProduct = titleProduct.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim()
        }
        titleProduct = titleProduct.replace(/[-—–:,]/g, ' ').replace(/\s{2,}/g, ' ').trim()
        if (titleProduct.length > 2) {
          variations.push(titleProduct)
          variations.push(postDocTitle) // also strip full title
        }
      }

      // Add explicit fields if they exist
      const explicitCarrier = (data as any).carrier || (data as any).companyName || ''
      const explicitProduct = (data as any).policyType || (data as any).productName || ''
      if (explicitCarrier && explicitCarrier.length > 2) variations.push(explicitCarrier)
      if (explicitProduct && explicitProduct.length > 3) {
        if (!genericTypesPost.includes(explicitProduct.toLowerCase())) variations.push(explicitProduct)
      }

      // Scan narration for known carriers/products
      const allNarration = scenes.map((s: any) => s.narration || '').join(' ').toLowerCase()
      for (const c of knownCarriers) {
        if (allNarration.includes(c)) variations.push(c)
      }
      for (const p of knownProducts) {
        if (allNarration.includes(p)) variations.push(p)
      }

      if (variations.length > 0) {
        // Dedupe and sort by length (longest first to avoid partial matches)
        const uniqueVars = [...new Set(variations)].sort((a, b) => b.length - a.length)

        for (const scene of scenes) {
          if (scene.narration) {
            for (const v of uniqueVars) {
              if (v.length > 2) {
                const regex = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
                scene.narration = scene.narration.replace(regex, 'the carrier')
              }
            }
            scene.narration = scene.narration
              .replace(/from the carrier the carrier/gi, 'from the carrier')
              .replace(/the carrier's the carrier/gi, "the carrier's")
              .replace(/the carrier the carrier/gi, 'the carrier')
              .replace(/\s{2,}/g, ' ')
              .trim()
          }
          if (scene.slideData?.headline) {
            for (const v of uniqueVars) {
              if (v.length > 2) {
                scene.slideData.headline = scene.slideData.headline.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
              }
            }
            scene.slideData.headline = scene.slideData.headline.replace(/\s{2,}/g, ' ').trim()
          }
        }
        console.log(`[script-gen] Stripped ${uniqueVars.length} carrier/product names from narration: ${uniqueVars.join(', ')}`)
      }

        // Remove entire scenes that are about the carrier (not the policy)
        const carrierScenePatterns = [
          /the company behind/i,
          /about (the |your |this )?(carrier|company|insurer)/i,
          /rated at the top/i,
          /financial (strength|rating|stability) of/i,
          /AM Best|A\+\+ rating|S&P rating|Moody's|Fitch/i,
          /track record that speaks/i,
          /history of (the |this )?(carrier|company)/i,
          /who (is|are) (the |this )?(carrier|company)/i,
        ]
        const beforeCount = scenes.length
        scenes = scenes.filter((scene: any) => {
          const title = scene.title || ''
          const narration = scene.narration || ''
          const isCarrierScene = carrierScenePatterns.some(p => p.test(title) || p.test(narration.slice(0, 200)))
          if (isCarrierScene) {
            console.log(`[script-gen] Removed carrier-focused scene: "${title}"`)
          }
          return !isCarrierScene
        })
        // Renumber remaining scenes
        if (scenes.length < beforeCount) {
          scenes.forEach((s: any, idx: number) => { s.scene = idx + 1 })
          console.log(`[script-gen] Removed ${beforeCount - scenes.length} carrier-focused scene(s)`)
        }
    }

    // PASS 2 — the "editor": polish the narration for flow, rhythm, and the
    // so-what, paced to each slide. Grounded (no new facts); best-effort so a
    // failure just leaves the first-pass narration untouched.
    if (scenes.length > 0) {
      scenes = await editScriptNarration(scenes, { detailLevel }).catch((e) => {
        console.error('[script-gen] editor pass skipped:', e instanceof Error ? e.message : e)
        return scenes
      })
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

/**
 * PASS 2 — the editor. Takes the first-pass scenes and rewrites ONLY the
 * narration for flow, rhythm, and the "so what", paced to each slide. It is
 * STRICTLY grounded: it may only use facts/numbers already present in the
 * scene's narration or slide data — never invents anything. Returns the same
 * scenes with improved narration; on any failure returns the input unchanged.
 *
 * Why a second pass: a single generate-then-ship call is good; a generate +
 * dedicated critique/polish pass is consistently better and is cheap.
 */
async function editScriptNarration(
  scenes: VideoScene[],
  opts: { detailLevel?: 'quick' | 'standard' | 'detailed' },
): Promise<VideoScene[]> {
  // Compact, grounded view of each scene for the editor (number + what's on the
  // slide + the current narration). Keeping it small keeps the pass fast/cheap.
  const brief = scenes.map((s, i) => {
    const sd = (s as any).slideData || {}
    const stats = Array.isArray(sd.stats) ? sd.stats.map((x: any) => `${x.label}: ${x.value}`).join('; ') : ''
    const bullets = Array.isArray(sd.bullets) ? sd.bullets.join(' | ') : ''
    return [
      `SCENE ${i + 1}${i === 0 ? ' (OPENING)' : i === scenes.length - 1 ? ' (CLOSING)' : ''}`,
      `headline: ${sd.headline || s.title || ''}`,
      stats ? `on-slide numbers: ${stats}` : '',
      bullets ? `on-slide points: ${bullets}` : '',
      `current narration: ${s.narration || ''}`,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const targetWords = opts.detailLevel === 'quick' ? '20-30' : opts.detailLevel === 'detailed' ? '90-160' : '30-50'

  const sys = `You are a world-class script editor for short narrated videos. You polish narration so it sounds like a confident, warm human walking the viewer through something — not captions read aloud.

You will receive the scenes of a video (each with what's ON the slide + the current narration). Rewrite ONLY the narration of each scene. Return improved narration that:
- Flows as ONE story across scenes (each scene opens grounded in what's on screen, with natural variety — never start two scenes the same way).
- Follows every number with its human consequence (the "so what") — never a bare figure.
- Varies sentence rhythm: mix short punchy lines with one longer line. Lead with the point.
- Uses natural spoken cadence (contractions, the occasional short question), and AVOIDS robotic filler ("the data shows", "it's worth noting", "as we can see", "next we'll look at").
- Is paced to the slide: roughly ${targetWords} words per scene.
- OPENING scene = a warm welcome that orients the viewer (no specific numbers there). CLOSING scene = a warm wrap-up / contact, no new topics.

ABSOLUTE RULES:
- GROUNDED: use ONLY facts, names, and numbers already present in that scene's data/narration. Invent NOTHING. Add no new figures, no contact info, no claims.
- Keep each scene's narration about ITS OWN slide only. Never reference "the next slide" or preview upcoming scenes.
- Do not change which scene covers what. Same count, same order.

Return ONLY a JSON array of objects: [{ "scene": <number>, "narration": "<polished narration>" }]. No markdown, no commentary.`

  const resp = await claudeCreate({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: sys,
    messages: [{ role: 'user', content: `SCENES TO POLISH:\n\n${brief}` }],
  } as any)

  const text = parseClaudeText(resp)
  const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) as { scene: number; narration: string }[]
  if (!Array.isArray(arr) || !arr.length) return scenes

  const byScene = new Map(arr.map((x) => [Number(x.scene), (x.narration || '').trim()]))
  // Strip forward-looking phrases the editor might reintroduce, to keep slide sync.
  const forward = /\b(next,?\s+we('ll|\s+will)|coming up|let's\s+(move|turn|shift)\s+(on\s+)?to|in\s+the\s+next\s+(slide|scene|section)|up\s+next|moving\s+on\s+to)\b/gi
  return scenes.map((s, i) => {
    const polished = byScene.get(i + 1) || byScene.get((s as any).scene)
    if (!polished) return s
    return { ...s, narration: polished.replace(forward, '').replace(/\s{2,}/g, ' ').trim() }
  })
}
