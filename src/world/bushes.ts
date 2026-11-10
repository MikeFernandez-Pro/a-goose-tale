// The game's bushes: scattered as the dead trees are (deadtrees.ts),
// either side of the old road, behind its walls where by one, out of the
// lights, off the scenes' pieces and the arches, in groves thinning into the
// dark; low enough to stand a little nearer the road than the trees, and never
// on a tree's trunk or a grave. Leaf cards from justASimpleTree's bush, four seeds of it,
// drawn a stretch at a time, coloured as the dead trees' leaves are, by a leaves
// folder of their own (createLeafMaterial); each with a copy of
// itself inside it, a little smaller and turned, filling the gaps between its
// cards, so it has more shape and less emptiness. The files' bushes are round
// and even; the bushes folder's form (BushForm) makes them less so: lumps in
// each kind's outline, and each bush squashed one way and leaning its own way.
// A share of them by the road and round the pond can be dead, as the bushes
// folder's kind has it (BushKind), none to start: bare twigs built here
// (deadbush.ts), standing among the leafy ones; the island's own stay in leaf.
import { Float32BufferAttribute, Group, Vector3, type BufferGeometry, type Material, type Mesh, type MeshStandardMaterial, type Texture } from 'three/webgpu'
import { modelLoader } from '../look/gltf'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { float, texture, uv } from 'three/tsl'
import { createLeafMaterial, createStretches, deadTrees, type DeadTree, type DeadTreeShape, type LeafLook, type Stretches } from './deadtrees'
import { random } from '../swarm/swarm'
import { noiseFloat } from './treesway'
import { deadBush } from './deadbush'
import type { Plain, Point } from './plain'
import type { StoneBlock } from './roadwalls'
import { ShellToonMaterial, type PaintLook, type ShellLook } from '../look/shell'
import type { ToonLook } from '../look/toon'

/** The bushes as set from the panel on 2026-10-25: as near the road as the trees, in small, thick groves; on 2026-10-26 1 to 1.2 m tall, twice as wide, 3 m apart. */
export function defaultBushShape(): DeadTreeShape {
  return { clear: 3, band: 18, thin: 0.6, light: 1, piece: 2, spacing: 3, shortest: 1, tallest: 1.2, width: 2, groves: 22, grove: 4, between: 0.3, byWall: 4, behindWall: 0.3, seed: 2 }
}

/**
 * The bushes' leaves to start, as set from the panel on 2026-10-26, its mid and bright green paler since 2026-11-10: a dark, a mid and a bright green, darkened by
 * nearly all of each card's baked shade and tinted as its clump, a touch of their own colour unlit, cut out at half.
 */
export function defaultBushLeafLook(): LeafLook {
  return { show: true, textured: true, cutout: 0.5, shadow: 0x40732b, mid: 0x80ba69, light: 0x99dc56, shadowTo: 0.55, lightFrom: 0.8, shading: 0.96, variation: 1 }
}

/** How close to a dead tree's trunk a bush may stand, m. */
const OFF_TRUNK = 1.2
/** How far a bush's middle stands off a grave's footprint at the least, m: about its leaves' half width, so no stone stands up out of it. */
export const OFF_GRAVE = 0.7

/** Whether a bush at (x, z) stands off every one of `graves`, each its middle and how far round its footprint reaches, m. */
export const offGraves = (graves: readonly (Point & { radius: number })[]) => (x: number, z: number) =>
  graves.every((g) => Math.hypot(g.x - x, g.z - z) >= g.radius + OFF_GRAVE)

/** The bushes along `road`, as `shape` scatters them, `variants` kinds of bush, none on a trunk of `trees`; the rest as `deadTrees` takes it. */
export function bushes(
  plain: Plain,
  road: readonly Point[],
  variants: number,
  trees: readonly Point[],
  shape = defaultBushShape(),
  walls: readonly StoneBlock[] = [],
  pieces: readonly Point[] = [],
  clear: (x: number, z: number) => boolean = () => true,
): DeadTree[] {
  const offTrunks = (x: number, z: number) => trees.every((t) => Math.hypot(t.x - x, t.z - z) >= OFF_TRUNK)
  return deadTrees(plain, road, variants, shape, walls, pieces, (x, z) => clear(x, z) && offTrunks(x, z))
}

/** The bushes' files: four seeds of the one bush, leaf cards cut out of one leaf texture. */
const MODELS = [1, 2, 3, 4].map((k) => `./models/bushes/bush${k}.glb`)
/** How tall each bush is laid in its geometry, m, before it is sized: about as tall as they stand. */
const LAID = 0.7
/** How far a bush is sunk into the ground, of its height: its lowest cards hang below its middle, so none float. */
const SUNK = 0.1
/** The copy inside each bush: how big, of the bush, round its middle, and how far it is turned about its upright, rad. */
const INNER = { size: 0.85, turn: 1.9 }

/** `bush` with a copy of itself inside it, INNER's size round the bush's middle and turned INNER's turn. */
function filled(bush: BufferGeometry): BufferGeometry {
  bush.computeBoundingBox()
  const middle = bush.boundingBox!.getCenter(new Vector3())
  const inner = bush.clone().translate(-middle.x, -middle.y, -middle.z).rotateY(INNER.turn).scale(INNER.size, INNER.size, INNER.size).translate(middle.x, middle.y, middle.z)
  return mergeGeometries([bush, inner])
}

/** How far the bushes are from the round, even ones their files have, as the bushes folder edits it. */
export interface BushForm {
  /** How far a bush's outline is pushed out and drawn in, of its reach from its middle: 0 as its file has it. */
  lumps: number
  /** About how many lumps across a bush: 1 one side fuller than the other, more for smaller bumps. */
  lumpCount: number
  /** How much narrower one way than the other a bush is at the most, 0 none to 1, each bush its own; its footprint as wide. */
  squash: number
  /** How far off upright a bush leans at the most, degrees, each its own way. */
  lean: number
}

/** The bushes' form to start, as set from the panel on 2026-11-10: deep, small lumps all over each, as wide both ways and upright. */
export function defaultBushForm(): BushForm {
  return { lumps: 0.75, lumpCount: 6, squash: 0, lean: 0 }
}

/**
 * `bush` with `form`'s lumps: every vertex pushed out from its middle or drawn in toward it, by a noise of the way to
 * it, so a card moves about as one; each `kind` its own lumps. `bush` itself with none.
 */
export function lumped(bush: BufferGeometry, form: BushForm, kind: number): BufferGeometry {
  if (form.lumps === 0) return bush
  bush.computeBoundingBox()
  const middle = bush.boundingBox!.getCenter(new Vector3())
  const from = bush.getAttribute('position')
  // Floats, whatever the file packed them as: a packed position could not be pushed out past its range.
  const position = new Float32BufferAttribute(from.count * 3, 3)
  const p = new Vector3()
  for (let i = 0; i < from.count; i++) {
    p.fromBufferAttribute(from, i).sub(middle)
    const way = form.lumpCount / (p.length() || 1)
    p.multiplyScalar(1 + form.lumps * noiseFloat(p.x * way + kind * 17.3, p.y * way, p.z * way)).add(middle)
    position.setXYZ(i, p.x, p.y, p.z)
  }
  const lumpy = bush.clone().setAttribute('position', position)
  lumpy.computeBoundingBox()
  lumpy.computeBoundingSphere()
  return lumpy
}

/** `bush` as `form` squashes and leans it, drawn from where it stands, so the same each time it is laid; `bush` itself with neither. */
export function uneven(bush: DeadTree, form: BushForm): DeadTree {
  if (form.squash === 0 && form.lean === 0) return bush
  const draw = random(Math.imul(Math.round(bush.x * 100), 73856093) ^ Math.imul(Math.round(bush.z * 100), 19349663))
  const narrow = Math.sqrt(1 - form.squash * draw())
  return { ...bush, width: bush.width / narrow, depth: bush.width * narrow, lean: (form.lean * Math.PI * draw()) / 180, leanTo: draw() * Math.PI * 2 }
}

/** What the bushes are, as the bushes folder has it: the share of them dead, bare twigs in `wood`, sRGB, 0 none to 1 all; the rest in leaf as their files have them. */
export interface BushKind {
  dead: number
  wood: number
}

/** The bushes to start, as decided on 2026-11-10: none of them dead, all in leaf; the dead ones' wood the dead trees' pale one. */
export function defaultBushKind(): BushKind {
  return { dead: 0, wood: 0xd7bbe7 }
}

/** Whether `bush` is one of the `share` of them dead: drawn from where it stands, so the same each time it is laid, and still dead as the share grows. */
export function isDead(bush: Point, share: number): boolean {
  return random(Math.imul(Math.round(bush.x * 100), 83492791) ^ Math.imul(Math.round(bush.z * 100), 2971215073))() < share
}

/** The dead bushes' seeds, a kind each: as many as the files' bushes, so a bush's variant picks either. */
const DEAD_SEEDS = [11, 23, 37, 53]

/**
 * The bushes drawn: laid where `lay` has them, dead or in leaf as `setKind` has them, in the leaves `setLeaves` paints
 * the leafy ones, in the shell `setShell` has.
 */
export interface BushesMesh extends Stretches {
  /** How many kinds of bush there are to pick from. */
  variants: number
  /** Lay `bushes`, each dead or in leaf as the kind's share has it, and `alive`, in leaf whatever it says: the island's. */
  lay(bushes: readonly DeadTree[], alive?: readonly DeadTree[]): void
  /** Take the bushes folder's kind: the bushes laid again as they last were, dead or in leaf, the dead ones in its wood. */
  setKind(kind: BushKind): void
  /** Take the bushes folder's form: every kind lumped again, the bushes laid again as they last were. */
  setForm(form: BushForm): void
  /** Take the bushes' leaves folder's values, but `show`: the bushes folder shows them or not. */
  setLeaves(look: LeafLook): void
  setShell(look: ShellLook & { paint: PaintLook; toon: ToonLook }): void
}

/**
 * The bushes, none laid yet, drawn by stretches, standing on the ground `groundAt` has under it: each file's bush in
 * one shell coloured as `leaves` has it, and as many dead ones (deadbush.ts) in a shell of their wood; which of the two
 * is laid as `startKind` has it, in the form `startForm` has.
 */
export async function createBushes(
  leaves: LeafLook,
  groundAt: (x: number, z: number) => number = () => 0,
  startForm = defaultBushForm(),
  startKind = defaultBushKind(),
): Promise<BushesMesh> {
  const loader = modelLoader()
  const files = await Promise.all(MODELS.map((url) => loader.loadAsync(url)))
  // Each bush on its own foot, LAID m tall, a little sunk; the leaf texture the files share.
  const filed: BufferGeometry[] = []
  let map: Texture | null = null
  for (const file of files) {
    file.scene.updateMatrixWorld(true)
    file.scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      map ??= (mesh.material as MeshStandardMaterial).map
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
      geometry.computeBoundingBox()
      const { min, max } = geometry.boundingBox!
      const size = LAID / (max.y - min.y)
      geometry.translate(0, -min.y, 0).scale(size, size, size).translate(0, -SUNK * LAID, 0)
      filed.push(filled(geometry))
    })
  }
  // The dead ones, as tall and as sunk.
  const grown = DEAD_SEEDS.map((seed) => deadBush(seed, LAID).translate(0, -SUNK * LAID, 0))
  // The kinds as drawn: the bushes in the form the bushes folder has, every bush of them squashed and leant by it.
  let form = { ...startForm }
  let kind = { ...startKind }
  const leafKinds = filed.map((bush, k) => lumped(bush, form, k))
  const deadKinds = grown.map((bush, k) => lumped(bush, form, k))
  // Cut out by the files' leaf texture, white leaves cut out by its alpha.
  const leafy = createLeafMaterial(map ? texture(map, uv()).a : float(1))
  leafy.set(leaves)
  const shell = leafy.material
  const wood = new ShellToonMaterial({ color: kind.wood })
  const inLeaf = createStretches(leafKinds, shell as Material, LAID, groundAt)
  const dead = createStretches(deadKinds, wood as Material, LAID, groundAt)
  const object = new Group().add(inLeaf.object, dead.object)
  let last: readonly DeadTree[] = []
  let lastAlive: readonly DeadTree[] = []
  const lay = (bushes: readonly DeadTree[], alive: readonly DeadTree[] = []) => {
    last = bushes
    lastAlive = alive
    const shaped = (these: readonly DeadTree[]) => these.map((bush) => uneven(bush, form))
    inLeaf.lay(shaped([...bushes.filter((bush) => !isDead(bush, kind.dead)), ...alive]))
    dead.lay(shaped(bushes.filter((bush) => isDead(bush, kind.dead))))
  }
  return {
    object,
    lay,
    cullPast(...where) {
      inLeaf.cullPast(...where)
      dead.cullPast(...where)
    },
    variants: Math.min(leafKinds.length, deadKinds.length),
    setKind(next) {
      const relay = next.dead !== kind.dead
      kind = { ...next }
      wood.color.setHex(kind.wood)
      if (relay) lay(last, lastAlive)
    },
    setForm(next) {
      form = { ...next }
      const old = [...leafKinds, ...deadKinds]
      filed.forEach((bush, k) => (leafKinds[k] = lumped(bush, form, k)))
      grown.forEach((bush, k) => (deadKinds[k] = lumped(bush, form, k)))
      lay(last, lastAlive)
      // The lumped bushes no longer drawn, never a file's own nor one as grown.
      for (const bush of old) if (!filed.includes(bush) && !grown.includes(bush)) bush.dispose()
    },
    setLeaves(look) {
      leafy.set(look)
    },
    setShell(look) {
      for (const material of [shell, wood]) {
        material.set(look)
        material.setPaint(look.paint)
        material.setToon(look.toon)
      }
    },
  }
}
