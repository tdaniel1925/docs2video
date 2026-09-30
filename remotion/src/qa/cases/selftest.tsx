import { AbsoluteFill } from 'remotion'
import type { QACase } from '../types'

/**
 * A frame that is broken on purpose, once in every way the guard looks for.
 * The runner requires every one of these to be caught; if one isn't, the
 * checker itself is broken and the whole run fails. A check that has never
 * been seen to fail proves nothing.
 */
const Broken: React.FC = () => (
  <AbsoluteFill style={{ background: '#0b1220', color: '#fff', fontFamily: 'Inter', fontSize: 48 }}>
    {/* off-frame: runs past the right edge */}
    <div style={{ position: 'absolute', left: 1700, top: 60, whiteSpace: 'nowrap' }}>Off the right edge of the frame</div>
    {/* clipped: cut by a box that hides overflow */}
    <div style={{ position: 'absolute', left: 80, top: 200, width: 300, overflow: 'hidden', whiteSpace: 'nowrap' }}>Cut off by its box, cut off by its box</div>
    {/* out-of-box: spills out of the card drawn around it */}
    <div style={{ position: 'absolute', left: 80, top: 360, width: 300, padding: 16, background: '#1e293b', border: '1px solid #475569', borderRadius: 10 }}>
      <div style={{ whiteSpace: 'nowrap' }}>Spills out of its card</div>
    </div>
    {/* box-off-frame: the card holding the words runs off the bottom */}
    <div style={{ position: 'absolute', left: 800, top: 1000, width: 500, padding: 16, background: '#1e293b', borderRadius: 10 }}>
      <div>Card off the bottom</div>
    </div>
    {/* overlap: two separate lines printed on top of each other */}
    <div style={{ position: 'absolute', left: 800, top: 500 }}>$1,234,567,890.00</div>
    <div style={{ position: 'absolute', left: 830, top: 505 }}>$9,876,543,210.00</div>
    {/* over-image: a line running under a small logo */}
    <svg style={{ position: 'absolute', left: 1500, top: 700, width: 200, height: 120 }} viewBox='0 0 200 120'><rect width='200' height='120' fill='#e2e8f0' /></svg>
    <div style={{ position: 'absolute', left: 1300, top: 730 }}>Runs under the logo</div>
  </AbsoluteFill>
)

// The runner (scripts/overflow-qa.mjs) expects: off-frame, clipped, out-of-box,
// box-off-frame — and overlap + over-image when QA_OVERLAP=1.
export const cases: QACase[] = [
  { id: 'selftest-planted-broken', component: Broken, props: {}, durationInFrames: 10, frames: [5] },
]
