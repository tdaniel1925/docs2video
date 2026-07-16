import { createClient } from '../../../_lib/supabase/client'

const MAX_BYTES = 100 * 1024 * 1024 // 100MB
const ALLOWED_EXT = ['pdf', 'docx', 'pptx', 'txt', 'csv', 'xlsx']

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
export async function uploadAndExtract(file: File, purpose: string): Promise<any> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error(`Unsupported file type. Allowed: ${ALLOWED_EXT.join(', ').toUpperCase()}`)
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is ${Math.round(MAX_BYTES / 1024 / 1024)}MB — try a smaller file or paste the text.`)
  }

  // 1) signed upload URL
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
  if (up.error) throw new Error('Upload failed — please check your connection and try again.')

  // 3) extract by path
  const exRes = await fetch('/api/extract-doc', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: urlData.path, purpose }),
  })
  const result = await exRes.json().catch(() => ({ error: 'The server returned an unexpected response.' }))
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
 * via uploadAndExtract (sequentially — keeps Supabase/VPS load sane and gives a
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
  const out: { fileName: string; data: any }[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    onProgress?.(i, files.length, f.name)
    const data = await uploadAndExtract(f, purpose)
    out.push({ fileName: f.name, data })
  }
  onProgress?.(files.length, files.length, '')
  return out
}
