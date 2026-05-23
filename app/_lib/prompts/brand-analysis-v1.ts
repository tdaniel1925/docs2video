export function buildBrandAnalysisPrompt(
  fullUrl: string,
  titleText: string | undefined,
  descText: string | undefined,
  pageText: string,
  jsonLd: string,
  allColors: string[],
  fonts: string[],
  socialLinks: Record<string, string>,
  hasLogoBuffer: boolean,
): string {
  return `You are a professional brand strategist. Extract brand information ONLY from the text provided below. Do NOT add, invent, or guess any information not present in this text.

Website: ${fullUrl}
${titleText ? `Page title: ${titleText}` : ''}
${descText ? `Meta description: ${descText}` : ''}

EXACT WEBSITE CONTENT (scraped by web crawler — use ONLY this data):
${pageText.slice(0, 15000)}

${jsonLd ? `Structured data (JSON-LD):\n${jsonLd}\n` : ''}

CSS colors found: ${allColors.join(', ')}
Fonts found: ${fonts.join(', ')}
Social links found: ${JSON.stringify(socialLinks)}
${hasLogoBuffer ? '\nA logo image from the website is attached below.' : ''}

CRITICAL COLOR INSTRUCTIONS:
- Do NOT just pick random CSS hex codes from the list above. Many of those are framework defaults (like #000, #fff, #f8f9fa, #e2e8f0).
- Instead, identify the ACTUAL BRAND COLORS — the colors used for the company logo, main headings, buttons, accent elements, and hero sections.
- The primary color should be the brand's main identifier (usually the logo color or the dominant color on buttons/headers).
- If a logo image is attached, extract the primary color DIRECTLY from the logo.
${hasLogoBuffer ? '- Look at the attached logo image carefully — the main color in the logo IS the primary brand color.' : ''}

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
}`
}
