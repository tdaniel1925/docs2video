/**
 * What a document upload may be — ONE list for the file picker, the browser
 * check, the signed-upload route and (by matching) the render service's
 * readDocumentText. Before 2026-10-15 these drifted: pickers offered files the
 * reader could not open, and the browser allowed 100MB while storage stops at
 * Supabase's 50MB project limit (the user saw "check your connection").
 *
 * Photos are allowed: an agent can snap a printed illustration with a phone
 * and the render service reads the picture directly.
 */
export const DOC_UPLOAD_EXT = [
  'pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'csv',
  'jpg', 'jpeg', 'png', 'webp', 'heic',
] as const

export const DOC_UPLOAD_ACCEPT = DOC_UPLOAD_EXT.map((e) => `.${e}`).join(',')

/** Supabase's project-wide upload cap (the creation-assets bucket sets none). */
export const DOC_UPLOAD_MAX_BYTES = 50 * 1024 * 1024

export const DOC_UPLOAD_KINDS = 'PDF, Word, PowerPoint, Excel, text, or a photo of the page'

export function docUploadExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

/** A message for the user if this file can't be uploaded, else null. */
export function docUploadProblem(fileName: string, size?: number): string | null {
  const ext = docUploadExt(fileName)
  if (!(DOC_UPLOAD_EXT as readonly string[]).includes(ext)) {
    return `"${fileName}" isn't a file type I can read. Use a ${DOC_UPLOAD_KINDS}.`
  }
  if (typeof size === 'number' && size > DOC_UPLOAD_MAX_BYTES) {
    return `"${fileName}" is ${Math.round(size / 1024 / 1024)} MB — the limit is ${DOC_UPLOAD_MAX_BYTES / 1024 / 1024} MB. Try a smaller copy, or paste the text instead.`
  }
  if (size === 0) return `"${fileName}" is empty. Please choose the file again.`
  return null
}
