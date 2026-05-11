'use client'

import { useState } from 'react'

const LAYOUTS = ['modern', 'minimal', 'corporate', 'two-column'] as const
type Layout = typeof LAYOUTS[number]

// Sample data
const agent = { name: 'Sarah Anderson', company: 'Anderson Financial Group', photo: null }
const quote = {
  items: [
    { description: 'Index Universal Life Policy Setup', amount: 2500 },
    { description: 'Financial Planning Consultation', amount: 750 },
    { description: 'Annual Review (first year)', amount: 0 },
  ],
  total: 3250,
}
const metrics = [
  { label: 'Death Benefit', value: '$176,204' },
  { label: 'Annual Premium', value: '$10,000' },
  { label: 'Cash Value (Yr 10)', value: '$116,371' },
  { label: 'Payment Mode', value: 'Annual' },
]

function ModernLayout() {
  return (
    <div style={{ background: '#0A1628', color: 'white', minHeight: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Hero header with gradient */}
      <div style={{ background: 'linear-gradient(135deg, #0A1628, #1B365D)', padding: '40px 32px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#C7E8A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0A1628', fontSize: 16 }}>SA</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{agent.name}</div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>{agent.company}</div>
            </div>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>Your Policy Explained</h1>
          <p style={{ fontSize: 14, opacity: 0.5 }}>American General &middot; Index Universal Life</p>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px' }}>
        {/* Video placeholder */}
        <div style={{ aspectRatio: '16/9', background: '#1B365D', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(199,232,168,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#C7E8A8"><polygon points="8 4 20 12 8 20" /></svg>
          </div>
        </div>

        {/* Key metrics */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C7E8A8', marginBottom: 14 }}>Key Numbers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {metrics.map((m, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quote */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C7E8A8', marginBottom: 14 }}>Quote</div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
            {quote.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < quote.items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ fontSize: 14 }}>{item.description}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{item.amount === 0 ? 'FREE' : `$${item.amount.toLocaleString()}`}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 18px', background: 'rgba(199,232,168,0.08)', borderTop: '1px solid rgba(199,232,168,0.15)' }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#C7E8A8' }}>${quote.total.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={{ flex: 1, padding: '14px', background: '#C7E8A8', color: '#0A1628', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Accept &amp; Pay ${quote.total.toLocaleString()} &rarr;</button>
            <button style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Request Changes</button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 32 }}>
          <button style={{ padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, color: 'white', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>&#128197;</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Book a Meeting</div>
          </button>
          <button style={{ padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, color: 'white', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>&#128196;</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Download PDF</div>
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.3, paddingBottom: 40 }}>Powered by Docs2Video</div>
      </div>

      {/* Chat widget */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 10, background: '#C7E8A8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A1628" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
    </div>
  )
}

function MinimalLayout() {
  return (
    <div style={{ background: '#FAFAF5', color: '#1a1a1a', minHeight: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px' }}>
        {/* Simple header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E8E4DB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>SA</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{agent.company}</div>
          </div>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Your Policy Overview</h1>
        <p style={{ fontSize: 15, color: '#888', marginBottom: 32 }}>Watch the explainer video below, then review the details.</p>

        {/* Video */}
        <div style={{ aspectRatio: '16/9', background: '#E8E4DB', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="8 4 20 12 8 20" /></svg>
          </div>
        </div>

        {/* Metrics as simple list */}
        <div style={{ marginBottom: 40 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #E8E4DB' }}>
              <span style={{ fontSize: 14, color: '#888' }}>{m.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div style={{ background: 'white', border: '1px solid #E8E4DB', borderRadius: 10, padding: 24, marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999', marginBottom: 16 }}>Quote</div>
          {quote.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < quote.items.length - 1 ? '1px solid #f0ede6' : 'none', fontSize: 14 }}>
              <span>{item.description}</span>
              <span style={{ fontWeight: 600 }}>{item.amount === 0 ? 'Free' : `$${item.amount.toLocaleString()}`}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0', marginTop: 12, borderTop: '2px solid #1a1a1a' }}>
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800 }}>${quote.total.toLocaleString()}</span>
          </div>
        </div>

        <button style={{ width: '100%', padding: '16px', background: '#1a1a1a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 12 }}>Accept &amp; Pay ${quote.total.toLocaleString()}</button>
        <button style={{ width: '100%', padding: '14px', background: 'transparent', color: '#888', border: '1px solid #E8E4DB', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 40 }}>Request Changes</button>

        <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
          <button style={{ flex: 1, padding: '14px', background: 'white', border: '1px solid #E8E4DB', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Book a Meeting</button>
          <button style={{ flex: 1, padding: '14px', background: 'white', border: '1px solid #E8E4DB', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Download PDF</button>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', paddingBottom: 40 }}>Powered by Docs2Video</div>
      </div>
    </div>
  )
}

function CorporateLayout() {
  return (
    <div style={{ background: '#F4F1EC', color: '#0F1A12', minHeight: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Brand bar */}
      <div style={{ background: '#0F1A12', color: 'white', padding: '14px 32px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#C7E8A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0F1A12', fontSize: 12 }}>SA</div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{agent.company}</span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.5 }}>Presentation for Mr. Client</span>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 32px' }}>
        {/* Title card */}
        <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 32, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6FA13A', marginBottom: 8 }}>Presentation</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Index Universal Life — Policy Overview</h1>
          <p style={{ fontSize: 14, color: '#8A968D' }}>Prepared by {agent.name} &middot; {agent.company}</p>
        </div>

        {/* Video */}
        <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ aspectRatio: '16/9', background: '#0F1A12', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(199,232,168,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#C7E8A8"><polygon points="8 4 20 12 8 20" /></svg>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ background: i === 0 ? '#C7E8A8' : i === 3 ? '#FFD9B8' : 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: '18px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#4B574F', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5DFD3', background: '#FAF7F2' }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A968D' }}>Quote Summary</span>
          </div>
          {quote.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #EFEAE0', fontSize: 14 }}>
              <span>{item.description}</span>
              <span style={{ fontWeight: 700 }}>{item.amount === 0 ? 'Included' : `$${item.amount.toLocaleString()}`}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 20px', background: '#0F1A12', color: 'white' }}>
            <span style={{ fontWeight: 700 }}>Total Due</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#C7E8A8' }}>${quote.total.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button style={{ flex: 2, padding: '16px', background: '#0F1A12', color: '#C7E8A8', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Accept &amp; Pay ${quote.total.toLocaleString()} &rarr;</button>
          <button style={{ flex: 1, padding: '16px', background: 'white', color: '#0F1A12', border: '1px solid #E5DFD3', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Request Changes</button>
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 40 }}>
          <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#128197;</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Book Meeting</div>
            <div style={{ fontSize: 11, color: '#8A968D', marginTop: 2 }}>Schedule a call</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#128196;</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Download PDF</div>
            <div style={{ fontSize: 11, color: '#8A968D', marginTop: 2 }}>High-res export</div>
          </div>
          <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#128172;</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Ask AI</div>
            <div style={{ fontSize: 11, color: '#8A968D', marginTop: 2 }}>Get instant answers</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc' }}>Powered by Docs2Video</div>
      </div>
    </div>
  )
}

function TwoColumnLayout() {
  return (
    <div style={{ background: '#F4F1EC', color: '#0F1A12', minHeight: '100%', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Brand bar */}
      <div style={{ background: '#0F1A12', color: 'white', padding: '14px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#C7E8A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0F1A12', fontSize: 12 }}>SA</div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{agent.company}</span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.5 }}>Prepared for Mr. Client</span>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px' }}>
        {/* Two columns — video left, everything else right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 28, alignItems: 'start' }}>

          {/* LEFT — Video + metrics */}
          <div>
            {/* Video player */}
            <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 10, marginBottom: 20 }}>
              <div style={{ aspectRatio: '16/9', background: '#0F1A12', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(199,232,168,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#C7E8A8"><polygon points="8 4 20 12 8 20" /></svg>
                </div>
              </div>
              <div style={{ padding: '14px 8px 6px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6FA13A', marginBottom: 4 }}>Presentation</div>
                <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>Index Universal Life — Policy Overview</h1>
                <p style={{ fontSize: 13, color: '#8A968D' }}>Prepared by {agent.name}</p>
              </div>
            </div>

            {/* Key metrics below video */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {metrics.map((m, i) => (
                <div key={i} style={{ background: i === 0 ? '#C7E8A8' : i === 1 ? '#FFD9B8' : 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#4B574F', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Downloads */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>&#128196; Download PDF</button>
              <button style={{ flex: 1, padding: '12px', background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>&#128249; Download Video</button>
            </div>
          </div>

          {/* RIGHT — Quote, payment, calendar, chat */}
          <div>
            {/* Quote */}
            <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5DFD3', background: '#FAF7F2' }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A968D' }}>Quote</span>
              </div>
              {quote.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #EFEAE0', fontSize: 13 }}>
                  <span>{item.description}</span>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 12 }}>{item.amount === 0 ? 'Free' : `$${item.amount.toLocaleString()}`}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 18px', background: '#0F1A12', color: 'white' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#C7E8A8' }}>${quote.total.toLocaleString()}</span>
              </div>
            </div>

            <button style={{ width: '100%', padding: '16px', background: '#0F1A12', color: '#C7E8A8', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 8 }}>Accept &amp; Pay ${quote.total.toLocaleString()} &rarr;</button>
            <button style={{ width: '100%', padding: '11px', background: 'transparent', color: '#8A968D', border: '1px solid #E5DFD3', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>Request Changes</button>

            {/* Calendar */}
            <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 20, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#C7E8A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>&#128197;</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Book a Meeting</div>
                  <div style={{ fontSize: 12, color: '#8A968D' }}>Schedule a call with {agent.name}</div>
                </div>
              </div>
              <button style={{ width: '100%', padding: '12px', background: '#C7E8A8', color: '#0F1A12', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>View Available Times &rarr;</button>
            </div>

            {/* AI Chat */}
            <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 20, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#DDD0F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>&#128172;</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Ask AI Assistant</div>
                  <div style={{ fontSize: 12, color: '#8A968D' }}>Get instant answers about this document</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Type your question..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #E5DFD3', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                <button style={{ padding: '10px 16px', background: '#0F1A12', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Ask</button>
              </div>
            </div>

            {/* Agent contact */}
            <div style={{ background: 'white', border: '1px solid #E5DFD3', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#C7E8A8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#0F1A12', fontSize: 16, flexShrink: 0 }}>SA</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: '#8A968D' }}>{agent.company}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', padding: '40px 0 20px' }}>Powered by Docs2Video</div>
      </div>
    </div>
  )
}

export default function ShareDemoPage() {
  const [layout, setLayout] = useState<Layout>('corporate')

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Layout picker */}
      <div style={{ background: '#0F1A12', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginRight: 8 }}>SHARE PAGE LAYOUTS:</span>
        {LAYOUTS.map((l) => (
          <button
            key={l}
            onClick={() => setLayout(l)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: layout === l ? '#C7E8A8' : 'rgba(255,255,255,0.08)',
              color: layout === l ? '#0F1A12' : 'rgba(255,255,255,0.6)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Preview */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {layout === 'modern' && <ModernLayout />}
        {layout === 'minimal' && <MinimalLayout />}
        {layout === 'corporate' && <CorporateLayout />}
        {layout === 'two-column' && <TwoColumnLayout />}
      </div>
    </div>
  )
}
