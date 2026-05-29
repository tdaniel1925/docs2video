'use client'

import { useState, useEffect } from 'react'

export default function TestKenBurnsPage() {
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
      const res = await fetch('/api/test-kenburns', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Failed' })
    }
    setRunning(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F1EC', padding: 32, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Ken Burns + Crossfade Test</h1>
        <p style={{ fontSize: 14, color: '#8A968D', marginBottom: 8 }}>
          3 scenes: slow zoom-in → pan right → zoom-out. All with 4K source, 1080p output, 30fps smooth motion, crossfade transitions.
        </p>
        <p style={{ fontSize: 12, color: '#8A968D', marginBottom: 32 }}>
          Cost: ~$0.40 (slides + TTS only) &middot; No AI video models used &middot; Pure FFmpeg
        </p>

        {!running && !result && (
          <button onClick={runTest} style={{
            padding: '16px 40px', borderRadius: 10, border: 'none',
            background: '#0F1A12', color: '#C7E8A8', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>
            Run Ken Burns Test &rarr;
          </button>
        )}

        {running && (
          <div style={{ background: 'white', borderRadius: 10, border: '1px solid #E5DFD3', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, border: '3px solid #C7E8A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Generating smooth Ken Burns video...</div>
                <div style={{ fontSize: 14, color: '#8A968D' }}>
                  {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')} elapsed
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#4B574F' }}>
              {elapsed < 5 && <p>Generating TTS narration...</p>}
              {elapsed >= 5 && elapsed < 60 && <p>Generating 4K slides with Gemini...</p>}
              {elapsed >= 60 && elapsed < 75 && <p>Upscaling to 4K with Sharp...</p>}
              {elapsed >= 75 && elapsed < 120 && <p>Applying Ken Burns effects (zoom, pan) at 30fps...</p>}
              {elapsed >= 120 && <p>Adding crossfade transitions between scenes...</p>}
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
                <button onClick={() => setResult(null)} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, border: '1px solid #E5DFD3', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <video src={result.videoUrl} controls autoPlay style={{ width: '100%', display: 'block' }} />
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    Done in {Math.floor(result.totalTime / 60)}:{(result.totalTime % 60).toString().padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: 13, color: '#8A968D', marginBottom: 16 }}>
                    Cost: {result.cost} &middot; Effects: zoom-in → pan-right → zoom-out &middot; Crossfade transitions
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <a href={result.videoUrl} download target="_blank" rel="noopener noreferrer"
                      style={{ padding: '10px 20px', borderRadius: 10, background: '#0F1A12', color: '#C7E8A8', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      Download MP4
                    </a>
                    <button onClick={() => setResult(null)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E5DFD3', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      Run Again
                    </button>
                  </div>
                  {result.log && (
                    <details style={{ marginTop: 16 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 13, color: '#8A968D' }}>Show log</summary>
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
