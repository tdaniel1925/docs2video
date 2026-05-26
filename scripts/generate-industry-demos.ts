/**
 * Batch generate 8 industry-specific Docs2Video promo videos.
 *
 * These are PROMO VIDEOS FOR DOCS2VIDEO — not sample explainer videos.
 * Each video speaks directly to professionals in that industry and shows
 * how Docs2Video solves their document-to-video pain point.
 *
 * Usage:  npm run generate-demos
 *         npx tsx scripts/generate-industry-demos.ts
 */

import { config } from 'dotenv'
import { resolve, join } from 'path'
import { writeFile, mkdir, stat } from 'fs/promises'

// Load env vars BEFORE anything else reads them
config({ path: resolve(__dirname, '..', '.env.local') })

// Verify key is loaded
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not found. Check .env.local')
  process.exit(1)
}
console.log('ENV loaded: GEMINI_API_KEY=' + process.env.GEMINI_API_KEY.slice(0, 10) + '...')

import { generateSlide } from '../app/_lib/gemini'
import { synthesizeSpeech } from '../app/_lib/tts'
import { assembleVideo } from '../app/_lib/video'
import type { ExtractedData } from '../app/_lib/extract-types'

// ---------------------------------------------------------------------------
// Brand settings
// ---------------------------------------------------------------------------
const BRAND_NAME = 'Docs2Video'
const STYLE_ID = 'blue-steps' as const
const VOICE_ID = 'nova'
const COLORS = {
  primary: '#1B3A5C',
  secondary: '#3BB5C8',
  accent: '#F5A623',
  background: '#0a1628',
  text: '#FFFFFF',
}

// ---------------------------------------------------------------------------
// Industry definitions — each has 3 promo scenes
// ---------------------------------------------------------------------------
interface IndustryPromo {
  slug: string
  name: string
  scenes: {
    slidePrompt: string
    narration: string
  }[]
}

const INDUSTRIES: IndustryPromo[] = [
  {
    slug: 'insurance',
    name: 'Insurance',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for insurance agents.
Headline: "Your clients aren't reading their policy illustrations."
Sub-text: "60-page PDFs get ignored. Premiums, cash values, riders — none of it lands."
Visual: Show a stack of unread documents with a red "UNREAD" stamp. Dark, moody atmosphere.
Brand: "${BRAND_NAME}" logo/text in corner. Use brand colors.`,
        narration:
          'Insurance agents — you spend hours preparing policy illustrations, but your clients never read them. Sixty pages of premiums, cash values, and riders just sitting in an inbox, unopened.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for insurance agents.
Headline: "Docs2Video turns policy illustrations into branded explainer videos."
Sub-text: "Upload your PDF. Get a narrated video in 90 seconds."
Visual: Show a document transforming into a video player with slides. Bright, energetic.
Include 3 steps: "Upload PDF → Branded Slides Generated → Narrated Video Ready"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video reads your policy illustration, generates branded slides highlighting death benefits, cash value growth, and riders, then records professional narration — all in about ninety seconds.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for insurance agents.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first explainer video is on us."
Visual: Clean, bold call-to-action design. Large URL. Inviting and confident.
Include: "2 free short videos" badge.
Brand: "${BRAND_NAME}" prominently displayed with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any policy illustration and get your first branded explainer video on us. Your clients will actually watch this one.',
      },
    ],
  },
  {
    slug: 'real-estate',
    name: 'Real Estate',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for real estate agents.
Headline: "Your listing presentations are collecting dust."
Sub-text: "Market analyses, comps, and property details — buried in PDFs nobody opens."
Visual: Show property documents stacked up, ignored. Dim, frustrated mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration:
          'Real estate agents — you put together beautiful listing presentations and market analyses, but your sellers flip through them once and forget everything. All those comps and pricing strategies, gone.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for real estate agents.
Headline: "Turn your CMAs into cinematic listing videos."
Sub-text: "Upload your market analysis. Get a branded video walkthrough in 90 seconds."
Visual: Document transforming into a polished video with property slides. Bright and modern.
Steps: "Upload CMA → Branded Slides → Narrated Video"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video takes your CMA or listing presentation, builds gorgeous branded slides with market data and property highlights, and adds professional narration — ready to send or share on social media.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for real estate agents.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first listing video is on us."
Visual: Bold CTA with URL. Modern real estate aesthetic.
Brand: "${BRAND_NAME}" with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any listing presentation or market analysis and get your first branded video on us. Stand out in every seller meeting.',
      },
    ],
  },
  {
    slug: 'financial-services',
    name: 'Financial Services',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for financial advisors.
Headline: "Your financial plans are too complex for clients to follow."
Sub-text: "Retirement projections, asset allocations, Monte Carlo simulations — lost in the PDF."
Visual: Dense financial documents with confused expressions (use icons, not faces). Dark mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration:
          'Financial advisors — your clients trust you with their retirement, but they glaze over when you hand them a forty-page financial plan. Projections, allocations, risk analyses — it is all just noise on paper.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for financial advisors.
Headline: "Turn financial plans into client-ready video summaries."
Sub-text: "Upload your plan. Docs2Video generates a clear, narrated walkthrough."
Visual: Financial document transforming into video with charts and graphs. Professional and clean.
Steps: "Upload Plan → Visual Slides → Narrated Summary"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video reads your financial plan, pulls out the key projections and recommendations, creates clear branded slides, and narrates the whole thing. Your clients can watch it anytime, anywhere.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for financial advisors.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first financial video is on us."
Visual: Clean CTA with URL. Wealth management aesthetic.
Brand: "${BRAND_NAME}" with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any financial plan and get your first branded explainer video on us. Your clients will finally understand the plan you built for them.',
      },
    ],
  },
  {
    slug: 'legal',
    name: 'Legal',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for legal professionals.
Headline: "Your clients sign documents they don't understand."
Sub-text: "Contracts, agreements, and legal briefs — too dense for most people to follow."
Visual: Stack of legal documents with a confused stamp or icon. Serious, dark tone.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration:
          'Attorneys and legal professionals — your clients sign contracts and agreements they barely understand. Dense legal language means critical terms get overlooked, and that creates problems down the road.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for legal professionals.
Headline: "Turn contracts into clear video explanations."
Sub-text: "Upload any legal document. Get a plain-language narrated video summary."
Visual: Legal document transforming into an approachable video with key terms highlighted.
Steps: "Upload Document → Key Terms Extracted → Narrated Explainer"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video reads your contracts and legal documents, identifies the key terms and obligations, creates clean branded slides, and narrates a plain-language summary your clients can actually follow.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for legal professionals.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first legal explainer is on us."
Visual: Professional CTA. Authoritative legal aesthetic.
Brand: "${BRAND_NAME}" with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any contract or agreement and get your first narrated explainer video on us. Informed clients are better clients.',
      },
    ],
  },
  {
    slug: 'healthcare',
    name: 'Healthcare',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for healthcare professionals.
Headline: "Patients leave your office confused about their care plan."
Sub-text: "Treatment plans, discharge instructions, and benefits summaries — too much to absorb."
Visual: Medical documents piling up. Health-themed but showing information overload.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration:
          'Healthcare providers — your patients leave the office with a folder full of treatment plans and discharge instructions they will never read. Critical follow-up steps get missed, and outcomes suffer.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for healthcare professionals.
Headline: "Turn care plans into patient-friendly video guides."
Sub-text: "Upload any care document. Get a narrated video patients can rewatch at home."
Visual: Medical document transforming into a friendly, accessible video. Warm, caring tone.
Steps: "Upload Care Plan → Visual Summary → Narrated Guide"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video reads your treatment plans and care documents, creates clear visual slides with key instructions, and adds reassuring narration. Patients can rewatch at home as many times as they need.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for healthcare professionals.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first patient video is on us."
Visual: Warm CTA. Healthcare-friendly design.
Brand: "${BRAND_NAME}" with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any care plan or patient document and get your first branded video on us. Better understanding means better outcomes.',
      },
    ],
  },
  {
    slug: 'consulting',
    name: 'Consulting',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for consultants.
Headline: "Your strategy decks die in the inbox."
Sub-text: "Months of analysis condensed into slides that executives skim in two minutes."
Visual: Strategy documents and slide decks collecting digital dust. Corporate, frustrated mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration:
          'Consultants — you spend weeks on strategy decks and research reports, and your clients skim them in two minutes flat. All that analysis, all those recommendations, barely absorbed.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for consultants.
Headline: "Turn your deliverables into executive video briefings."
Sub-text: "Upload your deck or report. Get a polished narrated summary in 90 seconds."
Visual: Strategy document transforming into a sleek executive video. Premium, professional.
Steps: "Upload Report → Key Insights Extracted → Narrated Briefing"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video reads your strategy decks and reports, extracts the key insights and recommendations, builds branded slides, and records a narrated executive briefing. Your work finally gets the attention it deserves.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for consultants.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first executive briefing video is on us."
Visual: Premium CTA. Executive consulting aesthetic.
Brand: "${BRAND_NAME}" with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any strategy deck or report and get your first narrated executive briefing on us. Make every deliverable impossible to ignore.',
      },
    ],
  },
  {
    slug: 'education',
    name: 'Education',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for educators.
Headline: "Your students aren't reading the course materials."
Sub-text: "Syllabi, study guides, and research papers — walls of text that students skip."
Visual: Stacks of academic documents with bored/skipped icons. Academic but frustrated tone.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration:
          'Educators — you create detailed syllabi, study guides, and course materials, but students barely skim them. Important concepts and instructions get lost in walls of text.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for educators.
Headline: "Turn course materials into engaging video lessons."
Sub-text: "Upload any document. Get a narrated video summary students will actually watch."
Visual: Academic document transforming into an engaging video with visual aids. Bright, energetic.
Steps: "Upload Material → Visual Slides → Narrated Lesson"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video reads your course materials, creates visually engaging slides with key concepts highlighted, and adds clear narration. Students can watch on their phone, pause, rewind, and actually learn.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for educators.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first lesson video is on us."
Visual: Friendly CTA. Education-themed design.
Brand: "${BRAND_NAME}" with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any syllabus, study guide, or course document and get your first video lesson on us. Meet your students where they are — on video.',
      },
    ],
  },
  {
    slug: 'mortgage',
    name: 'Mortgage',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for mortgage professionals.
Headline: "Your borrowers are overwhelmed by loan documents."
Sub-text: "Rate comparisons, amortization schedules, closing disclosures — too much, too confusing."
Visual: Mortgage documents piling up with overwhelmed iconography. Dark, stressful mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration:
          'Mortgage professionals — your borrowers are drowning in loan documents. Rate comparisons, amortization schedules, and closing disclosures are critical, but most borrowers cannot make sense of them.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for mortgage professionals.
Headline: "Turn loan documents into clear video walkthroughs."
Sub-text: "Upload any mortgage document. Get a branded narrated video in 90 seconds."
Visual: Mortgage document transforming into a clear, friendly video with key numbers highlighted.
Steps: "Upload Loan Doc → Branded Slides → Narrated Walkthrough"
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration:
          'Docs2Video reads your loan estimates, rate comparisons, and closing disclosures, creates branded slides with key numbers front and center, and narrates a clear walkthrough borrowers can watch before signing.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for mortgage professionals.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first mortgage video is on us."
Visual: Clean CTA. Mortgage/finance aesthetic.
Brand: "${BRAND_NAME}" with tagline "Documents deserve to be seen."`,
        narration:
          'Try it free at docs2video.com. Upload any loan document and get your first branded explainer video on us. Confident borrowers close faster.',
      },
    ],
  },
  {
    slug: 'non-profit',
    name: 'Non-Profit',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for non-profits.
Headline: "Your donors don't read annual reports."
Sub-text: "Grant proposals get skimmed. Impact reports go unopened. Your mission deserves better."
Visual: Stacks of unread reports and proposals. Dark, serious mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration: 'Non-profit leaders — your donors don\'t read annual reports. Your grant committees skim proposals. The incredible impact you\'re making is buried in documents nobody opens.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for non-profits.
Headline: "Turn impact reports into compelling video stories."
Sub-text: "Upload your report. Get a branded narrated video in 90 seconds."
Visual: Report transforming into an engaging video with impact metrics highlighted.
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration: 'Docs2Video reads your impact reports, grant proposals, and annual summaries, then creates branded video explainers that show your mission in action. Donors watch. Committees remember. Funding follows.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for non-profits.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first impact video is on us."
Brand: "${BRAND_NAME}" with tagline "Your mission deserves to be seen."`,
        narration: 'Try it free at docs2video.com. Upload any report or proposal and get your first branded explainer video on us. Your mission deserves to be seen.',
      },
    ],
  },
  {
    slug: 'human-resources',
    name: 'Human Resources',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for HR professionals.
Headline: "Your employees pick the wrong benefits every year."
Sub-text: "47-page enrollment packets. Nobody reads them. Everyone makes bad choices."
Visual: Thick benefits documents with confused iconography. Dark mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration: 'HR professionals — your employees pick the wrong benefits every year because your enrollment packet is forty-seven pages long. Nobody reads it. Everyone makes uninformed choices. Then they blame HR.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for HR professionals.
Headline: "Turn benefits guides into clear video walkthroughs."
Sub-text: "Upload your enrollment packet. Get a narrated explainer in 90 seconds."
Visual: HR document transforming into a friendly video with benefits clearly explained.
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration: 'Docs2Video reads your benefits guides, handbooks, and policy documents, then creates branded video explainers employees actually watch. Open enrollment goes from confusion to confidence.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for HR professionals.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first HR video is on us."
Brand: "${BRAND_NAME}" with tagline "Benefits everyone can understand."`,
        narration: 'Try it free at docs2video.com. Upload any HR document and get your first branded explainer video on us. Your employees will thank you.',
      },
    ],
  },
  {
    slug: 'coaching',
    name: 'Coaching',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for coaches and consultants.
Headline: "Your proposals look the same as everyone else's."
Sub-text: "PDFs don't convey your expertise. Your clients can't tell you apart from the competition."
Visual: Generic-looking proposals stacked up. Dark, competitive mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration: 'Coaches and consultants — your proposals look identical to everyone else\'s. A PDF doesn\'t convey your expertise. Your potential clients can\'t tell you apart from the competition just by reading a document.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for coaches.
Headline: "Turn proposals into personalized video presentations."
Sub-text: "Upload your proposal. Get a branded narrated video in 90 seconds."
Visual: Coaching proposal transforming into a professional branded video.
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration: 'Docs2Video turns your coaching proposals, program outlines, and progress reports into branded video presentations that showcase your personality and expertise. Stand out before the first call.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for coaches.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first coaching video is on us."
Brand: "${BRAND_NAME}" with tagline "Your expertise deserves to be seen."`,
        narration: 'Try it free at docs2video.com. Upload any proposal or program outline and get your first branded explainer video on us. Close more clients by showing, not just telling.',
      },
    ],
  },
  {
    slug: 'fitness',
    name: 'Personal Training',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for personal trainers.
Headline: "Your clients don't follow written workout plans."
Sub-text: "PDFs of exercises sit unread. Nutrition guides get ignored. Results suffer."
Visual: Unread workout plans and nutrition documents. Dark mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration: 'Personal trainers — your clients don\'t follow written workout plans. Those PDFs with exercise descriptions and nutrition guides sit unread in their inboxes. No compliance means no results.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for personal trainers.
Headline: "Turn workout plans into narrated video guides."
Sub-text: "Upload your program. Get a branded video walkthrough in 90 seconds."
Visual: Workout plan transforming into an engaging video with exercises highlighted.
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration: 'Docs2Video turns your workout programs, nutrition plans, and progress reports into branded video guides your clients actually watch. Better compliance, better results, more referrals.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for personal trainers.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first fitness video is on us."
Brand: "${BRAND_NAME}" with tagline "Plans your clients will actually follow."`,
        narration: 'Try it free at docs2video.com. Upload any workout plan or nutrition guide and get your first branded explainer video on us. Your clients will actually follow through.',
      },
    ],
  },
  {
    slug: 'property-management',
    name: 'Property Management',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for property managers.
Headline: "Your tenants don't read lease agreements."
Sub-text: "Move-in packets go unread. Maintenance policies ignored. Disputes follow."
Visual: Lease documents and property listings piling up. Dark mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration: 'Property managers — your tenants don\'t read lease agreements. Move-in packets go straight to the trash. Maintenance policies are ignored. Then come the disputes, the violations, and the headaches.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for property managers.
Headline: "Turn lease documents into clear video walkthroughs."
Sub-text: "Upload any property document. Get a branded video in 90 seconds."
Visual: Lease transforming into a professional property video with key terms highlighted.
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration: 'Docs2Video turns your lease agreements, property listings, and community guidelines into branded video walkthroughs tenants actually watch. Fewer disputes, faster leasing, happier tenants.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for property managers.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first property video is on us."
Brand: "${BRAND_NAME}" with tagline "Properties that communicate better."`,
        narration: 'Try it free at docs2video.com. Upload any lease or listing and get your first branded explainer video on us. Better-informed tenants start from day one.',
      },
    ],
  },
  {
    slug: 'medical',
    name: 'Medical',
    scenes: [
      {
        slidePrompt: `PROMO SLIDE — PAIN POINT for medical practices.
Headline: "Your patients forget everything you just told them."
Sub-text: "Treatment plans, post-op instructions, insurance explanations — gone the moment they leave."
Visual: Medical documents with forgotten/confused iconography. Clinical but dark mood.
Brand: "${BRAND_NAME}" logo/text in corner.`,
        narration: 'Doctors and medical professionals — eighty percent of what you tell patients is forgotten the moment they leave your office. Treatment plans, post-procedure instructions, and insurance explanations just vanish.',
      },
      {
        slidePrompt: `PROMO SLIDE — SOLUTION for medical practices.
Headline: "Turn treatment plans into patient-friendly video explainers."
Sub-text: "Upload any medical document. Get a branded video in 90 seconds."
Visual: Medical document transforming into a clear, friendly video patients can rewatch.
Brand: "${BRAND_NAME}" prominently displayed.`,
        narration: 'Docs2Video turns your treatment plans, post-procedure instructions, and lab result summaries into branded video explainers patients can rewatch at home. Fewer callbacks, better compliance, healthier outcomes.',
      },
      {
        slidePrompt: `PROMO SLIDE — CTA for medical practices.
Headline: "Try it free at docs2video.com"
Sub-text: "Your first patient video is on us."
Brand: "${BRAND_NAME}" with tagline "Patients who understand heal faster."`,
        narration: 'Try it free at docs2video.com. Upload any patient document and get your first branded explainer video on us. Patients who understand their care follow through.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Minimal ExtractedData stub used as the "data" param for generateSlide.
// The actual slide content comes from slidePrompt overrides, but
// generateSlide still needs a data object for its context block.
// ---------------------------------------------------------------------------
function makePromoData(industry: IndustryPromo): ExtractedData {
  return {
    title: `${BRAND_NAME} for ${industry.name}`,
    subtitle: 'Turn documents into branded explainer videos in 90 seconds',
    source: BRAND_NAME,
    keyMetrics: [
      { label: 'Time to Video', value: '90 seconds', highlight: true },
      { label: 'AI-Generated Slides', value: 'Yes', highlight: true },
      { label: 'Professional Narration', value: 'Included', highlight: false },
      { label: 'Brand Customization', value: 'Full', highlight: false },
    ],
    sections: [
      { title: 'The Problem', content: `${industry.name} professionals send complex documents that clients never read.` },
      { title: 'The Solution', content: `${BRAND_NAME} transforms those documents into branded, narrated explainer videos.` },
    ],
    bulletPoints: [
      'Upload any PDF document',
      'AI extracts key information',
      'Branded slides generated automatically',
      'Professional narration recorded',
      'Video ready in 90 seconds',
    ],
    additionalNotes: [`Promo video for ${industry.name} vertical`],
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const outputDir = resolve(__dirname, '..', 'public', 'industry-demos')
  await mkdir(outputDir, { recursive: true })

  console.log(`\n=== Docs2Video Industry Promo Generator ===`)
  console.log(`Output: ${outputDir}`)
  console.log(`Industries: ${INDUSTRIES.length}`)
  console.log(`Scenes per video: 3`)
  console.log(`Style: ${STYLE_ID} | Voice: ${VOICE_ID}\n`)

  for (let i = 0; i < INDUSTRIES.length; i++) {
    const industry = INDUSTRIES[i]
    const tag = `[${i + 1}/${INDUSTRIES.length}] ${industry.name}`
    const outputPath = join(outputDir, `${industry.slug}.mp4`)

    // Skip if video already exists
    try {
      await stat(outputPath)
      console.log(`${tag}: SKIPPED — ${industry.slug}.mp4 already exists`)
      continue
    } catch { /* file doesn't exist, proceed */ }

    const promoData = makePromoData(industry)

    try {
      // --- Generate slides ---
      console.log(`${tag}: Generating slides...`)
      const slideBuffers: Buffer[] = []
      const referenceSlides: Buffer[] = []

      for (let s = 0; s < industry.scenes.length; s++) {
        const slide = await generateSlide(
          promoData,
          s,
          STYLE_ID,
          BRAND_NAME,
          null,       // no logo URL
          COLORS,
          industry.scenes[s].slidePrompt,
          false,      // no photo
          undefined,  // no contact info
          null,       // no logo buffer
          referenceSlides.length > 0 ? referenceSlides : undefined
        )
        slideBuffers.push(slide)
        referenceSlides.push(slide) // feed previous slides as reference for consistency
      }

      // --- Generate audio ---
      console.log(`${tag}: Generating audio...`)
      const audioBuffers: Buffer[] = []
      for (const scene of industry.scenes) {
        const audio = await synthesizeSpeech(scene.narration, VOICE_ID)
        audioBuffers.push(audio)
      }

      // --- Assemble video ---
      console.log(`${tag}: Assembling video...`)
      const { videoBuffer } = await assembleVideo(slideBuffers, audioBuffers, 'docs2video.com')

      // --- Save ---
      await writeFile(outputPath, videoBuffer)

      const fileStat = await stat(outputPath)
      const sizeMB = (fileStat.size / 1024 / 1024).toFixed(1)
      console.log(`${tag}: Done! (${sizeMB}MB)\n`)
    } catch (err) {
      console.error(`${tag}: FAILED —`, err)
      console.log() // blank line before next industry
    }
  }

  console.log('=== All done! ===\n')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
