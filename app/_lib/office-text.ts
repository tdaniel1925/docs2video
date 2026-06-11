import JSZip from 'jszip'

/**
 * Extract plain text from DOCX/PPTX in-app (no OpenAI). Both formats are zip
 * archives of XML; we pull the text runs and join them. Good enough to feed
 * Claude's content-structuring prompt — same path PDFs use.
 */

function stripXmlToText(xml: string): string {
  return xml
    // paragraph / line / slide breaks → spaces so words don't run together
    .replace(/<\/w:p>|<\/a:p>|<a:br\/?>|<w:br\/?>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const doc = zip.file('word/document.xml')
  if (!doc) throw new Error('Not a valid DOCX (missing word/document.xml)')
  return stripXmlToText(await doc.async('string'))
}

export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  // Slides are ppt/slides/slide1.xml, slide2.xml, ... — keep slide order
  const slideFiles = Object.keys(zip.files)
    .filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10)
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10)
      return na - nb
    })
  if (slideFiles.length === 0) throw new Error('Not a valid PPTX (no slides found)')
  const parts: string[] = []
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i])!.async('string')
    const text = stripXmlToText(xml)
    if (text) parts.push(`Slide ${i + 1}:\n${text}`)
  }
  return parts.join('\n\n')
}
