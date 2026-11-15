import React from 'react'
import { AbsoluteFill } from 'remotion'
import { Atmos, Band, Bokeh, Stage, World, kf, type Cam } from './core'

/* The shared stage for every film scene: the look's world, its scenery, the 3D camera, things in the air. */
export const camOf = (E: number, keys: { x?: [number, number][]; y?: [number, number][]; z: [number, number][]; ry?: [number, number][]; rx?: [number, number][] }, t: number, focus = 0): Cam => ({
  x: keys.x ? kf(t, keys.x) * E : 0, y: keys.y ? kf(t, keys.y) * E : 0, z: kf(t, keys.z) * E, rx: keys.rx ? kf(t, keys.rx) * E : 0, ry: keys.ry ? kf(t, keys.ry) * E : 0, focus,
})
export const Shell: React.FC<{ t: number; cam: Cam; children: React.ReactNode; overlay?: React.ReactNode; seed?: number }> = ({ t, cam, children, overlay, seed = 1 }) => (
  <AbsoluteFill>
    <World t={t} />
    <Band t={t} />
    <Stage cam={cam}>{children}<Atmos t={t} seed={seed} /></Stage>
    <Bokeh t={t} seed={seed + 2} />
    {overlay}
  </AbsoluteFill>
)
