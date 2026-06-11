'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const industries = [
  { name: 'Insurance', href: '/for/insurance', desc: 'Simplify policy explanations and claims processes', icon: '🛡️' },
  { name: 'Real Estate', href: '/for/real-estate', desc: 'Showcase listings and market reports visually', icon: '🏠' },
  { name: 'Financial Services', href: '/for/financial-services', desc: 'Present financial data with clarity and impact', icon: '📊' },
  { name: 'Legal', href: '/for/legal', desc: 'Transform legal documents into clear visuals', icon: '⚖️' },
  { name: 'Healthcare', href: '/for/healthcare', desc: 'Communicate health information effectively', icon: '🏥' },
  { name: 'Consulting', href: '/for/consulting', desc: 'Deliver insights through polished presentations', icon: '💼' },
  { name: 'Education', href: '/for/education', desc: 'Create engaging educational content at scale', icon: '🎓' },
  { name: 'Mortgage', href: '/for/mortgage', desc: 'Explain rates and processes with visual guides', icon: '🏦' },
  { name: 'Non-Profit', href: '/for/non-profit', desc: 'Share your mission with compelling visuals', icon: '❤️' },
  { name: 'Human Resources', href: '/for/human-resources', desc: 'Streamline onboarding and training materials', icon: '👥' },
  { name: 'Coaching', href: '/for/coaching', desc: 'Build branded content for your coaching practice', icon: '🎯' },
  { name: 'Personal Training', href: '/for/fitness', desc: 'Create workout guides and fitness content', icon: '💪' },
  { name: 'Property Management', href: '/for/property-management', desc: 'Automate tenant communications and reports', icon: '🏢' },
  { name: 'Medical', href: '/for/medical', desc: 'Produce patient education and medical visuals', icon: '🩺' },
]

export default function IndustryMegaMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on click outside (mobile)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200)
  }

  return (
    <div
      ref={menuRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.85)',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: 0,
          fontFamily: 'inherit',
        }}
      >
        Industries
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(780px, 90vw)',
            background: 'var(--bg-card, #fff)',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '24px',
            zIndex: 9999,
            animation: 'megaMenuFadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '4px',
            }}
          >
            {industries.map((ind) => (
              <Link
                key={ind.href}
                href={ind.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: 'var(--ink, #1a1a2e)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span style={{ fontSize: '20px', lineHeight: '1.4', flexShrink: 0 }}>{ind.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '1.3' }}>{ind.name}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', lineHeight: '1.4', marginTop: '2px' }}>{ind.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes megaMenuFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
