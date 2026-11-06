// What a phone's floor does without: the floor's shader pays for the pond's sand and the wells' ground on every pixel,
// though they lie on a small share of it, 9 ms of 64 on a Xiaomi Mi 9 at a pixel ratio of 2 (2026-11-04). So its
// triangles are parted, those that can show them under the whole shader, the rest under one without; and of those, the
// ones the road cannot reach under one without the road either, which every pixel paid for too, 4 to 6.5 ms of 30 to
// 50 (Mi 9, dpr 2, 2026-11-06). And Perlin noise, worked out per pixel, is read from a texture instead.
import type { RoadField } from './road'

/** The index with the triangles in order of the zone `zoneOf` puts each in, 0 to `zones` less one, and how many indices each zone has. */
export function splitTriangles(position: ArrayLike<number>, index: ArrayLike<number> | undefined, zoneOf: (x: number, lowest: number, z: number, radius: number) => number, zones: number): { index: Uint32Array; counts: number[] } {
  const count = index ? index.length : position.length / 3
  const corner = (k: number) => (index ? index[k]! : k)
  const parted: number[][] = Array.from({ length: zones }, () => [])
  for (let k = 0; k + 2 < count; k += 3) {
    const [a, b, c] = [corner(k), corner(k + 1), corner(k + 2)]
    const x = (position[3 * a]! + position[3 * b]! + position[3 * c]!) / 3
    const y = (position[3 * a + 1]! + position[3 * b + 1]! + position[3 * c + 1]!) / 3
    const z = (position[3 * a + 2]! + position[3 * b + 2]! + position[3 * c + 2]!) / 3
    const radius = Math.sqrt(Math.max(...[a, b, c].map((v) => (position[3 * v]! - x) ** 2 + (position[3 * v + 1]! - y) ** 2 + (position[3 * v + 2]! - z) ** 2)))
    parted[zoneOf(x, Math.min(position[3 * a + 1]!, position[3 * b + 1]!, position[3 * c + 1]!), z, radius)]!.push(a, b, c)
  }
  return { index: Uint32Array.from(parted.flat()), counts: parted.map((zone) => zone.length) }
}

/**
 * Whether a triangle, its middle and how far its corners lie from it, can show the road `field` lays: some cell its
 * pixels read lies nearer the road's middle than `reach`, the road's half width, edge and wobble. Its pixels read the
 * four cells round them, the field's edge cells past its edge, as the floor's shader does; none with no field laid.
 */
export function roadCanShow(field: RoadField | undefined, reach: number): (x: number, z: number, radius: number) => boolean {
  if (!field) return () => false
  const { minX, minZ, cell, columns, rows, data } = field
  const span = (from: number, to: number, last: number) => {
    const at = (v: number) => Math.floor(Math.min(Math.max(v / cell, 0), last))
    return [at(from), Math.min(at(to) + 1, last)] as const
  }
  return (x, z, radius) => {
    const [c0, c1] = span(x - radius - minX, x + radius - minX, columns - 1)
    const [r0, r1] = span(z - radius - minZ, z + radius - minZ, rows - 1)
    for (let row = r0; row <= r1; row++) {
      for (let column = c0; column <= c1; column++) if (Math.abs(data[(row * columns + column) * 4]!) < reach) return true
    }
    return false
  }
}

/** Gradient noise on a `size` square of bytes, 128 its nought and running to the full byte at one, `cells` of it across, its edges meeting. */
export function tiledNoise(size: number, cells: number): Uint8Array {
  // A small generator of its own, so the floor is the same on every load.
  let seed = 0x2f6e2b1
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const angles = Float32Array.from({ length: cells * cells }, () => next() * Math.PI * 2)
  const gradient = (i: number, j: number, dx: number, dy: number) => {
    const angle = angles[((j + cells) % cells) * cells + ((i + cells) % cells)]!
    return Math.cos(angle) * dx + Math.sin(angle) * dy
  }
  const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const bytes = new Uint8Array(size * size)
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = (column / size) * cells
      const y = (row / size) * cells
      const i = Math.floor(x)
      const j = Math.floor(y)
      const u = ease(x - i)
      const v = ease(y - j)
      const lower = gradient(i, j, x - i, y - j) * (1 - u) + gradient(i + 1, j, x - i - 1, y - j) * u
      const upper = gradient(i, j + 1, x - i, y - j - 1) * (1 - u) + gradient(i + 1, j + 1, x - i - 1, y - j - 1) * u
      // Plain gradient noise reaches about 0.7: stretched to the reach of three's.
      const noise = (lower * (1 - v) + upper * v) * Math.SQRT2
      bytes[row * size + column] = Math.round(Math.min(Math.max((noise + 1) / 2, 0), 1) * 255)
    }
  }
  return bytes
}

/**
 * `bytes`, a `size` square, read at (u, v) as a repeating texture with a linear filter reads it, its texels' centres at
 * their middles: the four round the point mixed, a share of the full byte. For the CPU to read what the GPU does.
 */
export function sampleTiled(bytes: ArrayLike<number>, size: number, u: number, v: number): number {
  const x = u * size - 0.5
  const y = v * size - 0.5
  const i = Math.floor(x)
  const j = Math.floor(y)
  const fx = x - i
  const fy = y - j
  const at = (column: number, row: number) => bytes[(((row % size) + size) % size) * size + (((column % size) + size) % size)]!
  const lower = at(i, j) * (1 - fx) + at(i + 1, j) * fx
  const upper = at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx
  return (lower * (1 - fy) + upper * fy) / 255
}
