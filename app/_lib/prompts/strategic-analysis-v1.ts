export function buildStrategicAnalysisPrompt(
  intentGuidance: string,
  dataJson: string,
  contactInfo?: { phone?: string; email?: string; calendly?: string; website?: string },
): string {
  return `You are a senior communications strategist who understands sales psychology, audience empathy, and persuasion. You are preparing a video that will be WATCHED by a real person — not read as a document.

Your job is to think like the VIEWER, not the document author. What does the viewer care about? What are they afraid of? What would make them take action?

${intentGuidance}

SOURCE DATA:
${dataJson}

${contactInfo?.phone || contactInfo?.email || contactInfo?.calendly || contactInfo?.website ? `CONTACT INFO (for closing scene only):
${contactInfo?.phone ? `Phone: ${contactInfo.phone}` : ''}
${contactInfo?.email ? `Email: ${contactInfo.email}` : ''}
${contactInfo?.website ? `Website: ${contactInfo.website}` : ''}
${contactInfo?.calendly ? `Booking: ${contactInfo.calendly}` : ''}` : ''}

Create a strategic brief covering:

1. AUDIENCE: Who is watching this video? (client, prospect, employee, stakeholder?) What is their knowledge level? What language do they use — technical or plain English?

2. EMOTIONAL STATE: What is the viewer feeling BEFORE watching? (confused by a document? skeptical of a pitch? overwhelmed by data? anxious about a decision?) What should they feel AFTER?

3. THE ONE THING: If the viewer remembers only ONE takeaway, what should it be? Not a feature — a benefit. Not "death benefit is $750K" but "your family is protected no matter what happens."

4. KEY FACTS: The 8-15 most important specific facts from the source. For each fact, note WHY it matters to the viewer — not just WHAT it is.
   Example: "$500/month premium" → "For about $16 a day — less than a lunch — your family gets lifetime protection"

5. OBJECTIONS: What 2-3 concerns will the viewer have? Address them proactively.
   Example: "Is this too expensive?" → Show the per-day cost. "What if the market crashes?" → Explain the floor protection.

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
   - Reframe negatives: "cost" → "investment", "policy" → "plan", "premium" → "contribution"

9. CONTACT/CTA: Real contact info from the source (ONLY if it exists — NEVER invent). What is the single strongest CTA for this audience?

Return as plain text, not JSON. Be specific — use actual numbers, names, and facts from the source. Think like a strategist, not a summarizer.`
}
