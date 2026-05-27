'use client'

import { useState } from 'react'

interface PreviewScene {
  scene: number
  title: string
  narration: string
  slidePrompt: string
  duration: number
}

interface QuickPreviewProps {
  scenes: PreviewScene[]
  slides: (string | null)[]
  totalScenes: number
  onApprove: () => void
  onEditScript: () => void
  approving: boolean
}

export default function QuickPreview({
  scenes,
  slides,
  totalScenes,
  onApprove,
  onEditScript,
  approving,
}: QuickPreviewProps) {
  const [activeSlide, setActiveSlide] = useState(0)

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      {/* Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px', marginBottom: 24, borderRadius: 10,
        background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
        border: '1px solid #bbf7d0',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <div style={{ fontSize: 13, color: '#166534' }}>
          <strong>Quick Preview</strong> — Showing {scenes.length} of {totalScenes} scenes. Your full video will have all {totalScenes} scenes.
        </div>
      </div>

      {/* Main preview area */}
      <div style={{
        display: 'flex', gap: 24, marginBottom: 24,
      }}>
        {/* Large slide preview */}
        <div style={{ flex: 1 }}>
          {slides[activeSlide] ? (
            <img
              src={slides[activeSlide]!}
              alt={`Preview slide ${activeSlide + 1}`}
              style={{
                width: '100%', borderRadius: 10,
                border: '1px solid var(--border-light)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              }}
            />
          ) : (
            <div style={{
              width: '100%', aspectRatio: '16/9', borderRadius: 10,
              background: 'var(--bg-soft)', border: '1px solid var(--border-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'var(--ink-light)',
            }}>
              Slide preview unavailable
            </div>
          )}
        </div>
      </div>

      {/* Scene cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {scenes.map((scene, i) => (
          <div
            key={i}
            onClick={() => setActiveSlide(i)}
            style={{
              flex: 1, cursor: 'pointer', borderRadius: 10,
              border: activeSlide === i ? '2px solid var(--mint)' : '1px solid var(--border-light)',
              background: activeSlide === i ? 'rgba(168,240,212,0.08)' : 'white',
              overflow: 'hidden', transition: 'all 0.15s',
            }}
          >
            {/* Thumbnail */}
            {slides[i] ? (
              <img
                src={slides[i]!}
                alt={`Slide ${i + 1}`}
                style={{ width: '100%', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '16/9',
                background: 'var(--bg-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--ink-light)',
              }}>
                No preview
              </div>
            )}
            {/* Scene info */}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                Scene {i + 1}: {scene.title}
              </div>
              <div style={{
                fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical' as any, overflow: 'hidden',
              }}>
                {scene.narration}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Script text for active scene */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)',
        borderRadius: 10, padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
          Scene {activeSlide + 1} narration:
        </div>
        <div style={{
          fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}>
          {scenes[activeSlide]?.narration ?? ''}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={onEditScript}
          className="btn btn-soft"
          style={{ fontSize: 14, padding: '12px 28px', borderRadius: 10 }}
        >
          Edit Script First
        </button>
        <button
          onClick={onApprove}
          disabled={approving}
          className="btn btn-primary"
          style={{
            fontSize: 14, padding: '12px 28px', borderRadius: 10,
            opacity: approving ? 0.6 : 1,
          }}
        >
          {approving ? 'Starting generation...' : 'Looks Good \u2014 Generate Full Video'}
        </button>
      </div>
    </div>
  )
}
