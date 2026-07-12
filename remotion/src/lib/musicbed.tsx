import React from 'react'
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion'

/* ============================================================================
 * MusicBed — GUARANTEES the music covers the ENTIRE video. Root-causes the
 * "music cut off halfway" bug: video length drifts (intro offsets, beat-snap, VO
 * running long) so a fixed-length track ends before the video does → dead air.
 *
 * This LOOPS the track as many times as needed to cover `total` frames, with a
 * tiny cross-fade at each loop seam and a clean fade-out at the true end. The
 * per-frame `volume` fn (the ducking envelope) is applied on top. It is now
 * IMPOSSIBLE for the music to run out, whatever the final video length is.
 *
 * Usage: replace  <Audio src={music} volume={musicDuck} />
 *        with     <MusicBed src="brand/music.mp3" musicFrames={M} volume={musicDuck} />
 * where musicFrames = round(musicDurationSeconds * fps).
 * ==========================================================================*/

export const MusicBed: React.FC<{
  src: string
  musicFrames: number            // length of the source track, in frames
  volume: (f: number) => number  // the ducking envelope (absolute frame)
  seam?: number                  // cross-fade frames at each loop seam
}> = ({ src, musicFrames, volume, seam = 12 }) => {
  const { durationInFrames } = useVideoConfig()
  const total = durationInFrames
  if (!musicFrames || musicFrames < 1) return <Audio src={staticFile(src)} volume={volume} />

  // how many loops to cover the whole video (each loop overlaps the seam)
  const step = Math.max(1, musicFrames - seam)
  const loops = Math.max(1, Math.ceil((total - musicFrames) / step) + 1)

  return (
    <>
      {Array.from({ length: loops }, (_, i) => {
        const from = i * step
        if (from >= total) return null
        return (
          <Sequence key={i} from={from} durationInFrames={musicFrames}>
            <Audio
              src={staticFile(src)}
              // volume takes the ABSOLUTE composition frame so the duck envelope
              // and the end fade stay correct across loop boundaries; a short
              // seam-fade avoids a click where loops overlap.
              volume={(rel) => {
                const abs = from + rel
                const base = volume(abs)
                // fade in over the seam (except the first loop) + out at loop tail
                const seamIn = i === 0 ? 1 : Math.min(1, rel / seam)
                const seamOut = Math.min(1, (musicFrames - rel) / seam)
                return base * seamIn * seamOut
              }}
            />
          </Sequence>
        )
      })}
    </>
  )
}
