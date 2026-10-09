import type { IndustryId } from './industries'

/*
 * Copy for the /for/<industry> landing pages (rendered by IndustryPage.tsx).
 *
 * TRUTH RULES — every line must be true of the product today:
 *   - No statistics, user counts, ratings, testimonials or quotes.
 *   - No speed promises beyond the app's own estimate (most videos take a
 *     few minutes; see /help/faq).
 *   - No real carrier, lender or company names.
 *   - Prices and free credits come from pricing.ts, never typed here.
 *   - Only claim features the product has (share page, booking button,
 *     quote + payment link, view alerts, slide deck PDF/PPTX, real logo).
 * tests/no-false-claims.test.ts scans this file.
 */

export interface IndustryPageCopy {
  slug: string
  /** Shown in "Docs2Video for …" and the FAQ-style headings. */
  name: string
  /** Who the page is for, e.g. "insurance professionals". */
  audience: string
  /** The INDUSTRIES config the product uses for this field, if it has one. */
  industryId: IndustryId | null
  metaTitle: string
  metaDescription: string
  /** Hero headline: plain part, then the italic part. */
  heroTitle: [string, string]
  heroSub: string
  /** The document they usually send, singular ("policy illustration"). */
  doc: string
  /** Who receives it, singular ("client", "patient"). */
  reader: string
  problems: { title: string; description: string }[]
}

export const INDUSTRY_PAGES: Record<string, IndustryPageCopy> = {
  insurance: {
    slug: 'insurance',
    name: 'Insurance',
    audience: 'insurance professionals',
    industryId: 'insurance',
    metaTitle: 'Docs2Video for Insurance | Policy Illustrations, Explained on Video',
    metaDescription: 'Insurance agents: turn long policy illustrations into short, branded, narrated videos your clients can watch on any phone — sent on a page where they can book a call.',
    heroTitle: ['Insurance agents: send the illustration as a video ', 'they will watch'],
    heroSub: 'Docs2Video turns a dense policy illustration into a short, branded, narrated video — easy to watch, and easy to share with a spouse before a decision.',
    doc: 'policy illustration',
    reader: 'client',
    problems: [
      { title: 'Illustrations are long and dense', description: 'Pages of tables and footnotes. It’s easy for a client to flip to the premium and skip the rest.' },
      { title: 'The explaining falls on you', description: 'You walk through the same numbers again on every call, or build a summary by hand.' },
      { title: 'Decisions stall on confusion', description: 'When a client isn’t sure what they are looking at, the easy answer is “let me think about it.”' },
    ],
  },
  'financial-services': {
    slug: 'financial-services',
    name: 'Financial Services',
    audience: 'financial professionals',
    industryId: 'financial',
    metaTitle: 'Docs2Video for Financial Services | Reports Clients Understand',
    metaDescription: 'Financial advisors: turn portfolio reports and retirement plans into short, branded, narrated videos your clients can watch before the review meeting.',
    heroTitle: ['Your clients deserve to ', 'understand their money'],
    heroSub: 'Docs2Video turns a portfolio report or plan into a short narrated video in plain language — with your branding and your client’s name on the cover.',
    doc: 'portfolio report',
    reader: 'client',
    problems: [
      { title: 'Reports are full of tables', description: 'Returns, allocations and projections are hard to read without someone explaining them.' },
      { title: 'The same questions, every quarter', description: '“Am I on track?” often needs a call just to walk through the report.' },
      { title: 'Review prep takes time', description: 'Turning a report into something a client can follow usually means building slides by hand.' },
    ],
  },
  'real-estate': {
    slug: 'real-estate',
    name: 'Real Estate',
    audience: 'real estate professionals',
    industryId: 'real_estate',
    metaTitle: 'Docs2Video for Real Estate | CMAs and Listings as Video',
    metaDescription: 'Real estate agents: turn a CMA, market report or listing into a short, branded, narrated video sellers and buyers can watch and forward to family.',
    heroTitle: ['Agents: your CMA deserves better than a ', 'spreadsheet'],
    heroSub: 'Docs2Video turns a market analysis or listing sheet into a short, branded, narrated video — one link your seller can watch and share with the whole household.',
    doc: 'market analysis',
    reader: 'client',
    problems: [
      { title: 'Printouts don’t tell the story', description: 'Comps and price tables make sense to you. To a seller they are just numbers.' },
      { title: 'Presentations take time to build', description: 'Making a polished listing presentation by hand eats into time you could spend with clients.' },
      { title: 'Nothing to share afterwards', description: 'Decisions often involve people who weren’t at the appointment.' },
    ],
  },
  mortgage: {
    slug: 'mortgage',
    name: 'Mortgage',
    audience: 'mortgage professionals',
    industryId: 'mortgage',
    metaTitle: 'Docs2Video for Mortgage | Loan Estimates Borrowers Understand',
    metaDescription: 'Loan officers: turn loan estimates and rate comparisons into short, branded, narrated videos borrowers can watch on their phone.',
    heroTitle: ['Help borrowers understand their loan ', 'before they sign'],
    heroSub: 'Docs2Video turns a loan estimate or rate sheet into a short narrated video that walks the borrower through it line by line — with your branding.',
    doc: 'loan estimate',
    reader: 'borrower',
    problems: [
      { title: 'Loan paperwork is confusing', description: 'Rates, points, fees and closing costs are a lot to take in at once.' },
      { title: 'Confused borrowers hesitate', description: 'When the numbers aren’t clear, “I need to think about it” is the safe answer.' },
      { title: 'Explaining takes calls', description: 'Walking each borrower through the same estimate takes time out of your day.' },
    ],
  },
  healthcare: {
    slug: 'healthcare',
    name: 'Healthcare',
    audience: 'healthcare teams',
    industryId: 'healthcare',
    metaTitle: 'Docs2Video for Healthcare | Benefits and Care Documents, Explained',
    metaDescription: 'Healthcare and benefits teams: turn benefits guides and care documents into short, branded, narrated videos people can watch on any device.',
    heroTitle: ['Benefits packets are hard to read. Make them ', 'easy to watch'],
    heroSub: 'Docs2Video turns a benefits guide or care document into a short narrated video in plain language, with your branding and the standard healthcare disclaimer.',
    doc: 'benefits guide',
    reader: 'reader',
    problems: [
      { title: 'Packets are long and technical', description: 'Deductibles, networks and coverage tiers are hard to compare on paper.' },
      { title: 'Questions pile up', description: 'When people don’t understand the document, they call or email to ask.' },
      { title: 'Making materials takes time', description: 'Turning a dense guide into something clear usually means extra design work.' },
    ],
  },
  legal: {
    slug: 'legal',
    name: 'Legal',
    audience: 'legal professionals',
    industryId: 'legal',
    metaTitle: 'Docs2Video for Legal | Agreements Clients Understand',
    metaDescription: 'Attorneys: turn contracts and agreements into short, branded, narrated plain-language summaries clients can watch before the meeting.',
    heroTitle: ['Your clients sign documents they don’t ', 'understand'],
    heroSub: 'Docs2Video turns an agreement into a short narrated summary in plain English — branded, with the standard “not legal advice” disclaimer added.',
    doc: 'agreement',
    reader: 'client',
    problems: [
      { title: 'Legal language is hard going', description: 'Clients often skim long agreements and miss the terms that matter most.' },
      { title: 'The same clause, explained again', description: 'Walking each client through the key terms takes meeting time.' },
      { title: 'Summaries take effort', description: 'Writing a plain-language summary by hand is slow work.' },
    ],
  },
  consulting: {
    slug: 'consulting',
    name: 'Consulting',
    audience: 'consultants',
    industryId: 'consulting',
    metaTitle: 'Docs2Video for Consulting | Deliverables Clients Actually Review',
    metaDescription: 'Consultants: turn long reports and deliverables into short, branded, narrated walkthroughs — plus an interactive presentation from the same work.',
    heroTitle: ['You spent weeks on that report. Make sure they ', 'get past page one'],
    heroSub: 'Docs2Video turns a long deliverable into a short narrated walkthrough or an interactive presentation, in your firm’s branding.',
    doc: 'report',
    reader: 'client',
    problems: [
      { title: 'Long reports get skimmed', description: 'Busy leaders often read the summary and not much else.' },
      { title: 'Formatting eats time', description: 'Turning findings into a polished presentation takes hours of work.' },
      { title: '“Can you walk us through it?”', description: 'Every walkthrough is another meeting on the calendar.' },
    ],
  },
  education: {
    slug: 'education',
    name: 'Education',
    audience: 'educators',
    industryId: 'education',
    metaTitle: 'Docs2Video for Education | Course Material as Narrated Video',
    metaDescription: 'Educators and researchers: turn papers, reports and course material into short, narrated explainer videos and interactive presentations.',
    heroTitle: ['Your material is valuable. Make it ', 'easy to take in'],
    heroSub: 'Docs2Video turns a paper, report or course document into a short narrated explainer video or an interactive presentation your students click through.',
    doc: 'course document',
    reader: 'student',
    problems: [
      { title: 'Long readings go unfinished', description: 'Dense PDFs are easy to put off and hard to get through.' },
      { title: 'Summaries take time to make', description: 'Building slides or a visual summary for each piece of material adds up.' },
      { title: 'Different people learn differently', description: 'Some people take in a topic better by listening and watching than by reading.' },
    ],
  },
  'human-resources': {
    slug: 'human-resources',
    name: 'Human Resources',
    audience: 'HR teams',
    industryId: 'hr',
    metaTitle: 'Docs2Video for Human Resources | Benefits Guides as Video',
    metaDescription: 'HR teams: turn benefits guides, handbooks and onboarding documents into short, branded, narrated videos employees can watch on any device.',
    heroTitle: ['Your benefits guide is long. Your employees are ', 'busy'],
    heroSub: 'Docs2Video turns a benefits guide or handbook into a short narrated video in plain language, branded for your company.',
    doc: 'benefits guide',
    reader: 'employee',
    problems: [
      { title: 'Enrollment packets are long', description: 'Many people pick the same plan as last year rather than read every page.' },
      { title: 'Questions flood in', description: 'When the guide isn’t clear, HR answers the same questions again and again.' },
      { title: 'Materials take time to build', description: 'Turning a guide into a presentation usually means extra design work.' },
    ],
  },
  coaching: {
    slug: 'coaching',
    name: 'Coaching',
    audience: 'coaches',
    industryId: null,
    metaTitle: 'Docs2Video for Coaches | Proposals and Programs as Video',
    metaDescription: 'Coaches: turn proposals, program outlines and course material into short, branded, narrated videos your prospects can watch.',
    heroTitle: ['Your proposal looks like everyone else’s. Your expertise ', 'deserves better'],
    heroSub: 'Docs2Video turns a proposal or program outline into a short, branded, narrated video — sent on a page where prospects can book a call.',
    doc: 'proposal',
    reader: 'prospect',
    problems: [
      { title: 'PDF proposals blend in', description: 'A document that looks like every other coach’s is easy to set aside.' },
      { title: 'Customizing takes time', description: 'Tailoring each proposal by hand adds up across every prospect.' },
      { title: 'Hard to show who you are', description: 'A page of text doesn’t carry your voice or your approach.' },
    ],
  },
  fitness: {
    slug: 'fitness',
    name: 'Personal Training',
    audience: 'trainers and gyms',
    industryId: null,
    metaTitle: 'Docs2Video for Personal Trainers & Gyms | Plans as Video',
    metaDescription: 'Personal trainers and gyms: turn workout programs and nutrition plans into short, branded, narrated videos your clients can watch on their phone.',
    heroTitle: ['Your workout plans sit ', 'unread in inboxes'],
    heroSub: 'Docs2Video turns a workout program or nutrition plan into a short, branded, narrated walkthrough your clients can replay any time.',
    doc: 'workout plan',
    reader: 'client',
    problems: [
      { title: 'Written plans get forgotten', description: 'A spreadsheet or PDF is easy to lose track of between sessions.' },
      { title: 'Building materials takes time', description: 'Making polished guides for each client adds up.' },
      { title: 'Hard to stay in touch', description: 'Between sessions, clients have little from you to look at.' },
    ],
  },
  medical: {
    slug: 'medical',
    name: 'Medical',
    audience: 'medical practices',
    industryId: 'healthcare',
    metaTitle: 'Docs2Video for Medical Practices | Care Instructions as Video',
    metaDescription: 'Medical practices: turn treatment plans and care instructions into short, branded, narrated videos patients can watch again at home.',
    heroTitle: ['Patients leave with questions you ', 'already answered'],
    heroSub: 'Docs2Video turns care instructions into a short narrated video in plain language that patients can replay at home — with the standard healthcare disclaimer added.',
    doc: 'care instructions',
    reader: 'patient',
    problems: [
      { title: 'A lot to remember', description: 'Instructions given in a busy appointment are easy to forget.' },
      { title: 'Handouts get lost', description: 'Printed sheets end up in a drawer or a bin.' },
      { title: 'Repeat questions', description: 'Staff time goes to explaining the same instructions again by phone.' },
    ],
  },
  'non-profit': {
    slug: 'non-profit',
    name: 'Non-Profit',
    audience: 'non-profits',
    industryId: null,
    metaTitle: 'Docs2Video for Non-Profits | Impact Reports as Video',
    metaDescription: 'Non-profits: turn impact reports and grant proposals into short, branded, narrated videos donors and committees can watch.',
    heroTitle: ['Your donors are busy. Your impact report ', 'deserves to be seen'],
    heroSub: 'Docs2Video turns an impact report or proposal into a short, branded, narrated video — one link to send to donors and supporters.',
    doc: 'impact report',
    reader: 'donor',
    problems: [
      { title: 'Annual reports are long', description: 'Supporters rarely read every page of a report.' },
      { title: 'Design takes time and money', description: 'Making reports look good usually means design work you may not have budget for.' },
      { title: 'Hard to stand out', description: 'A PDF looks like every other PDF in someone’s inbox.' },
    ],
  },
  'property-management': {
    slug: 'property-management',
    name: 'Property Management',
    audience: 'property managers',
    industryId: null,
    metaTitle: 'Docs2Video for Property Management | Leases and Listings as Video',
    metaDescription: 'Property managers: turn lease agreements, listings and tenant guides into short, branded, narrated videos tenants can watch on any device.',
    heroTitle: ['Tenants don’t read the lease. Give them something they ', 'will watch'],
    heroSub: 'Docs2Video turns a lease, listing or tenant guide into a short, branded, narrated video walkthrough.',
    doc: 'lease',
    reader: 'tenant',
    problems: [
      { title: 'Leases are long', description: 'Important terms get missed when tenants skim.' },
      { title: '“I didn’t know that was in the lease”', description: 'Misunderstandings turn into calls, emails and disputes.' },
      { title: 'Listings look alike', description: 'A plain listing sheet is easy to scroll past.' },
    ],
  },
}

export const INDUSTRY_PAGE_SLUGS = Object.keys(INDUSTRY_PAGES)
