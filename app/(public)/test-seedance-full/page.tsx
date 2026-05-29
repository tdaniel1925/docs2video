'use client'

import { useState, useEffect } from 'react'

export default function TestSeedanceFullPage() {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [running])

  async function runTest() {
    setRunning(true)
    setElapsed(0)
    setResult(null)

    try {
      const res = await fetch('/api/test-seedance-full', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' })
    }
    setRunning(false)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div style={{ minHeight: '100vh', background: '#F4F1EC', padding: 32, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Full Seedance Video Test</h1>
        <p style={{ fontSize: 14, color: '#8A968D', marginBottom: 8 }}>
          Generates a complete 2-minute IUL explainer with 3 Seedance animated scenes + 2 static slides + TTS narration
        </p>
        <p style={{ fontSize: 12, color: '#8A968D', marginBottom: 32 }}>
          Estimated cost: ~$7 &middot; Estimated time: 5-8 minutes
        </p>

        {!running && !result && (
          <button onClick={runTest} style={{
            padding: '16px 40px', borderRadius: 10, border: 'none',
            background: '#0F1A12', color: '#C7E8A8', fontSize: 16, fontWeight: 700,
            cursor: 'pointer',
          }}>
            Run Full Test &rarr;
          </button>
        )}

        {running && (
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5DFD3', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #C7E8A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Generating full video...</div>
                <div style={{ fontSize: 14, color: '#8A968D' }}>Elapsed: {formatTime(elapsed)}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#4B574F', lineHeight: 1.8 }}>
              {elapsed < 10 && <p>Generating TTS audio for 5 scenes...</p>}
              {elapsed >= 10 && elapsed < 30 && <p>Uploading audio... Generating slide images with Gemini...</p>}
              {elapsed >= 30 && elapsed < 60 && <p>Uploading slides... Starting Seedance animations...</p>}
              {elapsed >= 60 && elapsed < 120 && <p>Scene 1 animating with Seedance (title intro)...</p>}
              {elapsed >= 120 && elapsed < 200 && <p>Scene 4 animating (cash value chart)...</p>}
              {elapsed >= 200 && elapsed < 300 && <p>Scene 5 animating (closing CTA)...</p>}
              {elapsed >= 300 && elapsed < 360 && <p>Assembling final video with FFmpeg...</p>}
              {elapsed >= 360 && <p>Uploading final video... almost done!</p>}
            </div>

            <div style={{ marginTop: 16, height: 6, background: '#E5DFD3', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: '#C7E8A8', borderRadius: 3,
                transition: 'width 2s ease',
                width: elapsed < 10 ? '5%' : elapsed < 30 ? '15%' : elapsed < 60 ? '25%' : elapsed < 120 ? '40%' : elapsed < 200 ? '60%' : elapsed < 300 ? '80%' : elapsed < 360 ? '90%' : '95%',
              }} />
            </div>
          </div>
        )}

        {result && (
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5DFD3', overflow: 'hidden' }}>
            {result.error ? (
              <div style={{ padding: 24 }}>
                <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: 8 }}>Error</div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>{result.error}</div>
                {result.log && (
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: 13, color: '#8A968D' }}>Show log</summary>
                    <pre style={{ fontSize: 11, background: '#F4F1EC', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 300, marginTop: 8 }}>
                      {result.log.join('\n')}
                    </pre>
                  </details>
                )}
                <button onClick={() => { setResult(null) }} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, border: '1px solid #E5DFD3', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <video src={result.videoUrl} controls autoPlay style={{ width: '100%', display: 'block' }} />
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    Test Complete — {formatTime(result.totalTime)}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#8A968D', marginBottom: 16 }}>
                    {result.scenes?.map((s: any, i: number) => (
                      <span key={i}>Scene {i + 1}: {s.title} {s.animated ? '(animated)' : '(static)'}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <a href={result.videoUrl} download="seedance-full-test.mp4" target="_blank" rel="noopener noreferrer"
                      style={{ padding: '10px 20px', borderRadius: 10, background: '#0F1A12', color: '#C7E8A8', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      Download MP4
                    </a>
                    <button onClick={() => { setResult(null) }} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E5DFD3', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Run Again
                    </button>
                  </div>

                  {result.log && (
                    <details style={{ marginTop: 16 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 13, color: '#8A968D' }}>Show generation log</summary>
                      <pre style={{ fontSize: 11, background: '#F4F1EC', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 300, marginTop: 8 }}>
                        {result.log.join('\n')}
                      </pre>
                    </details>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
