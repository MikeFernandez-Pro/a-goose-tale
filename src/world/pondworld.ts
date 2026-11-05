// The pond at the road's end and all on its island: the water, the nest, the bonfire, the tent, the picnic, the oak, and the
// geese there.
import { Scene, Vector3 } from 'three/webgpu'
import type { NightLights } from '../light/nightlights'
import type { GroundFloor } from './ground'
import { type PondLook, createPond, islandMiddle, groundOf, defaultPondLook, shoreAt } from './pond'
import { rollingGround } from './rolling'
import { createGooseScenes, CAGE_FIRE_LIGHT } from '../game/goosescenes'
import type { PlainFires } from '../light/plainfires'
import { FakeLamps, FakeLamp } from '../light/fakelamps'
import type { Goose } from '../characters/goose'
import { type Roadside, ISLAND_BUSH_KEEP } from './roadside'
import type { Look } from '../settings'
import { defaultWaterLook, WATER_LOOKS, createWater } from './water'
import { url } from '../game/address'
import { defaultNestLook, defaultNestLeafLook, defaultNeedleLook, createNest } from './nest'
import { createTent } from './tent'
import { createPicnic } from './picnic'
import { createIslandTree } from './islandtree'
import { createIslandGeese } from '../characters/islandgeese'
import { createBeats } from '../game/beats'
import { type Plain, WADE } from './plain'

/** How far the pond was moved by hand from where it falls past home, m (the pond folder's, 2026-10-29; z 2026-10-30). */
const POND_MOVED = { x: 3.37, z: -0.7 }
/**
 * The pond drawn where the plain has it, past the last brazier: on along the last leg, its shore toward him WADE short
 * of home, so he is home as he wades in. The drawn pond is wider than the play's, so it lies further on.
 */
export function pondPastHome(p: Plain): PondLook {
  const look = defaultPondLook(p.pond)
  const way = Math.atan2(p.pond.z - p.home.z, p.pond.x - p.home.x)
  const reach = shoreAt(look, way + Math.PI) - WADE
  // Its island's shore turned across his way.
  const island = { ...look.island, turn: (way * 180) / Math.PI + 90 }
  return { ...look, x: p.home.x + Math.cos(way) * reach + POND_MOVED.x, z: p.home.z + Math.sin(way) * reach + POND_MOVED.z, island }
}

/** The pond's world on what the page has made. */
export async function createPondWorld({ scene, nightLights, beats, ground, gooseFloorBox, pondLook, gooseGround, gooseScenes, fires, fakeLamps, goose, goslingSize, roadside, look }: {
  scene: Scene
  nightLights: NightLights
  beats: ReturnType<typeof createBeats>
  ground: GroundFloor
  gooseFloorBox: { minX: number; maxX: number; minZ: number; maxZ: number }
  pondLook: PondLook
  gooseGround: ReturnType<typeof rollingGround>
  gooseScenes: Awaited<ReturnType<typeof createGooseScenes>>
  fires: PlainFires
  fakeLamps: FakeLamps
  goose: Goose
  goslingSize: { height: number }
  roadside: Roadside
  look: Look
}) {
  const { fireLook, fireLooks, plainFlame, sceneFires, pitFires, sceneFireFoot } = fires
  // The goose game's plain runs far past the arena's floor, out to the black: the floor laid under the whole of it, its
  // painting read in the world's own coordinates, so a bigger plane changes nothing where the old one was. The pond's
  // shore is cut out of it, and its bank, in the floor's material, falls from there to the water (pond.ts).
  // Its water depth-tinted, refracting and foaming (water.ts), as the pond folder's water edits it.
  const waterLook = defaultWaterLook()
  // `?water=1` to `?water=5`: one of the lake looks to try (water.ts) over the default.
  const waterAsked = WATER_LOOKS[Number(url.get('water')) - 1]
  if (waterAsked) Object.assign(waterLook, waterAsked.look)
  const water = await createWater(waterLook, nightLights.sunShadowSeen)
  const pond = createPond(ground.mesh, gooseFloorBox, pondLook, water.material, (field) => ground.setShore(field), gooseGround)
  scene.add(pond.object)
  // The goose's nest on the island's crown, pine needle cards round a hollow (nest.ts), laid again with the pond.
  const nestLook = defaultNestLook()
  const nestLeaves = defaultNestLeafLook()
  const nestNeedles = defaultNeedleLook()
  const nest = createNest(nestLeaves, nestNeedles)
  /** The nest laid again where the island's crown now is, and only with an island. */
  function layNest() {
    const at = nestAt(new Vector3())
    nest.set({ ...nestLook, show: nestLook.show && pondLook.island.show }, at.x, at.y, at.z)
  }
  /** The nest's middle in `out`: off the island's middle as the nest folder has it, on the ground there. */
  function nestAt(out: Vector3): Vector3 {
    const middle = islandMiddle(pondLook)
    const x = middle.x + nestLook.x
    const z = middle.z + nestLook.z
    return out.set(x, groundOf(pondLook, x, z), z)
  }
  scene.add(nest.object)
  layNest()
  /**
   * The bonfire on the island: the cage's campfire (goosescenes.ts) burning the cage's flame, and a lamp of its own over
   * it, as the island's bonfire folder places, turns and sizes it; `size` 1 the cage's campfire's own, `flame` its
   * flame's, each apart, the flame's foot on the logs as big as they are.
   */
  const islandFireLook = { show: true, x: 2.17, z: 1.64, y: 0, turn: 0, size: 1.24, flame: 0.89, intensity: 12, reach: 7 }
  /** The cage's campfire as drawn, a share of the set's own size; its lamp's height over it, CAGE_FIRE_LIGHT's. */
  const CAMPFIRE_SIZE = 0.8
  const islandFireModel = gooseScenes.campfire()
  const islandFireFlame = plainFlame()
  const islandFireLamp = fakeLamps.track(new FakeLamp(fireLook.lamp, islandFireLook.intensity, islandFireLook.reach, 0))
  const islandFireScale = islandFireModel.scale.x
  scene.add(islandFireModel)
  scene.add(islandFireLamp)
  /** Where the bonfire's foot is now: off the island's middle, on the ground there. */
  const islandFireAt = new Vector3()
  /** The bonfire stood again where the island and its folder have it. */
  function layIslandFire() {
    const middle = islandMiddle(pondLook)
    const x = middle.x + islandFireLook.x
    const z = middle.z + islandFireLook.z
    islandFireAt.set(x, groundOf(pondLook, x, z) + islandFireLook.y, z)
    islandFireModel.position.copy(islandFireAt)
    islandFireModel.rotation.y = (islandFireLook.turn * Math.PI) / 180
    islandFireModel.scale.setScalar(islandFireScale * CAMPFIRE_SIZE * islandFireLook.size)
    islandFireModel.visible = islandFireLook.show && pondLook.island.show
  }
  layIslandFire()
  // The tent on the island's crown (tent.ts), stood again with the pond.
  const tent = await createTent()
  scene.add(tent.object)
  tent.set(pondLook)
  // The breakfast in front of the island's oak (picnic.ts), laid again with the pond.
  const picnic = await createPicnic()
  scene.add(picnic.object)
  picnic.set(pondLook)
  // The oak on the island's top left, in leaf, in a wind of its own (islandtree.ts): its crown cut round him as the dead
  // trees' are, its wood left whole. Stood again with the pond.
  const islandTree = await createIslandTree()
  scene.add(islandTree.object)
  roadside.seenThrough.push(islandTree.crown)
  layIslandTree()
  function layIslandTree() {
    islandTree.set(pondLook)
    roadside.islandTrunk = islandTree.trunk()
    roadside.trunksChanged()
  }
  /** How far above the water a gosling at play keeps to, m, and how far he keeps off the tent and the bonfire, m. */
  const PLAY_DRY = 0.01
  const PLAY_CLEAR = 0.25
  /** The mother goose in the nest and goslings at play in front of the tent (islandgeese.ts), drawn only. */
  const nestPlace = new Vector3()
  const islandGeese = await createIslandGeese(
    {
      shown: () => pondLook.island.show,
      island: () => islandMiddle(pondLook),
      nest: () => nestAt(nestPlace),
      ground: (x, z) => groundOf(pondLook, x, z),
      gooseScale: () => goose.modelScale(),
      free: (x, z) =>
        groundOf(pondLook, x, z) > pondLook.water + PLAY_DRY &&
        (!tent.object.visible || Math.hypot(x - tent.object.position.x, z - tent.object.position.z) > tent.reach() + PLAY_CLEAR) &&
        (!picnic.object.visible || Math.hypot(x - picnic.object.position.x, z - picnic.object.position.z) > picnic.reach() + PLAY_CLEAR) &&
        (!roadside.islandTrunk || Math.hypot(x - roadside.islandTrunk.at.x, z - roadside.islandTrunk.at.z) > roadside.islandTrunk.radius + PLAY_CLEAR) &&
        (!islandFireModel.visible || Math.hypot(x - islandFireAt.x, z - islandFireAt.z) > 0.5 * islandFireLook.size + PLAY_CLEAR) &&
        roadside.islandBushes.every((bush) => Math.hypot(x - bush.x, z - bush.z) > ISLAND_BUSH_KEEP * bush.width + PLAY_CLEAR),
    },
    goslingSize,
  )
  scene.add(islandGeese.object)
  return {
    waterLook, water, pond,
    nest, nestLook, nestLeaves, nestNeedles, layNest,
    islandFireLook, islandFireModel, layIslandFire,
    tent, picnic, islandTree, layIslandTree, islandGeese,
    /** The island's bonfire a frame on, `firesLeft` of its night's light. */
    bonfireFrame(newBeat: boolean, firesLeft: number) {
      const stop = look.stopMotion
      // The island's bonfire, always lit while it shows, its lamp with it.
      const lit = islandFireModel.visible
      islandFireFlame.object.visible = look.flame.enabled && lit
      islandFireLamp.color.setHex(fireLook.lamp)
      islandFireLamp.intensity = lit ? islandFireLook.intensity * firesLeft : 0
      islandFireLamp.distance = islandFireLook.reach
      islandFireLamp.position.set(islandFireAt.x, islandFireAt.y + (CAGE_FIRE_LIGHT.height ?? 0) * islandFireLook.size, islandFireAt.z)
      if (islandFireFlame.object.visible) {
        const own = fireLooks.cage
        const { size, flame: flameSize } = islandFireLook
        islandFireFlame.set({ ...look.flame, height: own.height * flameSize, width: own.width * flameSize, glow: fireLook.glow, lean: 0 })
        if (!stop.enabled || newBeat) islandFireFlame.shape((channel) => beats.flameDraw(channel + 7 * (sceneFires.length + pitFires.length + 2)), 0, 0)
        islandFireFlame.place(sceneFireFoot.set(islandFireAt.x, islandFireAt.y + own.foot * size, islandFireAt.z))
      }
    },
  }
}
