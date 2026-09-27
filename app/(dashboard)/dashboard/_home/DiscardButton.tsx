'use client'

/** Discard asks first — it deletes the draft for good. */
export function DiscardButton({ className }: { className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm('Delete this draft? This can’t be undone.')) e.preventDefault()
      }}
    >
      Discard
    </button>
  )
}
