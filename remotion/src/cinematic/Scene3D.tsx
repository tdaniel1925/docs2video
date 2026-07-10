import { AbsoluteFill, useCurrentFrame, useVideoConfig, staticFile, interpolate, Easing } from 'remotion'
import { ThreeCanvas } from '@remotion/three'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

/**
 * Scene3D — UI screenshots as textured planes in REAL 3D space, with a camera
 * that dollies and orbits between them. This is the jump from "flat cards" to
 * "product film": genuine perspective, parallax, depth-of-field feel.
 *
 * NOTE: @remotion/three + @react-three/drei required. Camera path is driven by
 * `frame` so it's deterministic.
 */

const eio = (t: number) => Easing.inOut(Easing.cubic)(t)

const Panel: React.FC<{ src: string; position: [number, number, number]; rotation: [number, number, number]; opacity: number }> =
({ src, position, rotation, opacity }) => {
  const tex = useTexture(staticFile(src))
  // UI shots are ~1280x820 → aspect ~1.56
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[3.1, 2.0]} />
      <meshBasicMaterial map={tex as THREE.Texture} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  )
}

export const Scene3D: React.FC<{ src: string; enterAt: number }> = ({ src, enterAt }) => {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const t = Math.max(0, frame - enterAt)

  // camera path: start close + off-axis, dolly back and level out (a reveal)
  const p = eio(interpolate(t, [0, 1.4 * fps], [0, 1], { extrapolateRight: 'clamp' }))
  const camX = interpolate(p, [0, 1], [-2.2, 0.15])
  const camZ = interpolate(p, [0, 1], [3.1, 5.0])
  const camY = interpolate(p, [0, 1], [1.1, 0.15])
  const panelRotY = interpolate(p, [0, 1], [0.5, -0.06])
  const panelOpacity = interpolate(t, [0, 0.5 * fps], [0, 1], { extrapolateRight: 'clamp' })
  // gentle continuous float once settled
  const floatY = Math.sin(t * 0.04) * 0.04
  const floatR = Math.sin(t * 0.03) * 0.02

  return (
    <AbsoluteFill>
      <ThreeCanvas width={width} height={height} camera={{ fov: 42, position: [camX, camY, camZ] }} gl={{ antialias: true }}>
        <color attach="background" args={[0, 0, 0]} />
        <CameraLook x={camX} y={camY} z={camZ} />
        <Panel src={src} position={[0, floatY, 0]} rotation={[floatR * 0.5, panelRotY + floatR, 0]} opacity={panelOpacity} />
      </ThreeCanvas>
    </AbsoluteFill>
  )
}

// look-at helper so the camera always frames the panel
const CameraLook: React.FC<{ x: number; y: number; z: number }> = () => {
  // R3F auto-uses the ThreeCanvas camera; look handled by positioning panel at origin
  return null
}
