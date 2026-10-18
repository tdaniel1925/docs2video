import type { QACase } from '../types'
import { VisualDirectorVideo, type VisualDirectorProps, type VisualDirectorScene, type VisualDirectorWord } from '../../VisualDirectorVideo'

// VisualDirector (the talking-head overlay product, /render-visual-director).
// Every scene lasts 3 s. Each is scanned once settled (1.5 s in) and once mid-exit
// (0.2 s before it ends). The source clip is a tiny silent gradient in qa-public/.

const SCENE_S = 3
const FPS = 30

type SceneIn = Partial<VisualDirectorScene> & Pick<VisualDirectorScene, 'type' | 'title'>

function scenes(list: SceneIn[]): VisualDirectorScene[] {
  return list.map((s, i) => ({
    id: `s${i}`, start: i * SCENE_S, end: (i + 1) * SCENE_S, label: '', subtitle: '', placement: 'left',
    color: '#a58bff', enabled: true, ...s,
  }))
}

function words(text: string, seconds: number): VisualDirectorWord[] {
  const list = text.split(/\s+/).filter(Boolean)
  const step = seconds / list.length
  return list.map((word, i) => ({ word: word.slice(0, 80), start: i * step, end: (i + 1) * step - 0.02 }))
}

function frames(count: number, late = true): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(i * SCENE_S * FPS + 45)
    if (late) out.push((i + 1) * SCENE_S * FPS - 6)
  }
  return out
}

function vdCase(id: string, list: SceneIn[], opts: { aspect?: VisualDirectorProps['aspect']; captions?: string | null; logo?: boolean; late?: boolean } = {}): QACase {
  const aspect = opts.aspect ?? '16:9'
  const sc = scenes(list)
  const seconds = sc.length * SCENE_S
  const [width, height] = aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : [1920, 1080]
  const props: VisualDirectorProps = {
    sourceFile: 'vd-qa-source.mp4', sourceUrl: '', durationSeconds: seconds, aspect,
    captions: opts.captions !== null,
    scenes: sc,
    words: opts.captions ? words(opts.captions, seconds) : [],
    logo: opts.logo ? { sourceFile: 'vd-qa-logo.png', placement: 'top-right', start: 0, end: seconds, size: 14 } : null,
  }
  return { id, component: VisualDirectorVideo, props, durationInFrames: seconds * FPS, frames: frames(sc.length, opts.late ?? true), width, height, fps: FPS }
}

// ---------------------------------------------------------------- content ---

const NORMAL: SceneIn[] = [
  { type: 'headline', title: 'Claims paid in 48 hours', subtitle: 'Most customers hear back the same week.', placement: 'left' },
  { type: 'stat', title: '2.5×', subtitle: 'faster onboarding than last year', placement: 'right', color: '#6be0ff' },
  { type: 'list', title: 'What you get', subtitle: 'Faster quotes, fewer forms, one advisor and a yearly review', placement: 'left' },
  { type: 'chart', title: 'Policies sold', chartData: [{ label: 'Q1', value: 120 }, { label: 'Q2', value: 340 }, { label: 'Q3', value: 560 }, { label: 'Q4', value: 410 }], placement: 'right' },
  { type: 'workflow', title: 'How it works', subtitle: 'Upload | Review | Approve | Launch', placement: 'left' },
  { type: 'comparison', title: 'Before and after', subtitle: 'Before: manual entry | After: automatic sync', placement: 'right' },
  { type: 'quote', title: 'It just works.', subtitle: 'A customer, after the first month', placement: 'full' },
  { type: 'lower-third', title: 'Dana Whitfield', label: 'Speaker', subtitle: 'Head of Operations', placement: 'left' },
  { type: 'interface', title: 'Ask the assistant', subtitle: 'Summarize my policy | What is my deductible | When is my renewal', placement: 'right' },
  { type: 'network', title: 'One hub', subtitle: 'Sales | Support | Billing | Claims', placement: 'left' },
]

const NORMAL_CAPTIONS = 'So here is what we changed this year and why it matters for every customer we serve. We cut the wait, we cut the forms and we kept one person on your side the whole way through.'

const LONG_WORD = 'Supercalifragilisticexpialidocious-Indemnification'
// The server caps titles at 300 characters and subtitles at 500.
const T300 = ('Comprehensive Multi-Generational Wealth Transfer and Indexed Universal Life Accumulation Strategy with Guaranteed Minimum Death Benefit Riders, Chronic Illness Accelerated Benefits, and a ' + LONG_WORD + ' Clause for Every Beneficiary Named in the Trust Agreement Dated March 2019 ').slice(0, 300)
const S500 = ('This illustration assumes the current non-guaranteed crediting rate continues unchanged for the life of the policy, which is not likely, and actual results may be more or less favorable; the ' + LONG_WORD + ' provision applies to all riders, endorsements, amendments and supplemental benefits attached at issue or added later, including the waiver of monthly deduction, the overloan protection rider and the guaranteed insurability option exercisable at ages 25, 28, 31, 34, 37 and 40 without evidence of insurability. ').slice(0, 500)
const ITEMS_LONG = [
  'Guaranteed minimum death benefit of $1,234,567,890.00 for the full policy term',
  LONG_WORD,
  '100% High Cap Rate Acct (S&P 500 Index) with a 10.25% participation cap',
  'Chronic illness accelerated benefit rider with no additional premium charge',
  'Waiver of monthly deduction',
  'Overloan protection rider',
  'Guaranteed insurability option at ages 25, 28, 31, 34, 37 and 40',
  'An eighth item the engine should never show',
  'A ninth item the engine should never show',
  'A tenth item the engine should never show',
].join(' | ')
const BARS_LONG = [
  { label: 'Guaranteed Minimum Accumulation Value', value: 1234567890 },
  { label: LONG_WORD, value: 987654321 },
  { label: '100% High Cap Rate Acct (S&P 500 Index)', value: 456789012 },
  { label: 'Year 10', value: 12 },
  { label: 'Year 20 projected non-guaranteed', value: 345678901 },
  { label: 'Year 30', value: 876543210 },
  { label: 'Year 40', value: 1000000000 },
  { label: 'Year 50 at the maximum illustrated rate', value: 1200000000 },
  { label: 'Ninth bar the engine should drop', value: 5 },
  { label: 'Tenth bar the engine should drop', value: 9 },
]

// Entrance/exit motions that move or scale the panel (checked on the late frames).
const plan = (primary_animation: string, exit: NonNullable<VisualDirectorScene['motionPlan']>['exit']) =>
  ({ purpose: '', primary_animation, exit }) as VisualDirectorScene['motionPlan']

const LONG: SceneIn[] = [
  { type: 'headline', title: T300, subtitle: S500, placement: 'left', motionPlan: plan('slideSoftLeft', 'slideAway') },
  { type: 'headline', title: T300, subtitle: S500, placement: 'right', motionPlan: plan('scalePop', 'slideAway') },
  { type: 'headline', title: T300, subtitle: S500, placement: 'full', motionPlan: plan('zoomFocus', 'scaleDown') },
  { type: 'stat', title: '100% High Cap Rate Acct (S&P 500 Index)', subtitle: S500, placement: 'right' },
  { type: 'stat', title: '$1,234,567,890.00', subtitle: 'Guaranteed minimum death benefit across all ' + LONG_WORD + ' riders', placement: 'full' },
  { type: 'quote', title: T300, subtitle: S500, placement: 'left' },
  { type: 'list', title: T300, subtitle: ITEMS_LONG, placement: 'left' },
  { type: 'list', title: 'Riders', subtitle: ITEMS_LONG, placement: 'full' },
  { type: 'chart', title: T300, chartData: BARS_LONG, placement: 'right' },
  { type: 'chart', title: 'Accumulation', chartData: BARS_LONG, placement: 'full' },
  { type: 'workflow', title: T300, subtitle: ITEMS_LONG, placement: 'left' },
  { type: 'comparison', title: T300, subtitle: `Before ${LONG_WORD} and the old paper process: ${S500.slice(0, 160)} | After the new automated ${LONG_WORD} sync: $1,234,567,890.00 saved`, placement: 'right' },
  { type: 'comparison', title: 'Values', chartData: [{ label: LONG_WORD, value: 1234567890 }, { label: 'Year 40 projected non-guaranteed cash value', value: 987654321 }], placement: 'full' },
  { type: 'interface', title: T300, subtitle: ITEMS_LONG, placement: 'right' },
  { type: 'network', title: T300, subtitle: ITEMS_LONG, placement: 'left' },
  { type: 'network', title: 'Hub', subtitle: ITEMS_LONG, placement: 'full' },
  { type: 'lower-third', title: 'Dr. Maximilian Alexander Montgomery-Worthington III, CFP®, ChFC®, CLU®', label: 'Senior Vice President of Advanced Markets and ' + LONG_WORD, subtitle: 'Regional Director of Estate and Business Succession Planning, Northeastern United States and Atlantic Canada — maximilian.montgomery-worthington@northeastern-advanced-markets-group.example.com — +1 (555) 012-3456 ext. 7890', placement: 'left' },
]

const LONG_CAPTIONS = `And ${LONG_WORD} https://www.example-advanced-markets-group.com/policies/indexed-universal-life/illustrations?id=1234567890 means the ${LONG_WORD} rider pays $1,234,567,890.00 guaranteed. ` +
  'Everything else in this illustration is non-guaranteed and depends on the crediting rate the carrier declares each year for the indexed account.'

// Missing / empty optional fields, and the item/row counts at their edges.
const EMPTY: SceneIn[] = [
  { type: 'headline', title: '', subtitle: '', placement: 'left' },
  { type: 'list', title: 'No items', subtitle: '', placement: 'right' },
  { type: 'chart', title: 'One bar only', chartData: [{ label: 'Only', value: 5 }], subtitle: 'A chart needs two spoken values', placement: 'left' },
  { type: 'comparison', title: 'Nothing to compare', subtitle: '', placement: 'right' },
  { type: 'lower-third', title: 'Sam', label: '', subtitle: '', placement: 'right' },
  { type: 'network', title: 'Alone', subtitle: 'Just one', placement: 'full' },
  { type: 'stat', title: '2019', subtitle: 'The year it started (years never count up)', placement: 'left' },
]

// ------------------------------------------------------------------ cases ---

export const cases: QACase[] = [
  vdCase('visualdirector-normal', NORMAL, { captions: NORMAL_CAPTIONS, logo: true }),
  vdCase('visualdirector-normal-portrait', NORMAL, { aspect: '9:16', captions: NORMAL_CAPTIONS, logo: true, late: false }),
  vdCase('visualdirector-long', LONG, { captions: LONG_CAPTIONS, logo: true }),
  vdCase('visualdirector-long-portrait', LONG, { aspect: '9:16', captions: LONG_CAPTIONS, late: false }),
  vdCase('visualdirector-long-square', LONG, { aspect: '1:1', captions: LONG_CAPTIONS, late: false }),
  vdCase('visualdirector-long-nocaptions', LONG.filter((s) => s.type === 'lower-third' || s.placement === 'full'), { captions: null, late: false }),
  vdCase('visualdirector-empty', EMPTY, { captions: null }),
]
