# Docs2Video — Complete System Documentation

## 1. Overview

Docs2Video (docs2video.com) is a SaaS platform that transforms documents, URLs, text, and ideas into narrated video presentations. Users upload content (PDF, DOCX, URL, or raw text), the system extracts and structures the information, generates an AI script with narration, creates visual slides, synthesizes voice audio, generates background music, and assembles everything into a final video with FFmpeg on a Hetzner VPS.

The platform supports 13 industries with specialized terminology, disclaimers, and beat structures. It offers 6 subscription tiers from Free ($0/mo) to Enterprise+ ($799/mo). Payments are handled exclusively through Stripe.

**Tech Stack:** Next.js 16.2.6 (Turbopack), Supabase (PostgreSQL + Auth + Storage), Gemini 3 Pro (images), OpenAI GPT-4o-mini (text/scripts), OpenAI TTS-HD (voice), Google Lyria 2 (music), OpenAI GPT Image (logo styling), FFmpeg on Hetzner VPS (video assembly), Stripe (payments), Vercel (hosting).

---

## 2. Video Creation Pipeline

The full pipeline from user input to final video:

1. **Content Input** — User provides one of: URL, PDF/DOCX/PPTX file, pasted text, or an idea/topic
2. **Extraction** (`/api/extract-url` or `/api/extract`) — Content is scraped/parsed and structured into JSON (title, sections, metrics, bullets, contact info)
3. **Brand Detection** (`brand-scraper.ts`) — If URL provided, automatically scrape brand identity: logo, colors, fonts, tone, services
4. **Script Generation** (`script-generator.ts`) — Two-pass AI process:
   - **Pass 1: Strategic Analysis** — GPT-4o-mini acts as "senior communications strategist" analyzing audience, emotional state, key facts, objections, persuasion angles, and story arc
   - **Pass 2: Script Writing** — GPT-4o-mini generates scene-by-scene script with narration, slide data, and beat structure
5. **Script Review** — User reviews and can edit via AI chat (`/api/script-chat`)
6. **Video Generation** (`/api/generate-video`) — Orchestrates the build:
   - Cleans scenes (strips fake phones, replaces `{{BRAND_NAME}}`, removes empty scenes)
   - Formats narration for TTS (phone numbers to spoken digits, percentages to words)
   - Builds slide prompts from scene data + style template
   - Sends everything to VPS (`VIDEO_ASSEMBLY_URL/generate`)
7. **VPS Processing** (Hetzner server) — Runs in parallel:
   - Generates slide images (Gemini 3 Pro)
   - Synthesizes voice audio (OpenAI TTS-HD)
   - Generates background music (Google Lyria 2)
   - Composites logos onto cover/closing slides (Sharp)
   - Assembles final video (FFmpeg)
8. **Delivery** — Video URL stored in Supabase, user notified

**Status progression:** `pending` -> `scripting` -> `generating_audio` -> `generating_slides` -> `assembling` -> `completed` (or `failed`)

---

## 3. Content Extraction

### URL Extraction (Firecrawl + OpenAI)

**File:** `app/api/extract-url/route.ts`

**Process:**
1. Scrape main URL via Firecrawl (markdown + HTML formats)
2. Extract nav links matching keywords: `about`, `pricing`, `services`, `contact`, `features`, `solutions`, `products`, `plans`, `testimonials`, `reviews`, `faq`, `how-it-works`, `case-studies`, `clients`
3. Always try `/contact/` page if not found in nav
4. Scrape up to 5 additional nav pages in parallel
5. Extract contact info via regex (more reliable than AI):
   - Phone: `/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g`
   - Email: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`
6. Send combined content to OpenAI for structuring
7. Fix company name using HTML ground truth (og:site_name or `<title>` tag) — AI often strips apostrophes
8. Auto-create brand from scraped data

**Theme Analysis Prompt:**

```
You are an expert web designer analyzing a website's visual identity. Based on the HTML/CSS below, create a slide presentation style prompt that captures this website's look and feel.

Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "string — a short creative name for this style (2-3 words)",
  "description": "string — one sentence describing the visual style",
  "colors": {
    "primary": "hex color",
    "secondary": "hex color",
    "accent": "hex color",
    "background": "hex color",
    "text": "hex color"
  },
  "prompt": "string — A detailed visual style prompt for generating presentation slides that match this website's aesthetic. Describe: background treatment, color palette, typography style, layout approach, visual effects, mood/tone. Be specific about colors, gradients, textures, and spacing. This prompt will be used by an image generation AI to create branded slides."
}

Rules:
- Extract ACTUAL colors from the CSS/HTML — don't guess
- The prompt should be 2-4 sentences, highly specific and visual
- Focus on what makes this site's design unique
- The style should work on a 16:9 presentation slide
```

**Content Extraction Prompt:**

```
You are an expert content analyst. You will receive raw text extracted from a web page.

Your job is to analyze the text and extract the most important information into a structured format.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "title": "string — a clear, concise title summarizing the content",
  "subtitle": "string or null — a supporting subtitle if appropriate",
  "source": "string or null — the source or origin of the content if identifiable",
  "companyName": "string or null — the exact company/organization name as written on the site (preserve apostrophes, capitalization)",
  "contactInfo": {
    "phone": "string or null — any phone number found anywhere on the page including footer",
    "email": "string or null — any email address found anywhere on the page including footer",
    "website": "string or null — the main website URL",
    "address": "string or null — any physical address found"
  },
  "keyMetrics": [
    { "label": "string", "value": "string", "highlight": true/false }
  ],
  "sections": [
    { "title": "string", "content": "string" }
  ],
  "bulletPoints": ["string"],
  "additionalNotes": ["string"]
}

Rules:
- CONTACT INFO: Carefully scan the ENTIRE text including headers, footers, sidebars for phone numbers, email addresses, and physical addresses. Check the very bottom of the content — footers often have contact info.
- COMPANY NAME: Extract the exact company name with correct spelling, apostrophes, and capitalization
- Extract any numbers, percentages, dollar amounts, dates, or quantifiable data as keyMetrics
- Mark the 2-3 most important metrics with "highlight": true
- Break the content into logical sections with clear titles
- Pull out key takeaways or action items as bulletPoints
- Include any caveats, disclaimers, or supplementary info in additionalNotes
- If the text is short, still create a meaningful structure
- Be smart about understanding context — infer the topic and purpose
- keyMetrics should have concise labels and values (e.g. label: "Revenue", value: "$1.2M")
- Aim for 3-8 keyMetrics, 2-5 sections, and 3-10 bulletPoints
```

**Company Name Correction Logic:**
- Extracts ground truth from `og:site_name` meta tag or `<title>` tag (first segment before `|`, `-`, etc.)
- Compares AI-extracted name (lowercased, apostrophes removed) with HTML name
- If they match ignoring apostrophes/case but differ in exact text, uses the HTML version
- This fixes AI stripping apostrophes (e.g., "Patels" -> "Patel's")

### Document Extraction (PDF/DOCX/TXT)

**File:** `app/api/extract/route.ts`

**Supported formats:** PDF, PPTX, DOCX, TXT, CSV

**Process:**
- **Text files (TXT/CSV):** Read content directly, send to OpenAI for structuring
- **Binary files (PDF/PPTX/DOCX):** Convert to base64, send to VPS (`/extract-document` endpoint) for processing — avoids Vercel timeout limits
- File size limit: 50MB

**Text/Idea Structuring Prompt (system message):**

```
Extract and structure content into JSON. Return:
{
  "title": "Main title",
  "subtitle": "Subtitle or tagline",
  "sections": [{ "title": "Section name", "content": "Section content" }],
  "keyMetrics": [{ "value": "stat value", "label": "stat label" }],
  "contactInfo": { "phone": null, "email": null, "website": null },
  "companyName": "Company name if mentioned"
}
Only include real data found in the content. Never invent contact info.
```

**Idea Mode:** When user provides an idea/topic instead of content, GPT-4o-mini first generates 500-1000 words of content about the topic (with optional audience and purpose context), then structures it.

### Text/Idea Extraction

Same endpoint (`/api/extract`) handles JSON body with `text` or `idea` fields. The idea prompt:

```
Write comprehensive content about: "${idea}"${audience ? ` for audience: ${audience}` : ''}${purpose ? `. Purpose: ${purpose}` : ''}.
Include: overview, key points, benefits, relevant statistics or examples, and a conclusion. Write 500-1000 words of factual, useful content.
```

---

## 4. Script Generation

**File:** `app/_lib/script-generator.ts`

Script generation is a two-pass process using OpenAI GPT-4o-mini.

### Strategic Analysis Pass (Pass 1)

Before writing the script, a "senior communications strategist" analyzes the source data. This analysis becomes the primary guide for script writing.

**Full Strategic Analysis Prompt:**

```
You are a senior communications strategist who understands sales psychology, audience empathy, and persuasion. You are preparing a video that will be WATCHED by a real person — not read as a document.

Your job is to think like the VIEWER, not the document author. What does the viewer care about? What are they afraid of? What would make them take action?

${intentGuidance}

SOURCE DATA:
${JSON.stringify(data).slice(0, 30000)}

${contactInfo ? `CONTACT INFO (for closing scene only):
Phone: ${contactInfo.phone}
Email: ${contactInfo.email}
Website: ${contactInfo.website}
Booking: ${contactInfo.calendly}` : ''}

Create a strategic brief covering:

1. AUDIENCE: Who is watching this video? (client, prospect, employee, stakeholder?) What is their knowledge level? What language do they use — technical or plain English?

2. EMOTIONAL STATE: What is the viewer feeling BEFORE watching? (confused by a document? skeptical of a pitch? overwhelmed by data? anxious about a decision?) What should they feel AFTER?

3. THE ONE THING: If the viewer remembers only ONE takeaway, what should it be? Not a feature — a benefit. Not "death benefit is $750K" but "your family is protected no matter what happens."

4. KEY FACTS: The 8-15 most important specific facts from the source. For each fact, note WHY it matters to the viewer — not just WHAT it is.
   Example: "$500/month premium" -> "For about $16 a day — less than a lunch — your family gets lifetime protection"

5. OBJECTIONS: What 2-3 concerns will the viewer have? Address them proactively.
   Example: "Is this too expensive?" -> Show the per-day cost. "What if the market crashes?" -> Explain the floor protection.

6. PERSUASION ANGLE: What's the strongest emotional lever?
   - Fear of missing out? ("Rates go up every birthday")
   - Peace of mind? ("You'll never worry about your family's future again")
   - Social proof? ("Over 2,000 families already trust this")
   - Urgency? ("This rate is only guaranteed for 30 days")

7. STORY ARC: Map the video as a journey:
   - HOOK: What question or statement grabs attention in 3 seconds?
   - PROBLEM: What pain point does the viewer recognize?
   - SOLUTION: How does this solve it? (benefits, not features)
   - PROOF: What evidence backs it up? (numbers, testimonials, examples)
   - ACTION: What specific thing should they do next?

8. LANGUAGE GUIDE:
   - Translate jargon: List any technical terms and their plain-English equivalents
   - Tone: conversational and confident, not corporate or salesy
   - Reframe negatives: "cost" -> "investment", "policy" -> "plan", "premium" -> "contribution"

9. CONTACT/CTA: Real contact info from the source (ONLY if it exists — NEVER invent). What is the single strongest CTA for this audience?

Return as plain text, not JSON. Be specific — use actual numbers, names, and facts from the source. Think like a strategist, not a summarizer.
```

**Model:** GPT-4o-mini, temperature 0.3

### Intent Types & Guidance

The system maps video intent/purpose to specific guidance:

```typescript
const intentMap: Record<string, string> = {
  sales: 'This is a SALES VIDEO. The viewer is a potential buyer. Lead with the PROBLEM they have, not your product. Show the cost of NOT acting. Present benefits (not features), then pricing AFTER value is established. End with one specific CTA — not "contact us" but "book a 15-minute call" or "start your free trial." Use social proof before asking for the sale.',

  educate: 'This is an EDUCATIONAL VIDEO. The viewer wants to UNDERSTAND something. Start with why this matters to THEM. Explain concepts using analogies they already know. Every fact should answer "so what?" — why does this matter? End with what they can DO with this knowledge.',

  train: 'This is a TRAINING VIDEO. The viewer needs to LEARN a process. Start with WHY this matters to their job. Show each step with context (not just "do this" but "do this BECAUSE..."). Anticipate where they will get confused. End with what they should do Monday morning.',

  report: 'This is a DATA REPORT VIDEO. The viewer is a decision-maker. Don\'t read every number — pick the 3-5 that drive decisions. For each metric, explain: what it means, is it good or bad, and what should we do about it. Lead with the headline ("revenue is up 18%"), then support it.',

  proposal: 'This is a PROPOSAL VIDEO. The viewer is deciding whether to hire/buy from you. Lead with their problem (show you understand it). Present your approach as the obvious solution. Prove it with past results. Address "why you and not someone else?" End with specific next steps and timeline.',
}
```

### Script Generation Prompt — Insurance

**Full insurance script prompt (built by `buildInsuranceScriptPrompt`):**

```
You are a professional scriptwriter creating a life insurance policy explainer video narration.

POLICY DATA:
- Policy Type: ${data.policyType}
- Insured: ${data.insuredName}, Age ${data.insuredAge ?? 'N/A'}
- Death Benefit: ${formatCurrency(data.deathBenefit)}
- Annual Premium: ${formatCurrency(data.annualPremium)}
- Payment Mode: ${data.paymentMode}
- Loan Rate: ${data.loanRate}%
- Cash Value Projections:
  Year X: Guaranteed $Y, Illustrated $Z
- Surrender Value Projections:
  Year X: Guaranteed $Y, Current $Z
- Riders: [list]
- Additional Notes: [list]
- Agent/Agency: {{BRAND_NAME}}

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
   - Surrender values and what they mean
   - Policy loans and the loan rate
   - Each rider and what protection it provides
   Use as many scenes as needed. One concept per scene. Use specific numbers. Be thorough.

6. IMPLICATION — What this all means for the viewer. Connect the data back to their life.

7. DISCLAIMER-CLOSE (1 scene) — Closing legal disclaimer. EXACT narration: "As a reminder, this video is for educational purposes only and does not constitute financial advice. Policy guarantees depend on the issuing carrier's claims-paying ability, and non-guaranteed values may change. Please review your official policy documents and consult with your licensed professional."

8. ACTION (1 scene) — Clear next step. What should the viewer do now? End with the closing per VOICE RULES. Direct them to contact {{BRAND_NAME}}.

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
- Write like a storyteller, not a summarizer. Every scene should have a point, not just list facts.
```

### Script Generation Prompt — Generic (All Industries)

**Full generic script prompt (built by `buildGenericScriptPrompt`):**

```
You are a professional scriptwriter creating an explainer video narration about the following document/content.

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
- Subtitle: ${data.subtitle}
- Source: ${data.source}
- Presented by: {{BRAND_NAME}}

Key Metrics:
${metricsText || '(none)'}

Sections:
${sectionsText || '(none)'}

Key Points:
${bulletText || '(none)'}

Additional Notes: ${additionalNotes}

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
- If source says "fill out the form" -> say "visit our website to get started"
- If source says "click here to learn more" -> say "learn more at our website"
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
- Example: slideData shows "Revenue: $2.4M (+18%)" -> narrator says "Revenue jumped eighteen percent this year, coming in at two point four million."
```

### Beat Structures (by Industry)

All 13 industries have specific beat structures. The common beats are:

| Beat | Purpose |
|------|---------|
| `hook` | Opening — grab attention with compelling insight, benefit, or question |
| `disclaimer` | Legal/compliance disclaimer (required for: insurance, financial, mortgage, healthcare, legal, accounting) |
| `context` | Set the stage — what is this about, who is it for |
| `stakes` | Why it matters — impact, urgency, consequences of inaction |
| `evidence` | Deep dive — data, features, analysis, case studies (bulk of video) |
| `implication` | What does this mean practically for the viewer |
| `disclaimer-close` | Closing legal disclaimer (same industries as opening disclaimer) |
| `action` | Clear next step / CTA |

**Industries requiring disclaimers:** Insurance, Financial Services, Mortgage & Lending, Healthcare, Legal, Accounting & Tax

**Industries without disclaimers:** Real Estate, Consulting, Education, Technology, Human Resources, Sales & Marketing, General

**Full beat structures per industry:**

**Insurance:**
```
1. HOOK (1 scene) — Open with greeting, then state a compelling benefit or surprising number about the policy.
2. DISCLAIMER (1 scene) — Legal disclaimer: "This video is for educational and informational purposes only. It is not legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. Please consult with your licensed insurance professional before making decisions."
3. CONTEXT (1-2 scenes) — Who is this policy for, what type of policy, the big picture.
4. STAKES (1-2 scenes) — Why this matters. What the death benefit means for the family.
5. EVIDENCE (3-8 scenes) — Deep dive into premiums, cash value growth, surrender values, riders.
6. IMPLICATION (1-2 scenes) — What the data means practically for the policyholder.
7. DISCLAIMER-CLOSE (1 scene) — Closing legal disclaimer.
8. ACTION (1 scene) — Clear next step.
```

**Financial Services:**
```
1. HOOK (1 scene) — Open with a compelling market insight or portfolio highlight.
2. DISCLAIMER (1 scene) — "This content is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. All investments involve risk, including possible loss of principal. Consult with a qualified financial advisor before making investment decisions."
3. CONTEXT (1-2 scenes) — Market overview, portfolio positioning, or financial planning context.
4. STAKES (1-2 scenes) — Why this matters for their financial future. The impact of action vs inaction.
5. EVIDENCE (3-8 scenes) — Performance data, allocation breakdowns, projections, comparisons.
6. IMPLICATION (1-2 scenes) — What the numbers mean for their goals — retirement, wealth building, etc.
7. DISCLAIMER-CLOSE (1 scene) — Closing compliance disclaimer.
8. ACTION (1 scene) — Clear next step toward their financial goals.
```

**Real Estate:**
```
1. HOOK (1 scene) — Open with the most compelling feature of the property or market insight.
2. CONTEXT (1-2 scenes) — Property overview, location highlights, or market conditions.
3. STAKES (1-2 scenes) — Why this property/market matters now. Urgency, opportunity, lifestyle impact.
4. EVIDENCE (3-8 scenes) — Property details, comparables, market data, neighborhood stats, financial breakdown.
5. IMPLICATION (1-2 scenes) — What this means for the buyer/seller — lifestyle, investment potential, timing.
6. ACTION (1 scene) — Schedule a showing, make an offer, or list their property.
```

**Mortgage & Lending:**
```
1. HOOK (1 scene) — Open with a rate comparison, savings opportunity, or purchasing power insight.
2. DISCLAIMER (1 scene) — "This is for informational purposes only. Rates and terms are subject to change and may vary based on creditworthiness and other factors. This is not a commitment to lend. Equal Housing Lender."
3. CONTEXT (1-2 scenes) — Loan overview, rate environment, or refinance opportunity.
4. STAKES (1-2 scenes) — Monthly payment impact, total interest savings, or purchasing power difference.
5. EVIDENCE (3-8 scenes) — Rate comparisons, payment breakdowns, amortization highlights, closing cost details.
6. IMPLICATION (1-2 scenes) — Long-term financial impact, total savings, or equity building timeline.
7. DISCLAIMER-CLOSE (1 scene) — Closing lending disclaimer.
8. ACTION (1 scene) — Get pre-approved or lock in their rate.
```

**Healthcare:**
```
1. HOOK (1 scene) — Open with a health insight, patient outcome, or wellness opportunity.
2. DISCLAIMER (1 scene) — "This content is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or qualified health provider with questions about a medical condition."
3. CONTEXT (1-2 scenes) — Health topic overview, who it affects, current understanding.
4. STAKES (1-2 scenes) — Why this matters for health outcomes. The impact of early action or awareness.
5. EVIDENCE (3-8 scenes) — Clinical data, treatment options, outcomes, prevention strategies.
6. IMPLICATION (1-2 scenes) — What this means for the patient/audience practically.
7. DISCLAIMER-CLOSE (1 scene) — Closing medical disclaimer.
8. ACTION (1 scene) — Schedule an appointment, get screened, or adopt the recommended approach.
```

**Legal:**
```
1. HOOK (1 scene) — Open with the legal issue at hand or a key right/protection the viewer should know about.
2. DISCLAIMER (1 scene) — "This content is for informational purposes only and does not constitute legal advice. No attorney-client relationship is formed by viewing this content. Laws vary by jurisdiction. Consult with a qualified attorney for advice specific to your situation."
3. CONTEXT (1-2 scenes) — Legal landscape, relevant laws, or case background.
4. STAKES (1-2 scenes) — What's at risk. Rights, obligations, potential consequences.
5. EVIDENCE (3-8 scenes) — Legal analysis, key provisions, case comparisons, regulatory requirements.
6. IMPLICATION (1-2 scenes) — Practical implications for the viewer. What they should understand.
7. DISCLAIMER-CLOSE (1 scene) — Closing legal disclaimer.
8. ACTION (1 scene) — Consult an attorney, review documents, or take protective action.
```

**Consulting:**
```
1. HOOK (1 scene) — Open with the business challenge or opportunity that demands attention.
2. CONTEXT (1-2 scenes) — Current state assessment, market position, or organizational context.
3. STAKES (1-2 scenes) — The cost of inaction. Competitive pressure, missed opportunity, or growing risk.
4. EVIDENCE (3-8 scenes) — Data analysis, benchmarks, framework walkthrough, case studies, recommendations.
5. IMPLICATION (1-2 scenes) — Expected outcomes, ROI projections, transformation timeline.
6. ACTION (1 scene) — Engage on the next phase, schedule a deep dive, or approve the roadmap.
```

**Education:**
```
1. HOOK (1 scene) — Open with the learning outcome or career opportunity this education unlocks.
2. CONTEXT (1-2 scenes) — Program overview, who it's for, what skills or knowledge they'll gain.
3. STAKES (1-2 scenes) — Why this learning matters now. Career advancement, skill gaps, industry demand.
4. EVIDENCE (3-8 scenes) — Curriculum highlights, instructor credentials, student outcomes, program features.
5. IMPLICATION (1-2 scenes) — Career impact, earning potential, or personal growth outcomes.
6. ACTION (1 scene) — Enroll, request information, or take the next step in their learning journey.
```

**Accounting & Tax:**
```
1. HOOK (1 scene) — Open with a tax savings opportunity, financial insight, or deadline awareness.
2. DISCLAIMER (1 scene) — "This content is for informational purposes only and does not constitute tax or accounting advice. Tax laws change frequently and vary by jurisdiction. Consult with a qualified CPA or tax professional for advice specific to your situation."
3. CONTEXT (1-2 scenes) — Financial overview, tax landscape, or accounting principles context.
4. STAKES (1-2 scenes) — What's at risk: penalties, missed deductions, cash flow impact, compliance issues.
5. EVIDENCE (3-8 scenes) — Numbers breakdown, tax strategies, financial comparisons, regulatory requirements.
6. IMPLICATION (1-2 scenes) — Bottom-line impact, savings realized, or compliance achieved.
7. DISCLAIMER-CLOSE (1 scene) — Closing tax/accounting disclaimer.
8. ACTION (1 scene) — Schedule a review, file by deadline, or implement the strategy.
```

**Technology:**
```
1. HOOK (1 scene) — Open with the problem this technology solves or the transformation it enables.
2. CONTEXT (1-2 scenes) — Technology landscape, current challenges, or what exists today.
3. STAKES (1-2 scenes) — Cost of outdated systems, competitive disadvantage, or security risks.
4. EVIDENCE (3-8 scenes) — Features, architecture, performance metrics, case studies, integrations.
5. IMPLICATION (1-2 scenes) — Business impact: efficiency gains, cost reduction, competitive advantage.
6. ACTION (1 scene) — Start a trial, schedule a demo, or begin implementation.
```

**Human Resources:**
```
1. HOOK (1 scene) — Open with the people challenge or opportunity this addresses.
2. CONTEXT (1-2 scenes) — Workforce landscape, organizational needs, or policy overview.
3. STAKES (1-2 scenes) — Impact on retention, culture, productivity, or compliance.
4. EVIDENCE (3-8 scenes) — Data on outcomes, program details, policy breakdowns, benchmarks.
5. IMPLICATION (1-2 scenes) — Impact on employee experience, organizational health, or bottom line.
6. ACTION (1 scene) — Implement the program, enroll in benefits, or take the next HR step.
```

**Sales & Marketing:**
```
1. HOOK (1 scene) — Open with the result or transformation the product/service delivers.
2. CONTEXT (1-2 scenes) — Market positioning, who this is for, the problem being solved.
3. STAKES (1-2 scenes) — The cost of the status quo. What competitors are doing. The urgency.
4. EVIDENCE (3-8 scenes) — Product features, ROI data, case studies, testimonials, comparisons.
5. IMPLICATION (1-2 scenes) — The future with this solution. Success metrics and outcomes.
6. ACTION (1 scene) — Clear, compelling call-to-action with urgency.
```

**General (fallback):**
```
1. HOOK (1 scene) — Open with the most compelling insight or key takeaway from the document.
2. CONTEXT (1-2 scenes) — Set the stage. What is this about? Who is it for?
3. STAKES (1-2 scenes) — Why this matters. What's the impact or opportunity?
4. EVIDENCE (3-8 scenes) — Deep dive into the key data, findings, and details.
5. IMPLICATION (1-2 scenes) — What does this all mean practically?
6. ACTION (1 scene) — Clear next step for the viewer.
```

### Narration Rules (Complete List)

All narration rules enforced across all script types:

**Writing for Speech:**
- Write for the EAR, not the eye
- Short, punchy sentences. Vary sentence length for natural rhythm
- Use contractions: "you'll", "that's", "it's" (not "you will", "that is", "it is")
- Use active voice: "Your policy grows to $50,000" not "The cash value is projected to grow to $50,000"
- Address viewer directly: "your", "you", "you'll"

**Banned Phrases:**
- "it's important to note"
- "as you can see"
- "let's take a look at"
- "the data shows"
- "the evidence suggests"
- "it's worth noting"
- "as we mentioned"
- "moving on to"
- "in conclusion"
- "it goes without saying"
- "at the end of the day"
- "in this video"
- "in today's presentation"

**Banned Sentence Starters:**
- "Now,"
- "So,"
- "Additionally,"
- "Furthermore,"

**Banned Filler:**
- "As a matter of fact"
- "The truth is"
- "Believe it or not"

**Number Pronunciation:**
- Phone numbers: each digit spoken with natural grouping ("one, eight six six, seven five two, eight zero zero two")
- Money: spoken words ("twenty five thousand dollars" not "$25,000")
- Percentages: spoken ("seven point five percent" not "7.5%")
- Dates: spoken ("January fifteenth, twenty twenty six" not "1/15/2026")
- No literal dashes: "state of the art" not "state-of-the-art"
- No symbols: write "at" not "@", "and" not "&"
- URLs: "visit their website" not spelled out

**Medium Awareness (video, not website):**
- Never: "click here", "scroll down", "fill out the form below", "see below", "the link above", "submit your information"
- Instead: "visit our website", "give us a call", "reach out to us", "get in touch"

**Narrative Intelligence:**
- Open with a HOOK, not a greeting
- Don't repeat company name every sentence
- Don't read bullet points — explain WHY each matters
- Pick 3-5 most important features, explain BENEFIT not feature
- Translate jargon first time, then simplify
- Paraphrase testimonials naturally
- FAQ content: state facts directly, don't Q&A format
- "About Us" content: focus on what VIEWER gets

**Contact Info Rules:**
- Contact info ONLY in LAST scene narration
- If contact exists: ONE clear CTA (phone OR website), be confident
- If NO contact: "Thank you for watching" only
- Don't end with "Thank you for watching" if real contact info exists

**Data Integrity:**
- Only state facts from source data VERBATIM
- Zero tolerance for invented information
- Never invent phone numbers, URLs, emails
- Never say "visit our website" unless exact URL is in data

### Detail Levels

Three detail levels control video length:

```
quick:    "VIDEO LENGTH: HIGHLIGHTS — 3-4 scenes, under 60 seconds. Only the top 2-3 key points. Keep narration brief."

standard: "VIDEO LENGTH: STANDARD — Cover all major points with reasonable depth. 6-12 scenes. Each scene should fully explain its topic."

detailed: "VIDEO LENGTH: DETAILED — This must be a LONG, THOROUGH video. Requirements:
- Cover EVERY data point, metric, section, and detail in the source
- Each scene should have 100-200 words of narration — explain thoroughly, give context, provide examples
- Do NOT summarize — EXPAND on each point. Explain what it means, why it matters, how it works
- If a section has multiple sub-points, give each sub-point its own scene
- Add context scenes: explain background, industry context, why the viewer should care
- Target 5-15 minutes minimum. If you create less than 10 scenes, you are not being thorough enough.
- This should feel like a comprehensive training walkthrough, not a summary"
```

### Contact Info Handling

Contact info flows through the system from multiple sources:

1. **Source priority for contact info:**
   - Brand guide data (`brand.brand_guide_data.phone/email/calendly`)
   - Extracted data (`policyData.contactPhone`, `policyData.contactInfo.phone`)
   - Brand website

2. **In script generation:** Contact info is passed as a separate parameter and injected into the prompt:
   ```
   CONTACT INFO (MUST be included in the closing scene narration AND on the closing slide):
   Phone: ...
   Email: ...
   Website: ...
   The narrator should mention these naturally in the last scene. Display them on the closing slide.
   For phone numbers in narration: spell out naturally ("five five five, one two three, four five six seven")
   For websites in narration: just say "visit their website" — the URL will be on the slide.
   ```

3. **Post-generation injection:** If the last scene has fewer than 30 words (likely just "thank you"), contact info is programmatically injected:
   ```
   "Thank you for watching. To learn more, give us a call at [phone], email us at [email], or visit our website for more information. We look forward to hearing from you."
   ```

### Voice Descriptions (for Script Tone Matching)

```typescript
const map: Record<string, string> = {
  nova: 'warm female voice',
  shimmer: 'warm female voice',
  onyx: 'deep male voice',
  echo: 'deep male voice',
  alloy: 'neutral voice',
  fable: 'expressive British male voice',
}
```

When a voice is selected, this instruction is added:
```
VOICE STYLE: The narration will be read by a [voice description]. Write the script to match this voice's natural speaking style.
```

### Demo Script Generation

A separate function `generateDemoScript` creates short 3-scene demo videos from brand data:

```
You are a professional scriptwriter creating a SHORT demo explainer video about a company.

COMPANY INFO:
- Name: ${brandData.companyName}
- Tagline: ${brandData.tagline}
- Description: ${brandData.description}
- Services: ${servicesText}
- What makes them different: ${uspsText}

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
```

### Podcast / Two-Narrator Mode

When `narrationStyle === 'podcast'`, a dialogue-based script is generated:

**Speaker configuration (serious industries: insurance, finance, legal, healthcare, medical):**
- Speaker 1 (Alex): voice `ash`, "Speak as a clear, professional narrator. Warm but authoritative. Steady pace, confident delivery."
- Speaker 2 (Jordan): voice `shimmer`, "Speak as a thoughtful co-narrator. Professional, clear, and engaged. Ask purposeful questions that advance the topic."

**Speaker configuration (other industries):**
- Speaker 1 (Alex): voice `coral`, "Speak as an engaging, professional narrator. Warm and clear. Present information with energy but not forced enthusiasm."
- Speaker 2 (Jordan): voice `ash`, "Speak as a knowledgeable co-narrator. Professional and direct. Ask smart questions and add context."

**Podcast-specific rules:**
- Write the ENTIRE conversation first as a natural flowing dialogue, THEN divide into scenes
- Use transition phrases: "and speaking of...", "that actually connects to...", "building on that..."
- Reference earlier points: "you mentioned earlier that...", "going back to what you said about..."
- Vary who leads — sometimes Speaker 2 introduces a new topic
- Include natural connective tissue: "right", "exactly", "mm-hmm", "that makes sense"
- 2-3 exchanges per scene, alternating speakers
- Keep each line 1-2 sentences
- Professional but warm — like two smart colleagues briefing each other

### JSON Output Format

**Solo narrator:**
```json
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
    "narration": "what the narrator SAYS",
    "slidePrompt": "brief visual concept for the slide background/style",
    "duration": 15
  }
]
```

**Podcast mode adds:**
```json
"dialogue": [
  { "speaker": "Alex", "voice": "coral", "instructions": "...", "text": "what this speaker says" },
  { "speaker": "Jordan", "voice": "ash", "instructions": "...", "text": "what this speaker says" }
]
```

---

## 5. Slide Generation

### Prompt Building

**File:** `app/_lib/slide-engine/simple-prompt.ts`

Each slide is generated as a 1920x1088 pixel image. The prompt builder (`buildSimpleSlidePrompt`) constructs prompts based on slide type:

**Cover slides:**
```
This is a COVER/TITLE slide — bold, cinematic, first impression.
Title: "${headline}"
Subtitle: "${subtitle}"
```

**Closing slides:**
```
Closing slide. "${headline}"
"${brandName}"
Phone: ${contactInfo.phone}
Email: ${contactInfo.email}
Website: ${contactInfo.website}
```
(If no contact info: `Show brand name large with "Thank You" below.`)

**Content slides:**
```
Title: "${headline}"
Subtitle: "${subtitle}"
Key stats:
- ${label}: ${value}
Key points:
- ${bulletText}
```

**Base prompt template (all slides):**
```
Create a professional presentation slide, 1920x1088 pixels.

${stylePrompt}
Colors: primary ${brandColors.primary}, accent ${brandColors.secondary}.
Glossy, polished finish — subtle glass reflections, soft glows behind key elements, depth with layered shadows.

${contentLines}

Rules: Show only the text listed above. Spell everything exactly. 80px padding. No logo. Keep top-right corner clear.
```

**Narration context injection:** When narration is available, slides include:
```
CONTEXT: While this slide is showing, the narrator is saying: "${narrationContext}". The slide content MUST match this topic.
```

### Style Templates (All 64)

Each style is a concise visual description string. Here are all available templates:

| ID | Name | Description |
|----|------|-------------|
| `executive` | Executive | Deep navy gradient, gold accent lines, premium boardroom feel |
| `steampunk` | Steampunk | Aged dark metal, brass gears, copper frames, warm amber lighting |
| `urban-friday` | Urban Friday | Dark backgrounds, bold neon text, street art, club poster energy |
| `profile-resume` | Profile Resume | Clean white, sidebar accent, corporate typography |
| `neon-cyber` | Neon Cyber | Dark background, vibrant neon glows, circuit patterns, sci-fi |
| `glassmorphism` | Glassmorphism | Frosted glass panels, blur effect, gradient background |
| `watercolor` | Watercolor | Soft painted washes, organic shapes, brush strokes, pastels |
| `chalkboard` | Chalkboard | Dark chalk surface, hand-drawn chalk text, chalk dust |
| `art-deco` | Art Deco | Geometric symmetry, gold and black, 1920s Gatsby elegance |
| `medical-journal` | Medical Journal | Clean white, blue/teal accents, clinical typography |
| `legal-brief` | Legal Brief | Off-white parchment, serif typography, formal layout |
| `commercial-pro` | Commercial Pro | Sleek dark background, bold white text, luxury real estate |
| `comic-book` | Comic Book | Bold outlines, halftone dots, speech bubbles, primary colors |
| `marble-gold` | Marble & Gold | White marble, gold foil accents, elegant serif typography |
| `neubrutalism` | Neubrutalism | Bold black outlines, offset colored shadows, raw typography |
| `terminal` | Terminal | Black background, green monospace text, matrix-style |
| `social-grid` | Social Grid | Instagram-inspired cards, rounded corners, gradient accents |
| `blue-steps` | Blue Steps | Numbered circles connected by lines, blue gradient, corporate |
| `isometric` | Isometric | Geometric 3D shapes, depth perspective, tech illustration |
| `flat-vector` | Flat Vector | Clean minimal, bold flat colors, geometric shapes |
| `doodle` | Doodle | Sketched elements, notebook paper, marker accents |
| `line-art` | Line Art | Elegant single-weight lines, minimal color, architectural |
| `vintage-craft` | Vintage Craft | Aged paper textures, stamp typography, earthy colors |
| `flat-cartoon` | Flat Cartoon | Colorful character illustrations, rounded shapes, friendly |
| `colorful-steps` | Colorful Steps | Vibrant multi-colored step cards, rainbow progression |
| `timeline` | Timeline | Timeline with dated milestones, connecting lines |
| `anime-pop` | Anime Pop | Bold vibrant colors, manga typography, speed lines |
| `felt-craft` | Felt Craft | Textured felt backgrounds, stitched borders, cozy |
| `botanical-warm` | Botanical Warm | Illustrated leaves/flowers, warm earth tones |
| `vintage-editorial` | Vintage Editorial | Magazine layout, large serif headlines, sepia tones |
| `torn-collage` | Torn Collage | Ripped paper layers, mixed media, scrapbook aesthetic |
| `inventor-box` | Inventor Box | Technical drawing, blue grid paper, patent illustration |
| `cafe-realistic` | Cafe Guide | Warm coffee shop, wooden textures, lifestyle photography |
| `old-newspaper` | Old Newspaper | Yellowed newsprint, column layout, typewriter font |
| `paper-layers` | Paper Layers | Stacked cut paper, subtle shadows, origami-inspired |
| `street-graffiti` | Street Graffiti | Spray paint textures, brick wall, urban street art |
| `urban-chaos` | Urban Chaos | Layered city textures, gritty, concrete and steel |
| `urban-canvas` | Urban Canvas | Street art on clean walls, gallery-quality urban art |
| `neon-nightclub` | Neon Nightclub | Dark venue, vivid neon lights, DJ booth energy |
| `brick-blocks` | Brick Blocks | LEGO-inspired pixel blocks, bright colors, playful |
| `cinematic-hud` | Cinematic HUD | Sci-fi heads-up display, targeting brackets, military tech |
| `americana-poster` | Americana Poster | Vintage US propaganda, stars and stripes, patriotic |
| `black-label` | Black Label | Premium dark, minimalist white/gold typography, exclusive |
| `fire-vibes` | Fire Vibes | Dark with flame effects, ember particles, intense energy |
| `summer-fest` | Summer Fest | Bright sunny colors, palm trees, tropical, beach party |
| `indie-zine` | Indie Zine | DIY cut-and-paste, xerox texture, punk typography |
| `red-neon` | Red Neon | Dark with red neon glow, moody atmosphere |
| `editorial` | Editorial | High-fashion magazine, bold typography, generous whitespace |
| `rock-poster` | Rock Poster | Concert poster, distressed textures, skull/lightning motifs |
| `street-grunge` | Street Grunge | Dirty textures, torn edges, spray paint, 90s alternative |
| `stock-certificate` | Stock Certificate | Ornate border engraving, formal certificate, embossed seal |
| `vintage-bond` | Vintage Bond | Classic financial document, ornate scrollwork, treasury |
| `nightclub-flyer` | Nightclub Flyer | Flashy dark, bold event typography, party atmosphere |
| `concert-poster` | Concert Poster | Dramatic band imagery, bold stacked text, rock show |
| `movie-poster` | Movie Poster | Cinematic hero shot, dramatic lighting, blockbuster feel |
| `festival` | Festival | Psychedelic patterns, bohemian colors, outdoor music |
| `scientific-paper` | Scientific Paper | Academic layout, scatter plots, citation numbers |
| `collage-scrapbook` | Collage Scrapbook | Kraft paper, washi tape, polaroids, handmade |
| `gradient-mesh` | Gradient Mesh | Smooth flowing color gradients, abstract organic shapes |
| `newspaper` | Newspaper | Broadsheet columns, bold headlines, daily news aesthetic |
| `travel-magazine` | Travel Magazine | Stunning destination imagery, elegant typography, luxury |
| `luxury` | Luxury | Premium dark, gold foil accents, elegant serif, exclusive |

**Default fallback:** `executive`

**Custom brand style:** If a brand has custom colors (not the default `#1B365D`), a dynamic style prompt is generated:
```
Modern, visually striking presentation style. Primary brand color: ${brand.primary_color}, secondary: ${brand.secondary_color}. Use these colors boldly — gradient backgrounds, colored accent panels, glowing highlights, subtle patterns. Mix light and dark sections for visual variety. Each slide should feel like a premium design portfolio piece — creative layouts, interesting typography hierarchy, layered depth with shadows and glass effects. NOT a boring corporate template — make it look like a designer crafted each slide by hand. Think Apple keynote meets luxury brand lookbook.
```

### Slide Rules

- 1920x1088 pixel resolution
- Show only the text listed in the prompt — spell everything exactly
- 80px padding on all sides
- No logo rendered on slides (logos are composited separately by Sharp on cover/closing slides)
- Keep top-right corner clear (for logo compositing)
- Glossy, polished finish with subtle glass reflections, soft glows, layered shadows
- Contact info patterns are filtered from content slide bullets via regex

---

## 6. Voice & Audio

### Available Voices (All IDs and Descriptions)

**File:** `app/_lib/types.ts` — `VOICE_OPTIONS` array

| Voice ID | Display Name | Gender | Description |
|----------|-------------|--------|-------------|
| `nova` | Sarah | Female | Friendly and warm — most popular |
| `shimmer` | Emily | Female | Gentle and reassuring |
| `onyx` | James | Male | Deep and authoritative |
| `echo` | Michael | Male | Warm and conversational |
| `alloy` | Alex | Neutral | Professional and balanced |
| `fable` | Oliver | Male | Expressive with British accent |

**Default voice:** Sarah (nova) — first in the array, female.

### TTS Configuration

**File:** `app/_lib/tts.ts`

- **Provider:** OpenAI TTS-HD (model: `tts-1-hd`)
- **Speed:** 0.95 (slightly slower than default for clarity)
- **Format:** MP3
- **Max input:** 4096 characters (OpenAI limit, text is sliced)
- **Retry logic:** 3 attempts with exponential backoff (1s, 2s, 3s)
- **Timeout:** 30 seconds per attempt (AbortController)
- **Minimum audio size:** 100 bytes (below this, considered invalid)

**Fallback on failure:**
1. Try generating a pause audio ("..." spoken by `alloy` voice)
2. Last resort: Generate a minimal valid MP3 file header (417 bytes of silence, repeated 76 times)

**Scene processing:** Scenes are processed sequentially (not parallel) via `synthesizeAllScenes`. Each scene's narration is individually synthesized.

**Empty narration guard:** If narration text is empty/whitespace, silence is generated instead of calling TTS.

### Phone Number Formatting (formatForTTS)

**File:** `app/api/generate-video/route.ts`

The `formatForTTS` function converts written numbers to spoken words before sending to TTS:

```typescript
function formatForTTS(text: string): string {
  // Phone numbers: 1-800-441-1417, (800) 441-1417, 800.441.1417, +1 800 441 1417
  // -> "one, eight zero zero, four four one, one four one seven"
  
  // Percentages: 7.5% -> "seven point five percent"
}
```

**Digit word map:** `0`=zero, `1`=one, `2`=two, `3`=three, `4`=four, `5`=five, `6`=six, `7`=seven, `8`=eight, `9`=nine

**Phone number regex:** `/\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g`

Handles formats: `1-800-441-1417`, `(800) 441-1417`, `800.441.1417`, `+1 800 441 1417`

11-digit numbers starting with "1" prefix it with "one" then group the remaining 10 digits as 3-3-4.

### Music Generation

**File:** `app/_lib/music-generator.ts`

**Provider:** Google Lyria 2 (via Gemini API — same API key, no additional service)

**Music prompt building (`buildMusicPrompt`):**

The system auto-detects content type and chooses appropriate music:

| Content Type | Keywords | Music Style |
|-------------|----------|-------------|
| Insurance/Life | insurance, policy, life | Gentle piano with soft strings, warm and reassuring, professional corporate tone, slow tempo |
| Financial/Business | financ, business, invest, bank, revenue | Modern ambient corporate, subtle synth pads, confident and sophisticated |
| Education/Training | educat, learn, school, training, course | Light acoustic guitar, friendly and approachable, medium tempo |
| Technology | tech, software, digital, ai, cloud | Clean electronic ambient, modern and innovative, medium-upbeat tempo |
| Default | (anything else) | Gentle ambient piano with subtle pads, professional and warm, medium tempo |

All prompts append: `Instrumental only, no vocals, background music suitable for narration overlay. Target duration: approximately ${scenes.length * 25} seconds`

**Music generation process:**
1. Call Lyria 2 model via Gemini API with `responseModalities: ['AUDIO']`
2. Extract audio data from inline response parts
3. Verify audio is at least 1000 bytes
4. Upload WAV file to Supabase storage (`music/lyria-{timestamp}.wav`)
5. Return public URL

---

## 7. Video Assembly

### FFmpeg Pipeline

Video assembly runs on the Hetzner VPS (`VIDEO_ASSEMBLY_URL`). The Next.js app sends a POST to `/generate` with:

```json
{
  "videoId": "uuid",
  "voiceId": "nova",
  "scenes": [/* scene array */],
  "userId": "uuid",
  "slidePrompts": ["prompt1", "prompt2", ...],
  "logoUrl": "https://...",
  "musicPrompt": "...",
  "industry": "insurance",
  "narrationStyle": "solo"
}
```

The VPS handles: slide image generation (Gemini), TTS synthesis (OpenAI), music generation (Lyria 2), logo compositing (Sharp), and final FFmpeg assembly — all in parallel where possible.

### Logo Compositing

Logos are composited onto cover and closing slides using Sharp (not Gemini — Gemini must NEVER draw logos). The slide prompt includes `No logo. Keep top-right corner clear.` so there's clean space for the logo overlay.

Logo processing during brand scraping:
- Resize to 512x512 (contain, no enlargement, transparent background)
- Lanczos3 kernel for sharp edges
- Sharpen with sigma 1.2
- Output as high-quality PNG

### Scene Cleaning

Before sending to VPS, scenes undergo several cleaning steps:

1. **Brand name replacement:** `{{BRAND_NAME}}` placeholder replaced with actual brand name
2. **Fake phone stripping:** Any phone number in narration/slide data is checked against the original source data. If the digits don't exist in the source, the number is stripped. Logged as `Stripped invented phone: ...`
3. **"undefined" removal:** Literal string "undefined" is removed
4. **Whitespace collapse:** Multiple spaces collapsed to single
5. **Empty scene removal:** Scenes with fewer than 5 words of narration are removed (except closing/action scenes which are always preserved)
6. **Scene renumbering:** After removals, scenes are renumbered sequentially
7. **TTS formatting:** `formatForTTS()` converts phone numbers and percentages to spoken words

**Contact info bullet filtering on slides:**
```javascript
const contactPattern = /\b(?:\d{3}[-.\s]?\d{3,4}[-.\s]?\d{4}|\+\d{2}|@\w+\.\w+|www\.\w+|\.co\.uk|\.com\/|contact us|call us|reach out|get in touch|visit our)\b/i
```
Bullets matching this pattern are stripped from content slides (they should only appear on closing slide).

### Contact Info Injection

Contact info is injected into the closing slide and narration:

**Slide:** The closing `SimpleSlideInput` includes `contactInfo` (phone, website, email, calendly) which renders in the slide prompt.

**Narration:** If the last scene has fewer than 30 words, contact info is programmatically injected:
```
Thank you for watching. To learn more, give us a call at [phone], email us at [email], or visit our website for more information. We look forward to hearing from you.
```

---

## 8. Script Chat (AI Editor)

**File:** `app/api/script-chat/route.ts`

### System Prompt

```
You are a professional script editor assistant. The user has a video script with ${scenes.length} scenes. Video purpose: "${purpose || 'informational video'}".

${sourceRef ? `ORIGINAL SOURCE DATA (use this to verify facts, correct errors, and find missing information):
${sourceRef}

When the user says something is wrong or asks for corrections, LOOK UP the correct information from the source data above. Do not guess — use the exact facts from the source.` : ''}

You MUST respond with a JSON object in one of these formats:

FORMAT 1 — When you EDIT existing scenes:
{
  "changes": [
    { "index": 0, "title": "new title", "narration": "new narration text", "slideData": { "headline": "...", "bullets": ["..."], "stats": [...] } },
    { "index": 4, "narration": "only changed narration — other fields stay the same" }
  ],
  "summary": "What you changed and why",
  "suggestion": "Optional follow-up suggestion, or null"
}
Only include the fields you actually changed. "index" is 0-based (scene 1 = index 0).

FORMAT 1B — When you ADD or DELETE scenes (structural changes):
{
  "scenes": [/* COMPLETE array of ALL scenes */],
  "summary": "What you changed",
  "suggestion": "Optional suggestion, or null"
}
Use this format ONLY when adding new scenes, deleting scenes, or reordering. For simple edits, use FORMAT 1 with "changes".

FORMAT 2 — When you need clarification:
{
  "reply": "Your question to the user — be specific about what you need to know",
  "options": ["Option A", "Option B", "Option C"]
}

FORMAT 3 — When answering a question:
{
  "reply": "Your answer"
}

BEHAVIOR RULES:
- If the request is clear, make the changes and explain what you did in "summary"
- If the request is vague (e.g. "make it better", "fix it"), ask ONE clarifying question with specific options
- After making changes, include a proactive "suggestion" if you notice something that could be improved
- Always preserve scene structure: scene (number), title, narration, slideData, slidePrompt, duration
- Renumber scenes if adding or deleting
- NEVER invent contact info, phone numbers, URLs, or emails
- Keep the summary under 2 sentences — concise and specific

CONTEXT AWARENESS (CRITICAL):
- Read the FULL conversation history above. When the user says "yes", "do it", "specific", "that one" — they are responding to YOUR previous message. Look at what you last suggested and act on it.
- NEVER ask "what would you like to change?" if you just suggested something and they agreed. Just do it.
- If user picked an option you offered, execute that option immediately — don't ask again.
- You have access to the original source data. Use it to find real facts, pricing, competitors, features.
- If user asks about competitors or market info that's not in the source, say what you know and suggest they verify, but provide useful content.
- Users may paste large blocks of text as reference material. Use that content to update the script as requested.
- If a URL is detected in the message, web content from that URL will be provided below. Use it.
```

### Change Formats

| Format | When Used | Structure |
|--------|-----------|-----------|
| Format 1 (Diff) | Editing existing scenes | `{ changes: [{index, title?, narration?, slideData?}], summary, suggestion }` |
| Format 1B (Full) | Adding/deleting/reordering scenes | `{ scenes: [/* all scenes */], summary, suggestion }` |
| Format 2 (Clarify) | Need more info from user | `{ reply: "question", options: ["A", "B", "C"] }` |
| Format 3 (Answer) | Answering a question | `{ reply: "answer" }` |

### Conversation Memory

- Full conversation history is passed via the `history` parameter (array of `{role, text}`)
- History is mapped to OpenAI message format and included before the current user message
- The current script state is always sent with each message: `Current script:\n${JSON.stringify(scenes)}`
- Source data (up to 15,000 chars) is included for fact verification

### Web Research in Chat

The chat system can scrape URLs mentioned in messages:
- Detects full URLs (`https://...`) and domain-like strings (`word.com`, `word.io`, etc.)
- Scrapes via Firecrawl (markdown format, up to 10,000 chars)
- Injected into the system prompt as `WEB RESEARCH (scraped from ${url})`

**Model:** GPT-4o-mini, temperature 0.5, max_tokens 8000

---

## 9. Brand System

**File:** `app/_lib/brand-scraper.ts`

### Brand Analysis Prompt

```
You are a professional brand strategist. Extract brand information ONLY from the text provided below. Do NOT add, invent, or guess any information not present in this text.

Website: ${fullUrl}
Page title: ${titleMatch}
Meta description: ${descMatch}

EXACT WEBSITE CONTENT (scraped by web crawler — use ONLY this data):
${pageText.slice(0, 15000)}

Structured data (JSON-LD):
${jsonLd}

CSS colors found: ${allColors.join(', ')}
Fonts found: ${fonts.join(', ')}
Social links found: ${JSON.stringify(socialLinks)}

CRITICAL COLOR INSTRUCTIONS:
- Do NOT just pick random CSS hex codes from the list above. Many of those are framework defaults (like #000, #fff, #f8f9fa, #e2e8f0).
- Instead, identify the ACTUAL BRAND COLORS — the colors used for the company logo, main headings, buttons, accent elements, and hero sections.
- The primary color should be the brand's main identifier (usually the logo color or the dominant color on buttons/headers).
- If a logo image is attached, extract the primary color DIRECTLY from the logo.
- Look at the attached logo image carefully — the main color in the logo IS the primary brand color.

Create a comprehensive brand analysis. Return ONLY valid JSON (no markdown, no code fences):
{
  "companyName": "string",
  "tagline": "string (the company's tagline or slogan)",
  "description": "string (2-3 sentence brand description)",
  "industry": "string (what industry/niche)",
  "tone": "string (brand voice - professional, friendly, luxury, playful, authoritative, etc.)",
  "targetAudience": "string (who they serve - be specific)",
  "primaryColor": "#hex (THE MAIN BRAND COLOR — from the logo or dominant UI elements, NOT a framework default)",
  "secondaryColor": "#hex",
  "accentColor": "#hex",
  "backgroundColor": "#hex",
  "textColor": "#hex",
  "fonts": ["array of font families found or recommended"],
  "brandValues": ["array of 3-5 core values the brand communicates"],
  "services": ["array of main services/products offered"],
  "uniqueSellingPoints": ["array of 3-5 things that make them different"],
  "contentThemes": ["array of 5-8 content themes/topics they should post about on social media"],
  "socialMediaBio": "string (suggested social media bio based on brand identity)",
  "hashtagSuggestions": ["array of 10-15 relevant hashtags"],
  "toneGuide": {
    "doSay": ["phrases/approaches that match the brand"],
    "dontSay": ["phrases/approaches to avoid"],
    "samplePosts": ["3 example social media post captions in their brand voice"]
  },
  "competitorNotes": "string (observations about positioning based on the website)",
  "colorPsychology": "string (why these colors work for this brand)"
}
```

**Model:** GPT-4o-mini, temperature 0.3

### Logo Detection

Logo detection uses a priority-based scoring system. Multiple sources are tried and scored:

**Logo sources (by priority):**

1. **Header/Nav images (priority 10-11):** Images inside `<header>` or `<nav>` tags. Srcset versions get priority 11.
2. **Images with "logo" in class/alt/src (priority 6-8):** Any `<img>` with "logo" in attributes. Srcset versions get priority 8.
3. **Apple Touch Icon (priority 4):** `<link rel="apple-touch-icon">` — usually 180x180.
4. **og:image (priority 2):** Often a hero image, not the logo, so lowest priority.
5. **Google Favicon (fallback):** `https://www.google.com/s2/favicons?domain=${domain}&sz=256`
6. **Common direct paths (last resort):** `/apple-touch-icon.png`, `/logo.png`, `/images/logo.png`, `/assets/logo.png`, `/android-chrome-512x512.png`

**Logo scoring:**
- Base score = file size in bytes
- Wide logos (aspect ratio > 1.5) get +500,000 bonus (real logos with text are usually wide)
- Logos >= 400px wide get +100,000 bonus
- SVGs are excluded entirely
- Images under 500 bytes are skipped (tiny placeholders)

**WordPress handling:** Size suffixes like `-70x25.png` or `-300x150.jpg` are stripped to try the full-size original.

### Color Extraction

**From CSS/HTML (regex-based):**
- Hex colors: `/#[0-9a-fA-F]{6}\b/g`
- CSS custom properties with brand-related names: `--*primary*`, `--*brand*`, `--*accent*`, etc.
- Header/nav background colors
- Button background colors
- Link colors

**From logo image (Sharp-based, more reliable):**
1. Resize logo to 20x20 pixels
2. Read raw pixel data
3. Skip near-white, near-black, and gray pixels (saturation < 0.15)
4. Quantize colors (round to nearest 32)
5. Count occurrences, sort by frequency
6. Primary = most common saturated color, Secondary = second most common

**Priority:** Logo-extracted colors override AI-suggested colors.

### Font Extraction

Regex: `/font-family:\s*['"]?([^'";,}]+)/gi`

Extracts up to 8 unique font families from HTML/CSS.

### Social Links Detection

Regex patterns for: Facebook, Twitter/X, Instagram, LinkedIn, YouTube, TikTok, Pinterest.

---

## 10. Share Page Features

### Viewer Tracking

Share pages track viewer engagement. Each video has a unique share URL. The system tracks:
- View count
- Viewer identity (if captured via lead form)
- View timestamps

### Lead Capture

Share pages can include lead capture forms that collect viewer contact information before or after viewing the video.

### Promo Banners

Share pages support promotional banners displayed alongside the video.

### Downloads Available

Viewers can download:
- The video file (MP4)
- Individual slides (PNG images)

---

## Appendix: Industry Configuration Reference

Each industry has these fields:

| Field | Purpose |
|-------|---------|
| `id` | Machine identifier |
| `label` | Human-readable name |
| `keywords` | Array of terms for auto-detection (title matches count 3x) |
| `beatStructure` | Scene-by-scene storytelling framework |
| `terminology.use` | Preferred terms for this industry |
| `terminology.avoid` | Terms to avoid |
| `disclaimerRequired` | Whether legal disclaimer scenes are needed |
| `disclaimerText` | Opening disclaimer exact text |
| `closingDisclaimerText` | Closing disclaimer exact text |
| `tone` | Writing tone description |
| `ctaText` | Suggested call-to-action |
| `slideHints` | Visual guidance for slide design |
| `followUpTone` | Tone for follow-up communications |

**Industry auto-detection:** `detectIndustry()` counts keyword occurrences in title + content. Title matches get 3x weight. Minimum score of 2 required to avoid false positives. Falls back to `general`.

**All 13 industries:** Insurance, Financial Services, Real Estate, Mortgage & Lending, Healthcare, Legal, Consulting, Education, Accounting & Tax, Technology, Human Resources, Sales & Marketing, General.
