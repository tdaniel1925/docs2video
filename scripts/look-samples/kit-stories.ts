// =============================================================================
// FULL SAMPLE STORIES FOR THE SCENE KIT (scripts/look-samples/make-kit-samples.ts)
//
// Same rule as sample-content.ts: entirely made up. A placeholder agency and
// family ("Your Agency", the Rivera family — the same made-up client the look
// samples use), and a placeholder bakery and office team. 555-01xx numbers
// and example.com only. tests/kit-engine.test.ts fails if a real carrier name
// sneaks in here.
// =============================================================================

export type KitSampleBeat = {
  role: 'cover' | 'content' | 'closing'
  title: string
  narration: string
  slideData?: { headline?: string; bullets?: string[]; stats?: { label: string; value: string }[]; cta?: string }
}
export type KitSampleStory = {
  id: string
  brandName: string
  recipient: string
  regulated: boolean
  presenter?: { name: string; role: string }
  contact: { phone?: string; email?: string; website?: string; booking?: string }
  keyMetrics: { label: string; value: string }[]
  beats: KitSampleBeat[]
}

export const KIT_STORY_INSURANCE: KitSampleStory = {
  id: 'insurance',
  brandName: 'Your Agency',
  recipient: 'The Rivera Family',
  regulated: true,
  presenter: { name: 'Jordan Avery', role: 'Licensed Agent' },
  contact: { phone: '555-0142', email: 'hello@example.com', booking: 'example.com/book' },
  keyMetrics: [
    { label: 'Coverage amount', value: '$500,000' }, { label: 'Monthly premium', value: '$142' },
    { label: 'Term length', value: '20 years' }, { label: 'Mortgage balance', value: '$310,000' },
  ],
  beats: [
    { role: 'cover', title: 'Your Family’s Protection Plan', narration: 'Hi Rivera family. Thank you for letting me walk you through the protection plan we built together.', slideData: { headline: 'Your Family’s Protection Plan' } },
    { role: 'content', title: 'What your family receives', narration: 'If something happens to you, your family receives five hundred thousand dollars, paid tax-free.', slideData: { headline: 'What your family receives', stats: [{ label: 'Paid to your family', value: '$500,000' }] } },
    { role: 'content', title: 'What it costs', narration: 'All of that costs one hundred forty-two dollars a month, and that price stays the same for the full twenty years.', slideData: { headline: 'What it costs', stats: [{ label: 'Monthly premium', value: '$142/mo' }, { label: 'Price locked for', value: '20 years' }] } },
    { role: 'content', title: 'Where the money would go', narration: 'The amount is sized to your real needs: three hundred ten thousand dollars clears the mortgage, one hundred twenty thousand covers college, and seventy thousand replaces a year of income.', slideData: { headline: 'Where the money would go', stats: [{ label: 'Mortgage', value: '$310,000' }, { label: 'College', value: '$120,000' }, { label: 'A year of income', value: '$70,000' }] } },
    { role: 'content', title: 'Without it, and with it', narration: 'Without this plan, your family would face six hundred ten thousand dollars of bills and goals on their own. With it, that gap shrinks to one hundred ten thousand.', slideData: { headline: 'Without it, and with it', stats: [{ label: 'Without the plan', value: '$610,000' }, { label: 'With the plan', value: '$110,000' }] } },
    { role: 'content', title: 'How it works over time', narration: 'Coverage starts the day your first payment is made. The kids should finish college around age forty-five, the mortgage is paid off by fifty-five, and your coverage runs until you turn sixty-five.', slideData: { headline: 'How it works over time', bullets: ['Coverage starts with the first payment', 'College done around age 45', 'Mortgage paid off by 55', 'Coverage runs to age 65'] } },
    { role: 'content', title: 'Why it fits your family', narration: 'Three things make this a good fit. The price never goes up. You can switch to permanent coverage later. And switching never needs a new medical exam.', slideData: { headline: 'Why it fits your family', bullets: ['The price never goes up', 'Switch to permanent coverage later', 'No new medical exam to switch'] } },
    { role: 'content', title: 'The one thing to remember', narration: 'If you remember one thing, make it this: the best time to protect your family is while everything is going well.', slideData: { headline: 'The one thing to remember' } },
    { role: 'closing', title: 'Questions? Let’s talk', narration: 'If anything here raises a question, I am happy to walk through it with you. Book a quick call whenever it suits you.', slideData: { headline: 'Questions? Let’s talk', cta: 'Book a 15-minute call' } },
  ],
}

export const KIT_STORY_BAKERY: KitSampleStory = {
  id: 'bakery',
  brandName: 'Your Bakery Co.',
  recipient: 'The Example Co. Team',
  regulated: false,
  contact: { phone: '555-0177', email: 'orders@example.com', website: 'example.com' },
  keyMetrics: [{ label: 'Lunches delivered last year', value: '12,400' }, { label: 'Direct price per person', value: '$12.50' }],
  beats: [
    { role: 'cover', title: 'Fresh lunches for your team', narration: 'Here is how weekly catering from our bakery could work for your office.', slideData: { headline: 'Fresh lunches for your team' } },
    { role: 'content', title: 'Offices already trust us', narration: 'Last year we delivered twelve thousand four hundred lunches to offices around town.', slideData: { headline: 'Offices already trust us', stats: [{ label: 'Lunches delivered last year', value: '12,400' }] } },
    { role: 'content', title: 'What teams order most', narration: 'Sandwich boxes are forty-five percent of orders, salads thirty percent, soups fifteen percent, and pastries the last ten percent.', slideData: { headline: 'What teams order most', stats: [{ label: 'Sandwich boxes', value: '45%' }, { label: 'Salads', value: '30%' }, { label: 'Soups', value: '15%' }, { label: 'Pastries', value: '10%' }] } },
    { role: 'content', title: 'What it costs per person', narration: 'Through a delivery app, a lunch costs about eighteen dollars a person. Ordered direct from us, it is twelve fifty, with no delivery fee.', slideData: { headline: 'What it costs per person', stats: [{ label: 'Through a delivery app', value: '$18' }, { label: 'Direct from us', value: '$12.50' }] } },
    { role: 'content', title: 'How a week works', narration: 'You pick the menu on Monday, we confirm your head count on Wednesday, and lunch arrives on Friday at noon.', slideData: { headline: 'How a week works', bullets: ['Monday: pick the menu', 'Wednesday: confirm head count', 'Friday noon: lunch arrives'] } },
    { role: 'content', title: 'Why teams stay with us', narration: 'Teams stay because everything is baked fresh that morning, every box is labelled for allergies, and you get one simple invoice a month.', slideData: { headline: 'Why teams stay with us', bullets: ['Baked fresh that morning', 'Every box labelled for allergies', 'One simple invoice a month'] } },
    { role: 'content', title: 'A thank-you they can taste', narration: 'Good food is the easiest way to say thank you to a team that works hard.', slideData: { headline: 'A thank-you they can taste' } },
    { role: 'closing', title: 'Let’s plan your first lunch', narration: 'Want to try it? Book a tasting and we will bring samples to your office.', slideData: { headline: 'Let’s plan your first lunch', cta: 'Book a tasting' } },
  ],
}

export const KIT_STORIES = [KIT_STORY_INSURANCE, KIT_STORY_BAKERY]
