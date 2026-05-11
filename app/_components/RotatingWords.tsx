'use client'

import { useState, useEffect } from 'react'

const WORDS = [
  'Insurance',
  'Corporate',
  'Entertainment',
  'Sales Teams',
  'Real Estate',
  'Healthcare',
  'Legal',
  'Education',
  'Consulting',
]

export default function RotatingWords() {
  const [index, setIndex] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true)
      setTimeout(() => {
        setIndex(i => (i + 1) % WORDS.length)
        setAnimating(false)
      }, 600)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="rotating-words-wrap">
      <span className={`rotating-word ${animating ? 'swipe' : ''}`}>
        {WORDS[index]}
      </span>
      <style>{`
        .rotating-words-wrap {
          position: relative;
          display: inline-block;
          overflow: hidden;
          vertical-align: bottom;
          padding-right: 8px;
        }
        .rotating-word {
          display: inline-block;
          position: relative;
          color: var(--mint-darker, #4a7c59);
          font-style: italic;
          font-family: 'Instrument Serif', serif;
        }
        .rotating-word::after {
          content: '';
          position: absolute;
          top: 2px;
          bottom: 2px;
          left: -4px;
          width: calc(100% + 8px);
          background: var(--mint);
          transform: translateX(-110%);
          border-radius: 4px;
        }
        .rotating-word.swipe::after {
          animation: highlight-swipe 0.6s ease forwards;
        }
        @keyframes highlight-swipe {
          0% { transform: translateX(-110%); }
          45% { transform: translateX(0%); }
          55% { transform: translateX(0%); }
          100% { transform: translateX(110%); }
        }
      `}</style>
    </span>
  )
}
