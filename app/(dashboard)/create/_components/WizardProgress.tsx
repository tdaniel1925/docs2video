'use client'

import React from 'react'

interface WizardProgressProps {
  currentStep: number
  outputType: 'video' | 'pptx' | 'pdf'
}

const VIDEO_STEPS = ['Content', 'Presenter', 'Voice', 'Script', 'Generate']
const DOC_STEPS = ['Content', 'Presenter', 'Script', 'Generate']

export default function WizardProgress({ currentStep, outputType }: WizardProgressProps) {
  const steps = outputType === 'video' ? VIDEO_STEPS : DOC_STEPS

  return (
    <nav style={styles.container} aria-label="Wizard progress">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isCompleted = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        const isFuture = stepNum > currentStep

        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <div
                style={{
                  ...styles.connector,
                  background: isCompleted ? 'var(--mint, #3BB5C8)' : 'var(--border-light, #e0e0e0)',
                }}
              />
            )}
            <div style={styles.stepWrapper}>
              <div
                style={{
                  ...styles.stepCircle,
                  ...(isCurrent ? styles.stepCurrent : {}),
                  ...(isCompleted ? styles.stepCompleted : {}),
                  ...(isFuture ? styles.stepFuture : {}),
                }}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 7L5.5 10L11.5 4"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span style={styles.stepNumber}>{stepNum}</span>
                )}
              </div>
              <span
                style={{
                  ...styles.stepLabel,
                  ...(isCurrent ? styles.labelCurrent : {}),
                  ...(isFuture ? styles.labelFuture : {}),
                  ...(isCompleted ? styles.labelCompleted : {}),
                }}
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    padding: '16px 0',
    width: '100%',
    fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)',
  },
  stepWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.2s ease',
  },
  stepCurrent: {
    background: 'var(--mint, #3BB5C8)',
    color: 'var(--ink, #1B3A5C)',
  },
  stepCompleted: {
    background: 'var(--ink, #1B3A5C)',
    color: 'white',
  },
  stepFuture: {
    background: 'var(--bg-soft, #F7F9FB)',
    color: 'var(--ink-light, #8899AA)',
    border: '1px solid var(--border-light, #e0e0e0)',
  },
  stepNumber: {
    lineHeight: 1,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  labelCurrent: {
    color: 'var(--ink, #1B3A5C)',
  },
  labelCompleted: {
    color: 'var(--ink-soft, #3D5A7A)',
  },
  labelFuture: {
    color: 'var(--ink-light, #8899AA)',
    opacity: 0.6,
  },
  connector: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    minWidth: 20,
    marginBottom: 22,
  },
}
