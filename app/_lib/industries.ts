export type IndustryId = 'insurance' | 'financial' | 'real_estate' | 'mortgage' | 'healthcare' | 'legal' | 'consulting' | 'education' | 'accounting' | 'technology' | 'hr' | 'sales' | 'general'

export interface IndustryConfig {
  id: IndustryId
  label: string
  keywords: string[]
  beatStructure: string
  terminology: { use: string[]; avoid: string[] }
  disclaimerRequired: boolean
  disclaimerText?: string
  closingDisclaimerText?: string
  tone: string
  ctaText: string
  slideHints: string
  followUpTone: string
}

export const INDUSTRIES: Record<IndustryId, IndustryConfig> = {
  insurance: {
    id: 'insurance',
    label: 'Insurance',
    keywords: ['policy', 'premium', 'coverage', 'deductible', 'beneficiary', 'underwriting', 'claim', 'rider', 'annuity', 'death benefit', 'cash value', 'whole life', 'term life', 'universal life', 'IUL', 'VUL'],
    beatStructure: `1. HOOK (1 scene) — Open with greeting, then state a compelling benefit or surprising number about the policy.
2. DISCLAIMER (1 scene) — Legal disclaimer: "This video is for educational and informational purposes only. It is not legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. Please consult with your licensed insurance professional before making decisions."
3. CONTEXT (1-2 scenes) — Who is this policy for, what type of policy, the big picture.
4. STAKES (1-2 scenes) — Why this matters. What the death benefit means for the family.
5. EVIDENCE (3-8 scenes) — Deep dive into premiums, cash value growth, surrender values, riders.
6. IMPLICATION (1-2 scenes) — What the data means practically for the policyholder.
7. DISCLAIMER-CLOSE (1 scene) — Closing legal disclaimer.
8. ACTION (1 scene) — Clear next step.`,
    terminology: {
      use: ['policyholder', 'coverage', 'protection', 'cash value growth', 'guaranteed values', 'illustrated values', 'death benefit', 'premium', 'rider'],
      avoid: ['insurance product', 'sell', 'buy', 'investment returns', 'stock market', 'guaranteed returns'],
    },
    disclaimerRequired: true,
    disclaimerText: 'This video is for educational and informational purposes only. It is not legal, tax, or financial advice. Policy guarantees are based on the claims-paying ability of the issuing insurance company. Non-guaranteed values are subject to change. Please consult with your licensed insurance professional before making decisions.',
    closingDisclaimerText: 'As a reminder, this video is for educational purposes only and does not constitute financial advice. Policy guarantees depend on the issuing carrier\'s claims-paying ability, and non-guaranteed values may change. Please review your official policy documents and consult with your licensed professional.',
    tone: 'Professional but warm, like a trusted financial advisor explaining to a client over coffee. Use plain language — no insurance jargon. Make the client feel informed and confident.',
    ctaText: 'Schedule a review of your coverage today.',
    slideHints: 'Use shield icons, family silhouettes, growth charts, and trust imagery. Colors should feel stable and trustworthy — navy, gold, deep green.',
    followUpTone: 'Caring and proactive — check in on their understanding and offer to clarify.',
  },

  financial: {
    id: 'financial',
    label: 'Financial Services',
    keywords: ['portfolio', 'investment', 'asset allocation', 'ROI', 'return', 'dividend', 'equity', 'bond', 'mutual fund', 'ETF', 'wealth management', 'retirement', '401k', 'IRA', 'fiduciary', 'market', 'stocks'],
    beatStructure: `1. HOOK (1 scene) — Open with a compelling market insight or portfolio highlight.
2. DISCLAIMER (1 scene) — "This content is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. All investments involve risk, including possible loss of principal. Consult with a qualified financial advisor before making investment decisions."
3. CONTEXT (1-2 scenes) — Market overview, portfolio positioning, or financial planning context.
4. STAKES (1-2 scenes) — Why this matters for their financial future. The impact of action vs inaction.
5. EVIDENCE (3-8 scenes) — Performance data, allocation breakdowns, projections, comparisons.
6. IMPLICATION (1-2 scenes) — What the numbers mean for their goals — retirement, wealth building, etc.
7. DISCLAIMER-CLOSE (1 scene) — Closing compliance disclaimer.
8. ACTION (1 scene) — Clear next step toward their financial goals.`,
    terminology: {
      use: ['portfolio', 'allocation', 'diversification', 'time horizon', 'risk tolerance', 'compound growth', 'wealth building', 'financial goals'],
      avoid: ['guaranteed returns', 'get rich', 'no risk', 'sure thing', 'beat the market'],
    },
    disclaimerRequired: true,
    disclaimerText: 'This content is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. All investments involve risk, including possible loss of principal. Consult with a qualified financial advisor before making investment decisions.',
    closingDisclaimerText: 'Remember, this presentation is for educational purposes only. Investment decisions should be made in consultation with a qualified financial professional who understands your specific situation.',
    tone: 'Confident and knowledgeable, like a seasoned advisor sharing insights. Data-driven but accessible. Inspire confidence without overpromising.',
    ctaText: 'Let\'s schedule a portfolio review to align your investments with your goals.',
    slideHints: 'Use upward trending charts, pie charts for allocation, clean data visualizations. Colors: navy, gold, forest green for growth.',
    followUpTone: 'Analytical and forward-looking — reference specific data points and next review dates.',
  },

  real_estate: {
    id: 'real_estate',
    label: 'Real Estate',
    keywords: ['property', 'listing', 'square feet', 'sqft', 'bedroom', 'bathroom', 'MLS', 'appraisal', 'escrow', 'closing costs', 'HOA', 'mortgage rate', 'home value', 'neighborhood', 'market analysis', 'CMA', 'comparable'],
    beatStructure: `1. HOOK (1 scene) — Open with the most compelling feature of the property or market insight.
2. CONTEXT (1-2 scenes) — Property overview, location highlights, or market conditions.
3. STAKES (1-2 scenes) — Why this property/market matters now. Urgency, opportunity, lifestyle impact.
4. EVIDENCE (3-8 scenes) — Property details, comparables, market data, neighborhood stats, financial breakdown.
5. IMPLICATION (1-2 scenes) — What this means for the buyer/seller — lifestyle, investment potential, timing.
6. ACTION (1 scene) — Schedule a showing, make an offer, or list their property.`,
    terminology: {
      use: ['home', 'property', 'neighborhood', 'community', 'market value', 'equity', 'investment', 'lifestyle', 'curb appeal'],
      avoid: ['deal', 'steal', 'flip', 'guaranteed appreciation', 'no-brainer'],
    },
    disclaimerRequired: false,
    tone: 'Enthusiastic but professional, like a knowledgeable agent who genuinely loves the property. Paint a picture of the lifestyle. Use sensory language.',
    ctaText: 'Schedule a private showing today — this won\'t last long.',
    slideHints: 'Use property photography style, map pins, neighborhood icons, home silhouettes. Warm colors — cream, sage green, warm wood tones.',
    followUpTone: 'Warm and urgent — emphasize market timing and personal fit.',
  },

  mortgage: {
    id: 'mortgage',
    label: 'Mortgage & Lending',
    keywords: ['mortgage', 'loan', 'interest rate', 'APR', 'refinance', 'down payment', 'pre-approval', 'amortization', 'fixed rate', 'adjustable rate', 'ARM', 'FHA', 'VA loan', 'conventional', 'closing costs', 'LTV', 'debt-to-income'],
    beatStructure: `1. HOOK (1 scene) — Open with a rate comparison, savings opportunity, or purchasing power insight.
2. DISCLAIMER (1 scene) — "This is for informational purposes only. Rates and terms are subject to change and may vary based on creditworthiness and other factors. This is not a commitment to lend. NMLS #[number]. Equal Housing Lender."
3. CONTEXT (1-2 scenes) — Loan overview, rate environment, or refinance opportunity.
4. STAKES (1-2 scenes) — Monthly payment impact, total interest savings, or purchasing power difference.
5. EVIDENCE (3-8 scenes) — Rate comparisons, payment breakdowns, amortization highlights, closing cost details.
6. IMPLICATION (1-2 scenes) — Long-term financial impact, total savings, or equity building timeline.
7. DISCLAIMER-CLOSE (1 scene) — Closing lending disclaimer.
8. ACTION (1 scene) — Get pre-approved or lock in their rate.`,
    terminology: {
      use: ['monthly payment', 'interest rate', 'loan term', 'equity', 'pre-approval', 'purchasing power', 'closing costs', 'down payment'],
      avoid: ['guaranteed approval', 'no money down', 'everyone qualifies', 'instant approval'],
    },
    disclaimerRequired: true,
    disclaimerText: 'This is for informational purposes only. Rates and terms are subject to change and may vary based on creditworthiness and other factors. This is not a commitment to lend. Equal Housing Lender.',
    closingDisclaimerText: 'Rates shown are for illustrative purposes and subject to change. Final terms depend on credit approval, property appraisal, and other factors. Contact your loan officer for current rates and personalized options.',
    tone: 'Clear and empowering, like a loan officer helping someone understand their options. Demystify the process. Make big numbers feel manageable.',
    ctaText: 'Get pre-approved in minutes — let\'s find your perfect rate.',
    slideHints: 'Use house icons with dollar signs, rate comparison charts, payment calculator visuals. Colors: blue, green for savings, clean white backgrounds.',
    followUpTone: 'Supportive and educational — break down complex terms and emphasize what they can afford.',
  },

  healthcare: {
    id: 'healthcare',
    label: 'Healthcare',
    keywords: ['patient', 'diagnosis', 'treatment', 'clinical', 'medical', 'health', 'wellness', 'therapy', 'prescription', 'procedure', 'outcome', 'provider', 'HIPAA', 'care plan', 'symptoms', 'prevention'],
    beatStructure: `1. HOOK (1 scene) — Open with a health insight, patient outcome, or wellness opportunity.
2. DISCLAIMER (1 scene) — "This content is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or qualified health provider with questions about a medical condition."
3. CONTEXT (1-2 scenes) — Health topic overview, who it affects, current understanding.
4. STAKES (1-2 scenes) — Why this matters for health outcomes. The impact of early action or awareness.
5. EVIDENCE (3-8 scenes) — Clinical data, treatment options, outcomes, prevention strategies.
6. IMPLICATION (1-2 scenes) — What this means for the patient/audience practically.
7. DISCLAIMER-CLOSE (1 scene) — Closing medical disclaimer.
8. ACTION (1 scene) — Schedule an appointment, get screened, or adopt the recommended approach.`,
    terminology: {
      use: ['wellness', 'care', 'outcomes', 'prevention', 'treatment options', 'evidence-based', 'patient-centered', 'health goals'],
      avoid: ['cure', 'miracle', 'guaranteed results', 'no side effects', 'alternative to medical advice'],
    },
    disclaimerRequired: true,
    disclaimerText: 'This content is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or qualified health provider with questions about a medical condition.',
    closingDisclaimerText: 'This video is educational only and does not replace professional medical advice. Please consult your healthcare provider for guidance specific to your health situation.',
    tone: 'Compassionate and clear, like a doctor explaining to a patient in simple terms. Empathetic but factual. Empower without alarming.',
    ctaText: 'Talk to your healthcare provider about the right approach for you.',
    slideHints: 'Use medical icons (stethoscope, heart, DNA), calming imagery, clean clinical design. Colors: teal, soft blue, white, gentle green.',
    followUpTone: 'Gentle and encouraging — focus on empowerment and next steps in their care journey.',
  },

  legal: {
    id: 'legal',
    label: 'Legal',
    keywords: ['attorney', 'lawyer', 'legal', 'contract', 'litigation', 'plaintiff', 'defendant', 'statute', 'regulation', 'compliance', 'liability', 'tort', 'jurisdiction', 'arbitration', 'settlement', 'court'],
    beatStructure: `1. HOOK (1 scene) — Open with the legal issue at hand or a key right/protection the viewer should know about.
2. DISCLAIMER (1 scene) — "This content is for informational purposes only and does not constitute legal advice. No attorney-client relationship is formed by viewing this content. Laws vary by jurisdiction. Consult with a qualified attorney for advice specific to your situation."
3. CONTEXT (1-2 scenes) — Legal landscape, relevant laws, or case background.
4. STAKES (1-2 scenes) — What's at risk. Rights, obligations, potential consequences.
5. EVIDENCE (3-8 scenes) — Legal analysis, key provisions, case comparisons, regulatory requirements.
6. IMPLICATION (1-2 scenes) — Practical implications for the viewer. What they should understand.
7. DISCLAIMER-CLOSE (1 scene) — Closing legal disclaimer.
8. ACTION (1 scene) — Consult an attorney, review documents, or take protective action.`,
    terminology: {
      use: ['rights', 'obligations', 'protections', 'provisions', 'compliance', 'due diligence', 'legal framework', 'jurisdiction'],
      avoid: ['guaranteed outcome', 'will win', 'slam dunk', 'loophole', 'trick'],
    },
    disclaimerRequired: true,
    disclaimerText: 'This content is for informational purposes only and does not constitute legal advice. No attorney-client relationship is formed by viewing this content. Laws vary by jurisdiction. Consult with a qualified attorney for advice specific to your situation.',
    closingDisclaimerText: 'This video is for educational purposes only and is not legal advice. Laws and regulations vary by jurisdiction. Please consult a qualified attorney for guidance specific to your situation.',
    tone: 'Authoritative but accessible, like a trusted attorney explaining rights to a client. Clear, precise, and empowering without being intimidating.',
    ctaText: 'Schedule a consultation to discuss your specific situation.',
    slideHints: 'Use scales of justice, gavel, document icons, shield imagery. Colors: navy, burgundy, gold, dark charcoal. Professional and weighty.',
    followUpTone: 'Measured and precise — emphasize the importance of personalized legal counsel.',
  },

  consulting: {
    id: 'consulting',
    label: 'Consulting',
    keywords: ['strategy', 'optimization', 'framework', 'methodology', 'stakeholder', 'deliverable', 'KPI', 'ROI', 'transformation', 'implementation', 'roadmap', 'assessment', 'benchmark', 'best practice', 'engagement'],
    beatStructure: `1. HOOK (1 scene) — Open with the business challenge or opportunity that demands attention.
2. CONTEXT (1-2 scenes) — Current state assessment, market position, or organizational context.
3. STAKES (1-2 scenes) — The cost of inaction. Competitive pressure, missed opportunity, or growing risk.
4. EVIDENCE (3-8 scenes) — Data analysis, benchmarks, framework walkthrough, case studies, recommendations.
5. IMPLICATION (1-2 scenes) — Expected outcomes, ROI projections, transformation timeline.
6. ACTION (1 scene) — Engage on the next phase, schedule a deep dive, or approve the roadmap.`,
    terminology: {
      use: ['strategy', 'framework', 'optimization', 'transformation', 'stakeholders', 'outcomes', 'roadmap', 'capability', 'value creation'],
      avoid: ['easy fix', 'silver bullet', 'guaranteed results', 'one-size-fits-all', 'no effort required'],
    },
    disclaimerRequired: false,
    tone: 'Strategic and insightful, like a McKinsey partner presenting to the C-suite. Confident, data-driven, and action-oriented. Show thought leadership.',
    ctaText: 'Let\'s schedule a strategy session to accelerate your transformation.',
    slideHints: 'Use frameworks, 2x2 matrices, process flows, comparison tables. Clean and sophisticated. Colors: dark blue, slate, accent orange or teal.',
    followUpTone: 'Collaborative and forward-thinking — reference shared goals and next milestones.',
  },

  education: {
    id: 'education',
    label: 'Education',
    keywords: ['student', 'curriculum', 'learning', 'course', 'enrollment', 'tuition', 'degree', 'certification', 'training', 'workshop', 'module', 'lesson', 'instructor', 'campus', 'academic', 'scholarship'],
    beatStructure: `1. HOOK (1 scene) — Open with the learning outcome or career opportunity this education unlocks.
2. CONTEXT (1-2 scenes) — Program overview, who it's for, what skills or knowledge they'll gain.
3. STAKES (1-2 scenes) — Why this learning matters now. Career advancement, skill gaps, industry demand.
4. EVIDENCE (3-8 scenes) — Curriculum highlights, instructor credentials, student outcomes, program features.
5. IMPLICATION (1-2 scenes) — Career impact, earning potential, or personal growth outcomes.
6. ACTION (1 scene) — Enroll, request information, or take the next step in their learning journey.`,
    terminology: {
      use: ['learners', 'outcomes', 'skills', 'knowledge', 'growth', 'mastery', 'curriculum', 'certification', 'career advancement'],
      avoid: ['guaranteed job', 'easy', 'no effort', 'instant results', 'diploma mill'],
    },
    disclaimerRequired: false,
    tone: 'Inspiring and supportive, like a passionate educator who believes in their students. Encouraging but realistic about the work required.',
    ctaText: 'Take the first step — enroll today or request more information.',
    slideHints: 'Use graduation caps, books, lightbulb icons, growth metaphors, pathway imagery. Colors: academic blue, green, warm gold accents.',
    followUpTone: 'Encouraging and mentoring — celebrate progress and outline the path ahead.',
  },

  accounting: {
    id: 'accounting',
    label: 'Accounting & Tax',
    keywords: ['tax', 'deduction', 'audit', 'revenue', 'expense', 'balance sheet', 'P&L', 'profit', 'loss', 'CPA', 'bookkeeping', 'payroll', 'depreciation', 'amortization', 'fiscal year', 'quarterly', 'filing'],
    beatStructure: `1. HOOK (1 scene) — Open with a tax savings opportunity, financial insight, or deadline awareness.
2. DISCLAIMER (1 scene) — "This content is for informational purposes only and does not constitute tax or accounting advice. Tax laws change frequently and vary by jurisdiction. Consult with a qualified CPA or tax professional for advice specific to your situation."
3. CONTEXT (1-2 scenes) — Financial overview, tax landscape, or accounting principles context.
4. STAKES (1-2 scenes) — What's at risk: penalties, missed deductions, cash flow impact, compliance issues.
5. EVIDENCE (3-8 scenes) — Numbers breakdown, tax strategies, financial comparisons, regulatory requirements.
6. IMPLICATION (1-2 scenes) — Bottom-line impact, savings realized, or compliance achieved.
7. DISCLAIMER-CLOSE (1 scene) — Closing tax/accounting disclaimer.
8. ACTION (1 scene) — Schedule a review, file by deadline, or implement the strategy.`,
    terminology: {
      use: ['tax savings', 'deductions', 'compliance', 'cash flow', 'bottom line', 'fiscal health', 'strategic planning', 'write-off'],
      avoid: ['tax evasion', 'loophole', 'guaranteed refund', 'audit-proof', 'cheat the system'],
    },
    disclaimerRequired: true,
    disclaimerText: 'This content is for informational purposes only and does not constitute tax or accounting advice. Tax laws change frequently and vary by jurisdiction. Consult with a qualified CPA or tax professional for advice specific to your situation.',
    closingDisclaimerText: 'Tax laws are complex and subject to change. This video is educational only. Please consult your CPA or tax advisor for personalized guidance.',
    tone: 'Precise and reassuring, like a trusted CPA explaining a complex return. Make numbers feel manageable. Emphasize savings and clarity.',
    ctaText: 'Let\'s review your financials and find opportunities you might be missing.',
    slideHints: 'Use calculator icons, spreadsheet visuals, bar charts, dollar signs, calendar deadlines. Colors: green for savings, navy for trust, clean white.',
    followUpTone: 'Detail-oriented and proactive — reference specific deadlines and action items.',
  },

  technology: {
    id: 'technology',
    label: 'Technology',
    keywords: ['software', 'SaaS', 'platform', 'API', 'cloud', 'data', 'AI', 'machine learning', 'automation', 'integration', 'scalability', 'infrastructure', 'deployment', 'agile', 'sprint', 'DevOps', 'cybersecurity'],
    beatStructure: `1. HOOK (1 scene) — Open with the problem this technology solves or the transformation it enables.
2. CONTEXT (1-2 scenes) — Technology landscape, current challenges, or what exists today.
3. STAKES (1-2 scenes) — Cost of outdated systems, competitive disadvantage, or security risks.
4. EVIDENCE (3-8 scenes) — Features, architecture, performance metrics, case studies, integrations.
5. IMPLICATION (1-2 scenes) — Business impact: efficiency gains, cost reduction, competitive advantage.
6. ACTION (1 scene) — Start a trial, schedule a demo, or begin implementation.`,
    terminology: {
      use: ['platform', 'solution', 'integration', 'scalability', 'automation', 'efficiency', 'real-time', 'seamless', 'robust'],
      avoid: ['revolutionary', 'disruptive', 'game-changing', 'bleeding edge', 'paradigm shift'],
    },
    disclaimerRequired: false,
    tone: 'Clear and forward-thinking, like a product manager presenting to a technical audience. Balance features with business value. Avoid buzzword overload.',
    ctaText: 'Start your free trial or schedule a personalized demo today.',
    slideHints: 'Use circuit patterns, cloud icons, dashboard mockups, connected nodes, clean tech aesthetics. Colors: electric blue, dark charcoal, white, accent purple.',
    followUpTone: 'Practical and solution-focused — emphasize ease of implementation and support available.',
  },

  hr: {
    id: 'hr',
    label: 'Human Resources',
    keywords: ['employee', 'hiring', 'recruitment', 'onboarding', 'benefits', 'compensation', 'retention', 'culture', 'engagement', 'performance review', 'PTO', 'handbook', 'workplace', 'diversity', 'inclusion', 'talent'],
    beatStructure: `1. HOOK (1 scene) — Open with the people challenge or opportunity this addresses.
2. CONTEXT (1-2 scenes) — Workforce landscape, organizational needs, or policy overview.
3. STAKES (1-2 scenes) — Impact on retention, culture, productivity, or compliance.
4. EVIDENCE (3-8 scenes) — Data on outcomes, program details, policy breakdowns, benchmarks.
5. IMPLICATION (1-2 scenes) — Impact on employee experience, organizational health, or bottom line.
6. ACTION (1 scene) — Implement the program, enroll in benefits, or take the next HR step.`,
    terminology: {
      use: ['team members', 'talent', 'culture', 'engagement', 'well-being', 'growth opportunities', 'total rewards', 'work-life balance'],
      avoid: ['human capital', 'headcount reduction', 'resources', 'bodies', 'warm bodies'],
    },
    disclaimerRequired: false,
    tone: 'Warm and inclusive, like an HR leader who genuinely cares about people. Empathetic, clear about policies, and focused on the employee experience.',
    ctaText: 'Reach out to your HR team to learn more about your options.',
    slideHints: 'Use people icons, team imagery, organizational charts, benefit comparison tables. Colors: warm blue, orange, green, approachable pastels.',
    followUpTone: 'Supportive and open — emphasize that questions are welcome and resources are available.',
  },

  sales: {
    id: 'sales',
    label: 'Sales & Marketing',
    keywords: ['conversion', 'lead', 'prospect', 'pipeline', 'funnel', 'revenue', 'close rate', 'quota', 'territory', 'outreach', 'campaign', 'market share', 'competitive advantage', 'value proposition', 'pricing'],
    beatStructure: `1. HOOK (1 scene) — Open with the result or transformation the product/service delivers.
2. CONTEXT (1-2 scenes) — Market positioning, who this is for, the problem being solved.
3. STAKES (1-2 scenes) — The cost of the status quo. What competitors are doing. The urgency.
4. EVIDENCE (3-8 scenes) — Product features, ROI data, case studies, testimonials, comparisons.
5. IMPLICATION (1-2 scenes) — The future with this solution. Success metrics and outcomes.
6. ACTION (1 scene) — Clear, compelling call-to-action with urgency.`,
    terminology: {
      use: ['solution', 'results', 'value', 'ROI', 'outcomes', 'growth', 'competitive edge', 'partnership', 'success'],
      avoid: ['buy now', 'limited time only', 'act fast', 'no-brainer', 'too good to be true'],
    },
    disclaimerRequired: false,
    tone: 'Persuasive but credible, like a top sales professional who leads with value. Confident without being pushy. Focus on outcomes, not features.',
    ctaText: 'Let\'s explore how this can work for your specific situation.',
    slideHints: 'Use upward arrows, trophy icons, comparison tables, before/after visuals. Colors: bold blue, energetic orange, success green, clean white.',
    followUpTone: 'Consultative and value-driven — focus on their specific goals and how to achieve them.',
  },

  general: {
    id: 'general',
    label: 'General',
    keywords: [],
    beatStructure: `1. HOOK (1 scene) — Open with the most compelling insight or key takeaway from the document.
2. CONTEXT (1-2 scenes) — Set the stage. What is this about? Who is it for?
3. STAKES (1-2 scenes) — Why this matters. What's the impact or opportunity?
4. EVIDENCE (3-8 scenes) — Deep dive into the key data, findings, and details.
5. IMPLICATION (1-2 scenes) — What does this all mean practically?
6. ACTION (1 scene) — Clear next step for the viewer.`,
    terminology: {
      use: ['insights', 'findings', 'key takeaways', 'data', 'evidence', 'outcomes', 'next steps'],
      avoid: ['basically', 'obviously', 'simply', 'just'],
    },
    disclaimerRequired: false,
    tone: 'Professional but warm, like a knowledgeable presenter explaining to an engaged audience. Use plain language. Write like a storyteller, not a summarizer.',
    ctaText: 'Take the next step — reach out to learn more.',
    slideHints: 'Use clean data visualizations, professional icons, structured layouts. Colors from brand palette with good contrast.',
    followUpTone: 'Helpful and clear — summarize key points and offer to elaborate.',
  },
}

export function detectIndustry(title: string, content: string): IndustryId {
  const text = `${title} ${content}`.toLowerCase()

  let bestMatch: IndustryId = 'general'
  let bestScore = 0

  for (const [id, config] of Object.entries(INDUSTRIES)) {
    if (id === 'general') continue
    let score = 0
    for (const keyword of config.keywords) {
      // Count occurrences of each keyword
      const regex = new RegExp(keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      const matches = text.match(regex)
      if (matches) {
        score += matches.length
      }
    }
    // Title matches count double
    for (const keyword of config.keywords) {
      if (title.toLowerCase().includes(keyword.toLowerCase())) {
        score += 3
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = id as IndustryId
    }
  }

  // Require a minimum score threshold to avoid false positives
  return bestScore >= 2 ? bestMatch : 'general'
}
