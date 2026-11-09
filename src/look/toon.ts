// Toon shading's gradient: a lit surface takes the light in three hard steps,
// read from a gradient of fifteen texels, five a step; or in no steps at all,
// a smooth Lambert ramp.
// Each shell material (shell.ts) has a gradient of its own and rewrites it
// when its steps move, never recompiling.
import { DataTexture, LinearFilter, NearestFilter, RedFormat } from 'three/webgpu'

/** Texels in a gradient: the steps divide it. */
const TEXELS = 15

/** What a toon folder edits: three steps, or 0 for none (smooth), and each step's brightness, darkest first, 0 to 1. */
export interface ToonLook {
  steps: 0 | 3
  three: number[]
}

/** Three steps to start: shade, half-light, full light. */
const defaultToon = (): ToonLook => ({ steps: 3, three: [0.35, 0.65, 1] })

/** A gradient a material reads by how squarely the light falls on it, at the default steps. */
export function createToonGradient(): DataTexture {
  const gradient = new DataTexture(new Uint8Array(TEXELS), TEXELS, 1, RedFormat)
  gradient.minFilter = gradient.magFilter = NearestFilter
  gradient.generateMipmaps = false
  writeToon(gradient, defaultToon())
  return gradient
}

/** Write a toon folder's steps into `gradient`: no steps, and it is a Lambert ramp, dark where the light is behind, read smoothly. */
export function writeToon(gradient: DataTexture, look: ToonLook): void {
  const smooth = look.steps === 0
  const steps = look.three
  const data = gradient.image.data as Uint8Array
  for (let t = 0; t < TEXELS; t++) {
    const step = smooth ? (t / (TEXELS - 1) - 0.5) * 2 : steps[Math.floor((t * steps.length) / TEXELS)]
    data[t] = Math.round(Math.min(1, Math.max(0, step)) * 255)
  }
  gradient.magFilter = smooth ? LinearFilter : NearestFilter
  gradient.needsUpdate = true
}
