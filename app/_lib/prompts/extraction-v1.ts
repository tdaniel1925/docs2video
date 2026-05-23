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
- Aim for 3-8 keyMetrics, 2-5 sections, and 3-10 bulletPoints`

export const CONTENT_STRUCTURING_SYSTEM_PROMPT = `Extract and structure content into JSON. Return:
{
  "title": "Main title",
  "subtitle": "Subtitle or tagline",
  "sections": [{ "title": "Section name", "content": "Section content" }],
  "keyMetrics": [{ "value": "stat value", "label": "stat label" }],
  "contactInfo": { "phone": null, "email": null, "website": null },
  "companyName": "Company name if mentioned"
}
Only include real data found in the content. Never invent contact info.`
