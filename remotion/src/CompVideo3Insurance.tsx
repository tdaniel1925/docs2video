import React from 'react'
import { AbsoluteFill, Sequence, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import D from '../public/comp3/durations.json'

/* ============================================================================
 * APEX COMP PLAN — DETAILED EXPLAINER (~31 beats, ~4-5 min). Torn-paper style.
 * CORRECT to APEX_COMP_ENGINE_SPEC: seller = 60% of BV (not the sale); BV is
 * explained; worked examples labeled ILLUSTRATIVE. All readable data on
 * code-drawn cream torn-paper PANELS (per the readability rule). Strong
 * Ken-Burns on scenes. Captions HOLD (no flash). Ducked audio. Corner logo.
 * ==========================================================================*/
const FPS = 30
const NAVY = '#1e3a70', NAVY_D = '#132649', RED = '#c0272d', WHITE = '#fff', CREAM = '#f4efe4', GREEN = '#2f7d4f'
const INK = '#23324a', SOFT = '#6b6a5c'
const FONT = 'Archivo, Inter, system-ui, sans-serif'
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), backOut: Easing.bezier(0.34, 1.56, 0.64, 1) }
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)
const vo: number[] = (D as any).vo || []
const PANELS: Record<string, string> = (D as any).panels || {}

/* ---- captions for scene beats (Title Case, torn navy card) ---- */
const CAPS: Record<number, { kicker?: string; head: string; accent?: string }> = {
  0: { kicker: 'The Insurance Ladder', head: 'For Licensed Agents.' },
  1: { kicker: 'How You Get Paid', head: 'On First-Year Premium.' },
  4: { kicker: 'How You Climb', head: 'Production + Quality.', accent: 'Quality.' },
  12: {} as any, // finale handled specially
}
const FINALE = 12 // last beat is the CTA scene

const grainSVG = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='0.5'/></svg>`)
const Grain: React.FC<{ o?: number }> = ({ o = 0.05 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,${grainSVG}")`, backgroundPosition: `${(f * 4) % 180}px ${(f * 6) % 180}px`, mixBlendMode: 'multiply', opacity: o }} /> }
const Star: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = RED }) => (<svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 1.6l2.9 6.5 7.1.6-5.4 4.7 1.7 6.9L12 17.9 5.7 20.3l1.7-6.9L2 8.7l7.1-.6z" fill={color} /></svg>)

// caption HOLDS: fades in fast (frames 4-14), stays solid to the end (no out-fade;
// the scene Dissolve handles the exit). This kills the "flash".
const TORN_CARD = 'polygon(0% 7%,5% 2%,11% 8%,17% 2%,24% 8%,31% 2%,38% 8%,45% 2%,52% 8%,59% 2%,66% 8%,73% 2%,80% 8%,87% 2%,94% 8%,100% 3%,100% 92%,95% 98%,88% 91%,81% 98%,74% 91%,67% 98%,60% 91%,53% 98%,46% 91%,39% 98%,32% 91%,25% 98%,18% 91%,11% 98%,5% 91%,0% 96%)'
const CaptionCard: React.FC<{ c: { kicker?: string; head: string; accent?: string } }> = ({ c }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 20, stiffness: 150 } })
  const head = c.accent && c.head.includes(c.accent) ? <>{c.head.replace(c.accent, '')}<span style={{ color: '#ff8a8a' }}>{c.accent}</span></> : c.head
  return (
    <div style={{ position: 'absolute', left: 80, bottom: 120, maxWidth: 1600, transform: `translateY(${(1 - s) * 40}px) rotate(-1.4deg)`, opacity: clamp(s) }}>
      <div style={{ background: NAVY, clipPath: TORN_CARD, padding: '26px 52px 30px' }}>
        {c.kicker ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><Star /><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, letterSpacing: '0.2em', color: '#ff9d9d', textTransform: 'uppercase' }}>{c.kicker}</div></div> : null}
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 68, lineHeight: 1.03, color: WHITE, letterSpacing: '-0.02em' }}>{head}</div>
      </div>
    </div>
  )
}

/* ---- code-drawn cream torn-paper PANEL (all readable data lives here) ---- */
const PANEL_TORN = 'polygon(1% 3%,7% 1%,14% 4%,21% 1%,29% 3%,37% 0%,45% 3%,53% 1%,61% 4%,69% 1%,77% 3%,85% 0%,93% 3%,99% 1%,100% 7%,99% 18%,100% 30%,99% 44%,100% 58%,99% 72%,100% 84%,99% 93%,94% 99%,85% 97%,76% 100%,66% 97%,56% 100%,46% 97%,36% 100%,26% 97%,16% 100%,8% 98%,2% 99%,0% 93%,1% 78%,0% 64%,1% 50%,0% 36%,1% 22%,0% 10%)'
const Panel: React.FC<{ children: React.ReactNode; kicker?: string; foot?: React.ReactNode }> = ({ children, kicker, foot }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 2, fps, config: { damping: 17, stiffness: 120 } })
  return (
    <div style={{ position: 'absolute', left: 190, top: 130, width: 1540, height: 820, transform: `translateY(${(1 - s) * 26}px) rotate(-0.5deg)`, opacity: clamp(s) }}>
      <div style={{ position: 'absolute', inset: -8, background: 'rgba(0,0,0,0.42)', clipPath: PANEL_TORN, filter: 'blur(10px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${CREAM}, #ece5d6)`, clipPath: PANEL_TORN, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '70px 100px', textAlign: 'center' }}>
        <Grain o={0.08} />
        {kicker ? <div style={{ position: 'relative', fontFamily: FONT, fontWeight: 800, fontSize: 26, letterSpacing: '0.2em', color: RED, textTransform: 'uppercase', marginBottom: 26 }}>{kicker}</div> : null}
        <div style={{ position: 'relative', width: '100%' }}>{children}</div>
        {foot ? <div style={{ position: 'relative', fontFamily: FONT, fontWeight: 700, fontSize: 30, color: INK, marginTop: 30, lineHeight: 1.3 }}>{foot}</div> : null}
      </div>
    </div>
  )
}
const Illus: React.FC = () => <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: SOFT, fontStyle: 'italic' }}> · illustrative</span>
const CountUp: React.FC<{ to: number; prefix?: string; suffix?: string; at?: number; dur?: number; dp?: number }> = ({ to, prefix = '', suffix = '', at = 6, dur = 28, dp = 0 }) => { const f = useCurrentFrame(); const p = interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); const v = to * p; return <>{prefix}{dp ? v.toFixed(dp) : Math.round(v).toLocaleString('en-US')}{suffix}</> }
const Big: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = NAVY, size = 170 }) => <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 0.92, color, letterSpacing: '-0.03em' }}>{children}</div>

/* =================== DATA PANELS =================== */
const P_zero = () => <Panel kicker="Ladder · Free To Start" foot="No paywall. No catch.">< Big color={RED} size={280}>$0</Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 44, color: INK, marginTop: 6 }}>to begin</div></Panel>
const P_bvdef = () => <Panel kicker="Key Term" foot="Commissions are paid on B.V. — not the sticker price."><Big color={NAVY} size={150}>What is B.V.?</Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: RED, marginTop: 14 }}>Business Volume</div></Panel>
// COMPLIANT BV framing: a DESIGNATED value per product — never "after costs".
const P_bvdef2 = () => <Panel kicker="Business Volume"><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 50, color: INK, lineHeight: 1.32 }}>For every product, Apex <span style={{ color: RED }}>designates a Business Volume</span> — the amount your commission is based on.</div></Panel>
// Two rep-facing earning panels (replaces the old waterfall/split/personal ones)
const P_twoways = () => <Panel kicker="You Get Paid Two Ways" foot="Commission on the B.V. of what you sell."><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 }}><div style={{ width: 260, height: 200, background: NAVY, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 90, color: WHITE }}>1</div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: WHITE }}>Your Sales</div></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 60, color: SOFT }}>+</div><div style={{ width: 260, height: 200, background: RED, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 90, color: WHITE }}>2</div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: WHITE }}>Team Overrides</div></div></div></Panel>
const P_override = () => <Panel kicker="Override Income" foot="A share comes back to you as your team sells."><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 88, color: NAVY, lineHeight: 1.1 }}>You + Your Team</div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 42, color: RED, marginTop: 10 }}>both earn you income</div></Panel>
const P_both = () => <Panel kicker="Two Ways At Once"><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: INK, lineHeight: 1.25 }}>What <span style={{ color: NAVY }}>you sell</span><br />+ what <span style={{ color: RED }}>your team sells</span></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: GREEN, marginTop: 22 }}>= your income grows</div></Panel>
// (Removed: waterfall / bvamount / split / personal panels — non-compliant;
//  reps never see the internal waterfall or company/vendor cut.)
// 9 rank ladder
const RANKS = ['Starter', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Ruby', 'Diamond', 'Crown', 'Elite']
const P_ranks = () => { const f = useCurrentFrame(); return (
  <Panel kicker="Technology · 9 Ranks" foot={<>Starter → <span style={{ color: RED }}>Elite</span></>}>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14, height: 300 }}>
      {RANKS.map((r, i) => { const at = 6 + i * 4; const p = interpolate(f - at, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); const h = 70 + i * 26; const last = i === 8; return (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: clamp(p), transform: `translateY(${(1 - p) * 20}px)` }}><div style={{ width: 90, height: h, background: last ? RED : NAVY, borderRadius: 8, boxShadow: last ? `0 0 24px ${RED}66` : 'none' }} /><div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: last ? RED : INK }}>{r}</div></div>) })}
    </div>
  </Panel>
) }
// rank requirements — personal + group volume targets (code-drawn, generic)
const P_reqs = () => <Panel kicker="Each Rank Has A Target" foot="Hit both to advance."><div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'center' }}><div style={{ width: 340, height: 220, background: NAVY, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: '#ff9d9d' }}>PERSONAL</div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, color: WHITE }}>PV</div></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 54, color: SOFT }}>+</div><div style={{ width: 340, height: 220, background: RED, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: '#ffd9d9' }}>YOUR TEAM'S</div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 72, color: WHITE }}>GV</div></div></div></Panel>
const P_reqs2 = () => <Panel kicker="Reach Bronze" foot={<>Targets grow as you climb<Illus /></>}><div style={{ display: 'flex', gap: 60, justifyContent: 'center', alignItems: 'center' }}><div><Big color={NAVY} size={150}><CountUp to={150} at={6} /></Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 32, color: INK }}>personal volume</div></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 50, color: SOFT }}>+</div><div><Big color={RED} size={150}><CountUp to={300} at={14} /></Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 32, color: INK }}>group volume</div></div></div></Panel>
// how deep overrides pay: 1 level (Starter) → 7 levels (Elite)
const P_levels2 = () => <Panel kicker="Depth Grows With Rank" foot={<>Starter earns 1 level → <span style={{ color: RED }}>Elite earns all 7</span></>}><div style={{ display: 'flex', gap: 50, justifyContent: 'center', alignItems: 'center' }}><div style={{ textAlign: 'center' }}><Big color={NAVY} size={150}>1</Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK }}>level · Starter</div></div><div style={{ fontSize: 60, color: SOFT }}>→</div><div style={{ textAlign: 'center' }}><Big color={RED} size={150}>7</Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK }}>levels · Elite</div></div></div></Panel>
// override schedule — deeper levels unlock/pay more as you climb (generic bars)
const SCHED = [{ l: 'L1', v: 30 }, { l: 'L2', v: 12 }, { l: 'L3', v: 8 }, { l: 'L4', v: 6 }, { l: 'L5', v: 4 }, { l: 'L6', v: 3 }, { l: 'L7', v: 2 }]
const P_schedule = () => { const f = useCurrentFrame(); return (
  <Panel kicker="Override Schedule" foot={<>Higher rank → <span style={{ color: RED }}>more levels, deeper pay</span></>}>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 22, height: 300 }}>{SCHED.map((x, i) => { const p = interpolate(f - (6 + i * 5), [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); const h = 40 + (x.v / 30) * 240; return (<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: clamp(p), transform: `translateY(${(1 - p) * 20}px)` }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 36, color: i === 0 ? RED : INK }}>{x.v}%</div><div style={{ width: 110, height: h, background: i === 0 ? RED : NAVY, borderRadius: 8 }} /><div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: INK }}>{x.l}</div></div>) })}</div>
  </Panel>
) }
// override levels L1-L7 depth
const P_levels = () => { const f = useCurrentFrame(); return (
  <Panel kicker="Override Depth" foot={<>1 level at Starter → <span style={{ color: RED }}>7 levels</span> at the top</>}>
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>{[1, 2, 3, 4, 5, 6, 7].map((L, i) => { const p = interpolate(f - (6 + i * 6), [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); return (<div key={i} style={{ width: 130, height: 130, borderRadius: 18, background: i === 0 ? RED : NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: clamp(p), transform: `scale(${0.7 + clamp(p) * 0.3})` }}><span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 54, color: WHITE }}>L{L}</span></div>) })}</div>
  </Panel>
) }
const P_l1 = () => <Panel kicker="Level 1 · Enrollment Override" foot="On everyone you personally bring in."><Big color={RED} size={220}><CountUp to={30} suffix="%" at={8} /></Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: INK, marginTop: 6 }}>of the override pool — always</div></Panel>
const P_bonuses = () => <Panel kicker="One-Time Rank Bonuses" foot={<>Paid once per rank, along the way<Illus /></>}><Big color={NAVY} size={180}>$<CountUp to={93750} at={8} dur={34} /></Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: INK, marginTop: 8 }}>in bonuses · Starter → Elite</div></Panel>
const P_pv = () => <Panel kicker="To Earn Overrides" foot="Sell a little each month — stay qualified."><Big color={NAVY} size={200}><CountUp to={50} at={8} /> PV</Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: INK, marginTop: 6 }}>personal volume / month</div></Panel>
// insurance range 50-90
const P_range = () => { const f = useCurrentFrame(); const fill = interpolate(f, [8, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); const val = Math.round(50 + fill * 40); return (
  <Panel kicker="Insurance · Your Commission" foot="of first-year premium">
    <Big color={GREEN} size={200}>{val}%</Big>
    <div style={{ width: 1000, height: 26, borderRadius: 13, background: '#d8cfbd', margin: '30px auto 0', overflow: 'hidden' }}><div style={{ height: '100%', width: `${fill * 100}%`, background: `linear-gradient(90deg, ${GREEN}, #3fa06a)` }} /></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', width: 1000, margin: '10px auto 0', fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK }}><span>50% · Pre-Associate</span><span>90% · MGA</span></div>
  </Panel>
) }
const P_ownbook = () => <Panel kicker="You Own Your Book" foot="Your clients. Your renewals. Yours to keep."><Big color={NAVY} size={110}>Your Book</Big><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 60, color: RED, marginTop: 8 }}>Of Business</div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 34, color: INK, marginTop: 18 }}>It stays with you as you grow.</div></Panel>
const P_carriers = () => <Panel kicker="Paid Directly By Carriers" foot="Straight to you."><div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>{['Columbus Life', 'F&G', 'National Life', 'North American', 'Corebridge', 'United of Omaha'].map((c, i) => { const f = useCurrentFrame(); const p = interpolate(f - (6 + i * 5), [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); return <div key={i} style={{ background: NAVY, color: WHITE, fontFamily: FONT, fontWeight: 800, fontSize: 32, padding: '16px 30px', borderRadius: 10, opacity: clamp(p), transform: `translateY(${(1 - p) * 16}px)` }}>{c}</div> })}</div></Panel>
const INR = ['Pre-Associate', 'Associate', 'Sr. Associate', 'Agent', 'Sr. Agent', 'MGA']
const INP = ['50%', '55%', '60%', '70%', '80%', '90%']
const P_inranks = () => { const f = useCurrentFrame(); return (
  <Panel kicker="Insurance · 7 Ranks" foot={<>Climb by <span style={{ color: RED }}>production & quality</span></>}>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 18, height: 300 }}>{INR.map((r, i) => { const p = interpolate(f - (6 + i * 5), [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); const h = 100 + i * 32; const last = i === 5; return (<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: clamp(p), transform: `translateY(${(1 - p) * 20}px)` }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 34, color: last ? RED : GREEN }}>{INP[i]}</div><div style={{ width: 150, height: h, background: last ? RED : NAVY, borderRadius: 8 }} /><div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: INK }}>{r}</div></div>) })}</div>
  </Panel>
) }
const GENS = [{ g: 'Gen 1', p: 15 }, { g: 'Gen 2', p: 5 }, { g: 'Gen 3', p: 3 }, { g: 'Gen 4', p: 2 }, { g: 'Gen 5', p: 1 }, { g: 'Gen 6', p: 0.5 }]
const P_gens = () => { const f = useCurrentFrame(); return (
  <Panel kicker="Insurance · Build A Team" foot={<>Overrides <span style={{ color: RED }}>6 generations</span> deep</>}>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 30, height: 300 }}>{GENS.map((x, i) => { const p = interpolate(f - (6 + i * 5), [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); const h = 30 + (x.p / 15) * 230; return (<div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: clamp(p), transform: `translateY(${(1 - p) * 20}px)` }}><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: i === 0 ? RED : INK }}>{x.p}%</div><div style={{ width: 120, height: h, background: i === 0 ? RED : NAVY, borderRadius: 8 }} /><div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: INK }}>{x.g}</div></div>) })}</div>
  </Panel>
) }
const P_exteam = () => <Panel kicker="Example · Build A Team" foot={<>Each agent writes ~$5,000/mo premium<Illus /></>}><div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'center' }}><div><Big color={NAVY} size={140}><CountUp to={5} at={6} /></Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK }}>you recruit</div></div><div style={{ fontSize: 60, color: SOFT }}>→</div><div><Big color={RED} size={140}><CountUp to={20} at={18} /></Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: INK }}>agent team</div></div></div></Panel>
const P_ex7500 = () => <Panel kicker="Your Override Income" foot={<>On top of your own commissions<Illus /></>}><Big color={GREEN} size={190}>$<CountUp to={7500} at={8} dur={30} />/mo</Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: INK, marginTop: 8 }}>≈ $90,000 a year in overrides</div></Panel>
const P_weekly = () => { const f = useCurrentFrame(); return (<Panel kicker="Insurance · Weekly Bonus" foot="Reward for consistency."><div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>{[1, 2, 3, 4].map((t, i) => { const p = interpolate(f - (6 + i * 6), [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.backOut }); return <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: clamp(p), transform: `translateY(${(1 - p) * 16}px)` }}><div style={{ width: 150, height: 80 + i * 40, background: NAVY, borderRadius: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10 }}><span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: WHITE }}>{t}%</span></div><div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: INK, marginTop: 8 }}>Tier {t}</div></div> })}</div></Panel>) }
const P_recruit = () => <Panel kicker="Insurance · MGA Recruiting Bonus" foot={<>Quarterly · build your shop<Illus /></>}><Big color={RED} size={200}>$<CountUp to={6000} at={8} dur={28} /></Big><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: INK, marginTop: 6 }}>up to, per quarter</div></Panel>
const P_dualtree = () => <Panel kicker="The Difference" foot="No mixing. Fully compliant."><div style={{ display: 'flex', gap: 80, justifyContent: 'center', alignItems: 'center' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: 90 }}>🌳</div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: NAVY }}>Technology</div></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 50, color: SOFT }}>+</div><div style={{ textAlign: 'center' }}><div style={{ fontSize: 90 }}>🌳</div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: RED }}>Insurance</div></div></div><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 34, color: INK, marginTop: 20 }}>Two separate trees</div></Panel>
const P_streams = () => <Panel kicker="Run Both" foot="One team behind you."><div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'center' }}><div><Big color={NAVY} size={120}>Tech</Big></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 60, color: SOFT }}>+</div><div><Big color={RED} size={120}>Insurance</Big></div></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: GREEN, marginTop: 18 }}>= Two Income Streams</div></Panel>

const PANEL_MAP: Record<string, React.FC> = { zero: P_zero, bvdef: P_bvdef, bvdef2: P_bvdef2, twoways: P_twoways, override: P_override, both: P_both, ranks: P_ranks, reqs: P_reqs, reqs2: P_reqs2, levels: P_levels, levels2: P_levels2, schedule: P_schedule, l1: P_l1, bonuses: P_bonuses, pv: P_pv, range: P_range, carriers: P_carriers, ownbook: P_ownbook, inranks: P_inranks, gens: P_gens, exteam: P_exteam, ex7500: P_ex7500, weekly: P_weekly, recruit: P_recruit, dualtree: P_dualtree, streams: P_streams }

/* ---- paper scene (STRONG Ken-Burns: bigger zoom + directional pan, alternating) ---- */
const Scene: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig()
  const p = interpolate(f, [0, durationInFrames], [0, 1], { extrapolateRight: 'clamp', easing: Easing.bezier(0.33, 0, 0.4, 1) })
  const dir = i % 4 // vary the move per scene
  const zoomIn = dir < 2
  const scale = zoomIn ? 1.06 + p * 0.20 : 1.26 - p * 0.20 // push in or pull back — bigger range
  const panX = (dir === 0 ? 1 : dir === 1 ? -1 : dir === 2 ? 1 : -1) * p * 5
  const panY = (dir % 2 === 0 ? -1 : 1) * p * 3
  return (
    <AbsoluteFill style={{ background: NAVY_D, overflow: 'hidden' }}>
      <Img src={staticFile(`comp3/f-${i}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${panX}%, ${panY}%)` }} />
      <Grain />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 52%, rgba(19,38,73,0.6))` }} />
    </AbsoluteFill>
  )
}

/* ---- intro / end / corner ---- */
const Blobs: React.FC = () => { const f = useCurrentFrame(); const d = Math.sin(f * 0.03) * 30; return (<AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 40%, ${NAVY}, ${NAVY_D})` }}><div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: `${RED}22`, filter: 'blur(80px)', top: 120 + d, left: '30%' }} /></AbsoluteFill>) }
const INTRO = S(4.2), END = S(4.5), INTRO_XF = S(0.5), END_XF = S(0.5)
const IntroScreen: React.FC = () => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig()
  const s = spring({ frame: f - 4, fps, config: { damping: 13, stiffness: 130 } })
  // title fades in FAST (12→26) and HOLDS solid until the intro's own out-dissolve.
  const tagIn = interpolate(f, [12, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut })
  const out = interpolate(f, [INTRO - INTRO_XF, INTRO], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 26, opacity: out }}>
      <Blobs />
      <div style={{ background: WHITE, borderRadius: 14, padding: '36px 60px', boxShadow: '0 26px 70px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 40}px) scale(${0.82 + clamp(s) * 0.18})`, opacity: clamp(s) }}><Img src={staticFile('comp3/logo.png')} style={{ height: 150, display: 'block' }} /></div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: WHITE, opacity: tagIn, transform: `translateY(${(1 - tagIn) * 12}px)`, display: 'flex', alignItems: 'center', gap: 14 }}><Star size={26} /> The Insurance Ladder <Star size={26} /></div>
    </AbsoluteFill>
  )
}
const EndScreen: React.FC = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 140 } }); const tag = interpolate(f, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); const url = interpolate(f, [34, 54], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); return (<AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 24 }}><Blobs /><div style={{ background: WHITE, borderRadius: 14, padding: '30px 54px', boxShadow: '0 22px 60px rgba(0,0,0,0.5)', transform: `translateY(${(1 - s) * 34}px) scale(${0.86 + clamp(s) * 0.14})`, opacity: clamp(s) }}><Img src={staticFile('comp3/logo.png')} style={{ height: 120, display: 'block' }} /></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 50, color: WHITE, opacity: tag, textAlign: 'center' }}>Higher Rates. <span style={{ color: '#ff8a8a' }}>Your Book Of Business.</span></div><div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 44, color: WHITE, opacity: url }}>reachtheapex.net</div></AbsoluteFill>) }
const CornerLogo: React.FC<{ from: number; to: number }> = ({ from, to }) => { const f = useCurrentFrame(); const inO = interpolate(f, [from, from + S(0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const outO = interpolate(f, [to - S(0.5), to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <div style={{ position: 'absolute', top: 40, right: 50, opacity: Math.min(inO, outO) }}><div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '10px 18px', boxShadow: '0 6px 22px rgba(0,0,0,0.35)' }}><Img src={staticFile('comp3/logo.png')} style={{ height: 38, display: 'block' }} /></div></div> }

/* ---- timeline ---- */
const PAD = 0.5, XF = 0.4
const segD = vo.map((d) => (d || 6) + PAD)
const bodyFrames = Math.round((segD.reduce((a, b) => a + b, 0) - (segD.length - 1) * XF) * FPS)
export const COMP3_FRAMES = INTRO - INTRO_XF + bodyFrames + END - END_XF
const Dissolve: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => { const f = useCurrentFrame(); const xf = S(XF); const inO = interpolate(f, [0, xf], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const outO = interpolate(f, [dur - xf, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <AbsoluteFill style={{ opacity: Math.min(inO, outO) }}>{children}</AbsoluteFill> }

export const CompVideo3Insurance: React.FC = () => {
  const bodyStart = INTRO - INTRO_XF
  let cursor = 0
  const starts = segD.map((d) => { const from = S(cursor); cursor += d - XF; return bodyStart + from })
  const endStart = bodyStart + bodyFrames - END_XF
  const bgScene = (i: number) => { for (let k = i; k >= 0; k--) if (!PANELS[k]) return k; return 0 }
  return (
    <AbsoluteFill style={{ background: NAVY_D }}>
      <Audio src={staticFile('comp3/musicDucked.mp3')} volume={1} />
      <Audio src={staticFile('comp3/voMaster.mp3')} volume={1} />
      <Sequence from={0} durationInFrames={INTRO}><IntroScreen /></Sequence>
      {segD.map((d, i) => {
        const durF = S(d); const panel = PANELS[i]; const cap = CAPS[i]; const P = panel ? PANEL_MAP[panel] : null
        const finale = i === FINALE
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={durF + 2}>
            <Dissolve dur={durF}>
              <AbsoluteFill>
                {panel ? (
                  <AbsoluteFill style={{ background: NAVY_D }}>
                    {/* darkened paper texture behind panels (nearest scene image) */}
                    <Img src={staticFile(`comp3/f-${bgScene(i)}.png`)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.45) saturate(1.05)', transform: 'scale(1.12)' }} />
                    <AbsoluteFill style={{ background: 'rgba(19,38,73,0.55)' }} />
                    {P ? <P /> : null}
                  </AbsoluteFill>
                ) : finale ? (
                  // Finale = hero scene + a torn caption ONLY. The dedicated
                  // EndScreen (after this) is the single CTA card — no duplicate
                  // logo/URL card here (that caused the end-title flash/blink).
                  <AbsoluteFill><Scene i={i} />
                    <CaptionCard c={{ kicker: 'The Insurance Ladder', head: 'Higher Rates. Your Book. Team Overrides.', accent: 'Your Book.' }} />
                  </AbsoluteFill>
                ) : (
                  <><Scene i={i} />{cap && (cap as any).head ? <CaptionCard c={cap} /> : null}</>
                )}
              </AbsoluteFill>
            </Dissolve>
          </Sequence>
        )
      })}
      <Sequence from={endStart} durationInFrames={END}><EndScreen /></Sequence>
      <CornerLogo from={bodyStart} to={endStart + S(0.3)} />
    </AbsoluteFill>
  )
}
