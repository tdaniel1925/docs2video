// =============================================================================
// THE MADE-UP STORY BEHIND THE LOOK SAMPLES
//
// Step 3 of the create flow ("Make it yours") and the marketing site show a
// sample picture of every video look (public/style-samples/<look>-*.png).
// Every customer sees those pictures, so they must never show a real company,
// carrier, product or person. This file is the ONLY content they are drawn
// from: an insurance-style summary for an obviously made-up family, prepared
// by a placeholder agency, with no logo and no photo.
//
// scripts/look-samples/make-look-samples.ts turns it into pictures with the
// real renderers. tests/look-samples-content.test.ts fails if a real name
// sneaks back in here.
// =============================================================================

/** The "brand" the samples are made for: a placeholder, no logo, no photo. */
export const SAMPLE_BRAND = {
  name: 'Your Agency',
  primary_color: '#2F6F5E',
  secondary_color: '#1E2A33',
  accent_color: '#C9A227',
  background_color: '#F7F5F0',
  text_color: '#1E2A33',
  // 555-01xx numbers and example.com are reserved for made-up examples.
  phone: '555-0142',
  email: 'hello@example.com',
  website: 'example.com',
}

/** The made-up client the samples are addressed to. */
export const SAMPLE_CLIENT = 'The Rivera Family'

/** The made-up document title (plain words only, so nothing reads as a product name). */
export const SAMPLE_TITLE = 'Your Coverage Plan'

/** Scenes in the same shape the create flow's draft keeps them. */
export const SAMPLE_SCENES = [
  {
    _role: 'cover',
    title: 'Your Coverage at a Glance',
    narration: 'Here is a simple walk-through of the plan we put together for your family.',
    slideData: { headline: 'Your Coverage at a Glance' },
  },
  {
    title: 'What your plan gives you',
    beat: 'the numbers',
    narration: 'Your plan pays five hundred thousand dollars to your family, for a monthly premium of one hundred forty-two dollars, with coverage that runs to age sixty-five.',
    slideData: {
      headline: 'What your plan gives you',
      stats: [
        { label: 'Coverage amount', value: '$500,000' },
        { label: 'Monthly premium', value: '$142' },
        { label: 'Covered until', value: 'Age 65' },
      ],
      bullets: ['Pays your family if something happens to you', 'Premium stays the same every month'],
    },
  },
  {
    title: 'Why it fits your family',
    beat: 'the reasons',
    narration: 'It covers the mortgage, keeps the kids in school, and gives everyone time to adjust.',
    slideData: {
      headline: 'Why it fits your family',
      bullets: ['Pays off the mortgage', 'Keeps college plans on track', 'Gives your family time to adjust'],
      stats: [{ label: 'Mortgage covered', value: '$310,000' }, { label: 'College fund', value: '$120,000' }],
    },
  },
  {
    _role: 'closing',
    title: 'Questions? Let’s talk',
    narration: 'If you have any questions, reach out any time. We are happy to help.',
    slideData: { headline: 'Questions? Let’s talk', cta: 'Book a quick call' },
  },
]

/** The extracted-document facts the engines read (headers, footer chips). */
export const SAMPLE_EXTRACTED = {
  title: SAMPLE_TITLE,
  industry: 'insurance',
  recipientName: SAMPLE_CLIENT,
  keyMetrics: [
    { label: 'Coverage amount', value: '$500,000' },
    { label: 'Monthly premium', value: '$142' },
    { label: 'Covered until', value: 'Age 65' },
  ],
}
