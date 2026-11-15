import { loadFont as archivo } from '@remotion/google-fonts/Archivo'
import { loadFont as bebas } from '@remotion/google-fonts/BebasNeue'
import { loadFont as cormorant } from '@remotion/google-fonts/CormorantGaramond'
import { loadFont as dmsans } from '@remotion/google-fonts/DMSans'
import { loadFont as fraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as inter } from '@remotion/google-fonts/Inter'
import { loadFont as jetbrains } from '@remotion/google-fonts/JetBrainsMono'
import { loadFont as jost } from '@remotion/google-fonts/Jost'
import { loadFont as manrope } from '@remotion/google-fonts/Manrope'
import { loadFont as montserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as playfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as jakarta } from '@remotion/google-fonts/PlusJakartaSans'
import { loadFont as sourcesans } from '@remotion/google-fonts/SourceSans3'
import { loadFont as grotesk } from '@remotion/google-fonts/SpaceGrotesk'

import { KIT_FONTS, guardLook, sanitizeLook, type KitPlan } from '../kit/spec'
import { kitFont } from '../kit/fonts'

/*
 * A THEME is everything that makes a look itself, on one shared engine: colors, type, how numbers are drawn, how
 * cards are drawn, the world the camera moves through, how much the camera moves, and which effects are on.
 * Palettes and fonts are taken from Docs2Video's current looks (kit spec, presentation templates, explainer
 * templates) so each sample can sit beside today's version.
 */
const F = {
  archivo: archivo('normal', { weights: ['500', '700', '800'], subsets: ['latin'] }).fontFamily,
  bebas: bebas('normal', { weights: ['400'], subsets: ['latin'] }).fontFamily,
  cormorant: cormorant('normal', { weights: ['500', '600'], subsets: ['latin'] }).fontFamily,
  dmsans: dmsans('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily,
  fraunces: fraunces('normal', { weights: ['500', '600'], subsets: ['latin'] }).fontFamily,
  inter: inter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily,
  jetbrains: jetbrains('normal', { weights: ['500'], subsets: ['latin'] }).fontFamily,
  jost: jost('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily,
  manrope: manrope('normal', { weights: ['500', '700', '800'], subsets: ['latin'] }).fontFamily,
  montserrat: montserrat('normal', { weights: ['600', '700', '800'], subsets: ['latin'] }).fontFamily,
  playfair: playfair('normal', { weights: ['500', '600', '700'], subsets: ['latin'] }).fontFamily,
  jakarta: jakarta('normal', { weights: ['500', '600', '700', '800'], subsets: ['latin'] }).fontFamily,
  sourcesans: sourcesans('normal', { weights: ['400', '600'], subsets: ['latin'] }).fontFamily,
  grotesk: grotesk('normal', { weights: ['500', '700'], subsets: ['latin'] }).fontFamily,
}
cormorant('italic', { weights: ['500'], subsets: ['latin'] })
fraunces('italic', { weights: ['500'], subsets: ['latin'] })
playfair('italic', { weights: ['500'], subsets: ['latin'] })

export type World = 'space' | 'paper' | 'studio' | 'grid'
export type Theme = {
  id: string; name: string; dark: boolean
  bg: string; bg2: string; ink: string; muted: string; accent: string; accent2: string; cardBg: string; line: string
  head: string; headWeight: number; headUpper?: boolean; /** wide uppercase faces are drawn smaller */ upperScale?: number; headTrack?: string; headItalic?: boolean
  body: string; label: string; labelWeight: number; labelTrack: string
  /** metal: layered gold; solid: ink; accent: the accent color; */
  numeral: 'metal' | 'solid' | 'accent'
  card: 'glass' | 'paper' | 'flat' | 'frame' | 'rule'
  radius: number
  world: World
  /** extra touches: a frame round the picture, a diagonal band, a skyline, corner rules, a grid of index numbers */
  ornament?: 'frame' | 'band' | 'skyline' | 'corners' | 'index' | 'blobs'
  /** camera movement, 0.5 (still and exact) to 1.5 (lively) */
  energy: number
  dof: boolean; flare: number; bokeh: number; dust: number; grain: number; letterbox: boolean
  entrance: 'blur' | 'rise' | 'slide' | 'wipe'
  series: string[]
}

export const THEMES: Theme[] = [
  { id: 'slides', name: 'Animated slides', dark: true, bg: '#0B1424', bg2: '#1D3358', ink: '#F4F1EC', muted: '#AEB8C8', accent: '#D8B25A', accent2: '#7FA7E0', cardBg: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.16)',
    head: F.montserrat, headWeight: 800, headTrack: '-0.02em', body: F.sourcesans, label: F.montserrat, labelWeight: 700, labelTrack: '.28em',
    numeral: 'metal', card: 'glass', radius: 16, world: 'space', energy: 1, dof: true, flare: 0.6, bokeh: 6, dust: 40, grain: 0.06, letterbox: false, entrance: 'rise', series: ['#7FA7E0', '#9FB6C9', '#5E7BA6'] },
  { id: 'editorial', name: 'Editorial', dark: false, bg: '#F4EFE6', bg2: '#E6DCCB', ink: '#1C1F26', muted: '#5D5A52', accent: '#1F5A43', accent2: '#B08A4A', cardBg: '#FBF8F2', line: '#D9CFBE',
    head: F.fraunces, headWeight: 600, headTrack: '-0.02em', headItalic: true, body: F.dmsans, label: F.dmsans, labelWeight: 700, labelTrack: '.2em',
    numeral: 'solid', card: 'paper', radius: 2, world: 'paper', energy: 0.7, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0.05, letterbox: false, entrance: 'rise', series: ['#B08A4A', '#7C8C86', '#C9B79A'] },
  { id: 'bright', name: 'Bright', dark: false, bg: '#F6F3ED', bg2: '#D6EEE8', ink: '#15233B', muted: '#4B5872', accent: '#E8452A', accent2: '#1FA88E', cardBg: '#FFFFFF', line: '#E4DED2',
    head: F.grotesk, headWeight: 700, headTrack: '-0.03em', body: F.archivo, label: F.grotesk, labelWeight: 700, labelTrack: '.14em',
    numeral: 'accent', card: 'paper', radius: 26, world: 'studio', ornament: 'blobs', energy: 1.3, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0.03, letterbox: false, entrance: 'slide', series: ['#1FA88E', '#F5B72E', '#6B5CE0'] },
  { id: 'infographic', name: 'Infographic', dark: false, bg: '#FFFFFF', bg2: '#EEF3FB', ink: '#0F172A', muted: '#475569', accent: '#2563EB', accent2: '#F59E0B', cardBg: '#EEF3FB', line: '#DCE3EE',
    head: F.archivo, headWeight: 800, headTrack: '-0.035em', body: F.inter, label: F.archivo, labelWeight: 700, labelTrack: '.12em',
    numeral: 'accent', card: 'flat', radius: 10, world: 'grid', energy: 1.1, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0.02, letterbox: false, entrance: 'wipe', series: ['#2563EB', '#F59E0B', '#10B981'] },
  { id: 'midnight', name: 'Midnight', dark: true, bg: '#0F1729', bg2: '#1A2439', ink: '#E8EDF8', muted: '#A9B4CC', accent: '#D9B64C', accent2: '#ECCF7E', cardBg: 'rgba(26,36,57,.85)', line: 'rgba(255,255,255,.13)',
    head: F.playfair, headWeight: 600, headTrack: '-0.01em', headItalic: true, body: F.inter, label: F.inter, labelWeight: 600, labelTrack: '.3em',
    numeral: 'metal', card: 'glass', radius: 14, world: 'space', energy: 0.9, dof: true, flare: 0.5, bokeh: 7, dust: 36, grain: 0.06, letterbox: false, entrance: 'blur', series: ['#ECCF7E', '#8A7534', '#A9B4CC'] },
  { id: 'heritage', name: 'Heritage', dark: false, bg: '#F7F5EE', bg2: '#ECE6D6', ink: '#1C2A44', muted: '#5A6274', accent: '#A8842C', accent2: '#1C2A44', cardBg: '#FCFBF6', line: '#CDBF98',
    head: F.playfair, headWeight: 600, body: F.sourcesans, label: F.sourcesans, labelWeight: 600, labelTrack: '.32em', headItalic: true,
    numeral: 'solid', card: 'frame', radius: 0, world: 'paper', ornament: 'frame', energy: 0.6, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0.05, letterbox: false, entrance: 'rise', series: ['#A8842C', '#1C2A44', '#8A93A6'] },
  { id: 'warm', name: 'Warm Editorial', dark: false, bg: '#FAF9F5', bg2: '#F5E6DF', ink: '#3D3929', muted: '#6B6759', accent: '#C96442', accent2: '#E0906F', cardBg: '#FFFDF8', line: '#E8E6DC',
    head: F.jakarta, headWeight: 700, headTrack: '-0.025em', body: F.jakarta, label: F.jakarta, labelWeight: 700, labelTrack: '.16em',
    numeral: 'accent', card: 'paper', radius: 20, world: 'paper', energy: 0.8, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0.04, letterbox: false, entrance: 'rise', series: ['#C96442', '#7D8C6F', '#E0906F'] },
  { id: 'bold', name: 'Corporate Bold', dark: false, bg: '#F4F6FA', bg2: '#DDE3EC', ink: '#15233F', muted: '#4A5A78', accent: '#C0272D', accent2: '#1E3A70', cardBg: '#FFFFFF', line: '#DDE3EC',
    head: F.montserrat, headWeight: 800, headTrack: '-0.025em', headUpper: true, upperScale: 0.76, body: F.inter, label: F.montserrat, labelWeight: 700, labelTrack: '.2em',
    numeral: 'solid', card: 'flat', radius: 4, world: 'studio', ornament: 'band', energy: 1.15, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0.02, letterbox: false, entrance: 'slide', series: ['#1E3A70', '#C0272D', '#8B96AB'] },
  { id: 'mint', name: 'Fresh Mint', dark: false, bg: '#F4F1EC', bg2: '#E3F0D6', ink: '#232920', muted: '#5C6656', accent: '#6DA33F', accent2: '#2B3427', cardBg: '#FFFEFB', line: '#E4E0D5',
    head: F.jakarta, headWeight: 800, headTrack: '-0.03em', body: F.jakarta, label: F.jakarta, labelWeight: 700, labelTrack: '.16em',
    numeral: 'solid', card: 'paper', radius: 22, world: 'studio', ornament: 'blobs', energy: 0.95, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0.03, letterbox: false, entrance: 'rise', series: ['#6DA33F', '#A5CD7C', '#C7E8A8'] },
  { id: 'swiss', name: 'Swiss Corporate', dark: false, bg: '#FFFFFF', bg2: '#F1F4F9', ink: '#0B1220', muted: '#4C5970', accent: '#1D4ED8', accent2: '#0B1220', cardBg: '#F1F4F9', line: '#C9D2E0',
    head: F.archivo, headWeight: 800, headTrack: '-0.045em', body: F.archivo, label: F.jetbrains, labelWeight: 500, labelTrack: '.04em',
    numeral: 'solid', card: 'flat', radius: 0, world: 'grid', ornament: 'index', energy: 0.55, dof: false, flare: 0, bokeh: 0, dust: 0, grain: 0, letterbox: false, entrance: 'wipe', series: ['#1D4ED8', '#0B1220', '#C9D2E0'] },
  { id: 'luxury', name: 'Luxury Gold', dark: true, bg: '#0B0A08', bg2: '#1A1610', ink: '#F3ECDD', muted: '#D3C6AB', accent: '#D9B56E', accent2: '#F3ECDD', cardBg: 'rgba(12,11,9,.6)', line: 'rgba(217,181,110,.65)',
    head: F.cormorant, headWeight: 500, headItalic: true, body: F.jost, label: F.jost, labelWeight: 400, labelTrack: '.4em',
    numeral: 'metal', card: 'rule', radius: 0, world: 'space', ornament: 'corners', energy: 0.7, dof: true, flare: 0.45, bokeh: 5, dust: 30, grain: 0.07, letterbox: false, entrance: 'blur', series: ['#D9B56E', '#F3ECDD', '#8C7444'] },
  { id: 'night', name: 'Cinematic Night', dark: true, bg: '#04080F', bg2: '#0A1424', ink: '#F4F1EA', muted: '#B9C4D6', accent: '#FFB547', accent2: '#7FA7E0', cardBg: 'rgba(10,20,36,.86)', line: '#46587A',
    head: F.bebas, headWeight: 400, headUpper: true, headTrack: '.01em', body: F.manrope, label: F.manrope, labelWeight: 800, labelTrack: '.28em',
    numeral: 'accent', card: 'glass', radius: 14, world: 'space', ornament: 'skyline', energy: 1.25, dof: true, flare: 0.9, bokeh: 8, dust: 50, grain: 0.09, letterbox: true, entrance: 'blur', series: ['#FFB547', '#7FA7E0', '#B9C4D6'] },
]
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0]
export const FILM_THEME_IDS = THEMES.map((t) => t.id)

/* The kit's three ready looks are three of the film themes. */
const KIT_LOOK_THEME: Record<string, string> = { 'animated-slides': 'slides', editorial: 'editorial', bright: 'bright' }

/**
 * The theme for a plan: a named film look, a kit ready look, or — for "Your look" and brand looks — a theme DERIVED
 * from the kit Look (its guarded colors, its fonts, its feel and background), so every custom look draws too.
 */
export function themeForPlan(plan: KitPlan): Theme {
  if (plan.filmTheme && FILM_THEME_IDS.includes(plan.filmTheme)) return themeById(plan.filmTheme)
  const look = sanitizeLook(plan.look)
  const ready = KIT_LOOK_THEME[look.id]
  if (ready && look.id !== 'custom') return themeById(ready)
  const { tokens: k } = guardLook(look)
  const base = themeById(k.dark ? 'slides' : look.feel === 'energetic' ? 'bright' : 'editorial')
  const head = kitFont(look.headFont), body = kitFont(look.bodyFont)
  const world: World = look.background === 'paper' ? 'paper' : k.dark ? 'space' : look.background === 'gradient' ? 'studio' : 'paper'
  return {
    ...base, id: 'custom', name: look.name || 'Your look', dark: k.dark,
    bg: k.bg, bg2: k.glow, ink: k.text, muted: k.muted, accent: k.accentBig, accent2: k.series[1] ?? k.accentInk,
    cardBg: k.dark ? 'rgba(255,255,255,.06)' : k.surface, line: k.surfaceLine,
    head, headWeight: look.headWeight ?? (KIT_FONTS[look.headFont]?.kind === 'serif' ? 600 : 800), headUpper: !!look.upperLabels && false, headItalic: KIT_FONTS[look.headFont]?.kind === 'serif',
    body, label: body, labelWeight: 700, labelTrack: '.2em',
    numeral: k.dark ? 'accent' : 'solid', card: k.dark ? 'glass' : 'paper', radius: look.corners === 'square' ? 2 : 10,
    world, ornament: undefined, energy: look.feel === 'calm' ? 0.7 : look.feel === 'energetic' ? 1.2 : 0.95,
    dof: k.dark, flare: k.dark ? 0.4 : 0, bokeh: k.dark ? 5 : 0, dust: k.dark ? 30 : 0, letterbox: false,
    entrance: look.feel === 'energetic' ? 'slide' : k.dark ? 'blur' : 'rise', series: k.series.slice(0, 3),
  }
}
