'use client'

import { useRef, useState } from 'react'

/**
 * Dictation that works on every device.
 *
 * Native Web Speech where it exists (Chrome, Edge, most Android), otherwise
 * record-and-transcribe through the server (iOS Safari, installed web apps,
 * locked-down laptops). One toggle, one callback with the words.
 *
 * WHY IT IS SHAPED LIKE THIS — the first attempt at a mic in this app did none
 * of it and was reported as "does not work":
 *
 *   - It had NO FALLBACK. Where Web Speech is missing or blocked, nothing
 *     happened at all. That is most of the reason this exists.
 *   - It built ONE recogniser on mount and reused it. A SpeechRecognition
 *     object that has already ended or errored can refuse to start again, so
 *     the button worked once and then went dead. A fresh one per press avoids
 *     the whole class of problem.
 *   - It asked for the microphone with getUserMedia BEFORE starting native
 *     speech. That looked like belt-and-braces and was actively harmful: when
 *     that call fails the native path never runs, even though it would have
 *     worked. Let the speech API ask for itself; the recorder path asks
 *     separately because it genuinely needs to.
 *
 * The proven version of this lives in the Jordyn app. This one adds an error
 * message, because silent catches are how the original went unnoticed.
 */
export function useDictation(
  onText: (text: string) => void,
  opts?: { onError?: (message: string) => void },
) {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const recogRef = useRef<any>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const modeRef = useRef<'native' | 'recorded' | null>(null)

  const fail = (m: string) => opts?.onError?.(m)

  const stop = () => {
    if (modeRef.current === 'native') {
      try { recogRef.current?.stop() } catch { /* already stopped */ }
    } else if (modeRef.current === 'recorded') {
      try { mediaRef.current?.stop() } catch { /* already stopped */ }
    }
    setListening(false)
    modeRef.current = null
  }

  /** Record it and let the server read it back. Works anywhere with a mic. */
  const startRecorder = async () => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      fail('I need permission to use your microphone. Click the padlock in the address bar, allow the microphone, then press the mic again.')
      setListening(false)
      return
    }
    try {
      // Safari records m4a and refuses webm; everything else is happy with webm.
      const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mime })
        // An accidental tap produces a few hundred bytes of nothing. Sending it
        // costs a round trip to be told there was no speech.
        if (blob.size < 2000) { setListening(false); return }
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('audio', new File([blob], `dictation.${mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: mime }))
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          const d = await res.json().catch(() => ({}))
          if (res.ok && d.text) onText(String(d.text))
          else if (res.ok) fail('I couldn\'t make out any words. Try again, a bit closer to the microphone.')
          else fail(d.error || 'I couldn\'t turn that recording into words. You can type it instead.')
        } catch {
          fail('I couldn\'t reach the server to read that back. Check your connection, or type it instead.')
        }
        setTranscribing(false)
      }
      mediaRef.current = mr
      mr.start()
      modeRef.current = 'recorded'
      setListening(true)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      fail('This device wouldn\'t let me record. You can type it instead.')
      setListening(false)
    }
  }

  const start = async () => {
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (SR) {
      try {
        // A FRESH ONE EVERY TIME. Reusing an instance that has ended is what
        // makes a mic button work once and then never again.
        const r = new SR()
        r.continuous = true
        r.interimResults = true
        r.lang = navigator.language || 'en-US'
        r.onresult = (e: any) => {
          let final = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript
          }
          if (final.trim()) onText(final.trim())
        }
        r.onend = () => setListening(false)
        r.onerror = (e: any) => {
          setListening(false)
          // 'aborted' is what stopping it yourself looks like — not a problem.
          if (e?.error === 'aborted' || e?.error === 'no-speech') return
          // Anything the browser's own speech service cannot do, the recorder
          // usually can. Fall back rather than reporting a dead end.
          if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
            fail('Your browser is blocking the microphone for this site. Click the padlock in the address bar, allow the microphone, then press the mic again.')
            return
          }
          modeRef.current = null
          void startRecorder()
        }
        recogRef.current = r
        r.start()
        modeRef.current = 'native'
        setListening(true)
        return
      } catch {
        // Native refused outright — record instead.
      }
    }
    await startRecorder()
  }

  const toggle = () => { if (listening) stop(); else void start() }

  return { listening, transcribing, toggle, stop }
}
