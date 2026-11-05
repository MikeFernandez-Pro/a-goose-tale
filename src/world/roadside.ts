// What stands along the old road, laid again as the panel's folders change it: the graveyard, its ghosts and graves; the
// road's arches and broken walls; the dead trees and bushes either side, cut round him by the see-through.
import { Scene, WebGPURenderer, type Object3D, Vector2, type Material, Mesh, type NodeMaterial } from 'three/webgpu'
import { GoosePlay } from '../game/gooseplay'
import { type PlaySwarm } from '../swarm/play'
import { type Lights } from '../light/lights'
import { FakeLamps } from '../light/fakelamps'
import { type PondLook, shoreAt, islandMiddle, groundOf } from './pond'
import { type RoadShape, roadLine, leadIn, roadField } from './road'
import { type RoadLook, type GroundFloor } from './ground'
import { type Look } from '../settings'
import { gooseThemeOf } from '../look/goosethemes'
import { createGooseScenes, BURNING_MODEL } from '../game/goosescenes'
import { createFallingLeaves } from './fallingleaves'
import { featureOn, url, noPanel } from '../game/address'
import { layGraveyard, defaultGraveLook, ghostAt, inGraveyard } from './graveyard'
import { createPlainGhosts, createGhosts, mountGhostControls } from '../characters/ghosts'
import { type GraveGround, createGraves, mountGraveControls, scatterGravePumpkins } from './graves'
import { offWay, defaultDeadTreeShape, defaultBarkLook, defaultGrassLook, defaultLeafLook, createDeadTrees, type DeadTree, type DeadTreeShape, deadTrees, treeVariantOf, trunkRadius } from './deadtrees'
import { createGraveCandles, mountCandleControls } from './gravecandles'
import { defaultArchLook, type ArchStone, defaultArchWet, type ArchShell, createArches, archesOf, archStones } from './arches'
import { defaultRoadWallLook, ROAD_WALL_STYLES, type RoadWallLook, createRoadWalls, type StoneBlock, roadWallStones, roadWallsOf, roadWallLines } from './roadwalls'
import { type ShineLook } from '../look/shell'
import { defaultTreeWindLook } from './treesway'
import { defaultBushShape, defaultBushLeafLook, createBushes, bushes } from './bushes'
import { defaultNoiseSeeThrough, noiseSeeThrough, seeThroughZone } from '../look/seethrough'
import { uniform, renderGroup, positionWorld } from 'three/tsl'
import { type Wall, nearestWalls } from '../swarm/walls'
import { type Point } from './plain'
import { walkOf } from '../game/gooseintro'
import { GHOST_HEARD } from '../sound/gooseheard'

/** How far round an island bush the goslings keep, m, of its width. */
export const ISLAND_BUSH_KEEP = 0.35
/** How far the burning tree is turned, rad. */
const BURNING_TURN = 0.6

/** The roadside, made and laid on what the page has made. */
export async function createRoadside({ scene, goosePlay, lights, fakeLamps, backend, renderer, groundAt, pondLook, gooseFloorBox, roadShape, roadLook, ground, look, gooseTheme, gooseScenes, fallingLeaves, dev }: {
  scene: Scene
  goosePlay: GoosePlay<PlaySwarm>
  lights: Lights
  fakeLamps: FakeLamps
  backend: string
  renderer: WebGPURenderer
  groundAt: (x: number, z: number) => number
  pondLook: PondLook
  gooseFloorBox: { minX: number; maxX: number; minZ: number; maxZ: number }
  roadShape: RoadShape
  roadLook: RoadLook
  ground: GroundFloor
  look: Look
  gooseTheme: ReturnType<typeof gooseThemeOf>
  gooseScenes: Awaited<ReturnType<typeof createGooseScenes>>
  fallingLeaves: ReturnType<typeof createFallingLeaves> | undefined
  dev: Pick<typeof import('../dev/devtools'), 'GUI'> | undefined
}) {
  // Ghost geese (`?ghosts`, `=float`, `=rag` or `=ball`, `&ghostcount=`), cloth sheets on the GPU (ghosts.ts); WebGPU only.
  // `?graveyard` (the goose game's default, ball ghosts): they walk the graveyard's chain behind the last fire as
  // graveyard.ts lays it, on the play's clock, so they meet where and when they meet there.
  const graveyard = (() => {
    if (!featureOn('graveyard')) return undefined
    const k = goosePlay.plain.braziers.length - 1
    const fire = goosePlay.plain.braziers[k]
    // The fire before it, not a ghost's gosling's brazier, which stands in the graveyard.
    const before = goosePlay.plain.braziers.slice(0, k).reverse().find((b) => b.follows === undefined)
    return fire && before ? layGraveyard(defaultGraveLook(), fire, goosePlay.level.lights[k]?.reach ?? fire.reach, before) : undefined
  })()
  const ghosts = graveyard && backend !== 'WebGPU'
    ? createPlainGhosts(groundAt, { count: graveyard.ghosts.length, reach: graveyard.ghosts[0]?.light.reach ?? 1, speed: defaultGraveLook().speed, at: (g, t) => ghostAt(graveyard.ghosts[g]!, t) }, fakeLamps)
    : (url.has('ghosts') || graveyard) && backend === 'WebGPU'
    ? await createGhosts(
        renderer,
        goosePlay.holder,
        groundAt,
        url.get('ghosts') || 'ball',
        Number(url.get('ghostcount') ?? 4),
        graveyard && { count: graveyard.ghosts.length, reach: graveyard.ghosts[0]?.light.reach ?? 1, speed: defaultGraveLook().speed, at: (g, t) => ghostAt(graveyard.ghosts[g]!, t) },
        fakeLamps,
      )
    : undefined
  if (ghosts) scene.add(ghosts.object)
  /** The old road's middle as last laid, for the graves to keep off: none till it is, and they are laid again then. */
  let gravesRoad: readonly { x: number; z: number }[] = []
  // Its graves over its ground among the ghosts' paths (graves.ts), clear of the crossings, out of the pond, and off the
  // road out to its faded edge, though not to the furthest its edge wavers out: close by it, as old graves stand by a way.
  const graveGround: GraveGround | undefined = graveyard && {
    paths: graveyard.ghosts.map((g) => g.path.points),
    ground: graveyard.outline,
    keepClear: graveyard.meetings.map((m) => ({ ...m.at, radius: 1.1 })),
    wet: (x, z) => Math.hypot(x - pondLook.x, z - pondLook.z) < shoreAt(pondLook, Math.atan2(z - pondLook.z, x - pondLook.x)) + 0.6,
    onRoad: (x, z, radius) => gravesRoad.length > 0 && offWay(gravesRoad, { x, z }) < roadLook.width / 2 + roadLook.edge + radius,
  }
  const graves = graveGround ? await createGraves(graveGround, groundAt) : undefined
  if (graves) scene.add(graves.object)
  // Candles at the graves' feet (gravecandles.ts), laid again whenever the graves are.
  const graveCandles = graves ? await createGraveCandles(groundAt) : undefined
  if (graveCandles) scene.add(graveCandles.object)
  const layGraveCandles = () => graves && graveCandles?.lay(graves.footprints())
  // No last fire past it: the graveyard runs on to the pond, and the ghosts are its only light. Its light out for the
  // swarm and the play, its stand and flame not drawn; its place still lays the graveyard.
  if (graveyard) {
    const k = goosePlay.plain.braziers.length - 1
    const last = goosePlay.level.lights[k]
    if (last) last.on = false
    const drawn = lights.object.children[k]
    if (drawn) drawn.visible = false
  }
  // A ghost's gosling (plain.ts) walks behind his ghost, counted from the first he meets, the last laid: its light the
  // panel's reach. His brazier lights nothing and is not drawn.
  goosePlay.plain.braziers.forEach((b, k) => {
    const drawn = b.follows === undefined ? undefined : lights.object.children[k]
    if (drawn) drawn.visible = false
  })
  if (graveyard && ghosts) {
    const walking = graveyard.ghosts
    goosePlay.ghostAt = (ghost, t) => {
      const g = walking.length - 1 - ghost
      const light = ghosts.lights[g]
      return walking[g] && light ? { ...ghostAt(walking[g], t), reach: light.reach } : undefined
    }
  }
  if (dev && ghosts && !noPanel)
    mountGhostControls(
      ghosts,
      dev.GUI,
      graves &&
        ((gui) => {
          mountGraveControls(graves, gui, () => {
            setStones()
            layGravePumpkins()
            layGraveCandles()
          })
          if (graveCandles) mountCandleControls(graveCandles, gui, layGraveCandles)
        }),
    )
  /** How far round a graveyard pumpkin he keeps clear when they are scattered, m. */
  const GRAVE_PUMPKIN_RADIUS = 0.4
  /**
   * A few of the well's pumpkins in the graveyard by the road, clear of its graves, looking back down the road at him
   * coming (graves.ts): again whenever the road or the graves are laid again.
   */
  function layGravePumpkins() {
    if (!graveyard || !graveGround) return
    const stones = (graves?.footprints() ?? []).map(({ at, outline }) => ({ ...at, radius: Math.max(...outline.map((p) => Math.hypot(p.x, p.z))) }))
    const back = { x: -graveyard.entrance.facing.x, z: -graveyard.entrance.facing.z }
    gooseScenes.layLoosePumpkins(scatterGravePumpkins(graveGround, gravesRoad, back, stones, gooseScenes.pumpkinKinds, GRAVE_PUMPKIN_RADIUS))
  }
  // The ghosts' lights handed to the swarm after the play's own, so the rats keep out of them as out of a brazier's:
  // patched onto the play from here, to keep them out of gooseplay.ts.
  if (ghosts) {
    const playLights = goosePlay.lights.bind(goosePlay)
    goosePlay.lights = () => [...playLights(), ...ghosts.lights]
  }
  // The old road's arches over it out in the dark between its fires (arches.ts), as the road folder edits them.
  const archLook = defaultArchLook()
  // Their slabs and their toon shell, as the doors folder edits them: the road's and the floor's as the page opens, the
  // floor's glossy highlight making them wet as the road is; theirs from then. As the folder was set on 2026-10-25:
  // smaller slabs than the road's; a theme's own shell over that. Their stone 0.68 light, and no highlight, whatever the
  // theme, since 2026-10-26, and a thin soft periwinkle rim, as set from the panel on 2026-10-27; the walls' the same.
  const STONE_LIGHTNESS = 0.68
  const matted = { specular: 0, rim: true, rimStrength: 0.32, rimWidth: 0.23, rimSoftness: 0.075, rimColor: 0x9097fe }
  const { saturation: stoneSaturation, hue: stoneHue, rotation: stoneRotation, relief: stoneRelief } = roadLook
  const archStone: ArchStone = { lightness: STONE_LIGHTNESS, saturation: stoneSaturation, hue: stoneHue, scale: 1.1, rotation: stoneRotation, relief: stoneRelief, wet: defaultArchWet() }
  const archShell: ArchShell = structuredClone({ ...look.floor.shell, rim: true, rimStrength: 3, rimWidth: 0.31, rimSoftness: 0.075, paint: look.floor.paint, toon: look.floor.toon })
  if (gooseTheme?.doors) Object.assign(archShell, gooseTheme.doors)
  Object.assign(archShell, matted)
  const arches = await createArches(archLook, archStone, groundAt)
  scene.add(arches.object)
  // The old road's broken walls beside it (roadwalls.ts), as the walls folder edits them: of the arches' stone and in
  // their shell as the page opens, or a theme's, their own from then; `?walls=<kind>` starts with another kind (field, lane, ruins,
  // tumbled, none).
  const roadWallLook = defaultRoadWallLook()
  const wallsAsked = url.get('walls')
  if (wallsAsked !== null && (ROAD_WALL_STYLES as readonly string[]).includes(wallsAsked)) roadWallLook.style = wallsAsked as RoadWallLook['style']
  // Their tiles as the walls folder was set on 2026-10-25: a little bigger, square to the wall, slid along and up.
  const wallStone = { ...structuredClone(archStone), scale: 1.35, rotation: 0, offsetX: 1.32, offsetY: 0.5 }
  const wallShell = structuredClone(archShell)
  if (gooseTheme?.walls) Object.assign(wallShell, gooseTheme.walls)
  Object.assign(wallShell, matted)
  const roadWalls = await createRoadWalls(wallStone, groundAt)
  scene.add(roadWalls.object)
  roadWalls.setShell(wallShell)
  // The dead trees either side of the road (deadtrees.ts), behind its walls where by one, as the dead trees folder edits
  // them: scattered again on every change to it, the road, the arches or the walls; in the scenes' shell, their wood the
  // colour chosen on 2026-10-26, or a bark set the bark folder picks, laid as the floor is; swaying in the wind as
  // justASimpleTree's trees do.
  const deadTreeShape = defaultDeadTreeShape()
  const deadTreeLook = { show: true, wood: 0xe4aff3, saturation: 0.64, y: -0.31, trunk: 0.09, rings: 6 }
  /** The dead trees' highlight and rim, over the scenes' shell they share, as set from the panel on 2026-10-26: no highlight, a soft lilac rim. */
  const deadTreeShine: ShineLook = {
    specular: 0,
    shininess: 30,
    softness: 0.17,
    specularColor: 0xc0d8f0,
    rim: true,
    rimStrength: 0.51,
    rimWidth: 0.37,
    rimSoftness: 0.1,
    rimColor: 0xc6c2ff,
  }
  const deadTreeBark = defaultBarkLook()
  // The floor's grass up their feet, in the floor's look as the floor folder has it (lookChanged).
  const deadTreeGrass = defaultGrassLook()
  const deadTreeLeaves = defaultLeafLook()
  const deadTreeWind = defaultTreeWindLook()
  // The goose scenes' dead tree among them, drawn as one of theirs, its gosling riding its branch in their wind.
  const deadTreesMesh = await createDeadTrees(deadTreeLook.wood, groundAt, gooseScenes.treeWood)
  deadTreesMesh.setLeaves(deadTreeLeaves)
  deadTreesMesh.setBark(deadTreeBark)
  deadTreesMesh.setWind(deadTreeWind)
  deadTreesMesh.setWood(deadTreeLook.wood, deadTreeLook.saturation)
  scene.add(deadTreesMesh.object)
  deadTreesMesh.object.position.setY(deadTreeLook.y)
  deadTreesMesh.setTrunk(deadTreeLook.trunk)
  deadTreesMesh.setRings(deadTreeLook.rings)
  scene.add(deadTreesMesh.own)
  gooseScenes.swayTree = deadTreesMesh.swayOwn
  // The falling leaves, where they fall, in the dead trees' leaf colours, as the leaves folder sets them: the mid, the
  // shadow, the light and the mid again, so the mid falls most, as it shows most on the trees; as much of their own
  // colour shown unlit as the trees'.
  function leavesFallAsTrees(): void {
    if (!fallingLeaves || !deadTreesMesh.leaves) return
    const { mid, shadow, light, glow } = deadTreeLeaves
    fallingLeaves.look.colours.splice(0, 4, mid, shadow, light, mid)
    fallingLeaves.look.glow = glow
    fallingLeaves.set()
  }
  leavesFallAsTrees()
  // The bushes (bushes.ts), scattered as the trees are, nearer the road and off their trunks, as the bushes folder edits
  // them; their leaves chosen on 2026-10-25, all of them sunk `y` m from where they stand, as set on the panel.
  const bushShape = defaultBushShape()
  const bushLook = { show: true, y: -0.15 }
  const bushLeaves = defaultBushLeafLook()
  const bushesMesh = await createBushes(bushLeaves, groundAt)
  scene.add(bushesMesh.object)
  bushesMesh.object.position.setY(bushLook.y)
  // The goose game's see-through (seethrough.ts): the dead trees between the camera and him, and nothing else since the
  // change of 2026-10-26, dithered away round him by Perlin noise, as the see-through folder sets it: on 2026-10-26 a
  // wide hole, 4 m round, cut from him on, in finer blots. A tree's trunk is kept whole
  // (DeadTreesMesh.trunk), so it stands there whatever is dithered away above it: up to 0.09 of its height, under the
  // first fork of any of the four, 0.155 of the height up the lowest (2026-10-26), its cut filled by its cross-section,
  // never cut itself.
  const gooseSeeLook = { ...defaultNoiseSeeThrough(), radius: 4, bias: 0, noiseScale: 0.19 }
  const gooseSee = noiseSeeThrough(gooseSeeLook)
  // Its zone, for its debug: rings round him at the hole's radius and its clear core's.
  const gooseSeeZone = seeThroughZone()
  scene.add(gooseSeeZone.object)
  const seenThrough: Object3D[] = [deadTreesMesh.object]
  /** Where the burning tree stands, and how far round its trunk the see-through leaves it whole, m: its crown's reach. */
  const burningAt = uniform(new Vector2(1e6, 1e6)).setGroup(renderGroup)
  const BURNING_WHOLE = 3.5
  const burningWhole = positionWorld.xz.sub(burningAt).length().lessThan(BURNING_WHOLE)
  const cutThrough = new WeakSet<Material>()
  /**
   * Cut every material under the see-through's objects not cut yet, a frame at a time: the trees are new meshes each time
   * they are laid. A material with a mask of its own keeps it, and one seen through, a glow or a flame, is not cut.
   */
  function cutSeenThrough() {
    for (const object of seenThrough) {
      object.traverse((child) => {
        if (!(child as Mesh).isMesh) return
        for (const m of [(child as Mesh).material].flat() as (Material & Partial<NodeMaterial>)[]) {
          if (cutThrough.has(m)) continue
          cutThrough.add(m)
          if (!m.isNodeMaterial || m.maskNode || m.transparent || m === deadTreesMesh.trunk.whole) continue
          gooseSee.cut(m as NodeMaterial, m === deadTreesMesh.trunk.material ? deadTreesMesh.trunk.kept.or(burningWhole) : burningWhole)
          m.needsUpdate = true
        }
      })
    }
  }
  /** How far past the pond's shore a dead tree stands at the least, m: off its bank. */
  const TREE_OFF_POND = 2
  /** Where a dead tree may stand: on the floor, a trunk's width in from its edge, and off the pond and its bank. */
  const treeGround = (x: number, z: number) => {
    if (x < gooseFloorBox.minX + 1 || x > gooseFloorBox.maxX - 1 || z < gooseFloorBox.minZ + 1 || z > gooseFloorBox.maxZ - 1) return false
    return Math.hypot(x - pondLook.x, z - pondLook.z) > shoreAt(pondLook, Math.atan2(z - pondLook.z, x - pondLook.x)) + TREE_OFF_POND
  }
  /** The arches' shell as the doors folder last set it. */
  const archesShell = () => arches.setShell(archShell)
  archesShell()
  /** The burning tree as the dead trees lay it, with them. */
  let burningTree: DeadTree | undefined
  /** The road as last laid, and the arches over it. */
  let roadLaid: ReturnType<typeof roadLine> = { points: [] }
  /**
   * How far the hand-laid road is drawn on back past its first point, m, so they come walking up it from out of view in
   * the opening; and that stretch, from its far end to the first point, which no tree or bush stands on.
   */
  const ROAD_LEAD_IN = 20
  let roadLead: { x: number; z: number }[] = []
  let archesLaid: ReturnType<typeof archesOf> = []
  /** The walls beside the road as last laid, and as the rats keep out of them. */
  let wallsLaid: StoneBlock[] = []
  let roadRatWalls: Wall[] = []
  /** Where he stood when the rats were last handed the walls nearest him: none yet, or walls laid again since. */
  const ratWallsAt = { x: NaN, z: NaN }
  /** How far he walks before the rats are handed the walls nearest him again, m: the GPU step reads MAX_WALLS at most. */
  const RAT_WALLS_AGAIN = 3
  /** The arches' stones on the ground, as big as the ground folder has them, the walls, and the graves, kept out of by him and his goslings. */
  const setStones = () =>
    goosePlay.setStones([...archesLaid.flatMap((arch) => archStones(arch, archLook.scale)), ...roadWallStones(wallsLaid), ...(graves?.footprints() ?? [])])
  /** The arches as the road and ground folders last set them: sized, raised and coloured, and their stones with them. */
  const archesChanged = () => {
    arches.set(archLook)
    setStones()
  }
  /** The arches over the road as last laid, as many as the road folder has them, again on a change to their number. */
  const layArches = () => {
    // None on the ghosts' paths: their doorways would stand in the graveyard.
    archesLaid = archesOf(goosePlay.plain, roadLaid, archLook.count).filter((arch) => !graveyard || !inGraveyard(graveyard, arch, 5))
    arches.lay(archesLaid)
    layWalls()
  }
  /** The walls beside the road as last laid, as the walls folder has them, clear of the arches, again on every change to it, them or the road. */
  function layWalls() {
    // None in the graveyard, with room round it: its ghosts walk and he follows them where the walls would be.
    wallsLaid = roadWallsOf(goosePlay.plain, roadLaid, roadWallLook, archesLaid).filter((block) => !graveyard || !block.line.some((p) => inGraveyard(graveyard, p, 1)))
    roadWalls.lay(wallsLaid)
    roadRatWalls = roadWallLines(wallsLaid)
    ratWallsAt.x = NaN
    setStones()
    layTrees()
  }
  /** The dead trees as last laid: the bushes keep off their trunks. */
  let treesLaid: DeadTree[] = []
  /**
   * The pond's own woods: trees and bushes either side of a line round it, its shore pushed POND_WOODS_OUT m out, as far
   * as POND_WOODS_BAND m either side of it, so wherever he swims some stand within sight; never in the water or on its
   * bank (`treeGround`), nor in the graveyard.
   */
  const POND_WOODS_OUT = 6
  const POND_WOODS_BAND = 14
  /** How many points the line round the pond is drawn with. */
  const POND_WOODS_POINTS = 96
  /** The line round the pond its woods stand either side of, closed; none with no pond. */
  function pondWoodsLine(): Point[] {
    const line = Array.from({ length: POND_WOODS_POINTS }, (_, j) => {
      const angle = (j / POND_WOODS_POINTS) * Math.PI * 2
      const r = shoreAt(pondLook, angle) + POND_WOODS_OUT
      return { x: pondLook.x + Math.cos(angle) * r, z: pondLook.z + Math.sin(angle) * r }
    })
    return [...line, line[0]!]
  }
  /** `shape` as the pond's woods scatter it: right up to their line, out to the band, on a seed of their own. */
  const pondWoodsShape = (shape: DeadTreeShape): DeadTreeShape => ({ ...shape, clear: 0, band: POND_WOODS_BAND, seed: shape.seed + 50 })
  /** Where the pond's woods may stand: where the road's may, off the walls, out of the graveyard, `spacing` m off any of `laid`. */
  const pondWoodsGround = (laid: readonly Point[], spacing: number) => (x: number, z: number) =>
    treeGround(x, z) &&
    (!graveyard || !inGraveyard(graveyard, { x, z }, 1)) &&
    wallsLaid.every((wall) => offWay(wall.line, { x, z }) > wall.thick / 2 + 1) &&
    laid.every((p) => Math.hypot(p.x - x, p.z - z) >= spacing)
  /**
   * The opening's view kept clear: no tree by the road stands back down it from where his walk begins, between him and
   * the camera, within `back` m behind him and `side` m either side.
   */
  const OPENING_CLEAR = { back: 10, side: 3 }
  const inOpeningView = (from: { x: number; z: number }, tree: { x: number; z: number }) =>
    tree.z > from.z && tree.z - from.z < OPENING_CLEAR.back && Math.abs(tree.x - from.x) < OPENING_CLEAR.side
  /** Whether `p` stands within `clear` m of the road drawn on back past its first point. */
  const onRoadLead = (p: { x: number; z: number }, clear: number) => roadLead.length >= 2 && offWay(roadLead, p) < clear
  /** The dead trees as the dead trees folder has them, along the road as last laid, behind its walls and clear of its arches; the bushes again round them. */
  function layTrees() {
    deadTreesMesh.object.visible = deadTreeLook.show
    const walkFrom = walkOf(goosePlay.plain.start, goosePlay.plain.road)[0]!
    const byRoad = deadTreeLook.show
      ? deadTrees(goosePlay.plain, roadLaid.points, deadTreesMesh.variants, deadTreeShape, wallsLaid, archesLaid, treeGround).filter((tree) => !inOpeningView(walkFrom, tree) && !onRoadLead(tree, deadTreeShape.clear))
      : []
    const byPond = deadTreeLook.show ? deadTrees(goosePlay.plain, pondWoodsLine(), deadTreesMesh.variants, pondWoodsShape(deadTreeShape), [], archesLaid, pondWoodsGround(byRoad, deadTreeShape.spacing)) : []
    treesLaid = [...byRoad, ...byPond]
    // The burning tree among them, on the spawn's light, as tall as the tallest.
    const variant = treeVariantOf(BURNING_MODEL)
    const spawn = goosePlay.plain.braziers[0]
    burningTree = spawn && !spawn.scene && variant >= 0 ? { x: spawn.x, z: spawn.z, variant, turn: BURNING_TURN, height: deadTreeShape.tallest, width: deadTreeShape.width } : undefined
    if (burningTree) treesLaid = [...treesLaid, burningTree]
    if (burningTree) burningAt.value.set(burningTree.x, burningTree.z)
    deadTreesMesh.lay(treesLaid)
    trunksChanged()
    layBushes()
  }
  /** The dead trees' trunks and the island tree's, bodies he and his goslings keep out of; hidden, none. */
  function trunksChanged() {
    goosePlay.setTrunks([...treesLaid.map((tree) => ({ at: tree, radius: trunkRadius(tree) })), ...(roadside.islandTrunk ? [roadside.islandTrunk] : [])])
  }
  /**
   * The island's bushes, off its middle, m: one behind the tent and a small one past the bonfire, clear
   * of the tent, the fire and the goslings' play, as far up from the waterline as the crown leaves room; how tall, m, how
   * much wider than laid, how far turned, rad, and which kind.
   */
  const ISLAND_BUSHES = [
    { x: 2.4, z: -2, height: 1.1, width: 1.9, turn: 2.2, variant: 2 },
    { x: 3.4, z: 0.3, height: 0.75, width: 1.4, turn: 4.1, variant: 3 },
  ]
  /** The island's bushes where it now is, each lifted from the floor's ground to the island's. */
  function islandBushes(variants: number): DeadTree[] {
    if (!pondLook.island.show) return []
    const middle = islandMiddle(pondLook)
    return ISLAND_BUSHES.map((bush) => {
      const x = middle.x + bush.x
      const z = middle.z + bush.z
      return { ...bush, x, z, variant: bush.variant % variants, lift: groundOf(pondLook, x, z) - groundAt(x, z) }
    })
  }
  /** The bushes as the bushes folder has them, scattered as the trees are, off their trunks; and the island's own. */
  function layBushes() {
    bushesMesh.object.visible = bushLook.show
    roadside.islandBushes = bushLook.show ? islandBushes(bushesMesh.variants) : []
    if (!bushLook.show) return bushesMesh.lay([])
    const byRoad = bushes(goosePlay.plain, roadLaid.points, bushesMesh.variants, treesLaid, bushShape, wallsLaid, archesLaid, treeGround).filter((bush) => !onRoadLead(bush, bushShape.clear))
    const byPond = bushes(goosePlay.plain, pondWoodsLine(), bushesMesh.variants, treesLaid, pondWoodsShape(bushShape), [], archesLaid, pondWoodsGround(byRoad, bushShape.spacing))
    bushesMesh.lay([...byRoad, ...byPond, ...roadside.islandBushes])
  }
  /** The old road laid along the play's plain, and its arches over it, again on every change to its way. */
  const layRoad = () => {
    roadLaid = roadLine(goosePlay.plain, roadShape)
    const { road } = goosePlay.plain
    const drawn = road && road.length >= 2 ? leadIn(road, ROAD_LEAD_IN) : undefined
    roadLead = drawn ? drawn.slice(0, 2) : []
    ground.setRoad(roadField(drawn ? roadLine({ ...goosePlay.plain, road: drawn }, roadShape) : roadLaid))
    gravesRoad = roadLaid.points
    graves?.set()
    layGravePumpkins()
    layGraveCandles()
    layArches()
  }
  /** How far past the graveyard's ground the camera's view wakes its ghosts, m: woken out of sight, their cloth settles before it shows. */
  const GHOST_SETTLE = 3
  /**
   * Whether the graveyard's ghosts may be seen or heard: its ground, their lamps' reach and GHOST_SETTLE round it, in
   * the camera's view, or within earshot of him. Else they are neither walked nor drawn, and walk on from where the
   * play's clock has them once woken. Without the graveyard they walk round him, always awake.
   */
  function ghostsNear(within: (x: number, z: number, radius: number, reach: number) => boolean, inView: (x: number, z: number, radius: number) => boolean): boolean {
    if (!graveyard) return true
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const p of graveyard.outline) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.z)
      maxZ = Math.max(maxZ, p.z)
    }
    const x = (minX + maxX) / 2
    const z = (minZ + maxZ) / 2
    const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2
    return within(x, z, radius, GHOST_HEARD) || (!!ghosts && inView(x, z, radius + ghosts.look.reach + GHOST_SETTLE))
  }
  const roadside = {
    ghostsNear,
    graveyard, ghosts, graves, graveCandles,
    arches, archLook, archStone, archShell, archesChanged, archesShell, layArches,
    roadWalls, roadWallLook, wallStone, wallShell, layWalls,
    deadTreesMesh, deadTreeLook, deadTreeShape, deadTreeShine, deadTreeBark, deadTreeGrass, deadTreeLeaves, deadTreeWind, leavesFallAsTrees, layTrees,
    bushesMesh, bushLook, bushShape, bushLeaves, layBushes,
    gooseSee, gooseSeeLook, gooseSeeZone, seenThrough, cutSeenThrough,
    layRoad,
    /** The island tree's trunk as last stood, none while it is hidden: a body as the dead trees' are. */
    islandTrunk: undefined as { at: { x: number; z: number }; radius: number } | undefined,
    /** The island's bushes as last laid; none with no island. */
    islandBushes: [] as DeadTree[],
    trunksChanged,
    get wallsLaid() {
      return wallsLaid
    },
    get burningTree() {
      return burningTree
    },
    /** The road's walls nearest him handed to the rats, as he walks on or they are laid again. */
    ratWallsFrame(holder: { x: number; z: number }, walls: () => Wall[], swarm: { setWalls(walls: Wall[]): void }) {
      if (Math.hypot(holder.x - ratWallsAt.x, holder.z - ratWallsAt.z) < RAT_WALLS_AGAIN) return
      ratWallsAt.x = holder.x
      ratWallsAt.z = holder.z
      swarm.setWalls(nearestWalls([...walls(), ...roadRatWalls], holder.x, holder.z))
    },
  }
  layRoad()
  return roadside
}

/** The roadside as the page has it. */
export type Roadside = Awaited<ReturnType<typeof createRoadside>>
