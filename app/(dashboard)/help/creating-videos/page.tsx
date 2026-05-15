'use client'

import Link from 'next/link'

const STEP_CIRCLE = {
  width: 36, height: 36, borderRadius: '50%', background: 'var(--ink)', color: 'var(--mint)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  fontWeight: 700, fontSize: 15, flexShrink: 0,
}

export default function CreatingVideosPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--ink-light)' }}>
        <Link href="/help" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>
          Help Center
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>Creating Explainer Videos</span>
      </div>

      <div className="page-head" style={{ marginBottom: 32 }}>
        <div>
          <h1>Creating Explainer Videos</h1>
          <p>A complete step-by-step guide from uploading your content to sharing the final video.</p>
        </div>
      </div>

      {/* Step 1 */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={STEP_CIRCLE}>1</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Upload Your Content</h2>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            When you click "Create Video," you will see a content input screen with several options arranged as tabs or cards across the top. Choose the method that best matches your source material:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Upload PDF</strong> — Drag and drop a PDF file onto the upload zone, or click to browse your files. You will see a progress bar as the document uploads. The AI reads every page and extracts titles, key points, and data automatically. This works well for reports, proposals, illustrations, and whitepapers.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Type or Paste</strong> — A large text area appears where you can paste content from any source: meeting notes, emails, bullet points, or full articles. There is no length limit, but the AI works best with focused content about a single topic.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>From URL</strong> — Enter any webpage address. The AI visits the page, reads the content, and structures it for your video. Great for turning blog posts, landing pages, or news articles into videos.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>AI Research</strong> — Enter a topic and the AI conducts research using real, current data and statistics. It finds relevant information, cites sources, and structures everything into a coherent narrative. Perfect when you do not have a source document but want a data-driven video.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Start from Idea</strong> — Describe your topic, target audience, and preferred tone. The AI generates complete content from scratch. You will see fields for the topic, who the audience is, and what tone to use (professional, casual, educational, etc.).
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>AI Proposal (Pro/Agency only)</strong> — An interactive chat experience where the AI interviews you about a client scenario, then builds a complete proposal. You answer questions one at a time, and the AI assembles a structured presentation from your answers.
          </p>
        </div>
      </div>

      {/* Step 2 */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={STEP_CIRCLE}>2</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Review Extracted Data</h2>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            After the AI processes your content, you will see a review screen showing the extracted information in editable fields. This typically includes:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Title</strong> — The main title for your video. Click to edit if the AI-generated title does not match your preference.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Key Points</strong> — The main topics and data points extracted from your content. Each appears as an editable text block. You can add, remove, or rewrite any of them.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Data & Statistics</strong> — Any numbers, percentages, or comparisons found in your source. Verify these are accurate before proceeding, as they will appear on your video slides.
          </p>
          <p>
            Take your time on this step. The more accurate the data is here, the better your final video will be. Everything on this screen can be edited by clicking on the text.
          </p>
        </div>
      </div>

      {/* Step 3 */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={STEP_CIRCLE}>3</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Review and Edit the Script</h2>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            The AI generates a full video script broken into individual scenes. You will see each scene displayed as a card in a vertical list. Each scene card contains:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Scene Title</strong> — A heading for the scene (e.g., "Introduction," "Key Benefits," "Summary"). Click to rename.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Narration Text</strong> — The words the voiceover will speak for this scene. Edit freely to change wording, add details, or adjust the tone.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Slide Notes</strong> — Key points that will appear as text on the visual slide. These are usually shorter than the narration and highlight the most important takeaways.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--ink)' }}>Beat Structure</strong> — Each video follows a proven narrative flow: Hook (grabs attention), Problem (identifies the challenge), Solution (presents the answer), Evidence (backs it up with data), and Call to Action (tells the viewer what to do next). The AI labels each scene with its beat so you can see the overall story arc.
          </p>
          <p>
            You can reorder scenes by dragging them, delete scenes you do not want, or add new scenes with the "Add Scene" button at the bottom.
          </p>
        </div>
      </div>

      {/* Step 4 */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={STEP_CIRCLE}>4</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Choose Your Options</h2>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Before generating, you configure the look and feel of your video:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Brand</strong> — Select which brand to apply from a dropdown. Your brand's logo, colors, and contact information will be used on the title slide, closing slide, and throughout the video. If you only have one brand, it is pre-selected.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Visual Style / Template</strong> — Choose from a gallery of visual templates. Each template has a distinct layout and design language. Your brand colors override the template's default palette, so every template looks on-brand. Custom templates you have created appear at the top of the gallery.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Voice</strong> — Browse available narration voices. Click any voice to hear a short preview clip. Voices range from professional and authoritative to warm and conversational. Select the one that best matches your audience.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Background Music</strong> — Optionally pick a background track from the music library. Music plays softly under the narration to set the mood. You can also choose "No music" for a clean voiceover only.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>Video Length</strong> — Choose between Standard (2-3 minutes, tighter and more focused) or Detailed (5-7 minutes, more in-depth coverage of each point).
          </p>
        </div>
      </div>

      {/* Step 5 */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={STEP_CIRCLE}>5</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Generate Your Video</h2>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Click the "Create my video" button to start generation. You will see a progress screen that shows each stage as it completes:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Generating slides</strong> — The AI creates the visual design for each scene based on your chosen template and brand. This takes about 30-60 seconds.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Recording narration</strong> — The voiceover is generated for each scene using your selected voice. You will see a progress indicator moving through the scenes.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Compositing video</strong> — The slides, narration, transitions, and music are combined into the final MP4 video file. This is the longest step, usually taking 1-2 minutes.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>You can leave the page.</strong> Video generation continues in the background. When it finishes, the video will appear in your Library. You will also see a notification if you are still on the site.
          </p>
        </div>
      </div>

      {/* Step 6 */}
      <div style={{
        background: 'white', border: '1px solid var(--border-light)', borderRadius: 12,
        padding: '28px 32px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <div style={STEP_CIRCLE}>6</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>View and Share Your Video</h2>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--ink-soft)' }}>
          <p style={{ marginBottom: 12 }}>
            Once generation is complete, you land on the video detail page. Here you will find:
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Video Player</strong> — Watch your video with full playback controls. Slide thumbnails appear below the player so you can jump to any scene.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Download Options</strong> — Download as MP4 (video file), PDF (slide deck), or PPTX (editable PowerPoint). Each format is generated in high quality.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: 'var(--ink)' }}>Share with Client</strong> — Send the video to a client by email, or copy the share link to send it yourself. The share page is fully branded and includes an AI chatbot, calendar booking, and more. See the <Link href="/help/sharing-videos" style={{ color: 'var(--mint-darker)', textDecoration: 'none', fontWeight: 600 }}>Sharing Videos</Link> guide for full details.
          </p>
          <p>
            <strong style={{ color: 'var(--ink)' }}>AI Editor</strong> — Want to make changes? Use the AI editor to refine individual slides, update narration text, or regenerate specific scenes without recreating the entire video.
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
