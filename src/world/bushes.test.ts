// The game's bushes: scattered as the dead trees are, nearer the road, never on a trunk.
import { describe, expect, it } from 'vitest'
import { SphereGeometry, Vector3, type BufferGeometry } from 'three/webgpu'
import { bushes, defaultBushForm, defaultBushShape, isDead, lumped, OFF_GRAVE, offGraves, uneven } from './bushes'
import { deadBush } from './deadbush'
import { behindWalls, deadTrees, offWay } from './deadtrees'
import { laid, ROUTE } from './plain'
import { defaultRoadShape, roadLine } from './road'
import { defaultRoadWallLook, roadWallsOf } from './roadwalls'

const plain = laid(ROUTE)
const shape = defaultBushShape()
const road = roadLine(plain, defaultRoadShape()).points
const walls = roadWallsOf(plain, { points: road }, defaultRoadWallLook())
const trees = deadTrees(plain, road, 5, undefined, walls)
const laidBushes = bushes(plain, road, 4, trees, shape, walls)
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)

describe("the game's bushes", () => {
  it('stand in their band either side of the road, behind its walls where by one', () => {
    expect(laidBushes.length).toBeGreaterThan(40)
    for (const b of laidBushes) {
      expect(offWay(road, b)).toBeGreaterThanOrEqual(shape.clear)
      expect(offWay(road, b)).toBeLessThanOrEqual(shape.band)
      expect(behindWalls(road, walls, shape, b)).toBe(true)
    }
  })

  it("stand off every tree's trunk, as tall as the shape allows, each one of the four bushes", () => {
    for (const b of laidBushes) {
      for (const t of trees) expect(distance(b, t)).toBeGreaterThanOrEqual(1.2)
      expect(b.height).toBeGreaterThanOrEqual(shape.shortest)
      expect(b.height).toBeLessThanOrEqual(shape.tallest)
    }
    expect(new Set(laidBushes.map((b) => b.variant)).size).toBe(4)
  })

  it('stand on no grave, their footprint and a bush half wide round it', () => {
    const graves = laidBushes.filter((_, k) => k % 5 === 0).map((b, k) => ({ x: b.x + 0.3, z: b.z - 0.2, radius: 0.3 + (k % 3) * 0.2 }))
    const off = bushes(plain, road, 4, trees, shape, walls, [], offGraves(graves))
    expect(off.length).toBeGreaterThan(laidBushes.length * 0.7)
    for (const b of off) for (const g of graves) expect(distance(b, g)).toBeGreaterThanOrEqual(g.radius + OFF_GRAVE)
  })

  it('stand where trunks were once the trees are gone', () => {
    const alone = bushes(plain, road, 4, [], shape, walls)
    expect(alone.length).toBeGreaterThan(laidBushes.length)
  })
})

describe('a dead bush', () => {
  const bush = deadBush(11, 0.7)
  bush.computeBoundingBox()
  const { min, max } = bush.boundingBox!

  it('stands as tall as asked on its foot, about as wide as tall, none of it under the ground', () => {
    expect(max.y).toBeCloseTo(0.7)
    expect(min.y).toBeGreaterThan(-0.03)
    for (const wide of [max.x - min.x, max.z - min.z]) {
      expect(wide).toBeGreaterThan(0.7 * 0.7)
      expect(wide).toBeLessThan(0.7 * 1.6)
    }
    // Its foot at the origin: the wood nearest the ground within a hand of it.
    const position = bush.getAttribute('position')
    const low = Array.from({ length: position.count }, (_, i) => new Vector3().fromBufferAttribute(position, i)).filter((p) => p.y < 0.02)
    expect(low.length).toBeGreaterThan(0)
    for (const p of low) expect(Math.hypot(p.x, p.z)).toBeLessThan(0.1)
  })

  it('is a few hundred triangles of wood, every one of them real, lit by normals round it', () => {
    const triangles = bush.index!.count / 3
    expect(triangles).toBeGreaterThan(300)
    expect(triangles).toBeLessThan(1200)
    const position = bush.getAttribute('position')
    const normal = bush.getAttribute('normal')
    expect(normal.count).toBe(position.count)
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i))).toBe(true)
      expect(new Vector3().fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 4)
    }
    expect(Math.max(...Array.from(bush.index!.array))).toBe(position.count - 1)
  })

  it('is the same bush from the same seed, another from another', () => {
    const points = (geometry: BufferGeometry) => Array.from(geometry.getAttribute('position').array)
    expect(points(deadBush(11, 0.7))).toEqual(points(bush))
    expect(points(deadBush(23, 0.7))).not.toEqual(points(bush))
  })
})

describe('the dead among the bushes', () => {
  it('are none of them at 0, all at 1, about the share asked between, and stay dead as it grows', () => {
    expect(laidBushes.some((b) => isDead(b, 0))).toBe(false)
    expect(laidBushes.every((b) => isDead(b, 1))).toBe(true)
    const half = laidBushes.filter((b) => isDead(b, 0.5))
    expect(half.length).toBeGreaterThan(laidBushes.length * 0.35)
    expect(half.length).toBeLessThan(laidBushes.length * 0.65)
    for (const b of half) expect(isDead(b, 0.8)).toBe(true)
  })
})

describe("the bushes' form", () => {
  const round = new SphereGeometry(0.5, 16, 12)
  const reaches = (geometry: BufferGeometry) => {
    const position = geometry.getAttribute('position')
    return Array.from({ length: position.count }, (_, i) => new Vector3().fromBufferAttribute(position, i).length())
  }

  it('leaves a bush as its file has it with no lumps, and each one upright and as wide both ways', () => {
    const even = { ...defaultBushForm(), lumps: 0, squash: 0, lean: 0 }
    expect(lumped(round, even, 0)).toBe(round)
    expect(uneven(laidBushes[0]!, even)).toBe(laidBushes[0])
  })

  it('pushes its outline out here and draws it in there, by no more than the lumps asked for', () => {
    const lumpy = lumped(round, { ...defaultBushForm(), lumps: 0.4, lumpCount: 2 }, 0)
    const far = reaches(lumpy)
    expect(Math.max(...far)).toBeGreaterThan(0.52)
    expect(Math.min(...far)).toBeLessThan(0.48)
    for (const reach of far) expect(Math.abs(reach - 0.5)).toBeLessThanOrEqual(0.5 * 0.4 + 1e-6)
    expect(lumpy.boundingSphere!.radius).toBeGreaterThan(0.5)
    // Each kind its own lumps.
    expect(reaches(lumped(round, { ...defaultBushForm(), lumps: 0.4, lumpCount: 2 }, 1))).not.toEqual(far)
  })

  it('squashes each bush its own way, its footprint as wide, and leans it no further than asked', () => {
    const form = { ...defaultBushForm(), squash: 0.6, lean: 20 }
    const made = laidBushes.map((b) => uneven(b, form))
    made.forEach((b, k) => {
      expect(b.width * b.depth!).toBeCloseTo(laidBushes[k]!.width ** 2)
      expect(b.depth! / b.width).toBeGreaterThanOrEqual(1 - 0.6 - 1e-9)
      expect(b.depth! / b.width).toBeLessThanOrEqual(1)
      expect(b.lean!).toBeLessThanOrEqual((20 * Math.PI) / 180)
    })
    expect(new Set(made.map((b) => (b.depth! / b.width).toFixed(2))).size).toBeGreaterThan(10)
    expect(new Set(made.map((b) => b.leanTo!.toFixed(1))).size).toBeGreaterThan(10)
    // The same bush the same every time it is laid.
    expect(uneven(laidBushes[3]!, form)).toEqual(made[3])
  })
})
