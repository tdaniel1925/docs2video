'use client'

import React, { useEffect, useState } from 'react'
import { calculateVideoCost } from '../../../_lib/credits'

interface CreditCostProps {
  outputType: 'video' | 'pptx' | 'pdf'
  detailLevel?: 'quick' | 'standard' | 'detailed'
  narrationStyle?: 'solo' | 'podcast'
  showConfirm?: boolean
  onConfirm?: () => void
}

interface BalanceData {
  balance: number
  monthly: number
  topup: number
}

export default function CreditCost({
  outputType,
  detailLevel = 'standard',
  narrationStyle = 'solo',
  showConfirm = false,
  onConfirm,
}: CreditCostProps) {
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cost = calculateVideoCost({ outputType, detailLevel, narrationStyle })

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch('/api/credits/balance')
        if (!res.ok) throw new Error('Failed to fetch balance')
        const data: BalanceData = await res.json()
        setBalanceData(data)
      } catch (err) {
        setError('Could not load credit balance')
        console.error('[CreditCost]', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBalance()
  }, [])

  if (loading) {
    return <div style={styles.container}><span style={styles.loading}>Loading credits...</span></div>
  }

  if (error || !balanceData) {
    return <div style={styles.container}><span style={styles.error}>{error || 'Unknown error'}</span></div>
  }

  const remaining = balanceData.balance
  const sufficient = remaining >= cost

  return (
    <div style={styles.container}>
      {sufficient ? (
        <div style={styles.info}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" stroke="var(--mint, #3BB5C8)" strokeWidth="1.5" />
            <path d="M5 8L7 10L11 6" stroke="var(--mint, #3BB5C8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            This will use <strong>{cost.toLocaleString()}</strong> credits ({remaining.toLocaleString()} remaining)
          </span>
        </div>
      ) : (
        <div style={styles.warning}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M8 1L15 14H1L8 1Z" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6V9M8 11.5V12" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>
            You need <strong>{cost.toLocaleString()}</strong> credits but have <strong>{remaining.toLocaleString()}</strong>. Buy more or upgrade your plan.
          </span>
        </div>
      )}

      {showConfirm && sufficient && onConfirm && (
        <button
          onClick={onConfirm}
          className="btn btn-mint"
          style={styles.confirmBtn}
        >
          Confirm &amp; Generate
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1px solid var(--border-light, #e0e0e0)',
    background: 'var(--bg-card, #FFFFFF)',
  },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: 'var(--ink, #1B3A5C)',
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#92400E',
    background: '#FFFBEB',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #FDE68A',
  },
  loading: {
    fontSize: 13,
    color: 'var(--ink-light, #8899AA)',
  },
  error: {
    fontSize: 13,
    color: '#DC2626',
  },
  confirmBtn: {
    marginTop: 12,
    width: '100%',
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 10,
    cursor: 'pointer',
    border: 'none',
  },
}
