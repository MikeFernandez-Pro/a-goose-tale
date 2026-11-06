import { describe, expect, it } from 'vitest'
import { roadCanShow, sampleTiled, splitTriangles, tiledNoise } from './groundzones'
import { ROAD_REACH, type RoadField } from './road'

const TWO_TRIANGLES = [0, 0, 0, 1, 0, 0, 0, 0, 1, 10, 0, 10, 11, 0, 10, 10, 0, 11]

describe('splitTriangles', () => {
  it('puts the triangles in order of their zone, and counts each zone', () => {
    const { index, counts } = splitTriangles(TWO_TRIANGLES, undefined, (x) => (x < 5 ? 1 : 0), 2)
    expect(counts).toEqual([3, 3])
    expect([...index]).toEqual([3, 4, 5, 0, 1, 2])
  })

  it('counts a zone with no triangles in it as none', () => {
    const { index, counts } = splitTriangles(TWO_TRIANGLES, undefined, (x) => (x < 5 ? 2 : 0), 3)
    expect(counts).toEqual([3, 0, 3])
    expect([...index]).toEqual([3, 4, 5, 0, 1, 2])
  })

  it('reads an index where there is one', () => {
    const { index, counts } = splitTriangles(TWO_TRIANGLES, [3, 4, 5, 0, 1, 2], (x) => (x > 5 ? 1 : 0), 2)
    expect(counts).toEqual([3, 3])
    expect([...index]).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('hands over the lowest corner, for ground that dips below the floor', () => {
    const lows: number[] = []
    splitTriangles([0, 2, 0, 1, -1, 0, 0, 3, 1], undefined, (_x, lowest) => {
      lows.push(lowest)
      return 0
    }, 1)
    expect(lows).toEqual([-1])
  })

  it('hands over how far the corners lie from the middle', () => {
    const radii: number[] = []
    splitTriangles(TWO_TRIANGLES.slice(0, 9), undefined, (_x, _lowest, _z, radius) => {
      radii.push(radius)
      return 0
    }, 1)
    expect(radii[0]).toBeCloseTo(Math.hypot(2 / 3, 1 / 3))
  })
})

/** A field of 1 m cells, 20 by 10 from the origin, its road's middle along z = 5: each cell how far across it, capped as the road's field is. */
function roadAlongFive(): RoadField {
  const columns = 20
  const rows = 10
  const data = new Float32Array(columns * rows * 4)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) data[(row * columns + column) * 4] = Math.min(row - 5, ROAD_REACH)
  }
  return { minX: 0, minZ: 0, cell: 1, columns, rows, data }
}

describe('roadCanShow', () => {
  it('sees the road where a cell the triangle reads lies nearer its middle than the reach', () => {
    const shows = roadCanShow(roadAlongFive(), 1.5)
    expect(shows(10, 5, 0.5)).toBe(true)
    expect(shows(10, 6.2, 0.5)).toBe(true)
  })

  it('sees none where every cell the triangle reads lies past the reach', () => {
    const shows = roadCanShow(roadAlongFive(), 1.5)
    expect(shows(10, 9, 0.5)).toBe(false)
    expect(shows(10, 1, 0.5)).toBe(false)
  })

  it('reads the cells as far round as the triangle reaches, and one more for the mixing between cells', () => {
    const shows = roadCanShow(roadAlongFive(), 1.5)
    // Its pixels at z 7.5 lie between rows 7 and 8, 2 and 3 off the road.
    expect(shows(10, 8, 0.5)).toBe(false)
    expect(shows(10, 8, 1.6)).toBe(true)
  })

  it('reads the field\'s edge cells past its edge, as the floor\'s shader does', () => {
    const shows = roadCanShow(roadAlongFive(), 1.5)
    expect(shows(-30, 5, 0.5)).toBe(true)
    expect(shows(40, 30, 0.5)).toBe(false)
  })

  it('sees the road nowhere with no field laid', () => {
    expect(roadCanShow(undefined, 1.5)(10, 5, 0.5)).toBe(false)
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

describe('sampleTiled', () => {
  // A 2 by 2 square: 0 and 255 on its first row, 51 and 102 on its second.
  const square = Uint8Array.from([0, 255, 51, 102])

  it('reads a texel whole at its centre, a share of the full byte', () => {
    expect(sampleTiled(square, 2, 0.25, 0.25)).toBeCloseTo(0)
    expect(sampleTiled(square, 2, 0.75, 0.25)).toBeCloseTo(1)
    expect(sampleTiled(square, 2, 0.25, 0.75)).toBeCloseTo(0.2)
  })

  it('mixes the four texels round a point between their centres, as a linear filter does', () => {
    expect(sampleTiled(square, 2, 0.5, 0.25)).toBeCloseTo(0.5)
    expect(sampleTiled(square, 2, 0.5, 0.5)).toBeCloseTo((0 + 255 + 51 + 102) / 4 / 255)
  })

  it('wraps past its edges, as a repeating texture does', () => {
    expect(sampleTiled(square, 2, 1.25, -0.75)).toBeCloseTo(sampleTiled(square, 2, 0.25, 0.25))
    expect(sampleTiled(square, 2, 0, 0.25)).toBeCloseTo(0.5)
  })
})
