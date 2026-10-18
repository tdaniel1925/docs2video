import { createClient } from '../../../_lib/supabase/client'
import { docUploadExt, docUploadProblem } from '../../../_lib/doc-upload'

/**
 * Bulletproof document upload + extraction:
 *  1. validate size/type up front (clear error, no doomed upload)
 *  2. get a signed upload URL, upload the file DIRECTLY to Supabase Storage
 *     (robust; big bytes never go through a Vercel function)
 *  3. call /api/extract-doc with just the storage path (tiny JSON)
 * Retries the storage upload once on a transient network error.
 *
 * Returns the parsed extraction result, or throws an Error with a user-friendly
 * message.
 */
export async function uploadAndExtract(file: File, purpose: string, onPhase?: (phase: 'uploading' | 'reading') => void): Promise<any> {
  const ext = docUploadExt(file.name)
  const problem = docUploadProblem(file.name, file.size)
  if (problem) throw new Error(problem)

  // 1) signed upload URL (the screen ticks "Uploading" → "Reading" as each
  //    part really starts, instead of a timer guessing)
  onPhase?.('uploading')
  const urlRes = await fetch('/api/extract-doc/upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, size: file.size }),
  })
  const urlData = await urlRes.json().catch(() => ({}))
  if (!urlRes.ok) throw new Error(urlData.error || 'Could not start the upload.')

  // 2) direct upload to Supabase (with one retry on transient failure)
  const supabase = createClient()
  const doUpload = () => supabase.storage.from(urlData.bucket).uploadToSignedUrl(urlData.path, urlData.token, file)
  let up = await doUpload()
  if (up.error) {
    await new Promise(r => setTimeout(r, 1200))
    up = await doUpload()
  }
  if (up.error) {
    const why = up.error.message || ''
    throw new Error(/size|large|exceed|413/i.test(why)
      ? `"${file.name}" is too large to upload. Try a smaller copy, or paste the text instead.`
      : 'Upload failed — please check your connection and try again.')
  }

  // 3) extract by path
  onPhase?.('reading')
  const exRes = await fetch('/api/extract-doc', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: urlData.path, purpose }),
  })
  const result = await exRes.json().catch(() => ({
    error: exRes.status === 504 ? 'Reading that file took too long. Try a shorter document, or paste the text instead.' : 'The server returned an unexpected response. Please try again.',
  }))
  if (!exRes.ok) throw new Error(result.error || 'We could not read this document.')
  // Carry the stored source path forward (private 'creation-assets' bucket) so
  // the share page can optionally offer the ORIGINAL file as a download. Only
  // meaningful for PDFs; attached like the existing `_autoBrandId` convention.
  if (result && typeof result === 'object' && ext === 'pdf') {
    result._sourcePdfPath = urlData.path
    result._sourcePdfName = file.name
  }
  return result
}

/** Cap on files per project (cost/time bound; keeps the video focused). */
export const MAX_FILES = 5

/**
 * Upload + extract SEVERAL documents (multi-file projects). Extracts each file
 * via uploadAndExtract (sequentially — keeps Supabase and render-service load sane and gives a
 * clear per-file error). Returns one entry per file in upload order. An
 * onProgress callback lets the UI show "Reading file 2 of 3…".
 */
export async function uploadAndExtractMany(
  files: File[],
  purpose: string,
  onProgress?: (done: number, total: number, fileName: string) => void,
): Promise<{ fileName: string; data: any }[]> {
  if (files.length > MAX_FILES) {
    throw new Error(`You can upload up to ${MAX_FILES} files at once.`)
  }
  // Read EVERY file before reporting, so one bad file is named (with its
  // reason) instead of silently costing the user the others' progress.
  const out: { fileName: string; data: any }[] = []
  const failed: string[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    onProgress?.(i, files.length, f.name)
    try {
      out.push({ fileName: f.name, data: await uploadAndExtract(f, purpose) })
    } catch (e) {
      failed.push(`"${f.name}": ${e instanceof Error ? e.message : 'could not be read'}`)
    }
  }
  onProgress?.(files.length, files.length, '')
  if (failed.length) {
    throw new Error(failed.length === files.length
      ? `None of the files could be read. ${failed.join(' ')}`
      : `I couldn't read ${failed.length === 1 ? 'one file' : `${failed.length} files`} — remove ${failed.length === 1 ? 'it' : 'them'} and try again (the rest were fine). ${failed.join(' ')}`)
  }
  return out
}
