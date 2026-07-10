import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { useRef, useEffect } from 'react'

/**
 * ShaderBackdrop — a GLSL fragment-shader backdrop rendered to a canvas each
 * frame. Flowing domain-warped fractal noise ("aurora fluid") + light streaks
 * + vignette + film grain. This is the single biggest "expensive" visual tell:
 * a living, generative backdrop that never repeats, computed on the GPU.
 *
 * Deterministic: the shader is driven by `frame`, so every render is identical.
 * Renders fast (one full-screen quad) — much cheaper than 3D geometry.
 */

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_c1;   // deep base
uniform vec3 u_c2;   // mid glow
uniform vec3 u_c3;   // accent
varying vec2 v_uv;

// hash + value noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v=0., a=0.5;
  for(int i=0;i<6;i++){ v+=a*noise(p); p*=2.02; a*=0.5; }
  return v;
}

void main(){
  vec2 uv = v_uv;
  vec2 p = uv * vec2(u_res.x/u_res.y, 1.0);
  float t = u_time * 0.06;

  // domain warp — the "fluid" motion
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t*0.8)));
  vec2 r = vec2(fbm(p + 3.0*q + vec2(1.7, 9.2) + t*0.5),
                fbm(p + 3.0*q + vec2(8.3, 2.8) - t*0.4));
  float f = fbm(p + 2.5*r);

  // color mixing — dark base rising to accent in the warped hot spots
  vec3 col = mix(u_c1, u_c2, clamp(f*f*1.8, 0.0, 1.0));
  col = mix(col, u_c3, clamp(length(r)*0.6, 0.0, 1.0) * smoothstep(0.4,0.9,f));

  // soft diagonal light streaks
  float streak = smoothstep(0.75, 1.0, sin((uv.x*2.2 - uv.y*1.4 + t*2.0)) * 0.5 + 0.5 + f*0.3);
  col += u_c3 * streak * 0.10;

  // radial glow rising from bottom-center
  float glow = smoothstep(1.1, 0.0, distance(uv, vec2(0.5, 1.15)));
  col += u_c2 * glow * 0.18;

  // vignette
  col *= smoothstep(1.25, 0.35, distance(uv, vec2(0.5)));

  // film grain (animated)
  float g = hash(uv * u_res.xy * 0.5 + fract(u_time)) - 0.5;
  col += g * 0.035;

  // keep it dark enough for white text
  col *= 0.82;
  gl_FragColor = vec4(col, 1.0);
}
`

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.,1.); }
`

const hex = (h: string): [number, number, number] => {
  const n = h.replace('#', '')
  return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255]
}

export const ShaderBackdrop: React.FC<{ c1?: string; c2?: string; c3?: string; speed?: number }> =
({ c1 = '#0a0f18', c2 = '#123a52', c3 = '#4a9fe0', speed = 1 }) => {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true })
    if (!gl) return
    const compile = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog); gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), width, height)
    gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), frame / fps)
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_c1'), hex(c1))
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_c2'), hex(c2))
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_c3'), hex(c3))
    gl.viewport(0, 0, width, height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }, [frame, fps, width, height, c1, c2, c3])

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={width} height={height} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  )
}
