// Generalized extracted data that works for PDFs, text input, and ideas
export interface ExtractedData {
  title: string
  subtitle: string | null
  source: string | null
  keyMetrics: { label: string; value: string; highlight?: boolean }[]
  sections: { title: string; content: string }[]
  bulletPoints: string[]
  additionalNotes: string[]
}
