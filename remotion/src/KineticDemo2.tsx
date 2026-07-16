import React from 'react'
import { AbsoluteFill, Audio, staticFile } from 'remotion'
import { loadFont as loadArchivoBlack } from '@remotion/google-fonts/ArchivoBlack'
import { KineticSlam, toFrames, type Slam } from './lib/kinetic'
import transients from '../public/kinetic/transients.json'

const { fontFamily: BLACK } = loadArchivoBlack()
const FPS = 30

// the detected syncopated drum hits (frames)
const HITS = toFrames((transients as any).transients, FPS)

// a punchy script — one word/phrase PER DRUM HIT. Short = lands on the beat.
// mode 'solid' = b&w invert slam; 'over' = text over image. accent for pops.
const SLAMS: Slam[] = [
  { text: 'THIS', mode: 'solid' },
  { text: 'IS', mode: 'solid' },
  { text: 'HOW', mode: 'solid' },
  { text: 'FAST', mode: 'solid', accent: '#2563eb' },
  { text: 'IDEAS', mode: 'solid' },
  { text: 'MOVE', mode: 'solid' },
  { text: 'NOW.', mode: 'solid', invert: true },
  { text: 'BOLD', mode: 'solid' },
  { text: 'PUNCHY', mode: 'solid' },
  { text: 'ON', mode: 'solid' },
  { text: 'EVERY', mode: 'solid' },
  { text: 'BEAT', mode: 'solid', accent: '#2563eb' },
  { text: 'SNAP', mode: 'solid' },
  { text: 'CUT', mode: 'solid', invert: true },
  { text: 'SLAM', mode: 'solid' },
  { text: 'BLACK', mode: 'solid', invert: true },
  { text: 'WHITE', mode: 'solid' },
  { text: 'REPEAT', mode: 'solid' },
  { text: 'FRAME', mode: 'solid' },
  { text: 'LOCKED', mode: 'solid', accent: '#2563eb' },
  { text: 'TO', mode: 'solid' },
  { text: 'THE', mode: 'solid' },
  { text: 'DRUMS', mode: 'solid', invert: true },
  { text: 'NO', mode: 'solid' },
  { text: 'MERCY', mode: 'solid' },
  { text: 'PURE', mode: 'solid' },
  { text: 'RHYTHM', mode: 'solid' },
  { text: 'FEEL', mode: 'solid' },
  { text: 'IT', mode: 'solid', invert: true },
  { text: 'HIT', mode: 'solid' },
  { text: 'AFTER', mode: 'solid' },
  { text: 'HIT', mode: 'solid' },
  { text: 'THIS', mode: 'solid' },
  { text: 'IS', mode: 'solid' },
  { text: 'KINETIC.', mode: 'solid', accent: '#2563eb', size: 170 },
]

// only use as many hits as we have words (and vice versa)
const N = Math.min(SLAMS.length, HITS.length)
export const KINETIC2_FRAMES = Math.round(15.0 * FPS)

export const KineticDemo2: React.FC = () => (
  <AbsoluteFill>
    <KineticSlam slams={SLAMS.slice(0, N)} hits={HITS.slice(0, N)} font={BLACK} end={KINETIC2_FRAMES} />
    <Audio src={staticFile('kinetic/music.mp3')} volume={0.9} />
  </AbsoluteFill>
)
