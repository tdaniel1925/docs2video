'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../_lib/supabase/client'

export default function UnsubscribePage() {
  const params = useParams()
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    async function unsub() {
      const supabase = createClient()
      const contactId = params.id as string

      const { error } = await supabase
        .from('campaign_contacts')
        .update({ unsubscribed: true })
        .eq('id', contactId)

      if (error) {
        console.error('[unsubscribe] Error:', error)
        setStatus('error')
      } else {
        setStatus('done')
      }
    }
    unsub()
  }, [params.id])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      background: '#f8fafb',
    }}>
      <div style={{
        maxWidth: 480,
        textAlign: 'center',
        padding: 40,
        background: '#fff',
        borderRadius: 10,
        border: '1px solid #e2e2e2',
      }}>
        {status === 'loading' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Processing...</h1>
            <p style={{ fontSize: 15, color: '#666' }}>Please wait while we update your preferences.</p>
          </>
        )}
        {status === 'done' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#1a1a1a' }}>Unsubscribed</h1>
            <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>
              You have been unsubscribed. You will not receive any more emails from this campaign.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#c0392b' }}>Something went wrong</h1>
            <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6 }}>
              We could not process your request. Please try again or contact support.
            </p>
          </>
        )}
        <div style={{ marginTop: 24 }}>
          <a href="https://docs2video.com" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>
            Docs2Video
          </a>
        </div>
      </div>
    </div>
  )
}
