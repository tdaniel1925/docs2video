'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const INTENTS = [
  { id: 'sales', icon: '🎯', title: 'Sales Pitch', desc: 'Convince someone to buy, sign up, or take action', questions: ['Who are you selling to?', 'What\'s the main benefit?'] },
  { id: 'educate', icon: '📚', title: 'Educate', desc: 'Explain a topic clearly to clients or the public', questions: ['Who is the audience?', 'What should they understand after watching?'] },
  { id: 'train', icon: '🏋️', title: 'Train', desc: 'Teach employees or team members a process', questions: ['Who is being trained?', 'What skill or process are they learning?'] },
  { id: 'report', icon: '📊', title: 'Present Data', desc: 'Share results, metrics, or a report visually', questions: ['Who will see this report?', 'What\'s the key takeaway?'] },
  { id: 'proposal', icon: '🤝', title: 'Win a Deal', desc: 'Pitch a proposal to win a client or project', questions: ['Who are you pitching to?', 'What makes your offer unique?'] },
  { id: 'custom', icon: '✨', title: 'Something Else', desc: 'Describe your goal and we\'ll figure it out', questions: ['What do you want this video to accomplish?'] },
]

export default function CreateGoalPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [step, setStep] = useState<'choose' | 'resume' | 'refine' | 'confirm'>('choose')
  const [answers, setAnswers] = useState<string[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [currentQ, setCurrentQ] = useState(0)
  const [refinedPurpose, setRefinedPurpose] = useState('')
  const [refining, setRefining] = useState(false)
  const [pendingState, setPendingState] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const intent = INTENTS.find(i => i.id === selected)

  // Check for pending creation on mount
  useEffect(() => {
    const existing = localStorage.getItem('d2v_create')
    if (existing) {
      try {
        const state = JSON.parse(existing)
        if (state.purpose || state.extractedData || state.scenes) {
          setPendingState(state)
          setStep('resume')
          return
        }
      } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    if (step === 'refine' && inputRef.current) inputRef.current.focus()
  }, [step, currentQ])

  function handleStartFresh() {
    localStorage.removeItem('d2v_create')
    sessionStorage.removeItem('d2v_file')
    sessionStorage.removeItem('d2v_fileName')
    sessionStorage.removeItem('d2v_fileType')
    setPendingState(null)
    setStep('choose')
  }

  function handleResume() {
    // Figure out where they left off and navigate there
    const state = pendingState
    if (state.scenes?.length > 0) router.push('/create/script')
    else if (state.extractedData) router.push('/create/review')
    else if (state.purpose) router.push('/create/source')
    else router.push('/create/source')
  }

  function handleSelectIntent(id: string) {
    // Clear any old state when starting fresh
    localStorage.removeItem('d2v_create')
    setSelected(id)
    setStep('refine')
    setAnswers([])
    setCurrentAnswer('')
    setCurrentQ(0)
  }

  async function handleAnswer() {
    if (!currentAnswer.trim() || !intent) return
    const newAnswers = [...answers, currentAnswer.trim()]
    setAnswers(newAnswers)
    setCurrentAnswer('')

    if (currentQ + 1 < intent.questions.length) {
      setCurrentQ(currentQ + 1)
    } else {
      // All questions answered — refine with AI
      setRefining(true)
      try {
        const res = await fetch('/api/refine-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intentType: selected, answers: newAnswers, questions: intent.questions }),
        })
        const data = await res.json()
        setRefinedPurpose(data.purpose || newAnswers.join('. '))
      } catch {
        setRefinedPurpose(newAnswers.join('. '))
      }
      setRefining(false)
      setStep('confirm')
    }
  }

  function handleConfirm() {
    // Save to localStorage and navigate
    const createState = JSON.parse(localStorage.getItem('d2v_create') || '{}')
    createState.purpose = refinedPurpose
    createState.intentType = selected
    localStorage.setItem('d2v_create', JSON.stringify(createState))
    router.push('/create/source')
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', maxWidth: 900, margin: '0 auto', width: '100%',
    }}>

      {/* Resume or discard pending creation */}
      {step === 'resume' && pendingState && (
        <div style={{ width: '100%', maxWidth: 500, animation: 'fadeInUp 0.4s ease' }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center' }}>
            You have an unfinished video
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 12, lineHeight: 1.6 }}>
            {pendingState.purpose ? `"${pendingState.purpose.slice(0, 100)}${pendingState.purpose.length > 100 ? '...' : ''}"` : 'Pick up where you left off or start fresh.'}
          </p>
          <p style={{ fontSize: 14, color: 'var(--ink-light)', textAlign: 'center', marginBottom: 32 }}>
            You stopped at: <strong style={{ color: 'var(--ink)' }}>
              {pendingState.scenes?.length > 0 ? 'Script editing' : pendingState.extractedData ? 'Content review' : pendingState.method ? 'Content extraction' : 'Adding content'}
            </strong>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={handleResume}
              style={{
                padding: '18px', borderRadius: 12, border: 'none',
                background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Continue where I left off &rarr;
            </button>
            <button
              onClick={handleStartFresh}
              style={{
                padding: '18px', borderRadius: 12, border: '2px solid var(--border)',
                background: 'white', color: 'var(--ink-soft)', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Discard and start fresh
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Choose intent */}
      {step === 'choose' && (
        <div style={{ width: '100%', animation: 'fadeInUp 0.4s ease' }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center', marginBottom: 8, color: 'var(--ink)' }}>
            What are you creating?
          </h1>
          <p style={{ fontSize: 18, color: 'var(--ink-soft)', textAlign: 'center', marginBottom: 48, lineHeight: 1.6 }}>
            Tell us the goal and we&apos;ll shape everything around it.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {INTENTS.map(intent => (
              <button
                key={intent.id}
                onClick={() => handleSelectIntent(intent.id)}
                style={{
                  padding: '32px 24px', borderRadius: 16, border: '2px solid var(--border-light)',
                  background: 'white', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{intent.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>{intent.title}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{intent.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Refine with questions */}
      {step === 'refine' && intent && (
        <div style={{ width: '100%', maxWidth: 600, animation: 'fadeInUp 0.4s ease' }}>
          <button
            onClick={() => { setStep('choose'); setSelected(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink-light)', marginBottom: 32, fontFamily: 'inherit' }}
          >
            &larr; Back to goals
          </button>

          <div style={{ fontSize: 48, marginBottom: 16 }}>{intent.icon}</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, color: 'var(--ink)' }}>
            {intent.title}
          </h2>

          {/* Show previous answers */}
          {answers.map((a, i) => (
            <div key={i} style={{ marginBottom: 16, padding: '16px 20px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-light)', marginBottom: 4 }}>{intent.questions[i]}</div>
              <div style={{ fontSize: 15, color: 'var(--ink)' }}>{a}</div>
            </div>
          ))}

          {/* Current question */}
          <div style={{ marginTop: 24 }}>
            <label style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 12 }}>
              {intent.questions[currentQ]}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                ref={inputRef}
                type="text"
                value={currentAnswer}
                onChange={e => setCurrentAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAnswer() }}
                placeholder="Type your answer..."
                style={{
                  flex: 1, padding: '16px 20px', borderRadius: 12, border: '2px solid var(--border)',
                  fontSize: 16, fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--mint)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={handleAnswer}
                disabled={!currentAnswer.trim()}
                style={{
                  padding: '16px 28px', borderRadius: 12, border: 'none',
                  background: currentAnswer.trim() ? 'var(--ink)' : 'var(--border)',
                  color: 'white', fontSize: 15, fontWeight: 700, cursor: currentAnswer.trim() ? 'pointer' : 'default',
                  transition: 'all 0.2s', fontFamily: 'inherit',
                }}
              >
                {currentQ + 1 < intent.questions.length ? 'Next' : 'Continue'} &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirm refined purpose */}
      {step === 'confirm' && (
        <div style={{ width: '100%', maxWidth: 600, animation: 'fadeInUp 0.4s ease' }}>
          {refining ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div className="spinner" style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 16, color: 'var(--ink-soft)' }}>Understanding your goal...</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 24, color: 'var(--ink)' }}>
                Here&apos;s what we&apos;ll create
              </h2>

              <div style={{
                padding: '24px 28px', borderRadius: 16, background: 'rgba(168,240,212,0.08)',
                border: '2px solid var(--mint)', marginBottom: 32,
              }}>
                <textarea
                  value={refinedPurpose}
                  onChange={e => setRefinedPurpose(e.target.value)}
                  style={{
                    width: '100%', border: 'none', background: 'transparent', fontSize: 17, lineHeight: 1.6,
                    color: 'var(--ink)', resize: 'vertical', minHeight: 80, fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => { setStep('choose'); setSelected(null); setAnswers([]) }}
                  style={{
                    padding: '16px 28px', borderRadius: 12, border: '2px solid var(--border)',
                    background: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                    color: 'var(--ink-soft)', fontFamily: 'inherit',
                  }}
                >
                  Start over
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    flex: 1, padding: '16px 28px', borderRadius: 12, border: 'none',
                    background: 'var(--ink)', color: 'white', fontSize: 17, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                  }}
                >
                  Looks good &mdash; add my content &rarr;
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
