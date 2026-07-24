import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'

/* ============================================================================
 * INFOGRAPHIC STYLE SAMPLE — the clean "data" look (minimal motion, precise
 * wipes, focus on numbers). Demonstrates 4 infographic layouts as a proof:
 *   1) Dashboard grid (2x2 stat cards)
 *   2) Big-number + supporting chart + small stats
 *   3) Vertical timeline / process
 *   4) Comparison / before-after with stat bars
 * All code-drawn (like TemplateCommercial beats) so it's animatable & crisp.
 * ==========================================================================*/
const FPS = 30
// "data" style palette — clean, analytical, light
const BG = '#0e1420', BG2 = '#141d2e', PANEL = '#1b2740', LINE = '#2b3a56'
const ACC = '#3f8cff', ACC2 = '#28d39a', HOT = '#ffb547', RED = '#ff5c6c', INK = '#e8eefc', MUTE = '#8fa3c4', WHITE = '#fff'
const DISP = 'Archivo, Inter, system-ui, sans-serif', BODY = 'Inter, system-ui, sans-serif', MONO = 'ui-monospace, Menlo, monospace'
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const S = (sec: number) => Math.round(sec * FPS)
const EASE = { expoOut: Easing.bezier(0.16, 1, 0.3, 1), wipe: Easing.bezier(0.65, 0, 0.35, 1) }

/* subtle data-grid background (blueprint feel) */
const GridBg: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 100% at 70% 10%, ${BG2}, ${BG})` }}>
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(${LINE}22 1px, transparent 1px), linear-gradient(90deg, ${LINE}22 1px, transparent 1px)`, backgroundSize: '54px 54px', opacity: 0.6 }} />
    <AbsoluteFill style={{ background: 'radial-gradient(90% 70% at 50% 40%, transparent 50%, rgba(0,0,0,0.5))' }} />
  </AbsoluteFill>
)

/* precise WIPE-in headline (the 'data' reveal) */
const Head: React.FC<{ kicker: string; head: string; accent?: string }> = ({ kicker, head, accent }) => {
  const f = useCurrentFrame()
  const w = interpolate(f, [4, 20], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.wipe })
  const kO = interpolate(f, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const el = accent && head.includes(accent) ? <>{head.replace(accent, '')}<span style={{ color: ACC }}>{accent}</span></> : head
  return (
    <div style={{ position: 'absolute', left: 90, top: 74 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: kO }}>
        <div style={{ width: 34, height: 4, background: ACC }} />
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: '0.22em', color: ACC2, textTransform: 'uppercase' }}>{kicker}</div>
      </div>
      <div style={{ marginTop: 12, fontFamily: DISP, fontWeight: 900, fontSize: 68, color: INK, letterSpacing: '-0.02em', clipPath: `inset(0 ${100 - w}% 0 0)` }}>{el}</div>
    </div>
  )
}

const CountUp: React.FC<{ to: number; at?: number; dur?: number; prefix?: string; suffix?: string; dp?: number }> = ({ to, at = 8, dur = 30, prefix = '', suffix = '', dp = 0 }) => {
  const f = useCurrentFrame(); const p = interpolate(f - at, [0, dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); const v = to * p
  return <>{prefix}{dp ? v.toFixed(dp) : Math.round(v).toLocaleString('en-US')}{suffix}</>
}

/* ---------- Layout 1: DASHBOARD 2x2 STAT CARDS ---------- */
const StatCard: React.FC<{ icon: string; value: number; prefix?: string; suffix?: string; label: string; at: number; accent: string; dp?: number }> = ({ icon, value, prefix, suffix, label, at, accent, dp }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - at, fps, config: { damping: 18, stiffness: 150 } })
  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 16, padding: '30px 34px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 18px 40px rgba(0,0,0,0.35)', transform: `translateY(${(1 - clamp(s)) * 26}px)`, opacity: clamp(s), position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', background: accent }} />
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ fontFamily: DISP, fontWeight: 900, fontSize: 84, color: WHITE, lineHeight: 0.95, letterSpacing: '-0.03em' }}><span style={{ color: accent }}><CountUp to={value} at={at + 2} prefix={prefix} suffix={suffix} dp={dp} /></span></div>
      <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 26, color: MUTE }}>{label}</div>
    </div>
  )
}
const Dashboard: React.FC = () => (
  <AbsoluteFill>
    <GridBg /><Head kicker="Apex · At A Glance" head="The Opportunity, In Numbers." accent="In Numbers." />
    <div style={{ position: 'absolute', left: 90, right: 90, top: 240, bottom: 80, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 26 }}>
      <StatCard icon="🪜" value={9} label="Technology ranks" at={14} accent={ACC} />
      <StatCard icon="💵" value={93750} prefix="$" label="In rank bonuses" at={20} accent={ACC2} />
      <StatCard icon="📈" value={7} label="Override levels deep" at={26} accent={HOT} />
      <StatCard icon="🔓" value={0} prefix="$" label="Cost to get started" at={32} accent={RED} />
    </div>
  </AbsoluteFill>
)

/* ---------- Layout 2: BIG NUMBER + CHART + SMALL STATS ---------- */
const BarChart: React.FC<{ data: { l: string; v: number }[]; max: number; accent: string }> = ({ data, max, accent }) => {
  const f = useCurrentFrame()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 300, padding: '0 8px' }}>
      {data.map((d, i) => { const p = interpolate(f - (16 + i * 4), [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); const h = (d.v / max) * 260 * p; const last = i === data.length - 1; return (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, color: last ? accent : MUTE, opacity: p }}>{d.v}</div>
          <div style={{ width: '100%', maxWidth: 70, height: h, background: last ? accent : `${accent}66`, borderRadius: 6 }} />
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: MUTE }}>{d.l}</div>
        </div>) })}
    </div>
  )
}
const BigNumberChart: React.FC = () => {
  const f = useCurrentFrame()
  return (
    <AbsoluteFill>
      <GridBg /><Head kicker="Team Overrides" head="Income That Compounds." accent="Compounds." />
      <div style={{ position: 'absolute', left: 90, top: 250, width: 720 }}>
        <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 30, color: MUTE }}>A Silver leader can earn about</div>
        <div style={{ fontFamily: DISP, fontWeight: 900, fontSize: 220, color: ACC2, lineHeight: 0.9, letterSpacing: '-0.04em', marginTop: 6 }}>$<CountUp to={745} at={8} dur={34} /></div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 34, color: INK, marginTop: 6 }}>per month <span style={{ color: MUTE, fontStyle: 'italic', fontSize: 24 }}>· illustrative</span></div>
        <div style={{ display: 'flex', gap: 40, marginTop: 34 }}>
          {[{ v: 5, l: 'leaders' }, { v: 30, l: 'team' }, { v: 4, l: 'income streams' }].map((s, i) => (
            <div key={i}><div style={{ fontFamily: DISP, fontWeight: 900, fontSize: 60, color: WHITE }}><CountUp to={s.v} at={12 + i * 3} /></div><div style={{ fontFamily: BODY, fontSize: 22, color: MUTE }}>{s.l}</div></div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 90, top: 300, width: 720, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 18, padding: '34px 40px', boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 20, letterSpacing: '0.18em', color: HOT, textTransform: 'uppercase', marginBottom: 20 }}>Monthly Growth · Illustrative</div>
        <BarChart data={[{ l: 'M1', v: 90 }, { l: 'M2', v: 260 }, { l: 'M3', v: 480 }, { l: 'M4', v: 745 }]} max={800} accent={ACC2} />
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Layout 3: VERTICAL TIMELINE / PROCESS ---------- */
const Timeline: React.FC = () => {
  const f = useCurrentFrame()
  const steps = [
    { n: '01', icon: '🎯', t: 'Be a product of the product', d: 'Use the tool yourself first.' },
    { n: '02', icon: '🛒', t: 'Get your three customers', d: 'Small enough anyone can do it.' },
    { n: '03', icon: '🤝', t: 'Develop five leaders', d: 'Who do exactly what you did.' },
    { n: '04', icon: '🔁', t: 'Teach them to duplicate', d: 'And it multiplies through your team.' },
  ]
  const lineP = interpolate(f, [12, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.wipe })
  return (
    <AbsoluteFill>
      <GridBg /><Head kicker="The System" head="The 5 & 3 Process." accent="5 & 3 Process." />
      <div style={{ position: 'absolute', left: 150, top: 260, bottom: 70, width: 4, background: LINE }}>
        <div style={{ width: '100%', height: `${lineP * 100}%`, background: ACC }} />
      </div>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 250, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {steps.map((s, i) => { const at = 14 + i * 10; const p = interpolate(f - at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 30, opacity: clamp(p), transform: `translateX(${(1 - clamp(p)) * 30}px)` }}>
            <div style={{ flexShrink: 0, width: 64, height: 64, borderRadius: '50%', background: BG, border: `4px solid ${ACC}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontWeight: 800, fontSize: 24, color: ACC, zIndex: 2 }}>{s.n}</div>
            <div style={{ flex: 1, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: '20px 30px', display: 'flex', alignItems: 'center', gap: 22 }}>
              <div style={{ fontSize: 40 }}>{s.icon}</div>
              <div><div style={{ fontFamily: DISP, fontWeight: 800, fontSize: 40, color: INK }}>{s.t}</div><div style={{ fontFamily: BODY, fontSize: 26, color: MUTE }}>{s.d}</div></div>
            </div>
          </div>) })}
      </div>
    </AbsoluteFill>
  )
}

/* ---------- Layout 4: COMPARISON / BEFORE-AFTER ---------- */
const CompareCol: React.FC<{ side: 'a' | 'b'; title: string; sub: string; rows: { l: string; v: number }[]; at: number }> = ({ side, title, sub, rows, at }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = spring({ frame: f - at, fps, config: { damping: 18, stiffness: 140 } })
  const accent = side === 'a' ? RED : ACC2
  return (
    <div style={{ flex: 1, background: side === 'a' ? '#231822' : '#132a26', border: `1px solid ${side === 'a' ? '#4a2b30' : '#1e4a40'}`, borderRadius: 18, padding: '34px 40px', transform: `translateY(${(1 - clamp(s)) * 30}px)`, opacity: clamp(s) }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: '0.16em', color: accent, textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontFamily: BODY, fontSize: 26, color: MUTE, marginBottom: 26 }}>{sub}</div>
      {rows.map((r, i) => { const p = interpolate(f - (at + 8 + i * 4), [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.expoOut }); return (
        <div key={i} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: BODY, fontWeight: 700, fontSize: 26, color: INK, marginBottom: 8 }}><span>{r.l}</span><span style={{ color: accent }}>{Math.round(r.v * p)}%</span></div>
          <div style={{ height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${r.v * p}%`, background: accent, borderRadius: 8 }} /></div>
        </div>) })}
    </div>
  )
}
const Comparison: React.FC = () => (
  <AbsoluteFill>
    <GridBg /><Head kicker="Before & After" head="Jordyn Changes The Math." accent="The Math." />
    <div style={{ position: 'absolute', left: 90, right: 90, top: 260, bottom: 80, display: 'flex', gap: 30, alignItems: 'stretch' }}>
      <CompareCol side="a" title="Without Jordyn" sub="Buried in busywork" rows={[{ l: 'Inbox handled', v: 40 }, { l: 'Follow-ups on time', v: 35 }, { l: 'Time on real work', v: 45 }]} at={14} />
      <div style={{ display: 'flex', alignItems: 'center', fontFamily: DISP, fontWeight: 900, fontSize: 60, color: MUTE }}>→</div>
      <CompareCol side="b" title="With Jordyn" sub="~8 hours back a week" rows={[{ l: 'Inbox handled', v: 95 }, { l: 'Follow-ups on time', v: 98 }, { l: 'Time on real work', v: 90 }]} at={20} />
    </div>
  </AbsoluteFill>
)

/* ---------- title cards between layouts ---------- */
const TitleCard: React.FC<{ n: string; t: string }> = ({ n, t }) => {
  const f = useCurrentFrame(); const w = interpolate(f, [4, 22], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.wipe })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 18 }}>
      <GridBg />
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: '0.3em', color: ACC2 }}>{n}</div>
      <div style={{ fontFamily: DISP, fontWeight: 900, fontSize: 84, color: INK, letterSpacing: '-0.02em', clipPath: `inset(0 ${100 - w}% 0 0)` }}>{t}</div>
    </AbsoluteFill>
  )
}

const D = S(4.6), T = S(1.6)
export const INFOG_FRAMES = T + D + T + D + T + D + T + D + S(2.2)
const Xf: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => { const f = useCurrentFrame(); const x = S(0.35); const i = interpolate(f, [0, x], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const o = interpolate(f, [dur - x, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <AbsoluteFill style={{ opacity: Math.min(i, o) }}>{children}</AbsoluteFill> }

export const InfographicSample: React.FC = () => {
  let c = 0; const seq = (dur: number, node: React.ReactNode) => { const from = c; c += dur; return <Sequence from={from} durationInFrames={dur + 2}><Xf dur={dur}>{node}</Xf></Sequence> }
  return (
    <AbsoluteFill style={{ background: BG }}>
      {seq(T, <TitleCard n="LAYOUT 1" t="Dashboard Grid" />)}
      {seq(D, <Dashboard />)}
      {seq(T, <TitleCard n="LAYOUT 2" t="Hero Number + Chart" />)}
      {seq(D, <BigNumberChart />)}
      {seq(T, <TitleCard n="LAYOUT 3" t="Timeline / Process" />)}
      {seq(D, <Timeline />)}
      {seq(T, <TitleCard n="LAYOUT 4" t="Before / After" />)}
      {seq(D, <Comparison />)}
      {seq(S(2.2), <TitleCard n="INFOGRAPHIC STYLE" t="Ready To Wire In." />)}
    </AbsoluteFill>
  )
}
