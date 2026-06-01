import { SOURCE_DELIMITER_OPEN, SOURCE_DELIMITER_CLOSE, SOURCE_TRUST_FOOTER } from '../prompt-safety'

export const THEME_PROMPT = `You are an expert web designer analyzing a website's visual identity. Based on the HTML/CSS below, create a slide presentation style prompt that captures this website's look and feel.

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
- The style should work on a 16:9 presentation slide`

export const EXTRACTION_PROMPT = `You are an expert content analyst. You will receive raw text extracted from a web page.

Your job is to analyze the text and extract the most important information into a structured format.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "title": "string — a clear, concise title summarizing the content",
  "subtitle": "string or null — a supporting subtitle if appropriate",
  "source": "string or null — the source or origin of the content if identifiable",
  "companyName": "string or null — the exact company/organization name as written on the site (preserve apostrophes, capitalization)",
  "contactInfo": {
    "phone": "string or null — see CONTACT OWNERSHIP rules below",
    "email": "string or null — see CONTACT OWNERSHIP rules below",
    "website": "string or null — the main website URL",
    "address": "string or null — physical address of the entity the content is ABOUT"
  },
  "keyMetrics": [
    { "label": "string", "value": "string", "qualifier": "string or null — context like 'projected', 'as of Q4 2025', 'guaranteed', 'estimated', 'annual'", "highlight": true/false }
  ],
  "sections": [
    { "title": "string", "content": "string" }
  ],
  "bulletPoints": ["string"],
  "additionalNotes": ["string"],
  "truncated": false
}

CONTACT OWNERSHIP (critical — a wrong detail in a client video is dangerous):
- Extract ONLY the contact details that belong to the ENTITY THE CONTENT IS ABOUT.
- For ALL four fields (phone, email, website, address): if multiple values appear and it's unclear which belongs to the primary entity (e.g. footer host line, parent company, partner, generic 1-800 support, co-located business), return null for that field. A null is safe; a wrong value is not.
- Website is usually unambiguous (the page's own domain), but if the content is ABOUT a different entity than the hosting site, use the entity's website or null.
- NEVER guess or infer contact info that isn't explicitly stated.

Rules:
- COMPANY NAME: Extract the exact company name with correct spelling, apostrophes, and capitalization
- Extract any numbers, percentages, dollar amounts, dates, or quantifiable data as keyMetrics
- For each metric, include a "qualifier" noting its context (projected vs actual, time period, guaranteed vs illustrated, etc.). If no qualifier applies, use null.
- Mark the 2-3 most important metrics with "highlight": true
- Break the content into logical sections with clear titles
- Pull out key takeaways or action items as bulletPoints
- Include any caveats, disclaimers, or supplementary info in additionalNotes
- If the text is short, still create a meaningful structure
- Be smart about understanding context — infer the topic and purpose
- keyMetrics should have concise labels and values (e.g. label: "Revenue", value: "$1.2M", qualifier: "FY 2025")
- Aim for 3-8 keyMetrics, 2-5 sections, and 3-10 bulletPoints

The user content below will be wrapped between ${SOURCE_DELIMITER_OPEN} and ${SOURCE_DELIMITER_CLOSE} delimiters.
${SOURCE_TRUST_FOOTER}`

export const CONTENT_STRUCTURING_SYSTEM_PROMPT = `Extract and structure content into JSON. Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "Main title",
  "subtitle": "Subtitle or tagline, or null",
  "source": "Source or origin, or null",
  "companyName": "Company name if mentioned, or null",
  "contactInfo": {
    "phone": "Phone number ONLY if it clearly belongs to the entity the content is about, otherwise null",
    "email": "Email ONLY if it clearly belongs to the entity, otherwise null",
    "website": "Website URL or null"
  },
  "keyMetrics": [{ "value": "stat value", "label": "stat label", "qualifier": "context like 'projected', 'annual', 'Q4 2025', or null", "highlight": false }],
  "sections": [{ "title": "Section name", "content": "Section content" }],
  "bulletPoints": ["Key takeaway or finding"],
  "additionalNotes": ["Any caveats, disclaimers, or supplementary info"],
  "truncated": false
}

CONTACT OWNERSHIP: For ALL four fields (phone, email, website, address), extract ONLY contacts belonging to the entity the content is ABOUT. If ownership is ambiguous (multiple values, unclear which entity), return null for that field. A null is safe; a wrong value in a client video is dangerous.

Only include real data found in the content. Never invent contact info.

The user content below will be wrapped between ${SOURCE_DELIMITER_OPEN} and ${SOURCE_DELIMITER_CLOSE} delimiters.
${SOURCE_TRUST_FOOTER}`
