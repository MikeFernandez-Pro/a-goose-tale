// Ghost geese (`?ghosts`, `&ghostcount=`), a sheet over a goose that is not there, since 2026-10-27:
// characters in the world that haunt and guide him, no light of their own, several of them. In the game
// they walk the graveyard's paths (graveyard.ts); with `?ghosts` alone each goes slowly round a small
// circle in front of him, walking or idle.
//
// Each ghost is a sphere and a sheet (2026-10-28, a more natural ghost): the verlet cloth of three's
// webgpu_compute_cloth example, springs and points in storage buffers stepped by two compute passes at
// 360 steps a second. The sheet is worn, as a costume's cloth is in games: dropped straight down from
// over it onto its sphere (swollen by the cloth's thickness), every point that lands on it rides it, and
// only the rest, hanging free from its middle, is simulated. WebGPU only.
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  Object3D,
  PointLight,
  Vector3,
  type ComputeNode,
  type Node,
  type WebGPURenderer,
} from 'three/webgpu'
import {
  atan,
  attribute,
  modelPosition,
  positionLocal,
  faceDirection,
  float,
  Fn,
  frontFacing,
  If,
  instancedArray,
  instanceIndex,
  length,
  Loop,
  mix,
  Return,
  select,
  sin,
  smoothstep,
  time,
  transformNormalToView,
  triNoise3D,
  uint,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import bakedPoints from './ghostsheet.json'
import type { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'
import type { FixedLight } from '../swarm/swarm'
import { FakeLamp, type FakeLamps } from '../light/fakelamps'

/** The sheet's radius, m, laid flat round its middle, and the radius of the sphere it is laid over, m. */
const RADIUS = 0.8
const BALL = 0.2
/** Points a side of a sheet; its grid is SIDE x SIDE, laid out as a disc. */
const SIDE = 41
/** Cloth steps a second, the example's; and the longest frame stepped, s, so a stall does not throw the sheet. */
const STEPS = 360
const STEP = 1 / STEPS
const LONGEST = 1 / 30
/** Seconds of cloth stepped before the first frame, so it starts hanging, not falling. */
const SETTLE = 3
/** How far a ghost moves between two updates, m, past which it jumped, woken after sleeping, and did not walk there: its whole sheet goes with it. */
const JUMP = 0.5
/** Where the ghosts stand, m off his start: in front of him (-z), in the fixed camera's view, clear of the fire pit on his right. */
const SPOTS: readonly [number, number][] = [
  [-1.5, -1.5],
  [0.9, -2.9],
  [-0.9, -4.3],
  [2.7, -3.8],
  [-3, -3.4],
  [1.6, -4.8],
  [-1.2, -5],
  [3.8, -5.2],
]

/** What the ghosts' folder edits live. */
export interface GhostLook {
  /** Cloth: spring pull per step, the bending springs' share of it, the speed kept per step, gravity's share, wind. */
  stiffness: number
  bend: number
  damping: number
  gravity: number
  wind: number
  /** Its sphere: its radius as a share of BALL, the cloth's thickness off it, m, and how high its middle stands over its feet, m. */
  bodies: number
  thickness: number
  ballHeight: number
  /** How high it floats, m, its bob, m and per second, and its turn, radians, 0 facing the camera. */
  hover: number
  bob: number
  bobRate: number
  turn: number
  /** Each going slowly round a circle about its spot: whether they do, its radius, m, and their pace, m/s. */
  circling: boolean
  circle: number
  speed: number
  /** Walking a walk: how fast, m/s, every ghost alike, so they still meet as they were laid to. */
  walkSpeed: number
  /** The sheet: colour, its own glow in the dark, the inside's shade, opacity. */
  colour: number
  glow: number
  inside: number
  opacity: number
  /** The eyes: forward of the sheet's middle and apart, m, their radius, m, and how dark, 0 the sheet's own to 1 black, their glow gone with it. */
  eyesAhead: number
  eyesApart: number
  eyeSize: number
  eyeDark: number
  /** Its own light, which holds rats off as a brazier's does: whether it shines, how far it holds them, m, its lamp's colour,
   * strength and height over its feet, m. */
  lit: boolean
  reach: number
  lamp: number
  lampStrength: number
  lampHeight: number
  /** Debug: the spheres drawn, the worn points shown red. */
  showBodies: boolean
  showWorn: boolean
}

// Set from the panel on 2026-10-27: a soft, see-through pale blue sheet, glowing; then again, brighter, with a
// wider, stronger light and a faint bob.
// Then on 2026-10-27 again: a stiff sheet blowing hard, paler and bluer, its eyes bigger, its feet slower; and once
// more, a little softer, heavier and swinging longer, its inside lighter; then soft and swinging on almost freely;
// then, on 2026-10-30, its swing settling sooner; then, on 2026-11-01, its lamp stronger.
const defaultLook = (): GhostLook => ({
  stiffness: 0.2,
  bend: 0.8,
  damping: 0.97,
  gravity: 1.57,
  wind: 1.2,
  bodies: 1,
  thickness: 0.04,
  ballHeight: 0.66,
  hover: 0.12,
  bob: 0.025,
  bobRate: 0.45,
  turn: 0.6,
  circling: true,
  circle: 0.9,
  speed: 0.4,
  walkSpeed: 1,
  colour: 0x94a9ff,
  glow: 1.12,
  inside: 0.72,
  opacity: 0.2,
  eyesAhead: 0.14,
  eyesApart: 0.084,
  eyeSize: 0.035,
  eyeDark: 1,
  lit: true,
  reach: 1.75,
  lamp: 0x94d4ff,
  lampStrength: 30,
  lampHeight: 0.5,
  showBodies: false,
  showWorn: false,
})

interface Ghost {
  rig: Group
  /** Its sphere, in its rig. */
  ball: Object3D
  lamp: PointLight | FakeLamp
  x: number
  z: number
  /** Its circle's middle, where it stands on its spot; how far round it, radians, and which way, 1 or -1. */
  cx: number
  cz: number
  round: number
  way: number
  yaw: number
  phase: number
}

/** Where each ghost walks, if not round a circle of its own: how many, their light's reach, m, and where ghost `g` is at `t` s of the play. */
export interface Walk {
  count: number
  reach: number
  /** How fast they were laid to walk, m/s: `at` is where they are at that pace. */
  speed: number
  at(g: number, t: number): { x: number; z: number }
}

export interface Ghosts {
  readonly object: Group
  readonly look: GhostLook
  readonly count: number
  /** Whether they walk a walk, not circles of their own. */
  readonly walking: boolean
  /** Each ghost's light as the swarm reads it, moved with it every frame: the rats keep out of it. */
  readonly lights: FixedLight[]
  /** Lays the sheets again on their spheres as they are set now. */
  wear(): void
  /** `t`, the play's time, s, for a walk's ghosts. */
  update(dt: number, t?: number): void
}

/** The concentric map of the square [-1, 1]^2 onto the unit disc (Shirley and Chiu): the grid laid as a round sheet. */
function disc(a: number, b: number): [number, number] {
  if (a === 0 && b === 0) return [0, 0]
  let r: number
  let phi: number
  if (Math.abs(a) > Math.abs(b)) {
    r = a
    phi = (Math.PI / 4) * (b / a)
  } else {
    r = b
    phi = Math.PI / 2 - (Math.PI / 4) * (a / b)
  }
  return [r * Math.cos(phi), r * Math.sin(phi)]
}

/** The sheet's paint as the look has it, set again from the look each frame where the panel may change it. */
function sheetPaint(look: GhostLook) {
  const paint = {
    colour: uniform(new Color(look.colour)),
    glow: uniform(look.glow),
    inside: uniform(look.inside),
    opacity: uniform(look.opacity),
    eyesAhead: uniform(look.eyesAhead),
    eyesApart: uniform(look.eyesApart),
    eyeSize: uniform(look.eyeSize),
    eyeDark: uniform(look.eyeDark),
    set(from: GhostLook) {
      paint.colour.value.set(from.colour)
      paint.glow.value = from.glow
      paint.inside.value = from.inside
      paint.opacity.value = from.opacity
      paint.eyesAhead.value = from.eyesAhead
      paint.eyesApart.value = from.eyesApart
      paint.eyeSize.value = from.eyeSize
      paint.eyeDark.value = from.eyeDark
    },
  }
  return paint
}

/**
 * `sheet` painted, the cloth's and the phones' baked one's alike: `cloth` its colour, its inside darker, glowing; its
 * eyes dark on its front, by `restAt`, its point's place on the sheet laid flat. Its opacity, the eyes solid, returned.
 */
function paintSheet(sheet: MeshLambertNodeMaterial, paint: ReturnType<typeof sheetPaint>, restAt: Node<'vec2'>, cloth = paint.colour as unknown as Node<'vec3'>): Node<'float'> {
  const eye = (side: number) => length(restAt.sub(vec2(paint.eyesApart.mul(side), paint.eyesAhead)))
  const eyes = smoothstep(paint.eyeSize, paint.eyeSize.mul(0.8), eye(1).min(eye(-1))).mul(paint.eyeDark)
  const shade = select(frontFacing, float(1), paint.inside)
  sheet.colorNode = vec4(mix(cloth.mul(shade), vec3(0.02, 0.02, 0.03), eyes), 1)
  // Every node material takes an emissive node; the types give it to the standard one alone.
  ;(sheet as unknown as { emissiveNode: Node }).emissiveNode = cloth.mul(paint.glow).mul(shade).mul(eyes.oneMinus())
  // The eyes as solid as they are dark, the light behind the sheet not showing through them.
  return mix(paint.opacity, float(1), eyes)
}

export function createGhosts(
  renderer: WebGPURenderer,
  him: { x: number; z: number },
  groundAt: (x: number, z: number) => number,
  count: number,
  walk?: Walk,
  /** Where given, each ghost's lamp a fake lamp of these (fakelamps.ts), not a point light. */
  lamps?: FakeLamps,
): Ghosts {
  const look = defaultLook()
  if (new URLSearchParams(location.search).has('ghostdebug')) look.showBodies = look.showWorn = true
  count = walk ? walk.count : Math.max(1, Math.min(SPOTS.length, count))
  if (walk) {
    look.reach = walk.reach
    look.walkSpeed = walk.speed
  }
  const object = new Group()

  // The ghosts, each its own rig, still, where SPOTS has them.
  const ghosts: Ghost[] = []
  for (let g = 0; g < count; g++) {
    const ball = new Object3D()
    ball.position.y = look.ballHeight
    const rig = new Group().add(ball)
    // Its lamp, as a brazier's (lights.ts): no falling off inside its reach, cut at it; no shadow, so no new pipelines for one.
    const lamp = lamps ? lamps.track(new FakeLamp(look.lamp, look.lampStrength, look.reach)) : new PointLight(look.lamp, look.lampStrength, look.reach, 0)
    rig.add(lamp)
    object.add(rig)
    const [dx, dz] = SPOTS[g % SPOTS.length]!
    ghosts.push({
      rig,
      ball,
      lamp,
      x: him.x + dx,
      z: him.z + dz,
      cx: him.x + dx,
      cz: him.z + dz,
      round: g * 2.39996,
      way: g % 2 ? -1 : 1,
      yaw: 0,
      phase: g * 2.39996,
    })
  }
  let clock = 0
  /** How far along their walk they are, in s at the pace it was laid at: the play's time, sped or slowed by the
   * folder's speed, so a change of speed moves none of them on with a jump; and the play's time last seen. */
  let now = 0
  let seen = 0
  /**
   * Where its walk has it, facing the way it goes, easing round; else round its circle by `dt`, facing the way it goes;
   * or still on its spot, turned as the panel has it.
   */
  const go = (ghost: Ghost, dt: number, g: number) => {
    if (walk) {
      const here = walk.at(g, now)
      const next = walk.at(g, now + 0.15)
      ghost.x = here.x
      ghost.z = here.z
      const want = Math.atan2(next.x - here.x, next.z - here.z)
      const d = Math.atan2(Math.sin(want - ghost.yaw), Math.cos(want - ghost.yaw))
      ghost.yaw += dt > 0 ? d * (1 - Math.exp(-dt / 0.25)) : d
      return
    }
    if (!look.circling) {
      ghost.x = ghost.cx
      ghost.z = ghost.cz
      ghost.yaw = look.turn + ghost.phase * 0.15
      return
    }
    ghost.round += (ghost.way * look.speed * dt) / Math.max(look.circle, 0.1)
    ghost.x = ghost.cx + Math.cos(ghost.round) * look.circle
    ghost.z = ghost.cz + Math.sin(ghost.round) * look.circle
    // Along the circle: d/dt of (cos, sin) is (-sin, cos), its way round.
    ghost.yaw = Math.atan2(-Math.sin(ghost.round) * ghost.way, Math.cos(ghost.round) * ghost.way)
  }
  const placeRig = (ghost: Ghost) => {
    const y = groundAt(ghost.x, ghost.z) + look.hover + look.bob * Math.sin(clock * look.bobRate * Math.PI * 2 + ghost.phase)
    ghost.rig.position.set(ghost.x, y, ghost.z)
    ghost.rig.rotation.set(0, ghost.yaw, 0)
    ghost.ball.position.y = look.ballHeight
    ghost.rig.updateMatrixWorld(true)
  }
  ghosts.forEach((ghost, g) => {
    go(ghost, 0, g)
    placeRig(ghost)
  })

  // The sheet's grid, laid flat as a disc in the ghost's own frame (x across, z forward), round its sphere's middle.
  const V = SIDE * SIDE
  const N = count * V
  const at = (i: number, j: number) => j * SIDE + i
  const restXZ = new Float32Array(V * 2)
  for (let j = 0; j < SIDE; j++)
    for (let i = 0; i < SIDE; i++) {
      const [x, z] = disc((i / (SIDE - 1)) * 2 - 1, (j / (SIDE - 1)) * 2 - 1)
      restXZ.set([x * RADIUS, z * RADIUS], at(i, j) * 2)
    }

  // The springs: along, across, the diagonals, and the bending ones two points apart; rest lengths as laid flat.
  const springs: number[] = []
  const bends: number[] = []
  const link = (a: number, b: number, bend: boolean) => {
    springs.push(a, b)
    bends.push(bend ? 1 : 0)
  }
  for (let j = 0; j < SIDE; j++)
    for (let i = 0; i < SIDE; i++) {
      if (i + 1 < SIDE) link(at(i, j), at(i + 1, j), false)
      if (j + 1 < SIDE) link(at(i, j), at(i, j + 1), false)
      if (i + 1 < SIDE && j + 1 < SIDE) link(at(i, j), at(i + 1, j + 1), false)
      if (i + 1 < SIDE && j > 0) link(at(i, j), at(i + 1, j - 1), false)
      if (i + 2 < SIDE) link(at(i, j), at(i + 2, j), true)
      if (j + 2 < SIDE) link(at(i, j), at(i, j + 2), true)
    }
  const S1 = bends.length
  const S = S1 * count
  const springIds = new Uint32Array(S * 2)
  const springRest = new Float32Array(S * 2)
  const touching: number[][] = Array.from({ length: N }, () => [])
  for (let g = 0; g < count; g++)
    for (let s = 0; s < S1; s++) {
      const ra = springs[s * 2]!
      const rb = springs[s * 2 + 1]!
      const a = g * V + ra
      const b = g * V + rb
      const id = g * S1 + s
      springIds.set([a, b], id * 2)
      springRest.set([Math.hypot(restXZ[ra * 2]! - restXZ[rb * 2]!, restXZ[ra * 2 + 1]! - restXZ[rb * 2 + 1]!), bends[s]!], id * 2)
      touching[a]!.push(id)
      touching[b]!.push(id)
    }
  // Each point: worn (1) or free (0), its springs' count and where they start in the list, its ghost.
  const params = new Uint32Array(N * 4)
  const list: number[] = []
  for (let n = 0; n < N; n++) {
    params.set([0, touching[n]!.length, list.length, Math.floor(n / V)], n * 4)
    list.push(...touching[n]!)
  }

  const positions = new Float32Array(N * 3)
  const position = instancedArray(positions, 'vec3')
  const velocity = instancedArray(N, 'vec3')
  const vertexParams = instancedArray(params, 'uvec4')
  const springList = instancedArray(new Uint32Array(list), 'uint')
  const springVertex = instancedArray(springIds, 'uvec2')
  const springLength = instancedArray(springRest, 'vec2')
  const springForce = instancedArray(S, 'vec3')
  // Laid from the rigs every frame, one buffer (a pass may bind 8): each ghost's sphere (x, y, z, radius swollen by
  // the cloth's thickness), then every point's worn place (read only for the worn), then each ghost's ground; then
  // how far each ghost just jumped.
  const WORN = count
  const FLOORS = WORN + N
  const SHIFTS = FLOORS + count
  const laidArray = new Float32Array((SHIFTS + count) * 4)
  const laid = instancedArray(laidArray, 'vec4')

  // Where each worn point rides: its place in its sphere's space.
  const wornLocal = new Float32Array(N * 3)
  const point = new Vector3()
  const invert = new Matrix4()

  /**
   * Lays each ghost's sheet on its sphere as it stands: every point dropped straight down from over it; one that
   * lands on the sphere (swollen by the thickness) is worn, riding it; one that misses hangs free, started a slope
   * down from where it would lie flat, so the settle has little to undo.
   */
  const wear = () => {
    ghosts.forEach((ghost, g) => {
      ghost.rig.updateMatrixWorld(true)
      const top = ghost.ball.getWorldPosition(new Vector3())
      const reach = BALL * look.bodies + look.thickness
      invert.copy(ghost.ball.matrixWorld).invert()
      const yaw = ghost.rig.rotation.y
      const cos = Math.cos(yaw)
      const sin = Math.sin(yaw)
      const ground = groundAt(ghost.x, ghost.z)
      const landed: number[] = []
      for (let v = 0; v < V; v++) {
        const n = g * V + v
        const lx = restXZ[v * 2]!
        const lz = restXZ[v * 2 + 1]!
        // The ghost's frame turned by its yaw: x across, z forward.
        const wx = top.x + lx * cos + lz * sin
        const wz = top.z - lx * sin + lz * cos
        point.set(wx, top.y + 0.6, wz)
        let hit = false
        for (let s = 0; s < 96 && point.y > ground; s++) {
          const d = point.distanceTo(top) - reach
          if (d < 1e-4) {
            hit = true
            break
          }
          point.y -= Math.max(d, 0.003)
        }
        if (hit) {
          const local = point.clone().applyMatrix4(invert)
          wornLocal.set([local.x, local.y, local.z], n * 3)
          positions.set([point.x, point.y, point.z], n * 3)
          params[n * 4] = 1
          landed.push(v)
        } else {
          params[n * 4] = 0
          positions.set([wx, Number.NaN, wz], n * 3)
        }
      }
      // A free point starts below the nearest worn one by its distance from it, laid flat: hanging as it would.
      for (let v = 0; v < V; v++) {
        const n = g * V + v
        if (params[n * 4]) continue
        let near = Infinity
        let y = top.y
        for (const w of landed) {
          const d = Math.hypot(restXZ[v * 2]! - restXZ[w * 2]!, restXZ[v * 2 + 1]! - restXZ[w * 2 + 1]!)
          if (d < near) {
            near = d
            y = positions[(g * V + w) * 3 + 1]!
          }
        }
        positions[n * 3 + 1] = Math.max(ground + 0.02, y - near)
      }
    })
    position.value.needsUpdate = true
    vertexParams.value.needsUpdate = true
    velocity.value.array.fill(0)
    velocity.value.needsUpdate = true
  }

  const stiffness = uniform(look.stiffness)
  const bend = uniform(look.bend)
  const damping = uniform(look.damping)
  const gravity = uniform(9.8 * STEP * STEP)
  const wind = uniform(look.wind)

  const springPass = Fn(() => {
    If(instanceIndex.greaterThanEqual(uint(S)), () => { Return() })
    const ids = springVertex.element(instanceIndex)
    const rest = springLength.element(instanceIndex)
    const delta = position.element(ids.y).sub(position.element(ids.x)).toVar()
    const dist = delta.length().max(1e-6)
    const k = select(rest.y.greaterThan(0.5), stiffness.mul(bend), stiffness)
    springForce.element(instanceIndex).assign(delta.mul(dist.sub(rest.x).mul(k).mul(0.5).div(dist)))
  })().compute(S) as ComputeNode

  const pointPass = Fn(() => {
    If(instanceIndex.greaterThanEqual(uint(N)), () => { Return() })
    const p = vertexParams.element(instanceIndex)
    const here = position.element(instanceIndex)
    If(p.x.greaterThan(uint(0)), () => {
      here.assign(laid.element(instanceIndex.add(uint(WORN))).xyz)
      Return()
    })
    const v = velocity.element(instanceIndex).mul(damping).toVar()
    Loop(p.y, ({ i }) => {
      const id = springList.element(p.z.add(uint(i)))
      const f = springForce.element(id)
      v.addAssign(select(springVertex.element(id).x.equal(instanceIndex), f, f.negate()))
    })
    v.y.subAssign(gravity)
    const gust = triNoise3D(here.mul(0.8), float(0.6), time).sub(0.25).mul(wind).mul(4e-5)
    v.addAssign(vec3(gust, gust.mul(0.3), gust.mul(0.6)))
    // Out of its sphere, swollen by the cloth's thickness; held where it touches, as cloth on a body is.
    const c = laid.element(p.w)
    const off = here.add(v).sub(c.xyz).toVar()
    const dist = off.length().max(1e-6)
    const pen = c.w.sub(dist).max(0)
    v.mulAssign(select(pen.greaterThan(0), float(0.7), float(1)))
    v.addAssign(off.mul(pen.div(dist)))
    const floor = laid.element(p.w.add(uint(FLOORS))).x
    If(here.y.add(v.y).lessThan(floor), () => {
      v.y.assign(floor.sub(here.y))
      v.x.mulAssign(0.6)
      v.z.mulAssign(0.6)
    })
    velocity.element(instanceIndex).assign(v)
    here.addAssign(v)
  })().compute(N) as ComputeNode

  // Every point carried by its ghost's jump, so its sheet lands in the shape it left, not whipped through its body after it.
  const shiftPass = Fn(() => {
    If(instanceIndex.greaterThanEqual(uint(N)), () => { Return() })
    const here = position.element(instanceIndex)
    here.addAssign(laid.element(vertexParams.element(instanceIndex).w.add(uint(SHIFTS))).xyz)
  })().compute(N) as ComputeNode

  // The drawn sheets, a vertex on every cloth point, in the cloth's own order. Each knows its point and the points
  // either side of it, across (its column's) and along (its row's); on the sheet's edge it stands in for the one past it.
  const clothIds = new Float32Array(N)
  const sides = new Float32Array(N * 4)
  const rest = new Float32Array(N * 2)
  const index: number[] = []
  for (let g = 0; g < count; g++) {
    rest.set(restXZ, g * V * 2)
    for (let j = 0; j < SIDE; j++)
      for (let i = 0; i < SIDE; i++) {
        const n = g * V + at(i, j)
        clothIds[n] = n
        const [i0, i1, j0, j1] = [Math.max(i - 1, 0), Math.min(i + 1, SIDE - 1), Math.max(j - 1, 0), Math.min(j + 1, SIDE - 1)]
        sides.set([g * V + at(i0, j), g * V + at(i1, j), g * V + at(i, j0), g * V + at(i, j1)], n * 4)
        if (i + 1 < SIDE && j + 1 < SIDE) index.push(n, n + SIDE, n + 1, n + 1, n + SIDE, n + SIDE + 1)
      }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(N * 3), 3))
  geometry.setAttribute('cloth', new Float32BufferAttribute(clothIds, 1))
  geometry.setAttribute('sides', new Float32BufferAttribute(sides, 4))
  geometry.setAttribute('rest', new Float32BufferAttribute(rest, 2))
  geometry.setIndex(index)

  const paint = sheetPaint(look)
  const showWorn = uniform(0)
  const sheet = new MeshLambertNodeMaterial({ side: DoubleSide, transparent: true })
  const drawn = uint(attribute('cloth', 'float'))
  const side = attribute('sides', 'vec4')
  sheet.positionNode = position.element(drawn)
  // Across the sheet and along it, from the neighbours either side: the normal as the cloth's own points give it.
  const across = position.element(uint(side.y)).sub(position.element(uint(side.x)))
  const along = position.element(uint(side.w)).sub(position.element(uint(side.z)))
  sheet.normalNode = transformNormalToView(along.cross(across).normalize()).toVarying().mul(faceDirection)
  const worn = vertexParams.element(drawn).x.toFloat().toVarying()
  const restAt = attribute('rest', 'vec2')
  sheet.opacityNode = paintSheet(sheet, paint, restAt, mix(paint.colour, vec3(1, 0.2, 0.1), worn.mul(showWorn)))
  sheet.alphaTest = 0.05
  const sheets = new Mesh(geometry, sheet)
  sheets.frustumCulled = false
  object.add(sheets)

  // The spheres, to see what the sheet lies on.
  const balls = new InstancedMesh(new IcosahedronGeometry(1, 2), new MeshBasicNodeMaterial({ color: 0xff5533, wireframe: true }), count)
  balls.frustumCulled = false
  object.add(balls)
  const ballMatrix = new Matrix4()

  const lay = () => {
    ghosts.forEach((ghost, g) => {
      ghost.ball.getWorldPosition(point)
      const r = BALL * look.bodies
      laidArray.set([point.x, point.y, point.z, r + look.thickness], g * 4)
      balls.setMatrixAt(g, ballMatrix.makeScale(r, r, r).setPosition(point))
      for (let v = 0; v < V; v++) {
        const n = g * V + v
        if (!params[n * 4]) continue
        point.fromArray(wornLocal, n * 3).applyMatrix4(ghost.ball.matrixWorld)
        laidArray.set([point.x, point.y, point.z, 0], (WORN + n) * 4)
      }
      laidArray[(FLOORS + g) * 4] = groundAt(ghost.x, ghost.z) + 0.02
    })
    laid.value.needsUpdate = true
    balls.instanceMatrix.needsUpdate = true
  }
  const step = () => {
    renderer.compute(springPass)
    renderer.compute(pointPass)
  }
  /** Lays the sheets on it as it stands and lets the free cloth fall still. */
  const dress = () => {
    wear()
    lay()
    // Moving nothing, so its pipeline is not first built when they wake.
    renderer.compute(shiftPass)
    for (let s = 0; s < SETTLE * STEPS; s++) step()
  }
  dress()

  const lights: FixedLight[] = ghosts.map((ghost) => ({ x: ghost.x, z: ghost.z, reach: look.reach, on: look.lit }))
  let owed = 0
  const update = (dt: number, t?: number) => {
    clock += dt
    const passed = t === undefined ? dt : Math.max(0, t - seen)
    if (t !== undefined) seen = t
    now += passed * (walk ? look.walkSpeed / Math.max(walk.speed, 1e-6) : 1)
    stiffness.value = look.stiffness
    bend.value = look.bend
    damping.value = look.damping
    gravity.value = 9.8 * look.gravity * STEP * STEP
    wind.value = look.wind
    paint.set(look)
    showWorn.value = look.showWorn ? 1 : 0
    balls.visible = look.showBodies
    let jumped = false
    ghosts.forEach((ghost, g) => {
      const { x, y, z } = ghost.rig.position
      go(ghost, dt, g)
      placeRig(ghost)
      const { x: toX, y: toY, z: toZ } = ghost.rig.position
      if (Math.hypot(toX - x, toZ - z) <= JUMP) return
      laidArray.set([toX - x, toY - y, toZ - z], (SHIFTS + g) * 4)
      jumped = true
    })
    ghosts.forEach((ghost, g) => {
      const light = lights[g]!
      light.x = ghost.x
      light.z = ghost.z
      light.reach = look.reach
      light.on = look.lit
      ghost.lamp.visible = light.on
      ghost.lamp.color.set(look.lamp)
      ghost.lamp.intensity = look.lampStrength
      ghost.lamp.distance = look.reach
      ghost.lamp.position.y = look.lampHeight
    })
    lay()
    if (jumped) {
      renderer.compute(shiftPass)
      laidArray.fill(0, SHIFTS * 4)
    }
    owed = Math.min(owed + dt, LONGEST)
    while (owed >= STEP) {
      step()
      owed -= STEP
    }
  }

  // `?ghostbake`: each ghost's sheet as it hangs now, in its own frame (x across, y up from under its feet, z ahead), its
  // cloth's points in the grid's order, for tools/generators/ghost_sheet.mjs to bake the phones' (createPlainGhosts).
  if (new URLSearchParams(location.search).has('ghostbake'))
    Object.assign(globalThis, {
      ghostSheets: async () => {
        const all = new Float32Array(await renderer.getArrayBufferAsync(position.value))
        // A storage buffer's vec3 may come back padded to four floats.
        const stride = all.length / N
        return ghosts.map((ghost, g) => {
          invert.copy(ghost.rig.matrixWorld).invert()
          const own: number[] = []
          for (let v = 0; v < V; v++) own.push(...point.fromArray(all, (g * V + v) * stride).applyMatrix4(invert).toArray())
          return own
        })
      },
    })

  return {
    object,
    look,
    count,
    walking: walk !== undefined,
    lights,
    wear: dress,
    update,
  }
}

/** How far the baked sheet's hem swings either way, m at its feet, none at its sphere's middle, and how fast, rad/s. */
const HEM_SWING = 0.03
const HEM_RATE = 3.1

/**
 * The sheet as the PC's cloth hangs walking, baked (ghostsheet.json, tools/generators/ghost_sheet.mjs): its grid's
 * points in its ghost's own frame, each with its place on the sheet laid flat, as the cloth's are, for its eyes.
 */
function bakedSheet(): BufferGeometry {
  const { side, points } = bakedPoints
  const rest = new Float32Array(side * side * 2)
  const index: number[] = []
  for (let j = 0; j < side; j++)
    for (let i = 0; i < side; i++) {
      const n = j * side + i
      const [x, z] = disc((i / (side - 1)) * 2 - 1, (j / (side - 1)) * 2 - 1)
      rest.set([x * RADIUS, z * RADIUS], n * 2)
      if (i + 1 < side && j + 1 < side) index.push(n, n + side, n + 1, n + 1, n + side, n + side + 1)
    }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  geometry.setAttribute('rest', new Float32BufferAttribute(rest, 2))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * The ghosts where their cloth is not stepped: on WebGL 2, which has no compute, and on a phone (2026-11-07, as asked).
 * The same walk, the same lamps and the same lights, for the graveyard has no other light and no way through without
 * them (a Xiaomi Mi 9 could not finish the game, 2026-11-03); each sheet the PC's cloth baked as it hangs walking, in
 * its paint, its hem swinging a little.
 */
export function createPlainGhosts(groundAt: (x: number, z: number) => number, walk: Walk, lamps?: FakeLamps): Ghosts {
  const look = defaultLook()
  look.reach = walk.reach
  look.walkSpeed = walk.speed
  const object = new Group()
  const sheet = bakedSheet()
  const cloth = new MeshLambertNodeMaterial({ side: DoubleSide, transparent: true })
  cloth.opacityNode = paintSheet(cloth, sheetPaint(look), attribute('rest', 'vec2'))
  cloth.alphaTest = 0.05
  // The hem swung round, the more the lower, each ghost on a beat of its own by where it stands.
  const below = float(look.ballHeight).sub(positionLocal.y).div(look.ballHeight).clamp(0, 1)
  const beat = time.mul(HEM_RATE).add(atan(positionLocal.z, positionLocal.x).mul(2)).add(modelPosition.x.add(modelPosition.z).mul(1.7))
  cloth.positionNode = positionLocal.add(vec3(sin(beat), 0, sin(beat.add(1.3)).mul(0.6)).mul(below.mul(below).mul(HEM_SWING)))
  const rigs = Array.from({ length: walk.count }, (_, g) => {
    const rig = new Group()
    rig.add(new Mesh(sheet, cloth))
    const lamp = lamps?.track(new FakeLamp(look.lamp, look.lampStrength, look.reach))
    if (lamp) {
      lamp.position.y = look.lampHeight
      rig.add(lamp)
    }
    object.add(rig)
    const here = walk.at(g, 0)
    return { rig, yaw: 0, phase: g * 2.39996, lamp, ...here }
  })
  const lights: FixedLight[] = rigs.map(({ x, z }) => ({ x, z, reach: look.reach, on: look.lit }))
  let clock = 0
  return {
    object,
    look,
    count: walk.count,
    walking: true,
    lights,
    wear: () => {},
    update(dt, t = clock + dt) {
      clock += dt
      rigs.forEach((one, g) => {
        const here = walk.at(g, t)
        const next = walk.at(g, t + 0.15)
        const want = Math.atan2(next.x - here.x, next.z - here.z)
        const d = Math.atan2(Math.sin(want - one.yaw), Math.cos(want - one.yaw))
        one.yaw += dt > 0 ? d * (1 - Math.exp(-dt / 0.25)) : d
        const bob = look.bob * Math.sin(clock * look.bobRate * Math.PI * 2 + one.phase)
        one.rig.position.set(here.x, groundAt(here.x, here.z) + look.hover + bob, here.z)
        one.rig.rotation.y = one.yaw
        lights[g] = Object.assign(lights[g]!, { x: here.x, z: here.z, reach: look.reach, on: look.lit })
      })
    },
  }
}

/** The ghosts' folder; the count reloads the page, the sphere's settings lay the sheets again, the rest is live. */
export function mountGhostControls(ghosts: Ghosts, Gui: typeof GUI, more?: (gui: GUI) => void): void {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;bottom:8px;left:524px;z-index:1000;max-height:90vh;overflow:auto'
  document.body.append(container)
  const gui = new Gui({ title: 'ghosts', container, width: 250 } as ConstructorParameters<typeof GUI>[0])
  gui.close()
  // What the page adds (the graves) first, open; the ghosts' own folders after it, shut.
  more?.(gui)
  const { look } = ghosts
  const reload = (key: string, value: string) => {
    const url = new URL(location.href)
    url.searchParams.set(key, value)
    location.href = url.toString()
  }
  const page = { count: ghosts.count }
  if (!ghosts.walking) gui.add(page, 'count', 1, SPOTS.length, 1).name('how many (reloads)').onFinishChange((v: number) => reload('ghostcount', String(v)))
  const again = () => ghosts.wear()
  const blob = gui.addFolder('the sphere under it').close()
  blob.add(look, 'bodies', 0.5, 2, 0.01).name('sphere size').onFinishChange(again)
  blob.add(look, 'ballHeight', 0.2, 1.4, 0.01).name('sphere height m').onFinishChange(again)
  blob.add(look, 'thickness', 0, 0.15, 0.005).name('thickness m').onFinishChange(again)
  if (!ghosts.walking) blob.add(look, 'turn', -Math.PI, Math.PI, 0.01).name('turn (standing)').onFinishChange(again)
  blob.add(look, 'hover', 0, 1.2, 0.01).name('hover m').onFinishChange(again)
  blob.add({ again }, 'again').name('lay the sheet again')
  const cloth = gui.addFolder('cloth').close()
  cloth.add(look, 'stiffness', 0.05, 1, 0.01).name('stiffness')
  cloth.add(look, 'bend', 0, 1, 0.01).name('bending share')
  cloth.add(look, 'damping', 0.85, 0.999, 0.001).name('speed kept a step')
  cloth.add(look, 'gravity', 0, 2, 0.01).name('gravity share')
  cloth.add(look, 'wind', 0, 6, 0.05).name('wind')
  const idle = gui.addFolder('moves')
  if (ghosts.walking) idle.add(look, 'walkSpeed', 0.1, 3, 0.05).name('walk speed m/s')
  else {
    idle.add(look, 'circling').name('going round')
    idle.add(look, 'circle', 0.2, 4, 0.05).name('circle radius m')
    idle.add(look, 'speed', 0, 2, 0.01).name('pace m/s')
  }
  idle.add(look, 'bob', 0, 0.3, 0.005).name('bob m')
  idle.add(look, 'bobRate', 0, 2, 0.01).name('bob /s')
  const sheet = gui.addFolder('sheet').close()
  sheet.addColor(look, 'colour').name('colour')
  sheet.add(look, 'glow', 0, 2, 0.01).name('own glow')
  sheet.add(look, 'inside', 0, 1, 0.01).name('inside shade')
  sheet.add(look, 'opacity', 0.1, 1, 0.01).name('opacity')
  sheet.add(look, 'eyesAhead', -0.3, 0.4, 0.005).name('eyes ahead m')
  sheet.add(look, 'eyesApart', 0, 0.2, 0.002).name('eyes apart m')
  sheet.add(look, 'eyeSize', 0, 0.08, 0.001).name('eye size m')
  sheet.add(look, 'eyeDark', 0, 1, 0.01).name('eye darkness')
  const light = gui.addFolder('its light').close()
  light.add(look, 'lit').name('shines (rats keep out)')
  light.add(look, 'reach', 0.3, 6, 0.05).name('reach m')
  light.addColor(look, 'lamp').name('lamp colour')
  light.add(look, 'lampStrength', 0, 60, 0.1).name('lamp strength')
  light.add(look, 'lampHeight', 0, 1.5, 0.01).name('lamp height m')
  const debug = gui.addFolder('debug').close()
  debug.add(look, 'showBodies').name('show spheres')
  debug.add(look, 'showWorn').name('worn cloth red')
  gui.add({ copy: () => {
    const text = JSON.stringify(look)
    console.log(text)
    void navigator.clipboard?.writeText(text)
  } }, 'copy').name('copy values')
}
