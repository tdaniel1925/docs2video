'use client'

import type { ReactNode, CSSProperties } from 'react'

/**
 * One row of the job.
 *
 * WHY THIS SHAPE. The previous version put every question into the chat as it
 * arrived. That made the job invisible: what you had decided scrolled away,
 * what was left was never shown, and the way out of each panel appeared in a
 * different place depending on which panel it was. Five rows you can take in at
 * a glance replaces all of it.
 *
 * A CLOSED ROW STILL ANSWERS ITS OWN QUESTION. "How should it look" is not
 * useful once it is done — "Warm Rustic" is. So a finished row shows the
 * ANSWER, not the prompt, and clicking it reopens to change it. Nothing has to
 * be remembered and nothing has to be scrolled back to.
 *
 * There is no Done button anywhere in here. Opening the next row is what
 * finishing looks like, and a control whose only job is to close the thing you
 * just used is the definition of a step too many.
 */
export function StepRow({
  n, title, answer, open, done, optional, onToggle, children, line, ink, soft,
}: {
  /** 1-based, shown so the order is obvious without reading. */
  n: number
  /** The question, shown while unanswered. */
  title: string
  /** What was chosen, shown INSTEAD of the question once there is one. */
  answer?: string
  open: boolean
  done: boolean
  /** Skippable. Marked so nobody thinks they owe us a photo. */
  optional?: boolean
  onToggle: () => void
  children: ReactNode
  line: string
  ink: string
  soft: string
}) {
  const head: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '11px 13px', background: 'none', border: 'none', cursor: 'pointer',
    font: 'inherit', textAlign: 'left', color: ink,
  }

  return (
    <div style={{ borderBottom: `1px solid ${line}` }}>
      <button onClick={onToggle} style={head}
        // Marked so a check can count THESE and not every expandable thing on
        // the page — a design block carries aria-expanded too.
        data-step-row=""
        aria-expanded={open}
        title={done ? `${title} — currently ${answer}. Click to change it.` : title}>
        {/* A TICK OR A NUMBER, never both. The tick means "no need to come
            back"; the number means "this one is still yours to do". */}
        <span style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800,
          background: done ? ink : 'transparent',
          color: done ? 'white' : soft,
          border: done ? '1px solid transparent' : `1px solid ${line}`,
        }}>{done ? '✓' : n}</span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{title}</span>
          {done && answer && (
            <span style={{
              display: 'block', fontSize: 12.5, color: soft, marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{answer}</span>
          )}
          {!done && optional && (
            <span style={{ display: 'block', fontSize: 12.5, color: soft, marginTop: 1 }}>
              Optional — skip it and the artwork is invented
            </span>
          )}
        </span>

        <span style={{ fontSize: 11, color: soft, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && <div style={{ padding: '2px 13px 14px' }}>{children}</div>}
    </div>
  )
}

/**
 * "You can drop things here", said where the dropping should happen.
 *
 * The gestures all worked before and none of them were mentioned, so nobody
 * used them — and a line at the top of the page saying "you can paste anywhere"
 * scrolls away and is read once, at the moment it is least useful. This says it
 * inside the section that wants the file, at the moment that section is open.
 */
export function DropHint({
  what, pasteKey, onFiles, line, soft, ink,
}: {
  /** What this section wants, in plain words. */
  what: string
  pasteKey: string
  onFiles: (files: File[]) => void
  line: string
  soft: string
  ink: string
}) {
  return (
    <label
      onDragOver={(e) => { e.preventDefault() }}
      onDrop={(e) => {
        e.preventDefault()
        const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
        if (files.length) onFiles(files)
      }}
      style={{
        display: 'block', marginTop: 12, padding: '14px 16px',
        border: `1px dashed ${line}`, borderRadius: 9, cursor: 'pointer',
        fontSize: 12.5, color: soft, lineHeight: 1.55, textAlign: 'center',
      }}>
      <strong style={{ color: ink }}>{what}</strong>
      <br />
      Drag it here, click to pick a file, or press {pasteKey}.
      <input type="file" accept="image/*" multiple hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) onFiles(files)
        }} />
    </label>
  )
}
