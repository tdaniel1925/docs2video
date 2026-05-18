# Docs2Video — AI Prompts Reference

Every AI prompt in the system, where it lives, which model it uses, and what it does.

---

## 1. Document Extraction

**File:** `app/_lib/gemini.ts` line 25
**Model:** Gemini 2.5 Pro
**Variable:** `GENERIC_EXTRACTION_PROMPT`
**Used by:** `/api/extract` (PDF/PPTX upload)

**Purpose:** Extracts structured data from any uploaded document. Returns JSON with title, subtitle, sections, key metrics, bullet points, disclaimers, and auto-detected industry.

**Key behaviors:**
- Creates sections from document content areas
- When `preserveAllPages=true` (narrate/redesign mode), adds instruction to create one section per page with no summarizing
- Auto-detects industry (insurance, financial, legal, etc.) but user can override via dropdown
- Extracts insurance-specific data (policy type, death benefit, cash value projections) when detected

**Prompt excerpt:**
```
You are an expert document analyzer. Analyze this document and extract ALL key information.
First, identify the document type...
Return ONLY valid JSON matching this exact structure...
```

---

## 2. Slide Image Generation

**File:** `app/_lib/gemini.ts` line 281
**Model:** Gemini 3 Pro Image (IMAGE_MODEL)
**Function:** `generateSlide()`
**Used by:** `/api/generate-video`, `/api/generate-slide`

**Purpose:** Generates 1920x1080 slide images. Uses a 6-component structured prompt (subject, action, environment, art style, lighting, details).

**Key behaviors:**
- Cover slides: "Create a beautiful DECORATIVE BACKGROUND for a cover slide" — NO text, NO logos (Sharp composites these afterward)
- Closing slides: Same decorative-only approach
- Content slides: "Create a professional CONTENT slide about the following topic" with key facts, icons, and data points
- Disclaimer slides: Renders legal text prominently
- Brand name is NOT passed to Gemini (set to null) — prevents fake logo rendering
- Logo buffer is NOT passed to Gemini — Sharp handles all logo placement
- Uses template reference images for visual consistency across slides
- Previous slide buffer used for style matching

**Rules in prompt:**
- 1920x1080 pixels, landscape, 16:9
- Maximum 50 words of visible text per slide
- Do NOT generate logos, lettermarks, or brand marks
- Do NOT generate photographs of human faces
- VERIFY every number matches the data provided

---

## 3. Script Generation (Generic)

**File:** `app/_lib/script-generator.ts` line 98
**Model:** Gemini 2.5 Pro
**Function:** `buildGenericScriptPrompt()`
**Used by:** `/api/generate-script`, `/api/generate-video`

**Purpose:** Creates video narration script from extracted document data. Outputs an array of scenes with narration text, slide prompts, and titles.

**Key behaviors:**
- Industry-aware: uses terminology, tone, and beat structure from user-selected industry config
- Video purpose (user-typed) injected as primary directive: shapes narrative, tone, emphasis, and CTA
- Scene count adapts to content:
  - Narrate/redesign mode: exactly one scene per section (preserves all content)
  - Summarize mode: adaptive 4-16 scenes based on content length
- Beat structure: HOOK, DISCLAIMER (if required), CONTEXT, STAKES, EVIDENCE, IMPLICATION, ACTION
- Voice rules: narrator never introduces themselves, starts with "Hello, and thank you for your time"
- Asset placement: supports [ASSET:1], [ASSET:2] tags for product images

**Prompt excerpt:**
```
You are a professional scriptwriter creating an explainer video narration...
CRITICAL RULE - DATA FIDELITY: ONLY use information that appears in the DOCUMENT DATA below.
INDUSTRY: {config.label}
TERMINOLOGY: Use these terms: {use}. Avoid: {avoid}
TONE: {config.tone}
```

---

## 4. Script Generation (Insurance)

**File:** `app/_lib/script-generator.ts` line 34
**Model:** Gemini 2.5 Pro
**Function:** `buildInsuranceScriptPrompt()`
**Used by:** `/api/generate-script`, `/api/generate-video`

**Purpose:** Specialized script for life insurance illustrations. Handles policy-specific data points.

**Key behaviors:**
- Structures around policy type, death benefit, premium, cash value projections
- Always includes disclaimer scenes (required by industry config)
- References specific insurance terminology
- Beat structure tailored for insurance: hook, disclaimer, context, stakes, evidence (policy data), implication, action, closing disclaimer

---

## 5. Text-to-Speech

**File:** `app/_lib/tts.ts` line 19
**Model:** Gemini 2.5 Flash Preview TTS (`gemini-2.5-flash-preview-tts`)
**Function:** `synthesizeSpeech()`
**Used by:** `/api/generate-video`, `/api/pre-generate-audio`

**Purpose:** Converts narration text to spoken audio.

**Key behaviors:**
- Voice mapping: nova->Kore, shimmer->Leda, onyx->Charon, echo->Puck, alloy->Zephyr, fable->Orus
- Input text passed directly (no wrapper prompt — model handles TTS natively)
- Returns raw PCM (24kHz, 16-bit mono), encoded to MP3 via lamejs
- Empty text guard: returns silence instead of crashing
- 3 retries with backoff, silence fallback on total failure
- Max 5000 characters per call

---

## 6. Music Generation

**File:** `app/_lib/music-generator.ts` line 9
**Model:** Google Lyria 2 (`lyria-2`)
**Function:** `buildMusicPrompt()` + `generateCustomMusic()`
**Used by:** `/api/generate-video`

**Purpose:** Generates background music matching the video content.

**Key behaviors:**
- `buildMusicPrompt()` analyzes content to select music style:
  - Insurance: "Gentle piano with soft strings, warm and reassuring"
  - Financial: "Modern ambient corporate, subtle synth pads"
  - Education: "Light acoustic guitar, friendly and approachable"
  - Tech: "Clean electronic ambient, modern and innovative"
  - Default: "Gentle ambient piano with subtle pads"
- Always instrumental, no vocals
- Target duration based on scene count x 25 seconds
- Generated audio uploaded to Supabase storage, URL returned
- Returns null on failure (video assembles without music)

---

## 7. Brand Website Scraping

**File:** `app/_lib/brand-scraper.ts` line ~180
**Model:** Gemini 2.5 Pro
**Function:** `scrapeBrand()`
**Used by:** `/api/scrape-brand`

**Purpose:** Extracts complete brand identity from a website URL.

**Key behaviors:**
- Fetches website HTML with browser-like headers
- Extracts: company name, tagline, industry, tone, target audience
- Extracts: colors (primary, secondary, accent, background, text)
- Extracts: fonts, brand values, services, USPs, content themes
- Generates: social media bio, hashtags, tone guide (do/don't), color psychology
- Logo upscaling: separate call to recreate logo in high resolution

**Prompt excerpt:**
```
You are a professional brand strategist. Analyze this website thoroughly
and create a complete brand guide. Website: ${fullUrl}...
```

---

## 8. Raw Text Extraction

**File:** `app/api/extract-text/route.ts` line ~8
**Model:** Gemini 2.5 Pro
**Used by:** Create wizard "Type or Paste" tab

**Purpose:** Extracts structured data from raw pasted text (notes, emails, bullet points, articles).

**Prompt excerpt:**
```
You are an expert content analyst. You will receive raw text that could be
meeting notes, an email, bullet points, a report, an article, or any other
form of written content...
```

---

## 9. Auto-Select (Template/Voice/Slides)

**File:** `app/api/auto-select/route.ts` line ~76
**Model:** Gemini 2.5 (text)
**Used by:** Quick mode (removed), potentially create wizard

**Purpose:** Recommends presentation settings based on document content.

**Returns:** templateId, voiceId, slideCount (5-12), mood

**Prompt excerpt:**
```
You are an AI that recommends presentation settings based on document content.
Given this document content: ${contentSummary}...
```

---

## 10. Sofia — Brand Kit Chat

**File:** `app/api/brand-kit/route.ts` line ~24
**Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)
**Used by:** Brand kit creation wizard

**Purpose:** AI brand strategist that guides users through brand discovery via conversation.

**Key behaviors:**
- Multi-turn conversation
- Gathers: company name, industry, audience, personality, color preferences
- When ready, outputs JSON brand brief with `readyToBuild: true`
- Used to generate color palettes and brand guide

**Prompt excerpt:**
```
You are Sofia, a world-class brand director with 20 years of experience
building iconic brand identities for companies ranging from startups to
Fortune 500s. You have a warm, confident...
```

---

## 11. Color Palette Generation

**File:** `app/api/brand-kit/route.ts` line ~130
**Model:** Gemini 2.5 Flash
**Used by:** Brand kit creation (after Sofia collects brief)

**Purpose:** Generates 3 distinct color palettes from a brand brief.

**Returns:** Array of 3 palettes, each with primary, secondary, accent, background, text colors.

---

## 12. Slide Editing

**File:** `app/api/edit-slide/route.ts` line ~35
**Model:** Gemini 3 Pro Image
**Used by:** Video detail page "Redo" button

**Purpose:** Edits an existing slide with natural language instructions.

**Prompt excerpt:**
```
Here is an existing presentation slide. Make the following change and return
the modified slide:

EDIT INSTRUCTION: ${instruction}

RULES:
- Keep everything else EXACTLY the same...
- Output must be EXACTLY 1920x1080 pixels, 16:9...
```

---

## 13. Demo Slide Generation

**File:** `app/api/demo-slide-gpt/route.ts` line ~25
**Model:** OpenAI GPT-4 Vision OR Gemini 2.5 Pro
**Used by:** Brand deck generation, template previews

**Purpose:** Generates/edits presentation slides from a text prompt with optional logo.

---

## 14. Logo Upscaling

**File:** `app/api/brand-kit/route.ts` line ~340
**Model:** Gemini 3 Pro Image
**Used by:** Brand kit creation

**Purpose:** Recreates a logo in high resolution from a low-quality source.

**Prompt excerpt:**
```
Recreate this logo in HIGH RESOLUTION. Exact same design, colors, text, and
layout. Output on pure white background, crisp clean edges, centered, square
format. Do NOT modify or redesign...
```

---

## 15. Structured Prompt Builder

**File:** `app/_lib/gemini.ts` (inline function `buildStructuredPrompt`)
**Model:** N/A (helper function)
**Used by:** `generateSlide()`

**Purpose:** Constructs image generation prompts using a 6-component formula:
1. Subject — what to show
2. Action — visual treatment
3. Environment — canvas/context
4. Art Style — template style prompt
5. Brand Name — (now null, not used)
6. Brand Colors — color palette for design

---

## Model Usage Summary

| Model | Used For | Cost Impact |
|-------|----------|-------------|
| Gemini 2.5 Pro | Extraction, script generation, brand scraping | Per-token |
| Gemini 3 Pro Image | Slide generation, slide editing, logo upscale | Per-image |
| Gemini 2.5 Flash TTS | Voice narration | Per-character |
| Lyria 2 | Background music | Per-generation |
| Claude Sonnet 4 | Sofia brand chat only | Per-token |
| OpenAI GPT-4 Vision | Demo slides (legacy, optional) | Per-image |
