// What a phone's floor does without: the floor's shader pays for the pond's sand and the wells' ground on every pixel,
// though they lie on a small share of it, 9 ms of 64 on a Xiaomi Mi 9 at a pixel ratio of 2 (2026-11-04). So its
// triangles are parted, those that can show them under the whole shader, the rest under one without. And Perlin noise,
// worked out per pixel, is read from a texture instead.

/** The index with the triangles that need the whole shader last, and how many indices come before them. */
export function splitTriangles(position: ArrayLike<number>, index: ArrayLike<number> | undefined, needsAll: (x: number, lowest: number, z: number, radius: number) => boolean): { index: Uint32Array; plain: number } {
  const count = index ? index.length : position.length / 3
  const corner = (k: number) => (index ? index[k]! : k)
  const plain: number[] = []
  const whole: number[] = []
  for (let k = 0; k + 2 < count; k += 3) {
    const [a, b, c] = [corner(k), corner(k + 1), corner(k + 2)]
    const x = (position[3 * a]! + position[3 * b]! + position[3 * c]!) / 3
    const y = (position[3 * a + 1]! + position[3 * b + 1]! + position[3 * c + 1]!) / 3
    const z = (position[3 * a + 2]! + position[3 * b + 2]! + position[3 * c + 2]!) / 3
    const radius = Math.sqrt(Math.max(...[a, b, c].map((v) => (position[3 * v]! - x) ** 2 + (position[3 * v + 1]! - y) ** 2 + (position[3 * v + 2]! - z) ** 2)))
    ;(needsAll(x, Math.min(position[3 * a + 1]!, position[3 * b + 1]!, position[3 * c + 1]!), z, radius) ? whole : plain).push(a, b, c)
  }
  return { index: Uint32Array.from([...plain, ...whole]), plain: plain.length }
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
