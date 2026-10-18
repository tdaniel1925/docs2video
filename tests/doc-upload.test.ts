import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DOC_UPLOAD_EXT, DOC_UPLOAD_ACCEPT, DOC_UPLOAD_MAX_BYTES, docUploadProblem } from '../app/_lib/doc-upload'

// Audit 2026-10-15: pickers offered files the reader could not open (every
// Word/Excel upload failed on the render service), and the browser allowed
// 100MB while storage stops at 50MB. These guard against that drift.
const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const server = read('render-service/server.js')

function serverReadable(): Set<string> {
  const office = server.match(/const OFFICE_TYPES = new Set\(\[([^\]]+)\]\)/)
  const images = server.match(/const IMAGE_TYPES = \{([^}]+)\}/)
  expect(office, 'OFFICE_TYPES in server.js').toBeTruthy()
  expect(images, 'IMAGE_TYPES in server.js').toBeTruthy()
  const exts = new Set<string>(['pdf', 'txt', 'csv', 'md'])
  for (const m of office![1].matchAll(/'([a-z]+)'/g)) exts.add(m[1])
  for (const m of images![1].matchAll(/([a-z]+):/g)) exts.add(m[1])
  return exts
}

describe('document upload list', () => {
  it('every type the app lets you pick, the render service can read', () => {
    const readable = serverReadable()
    for (const ext of DOC_UPLOAD_EXT) expect(readable.has(ext), `.${ext} offered but not readable`).toBe(true)
  })

  it('the server image has the LibreOffice parts for Word and Excel', () => {
    const dockerfile = read('render-service/Dockerfile')
    for (const pkg of ['libreoffice-writer', 'libreoffice-calc', 'libreoffice-impress', 'poppler-utils']) expect(dockerfile).toContain(pkg)
  })

  it('upload screens use the shared list, not their own', () => {
    for (const f of ['app/(dashboard)/create/_components/Step1Content.tsx', 'app/(dashboard)/clients/[id]/review/page.tsx', 'app/(dashboard)/create/commercial/page.tsx']) {
      expect(read(f), f).toContain('DOC_UPLOAD_ACCEPT')
    }
    for (const f of ['app/(dashboard)/create/_components/uploadAndExtract.ts', 'app/api/extract-doc/upload-url/route.ts']) {
      const src = read(f)
      expect(src, f).toContain('docUploadProblem')
      expect(src, f).not.toMatch(/100 \* 1024 \* 1024/)
    }
  })

  it('size cap matches Supabase (50MB) and messages are plain', () => {
    expect(DOC_UPLOAD_MAX_BYTES).toBe(50 * 1024 * 1024)
    expect(docUploadProblem('scan.pdf', 60 * 1024 * 1024)).toMatch(/limit is 50 MB/)
    expect(docUploadProblem('notes.pages', 1000)).toMatch(/isn't a file type I can read/)
    expect(docUploadProblem('empty.docx', 0)).toMatch(/empty/)
    expect(docUploadProblem('photo.HEIC', 2_000_000)).toBeNull()
    expect(DOC_UPLOAD_ACCEPT.split(',')).toContain('.docx')
  })

  it('a file the reader cannot read is a 422 the app does not retry', () => {
    expect(server).toMatch(/err instanceof DocReadError \? 422 : 500/)
    const route = read('app/api/extract-doc/route.ts')
    expect(route).toContain('[500, 502, 503, 504].includes(vpsRes.status) && canRetry()')
    expect(route).toContain('BUDGET_MS = 285_000')
  })

  it('photo and logo pickers only offer types the upload routes accept', () => {
    for (const f of ['app/(dashboard)/settings/page.tsx', 'app/(onboarding)/setup/page.tsx', 'app/(dashboard)/brands/[id]/page.tsx', 'app/(dashboard)/create/commercial/page.tsx']) {
      expect(read(f), f).not.toContain('image/svg+xml')
    }
  })
})
