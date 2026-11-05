import { describe, expect, it } from 'vitest'
import { splitTriangles, tiledNoise } from './groundzones'

const TWO_TRIANGLES = [0, 0, 0, 1, 0, 0, 0, 0, 1, 10, 0, 10, 11, 0, 10, 10, 0, 11]

describe('splitTriangles', () => {
  it('puts the triangles that need the whole shader last', () => {
    const { index, plain } = splitTriangles(TWO_TRIANGLES, undefined, (x) => x < 5)
    expect(plain).toBe(3)
    expect([...index]).toEqual([3, 4, 5, 0, 1, 2])
  })

  it('reads an index where there is one', () => {
    const { index, plain } = splitTriangles(TWO_TRIANGLES, [3, 4, 5, 0, 1, 2], (x) => x > 5)
    expect(plain).toBe(3)
    expect([...index]).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('hands over the lowest corner, for ground that dips below the floor', () => {
    const lows: number[] = []
    splitTriangles([0, 2, 0, 1, -1, 0, 0, 3, 1], undefined, (_x, lowest) => {
      lows.push(lowest)
      return false
    })
    expect(lows).toEqual([-1])
  })

  it('hands over how far the corners lie from the middle', () => {
    const radii: number[] = []
    splitTriangles(TWO_TRIANGLES.slice(0, 9), undefined, (_x, _lowest, _z, radius) => {
      radii.push(radius)
      return false
    })
    expect(radii[0]).toBeCloseTo(Math.hypot(2 / 3, 1 / 3))
  })
})

describe('tiledNoise', () => {
  const size = 64
  const noise = tiledNoise(size, 8)

  it('is the same each time', () => {
    expect(tiledNoise(size, 8)).toEqual(noise)
  })

  it('rests near its nought and uses most of its range', () => {
    const mean = noise.reduce((sum, value) => sum + value, 0) / noise.length
    expect(Math.abs(mean - 127.5)).toBeLessThan(20)
    expect(Math.max(...noise) - Math.min(...noise)).toBeGreaterThan(150)
  })

  it('meets itself across its edges as it does between neighbours', () => {
    const step = (a: number, b: number) => Math.abs(noise[a]! - noise[b]!)
    let inside = 0
    let across = 0
    for (let k = 0; k < size; k++) {
      inside = Math.max(inside, step(k * size + 30, k * size + 31))
      across = Math.max(across, step(k * size + size - 1, k * size))
    }
    expect(across).toBeLessThanOrEqual(inside * 1.5)
  })
})
