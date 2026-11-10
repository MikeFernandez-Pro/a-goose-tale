// A dead bush, built here: a handful of bare stems fanning out of one foot,
// each kinked, forking twice into thinner twigs, no leaf on it. Chunky for its
// size, so its twigs still read from the game's camera, and few-sided, a bush a
// few hundred triangles. Drawn by the bushes (bushes.ts) in place of the leafy ones.
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'
import { random } from '../swarm/swarm'

/** How many stems leave the foot, and how far off upright the most upright and the most leaning one start, rad. */
const STEMS = 5
const LEAN = { least: 0.25, most: 1.05 }
/** A stem as grown, before the bush is sized: how long, and how thick at its foot, of that length. */
const STEM = { length: 1, thick: 0.045 }
/** A fork's twig of the wood it leaves: how long, how thick, and how far it turns off it, rad, at the least and the most. */
const FORK = { length: 0.6, thick: 0.7, least: 0.45, most: 0.95 }
/** How thin a piece of wood ends, of how thick it starts; how far each stretch of it kinks off the last; how much it is drawn back up. */
const TAPER = 0.6
const KINK = 0.3
const UP = 0.2
/** The pieces a stem, a branch off it and a twig off that are made of, and how many sides each has round it. */
const PIECES = [3, 2, 1]
const SIDES = [5, 4, 3]

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * A dead bush, `tall` m tall on its foot at the origin, grown from `seed`: the same bush from the same seed. Indexed,
 * with normals round each piece of wood, no uvs.
 */
export function deadBush(seed: number, tall: number): BufferGeometry {
  const draw = random(seed)
  const between = (least: number, most: number) => least + (most - least) * draw()
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const along = new Vector3()
  const side = new Vector3()
  const other = new Vector3()
  const out = new Vector3()

  /** A way off `from`, turned `angle` rad off it, any way round it. */
  const turned = (from: Vector3, angle: number): Vector3 => {
    side.set(draw() - 0.5, draw() - 0.5, draw() - 0.5).cross(from)
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0).cross(from)
    return from.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side.normalize(), Math.sin(angle)).normalize()
  }

  /** A tube through `points`, `thick[k]` round the k-th, `sides` round it; its end left open, too thin to see into. */
  const tube = (points: readonly Vector3[], thick: readonly number[], sides: number) => {
    const first = positions.length / 3
    points.forEach((point, k) => {
      along.subVectors(points[Math.min(k + 1, points.length - 1)]!, points[Math.max(k - 1, 0)]!).normalize()
      // One side carried ring to ring, so the tube never twists on itself.
      if (k === 0) side.set(Math.abs(along.x) > 0.9 ? 0 : 1, 0, Math.abs(along.x) > 0.9 ? 1 : 0)
      side.addScaledVector(along, -side.dot(along)).normalize()
      other.crossVectors(along, side)
      for (let s = 0; s < sides; s++) {
        const round = (s / sides) * Math.PI * 2
        out.copy(side).multiplyScalar(Math.cos(round)).addScaledVector(other, Math.sin(round))
        positions.push(point.x + out.x * thick[k]!, point.y + out.y * thick[k]!, point.z + out.z * thick[k]!)
        normals.push(out.x, out.y, out.z)
      }
    })
    for (let k = 0; k + 1 < points.length; k++) {
      for (let s = 0; s < sides; s++) {
        const a = first + k * sides + s
        const b = first + k * sides + ((s + 1) % sides)
        indices.push(a, b, a + sides, b, b + sides, a + sides)
      }
    }
  }

  /** A piece of wood from `start`, heading `way`, `length` long and `thick` at its start; and the twigs forking off it. */
  const grow = (start: Vector3, way: Vector3, length: number, thick: number, level: number) => {
    const pieces = PIECES[level]!
    const points = [start]
    const widths = [thick]
    const heading = way.clone()
    for (let k = 1; k <= pieces; k++) {
      // Kinked off the last stretch, drawn back up a little, never down into the ground.
      if (k > 1) heading.copy(turned(heading, between(0, KINK)))
      heading.y = Math.max(heading.y + UP * (k > 1 ? 1 : 0), 0.15)
      heading.normalize()
      points.push(points[k - 1]!.clone().addScaledVector(heading, length / pieces))
      widths.push(thick * (1 + (TAPER - 1) * (k / pieces)))
      if (level + 1 === PIECES.length) continue
      // A twig off each joint, and a fork of two at its end.
      for (let fork = k === pieces ? 2 : 1; fork > 0; fork--) {
        grow(points[k]!, turned(heading, between(FORK.least, FORK.most)), length * FORK.length * between(0.8, 1.1), widths[k]! * FORK.thick, level + 1)
      }
    }
    tube(points, widths, SIDES[level]!)
  }

  // The stems round the foot, the first the most upright, each a little further over and round.
  const turn = draw() * Math.PI * 2
  for (let stem = 0; stem < STEMS; stem++) {
    const lean = LEAN.least + (LEAN.most - LEAN.least) * (stem / (STEMS - 1)) * between(0.8, 1.1)
    const round = turn + stem * GOLDEN_ANGLE
    const way = new Vector3(Math.sin(lean) * Math.cos(round), Math.cos(lean), Math.sin(lean) * Math.sin(round))
    grow(new Vector3(way.x * 0.03, 0, way.z * 0.03), way, STEM.length * between(0.75, 1.05), STEM.thick, 0)
  }

  const bush = new BufferGeometry()
  bush.setAttribute('position', new Float32BufferAttribute(positions, 3))
  bush.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  bush.setIndex(indices)
  bush.computeBoundingBox()
  const size = tall / bush.boundingBox!.max.y
  bush.scale(size, size, size)
  return bush
}
