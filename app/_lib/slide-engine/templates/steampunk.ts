import type { TemplateSpec } from '../types'

export const steampunk: TemplateSpec = {
  id: 'steampunk',
  name: 'Steampunk',
  description: 'Bronze 3D objects, mechanical feel',
  designSpec: {
    background: {
      base: 'dark industrial metal (#1a1410)',
      texture: 'brushed dark metal with rivets, warm brass lighting',
      gradient: 'subtle warm glow from center',
    },
    decorativeElements: {
      primary: 'ornate brass frame border with mechanical corner decorations, copper pipes connecting sections',
      secondary: 'steam wisps at pipe joints, small pressure gauges as decorative elements',
      accents: 'rivets along borders, chain links, small gears in corners',
    },
    typography: {
      headline: 'ornate embossed gold/brass serif text with metallic sheen',
      accent: 'engraved brass plate labels with rivets',
      numbers: 'large bold inside brass gauge dial frames with glass faces',
      body: 'cream/warm white serif on dark metal plates',
      labels: 'small stamped brass letters',
    },
    cardStyle: 'riveted metal plates with brass borders, slightly raised with shadow',
    chartStyle: 'brass gauge dials with glass faces for metrics, copper-framed data plates for tables',
    colorSlots: {
      primary: 'FROM_LOGO_PRIMARY',
      secondary: 'FROM_LOGO_SECONDARY',
      text: 'cream/warm white (#F4E4C1)',
      background: 'dark industrial metal (#1a1410)',
      highlight: 'brass gold (#D4A843)',
    },
  },
  promptTemplate: 'Steampunk mechanical dashboard. Every element feels like precision Victorian-era engineering rendered in brass, copper, and iron.',
}
