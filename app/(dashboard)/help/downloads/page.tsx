'use client'

import Link from 'next/link'

export default function DownloadsHelpPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Downloads & Formats</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Downloads & Formats</h1>
          <p>Every completed video can be downloaded in multiple formats. Here is what each one gives you.</p>
        </div>
      </div>

      {/* MP4 Video */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          MP4 Video Download
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The MP4 is the full video file with narration, background music, slide transitions, and all visual elements combined into a single playable file.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Resolution:</strong> Videos are rendered in high definition (1920x1080).
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>When to use:</strong> Upload to YouTube, Vimeo, or social media. Attach to emails. Play in presentations. Share offline with clients who may not have internet access.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>How to download:</strong> Open any completed video from your Library and click the <strong style={{ color: 'var(--ink)' }}>Download MP4</strong> button below the video player.
          </p>
        </div>
      </div>

      {/* PDF Slides */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          PDF Slides Download
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The PDF contains all slides from your video as a printable slide deck. Each page is one slide with full visual quality.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>When to use:</strong> Print handouts for in-person meetings. Attach to follow-up emails as a leave-behind. Use as a reference document when the video itself is not needed.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>How to download:</strong> On the video detail page, click <strong style={{ color: 'var(--ink)' }}>Download PDF</strong>. The file downloads immediately.
          </p>
        </div>
      </div>

      {/* PPTX Presentation */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          PPTX Presentation Download
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The PPTX is an editable PowerPoint file. Each slide from your video becomes a PowerPoint slide with the visual design preserved.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>When to use:</strong> When you need to present live and want to control the pace. When you want to add, remove, or modify slides before a meeting. When your company requires PowerPoint format for compliance or archival.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>How to download:</strong> On the video detail page, click <strong style={{ color: 'var(--ink)' }}>Download PPTX</strong>. Open the file in PowerPoint, Google Slides, or Keynote.
          </p>
        </div>
      </div>

      {/* Script Download */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Script Text Download
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            The script download gives you the full narration text organized by scene. This is the exact text spoken in the voiceover.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>When to use:</strong> Review narration content for accuracy. Share the script with a colleague for feedback before creating the video. Use as a written summary or blog post. Archive for compliance records.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>How to download:</strong> On the video detail page, click <strong style={{ color: 'var(--ink)' }}>Download Script</strong> to save the narration text.
          </p>
        </div>
      </div>

      {/* Choosing the Right Format */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--ink)' }}>
          Choosing the Right Format
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Sending to a client remotely?</strong> Use the share link (no download needed) or send the MP4 for offline viewing.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Presenting live in a meeting?</strong> Download the PPTX so you can control the pace and navigate to specific slides.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Need a printed leave-behind?</strong> Download the PDF and print it.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Need just the words?</strong> Download the script for a text-only version of the narration.
          </p>
        </div>
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link href="/help" className="btn btn-soft">
          Back to Help Center
        </Link>
      </div>
    </div>
  )
}
