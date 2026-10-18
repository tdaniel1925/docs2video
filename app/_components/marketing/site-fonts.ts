import { Archivo, DM_Sans } from 'next/font/google'

/*
 * The public site's two fonts (the front page and every page it links to):
 * Archivo for the big capitals, DM Sans for the words. Loaded once here and
 * set as CSS variables on the .hp root, so the app's own fonts are untouched.
 */
export const display = Archivo({ subsets: ['latin'], weight: ['800', '900'], variable: '--hp-display', display: 'swap' })
export const sans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--hp-sans', display: 'swap' })
export const siteFonts = `${display.variable} ${sans.variable}`
