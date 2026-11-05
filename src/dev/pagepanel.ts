// The panel (panel.ts) on the page's own parts: every folder's look, and what each change lays again.
import { type Settings, type Look, type GooseFeel } from '../settings'
import { type Tuning, shoreLight } from '../swarm/swarm'
import { Rats } from '../swarm/rats'
import { GoosePlay, type FireScene } from '../game/gooseplay'
import { type PlaySwarm } from '../swarm/play'
import { createZoneRings } from '../world/zonerings'
import { type DarkLook } from '../look/post'
import { createOpeningShow } from '../ui/openingshow'
import { type PondLook } from '../world/pond'
import { createPondWorld } from '../world/pondworld'
import { type Roadside } from '../world/roadside'
import { type PlainFires } from '../light/plainfires'
import { type GroundFloor, type BedLook, type RoadLook, type WellGroundLook } from '../world/ground'
import { rollingGround, type RollingLook, rollAgain } from '../world/rolling'
import { type Plain } from '../world/plain'
import { type RoadShape } from '../world/road'
import { type GoslingSpeeds } from '../characters/goslings'
import { defaultFireShadowLook } from '../light/fireshadow'
import { createGooseScenes, RIGHT_WING } from '../game/goosescenes'
import { type TiltShift } from '../look/tiltshift'
import { createPanel } from './panel'
import { copyInto, FLOOR_LOOKS } from '../look/startinglook'
import { type DeadTreeShape } from '../world/deadtrees'
import { GOOSE_CAMERA_KEPT, CAMERA_FOV, type GooseView } from '../game/gooseview'
import { url } from '../game/address'

/** The parts of the page the panel's folders edit. */
export interface PageParts {
  settings: Settings
  tuning: Tuning
  look: Look
  capacity: number
  rats: Rats
  RAT_RADIUS: number
  torchChanged: () => boolean
  lookChanged: () => void
  shadowsChanged: () => void
  runTuning: GoosePlay<PlaySwarm>['runTuning']
  level: GoosePlay<PlaySwarm>['level']
  goosePlay: GoosePlay<PlaySwarm>
  zoneRings: ReturnType<typeof createZoneRings>
  darkLook: DarkLook
  feel: GooseFeel
  openingShow: ReturnType<typeof createOpeningShow>
  pondLook: PondLook
  pondWorld: Awaited<ReturnType<typeof createPondWorld>>
  roadside: Roadside
  fires: PlainFires
  ground: GroundFloor
  pondWater: (look: PondLook) => ReturnType<typeof shoreLight>
  bedLook: BedLook
  gooseGround: ReturnType<typeof rollingGround>
  goosePlain: Plain
  pondPlace: { x: number; z: number; widest: number }
  rollingLook: RollingLook
  roadShape: RoadShape
  roadLook: RoadLook
  goslingSpeeds: GoslingSpeeds
  goslingSize: { height: number }
  pitLight: number
  fireShadowLook: ReturnType<typeof defaultFireShadowLook>
  gooseScenes: Awaited<ReturnType<typeof createGooseScenes>>
  wellGroundLook: WellGroundLook
  view: GooseView
  tilt: TiltShift | undefined
}

/** The panel on `parts`. */
export function mountPagePanel({ settings, tuning, look, capacity, rats, RAT_RADIUS, torchChanged, lookChanged, shadowsChanged, runTuning, level, goosePlay, zoneRings, darkLook, feel, openingShow, pondLook, pondWorld, roadside, fires, ground, pondWater, bedLook, gooseGround, goosePlain, pondPlace, rollingLook, roadShape, roadLook, goslingSpeeds, goslingSize, pitLight, fireShadowLook, gooseScenes, wellGroundLook, view, tilt }: PageParts) {
  const { waterLook, water, pond, nest, nestLook, nestLeaves, nestNeedles, layNest, islandFireLook, layIslandFire, tent, picnic, islandTree, layIslandTree, islandGeese } = pondWorld
  const { arches, archLook, archStone, archShell, archesChanged, archesShell, layArches, roadWalls, roadWallLook, wallStone, wallShell, layWalls, deadTreesMesh, deadTreeLook, deadTreeShape, deadTreeShine, deadTreeBark, deadTreeGrass, deadTreeLeaves, deadTreeWind, leavesFallAsTrees, layTrees, bushesMesh, bushLook, bushShape, bushLeaves, layBushes, gooseSee, gooseSeeLook, layRoad } = roadside
  const { fireLook, fireLooks, pitFireLook, crownFireLook, trunkFireLook, footFireLook, branchLook, burningBranch } = fires
  /** A scene's fire as its folder edits it: its reach, which holds the rats off; its flame the flames folder's, its zone the interaction zones folder's. */
  function sceneFirePanel(kind: FireScene) {
    return { reach: goosePlay.settings.fireReach, kind }
  }
  return createPanel(settings, tuning, look, capacity, {
  count() {
    // Sent with the next frame's input; the swarm grows at the arena's edge, so the rats on screen stay where they are.
  },
  size() {
    // The rat is drawn at its size, and collides as a disc that size times
    // the spacing: the swarm keeps bigger, or more spaced, rats further apart.
    rats.setSize(settings.size)
    rats.setSizeBySpeed(settings.sizeBySpeed)
    tuning.ratRadius = RAT_RADIUS * settings.size * settings.spacing
  },
  speeds() {
    tuning.minSpeed = settings.minSpeed
    tuning.maxSpeed = settings.maxSpeed
    tuning.fleeMinSpeed = settings.fleeMinSpeed
    tuning.fleeMaxSpeed = settings.fleeMaxSpeed
  },
  animation() {
    rats.setSpeed(settings.runAnimation)
  },
  light() {
    if (torchChanged()) lookChanged()
  },
  shadows: shadowsChanged,
  look: lookChanged,
  floor() {
    copyInto(look.floor, FLOOR_LOOKS[look.floor.texture])
  },
}, {
  tuning: runTuning,
  level,
  // The goose game's dark, and its rats' seed: a new seed sets the rats down afresh, the page loaded again on it.
  goose: {
    settings: goosePlay.settings,
    refillZones: zoneRings.zones,
    dark: darkLook,
    feel,
    introLight: openingShow.introLight && openingShow.introLightLook,
    // The pond folder lays the pond again on every change.
    pond: { look: pondLook, changed: () => {
        pond.set(pondLook)
        layNest()
        tent.set(pondLook)
        picnic.set(pondLook)
        layIslandTree()
        layIslandFire()
        // The trees and bushes out of the water as it lies now, its own woods round it.
        layTrees()
        ground.setWaterLevel(pondLook.water)
        goosePlay.setWater(pondWater(pondLook))
      }, water: waterLook, waterChanged: () => water.set(waterLook), bed: bedLook, bedChanged: () => ground.setBed(bedLook), nest: { look: nestLook, changed: layNest, needles: nestNeedles, needlesChanged: () => nest.setNeedles(nestNeedles), leaves: nestLeaves, leavesChanged: () => nest.setLeaves(nestLeaves) }, tree: { look: islandTree.look, changed: layIslandTree, woodChanged: islandTree.woodChanged, leavesChanged: islandTree.leavesChanged, windChanged: islandTree.windChanged, fallChanged: islandTree.fallChanged, barkChanged: islandTree.barkChanged, grassChanged: () => islandTree.setGrass(look.floor) }, tent: { look: tent.look, changed: () => tent.set(pondLook), recolour: tent.recolour, shineChanged: tent.shineChanged }, picnic: { look: picnic.look, changed: () => picnic.set(pondLook), shineChanged: picnic.shineChanged }, bonfire: { look: islandFireLook, changed: layIslandFire }, geese: islandGeese.look },
    // The ground folder lays the plain's swells again on every change: the grid in place, the rats' copy, the floor.
    ground: { look: rollingLook, changed: () => {
        rollAgain(gooseGround, goosePlain, pondPlace, rollingLook)
        rats.groundChanged()
        pond.set(pondLook)
        // The arches and the walls stood on the ground as it rolls now.
        arches.set(archLook)
        roadWalls.lay(roadside.wallsLaid)
        layTrees()
      }, arches: { look: archLook, changed: archesChanged } },
    // The doors, the road's arches: their stone and their own toon shell.
    doors: { stone: archStone, stoneChanged: () => arches.setStone(archStone), shell: archShell, shellChanged: archesShell },
    // The walls beside the road: their kind, number, place and size, laid again on every change; their stone and toon shell.
    walls: {
      look: roadWallLook,
      changed: layWalls,
      stone: wallStone,
      stoneChanged: () => roadWalls.setStone(wallStone),
      shell: wallShell,
      shellChanged: () => roadWalls.setShell(wallShell),
    },
    // The dead trees: shown or not and their wood, and how they are scattered, again on every change.
    trees: {
      look: deadTreeLook,
      shape: deadTreeShape as DeadTreeShape,
      changed: layTrees,
      woodChanged: () => deadTreesMesh.setWood(deadTreeLook.wood, deadTreeLook.saturation),
      yChanged: () => deadTreesMesh.object.position.setY(deadTreeLook.y),
      trunkChanged: () => {
        deadTreesMesh.setTrunk(deadTreeLook.trunk)
        deadTreesMesh.setRings(deadTreeLook.rings)
      },
      bark: deadTreeBark,
      barkChanged: () => deadTreesMesh.setBark(deadTreeBark),
      grass: deadTreeGrass,
      grassChanged: () => deadTreesMesh.setGrass(deadTreeGrass, look.floor),
      leaves: deadTreesMesh.leaves ? deadTreeLeaves : undefined,
      leavesChanged: () => {
        deadTreesMesh.setLeaves(deadTreeLeaves)
        leavesFallAsTrees()
      },
      wind: deadTreeWind,
      windChanged: () => deadTreesMesh.setWind(deadTreeWind),
      shine: deadTreeShine,
      shineChanged: lookChanged,
    },
    // The bushes: shown or not and their leaves, and how they are scattered, again on every change.
    bushes: {
      look: bushLook,
      shape: bushShape as DeadTreeShape,
      changed: layBushes,
      leaves: bushLeaves,
      leavesChanged: () => bushesMesh.setLeaves(bushLeaves),
      yChanged: () => {
        bushesMesh.object.position.setY(bushLook.y)
      },
    },
    // The goslings' clip speeds, read live.
    goslings: goslingSpeeds,
    // Their height, read live.
    goslingSize,
    // The old road: its way laid again on a change, its look read live.
    road: {
      shape: roadShape,
      shapeChanged: layRoad,
      look: roadLook,
      changed: () => ground.setRoadLook(roadLook),
      arches: { look: archLook, countChanged: layArches },
    },
    // How far the spawn's brazier holds the rats off, if the plain starts by one.
    spawn: pitLight < 0 ? undefined : goosePlay.settings,
    // The burning branch's colours, lying or carried as his torch.
    branch: burningBranch && {
      colours: branchLook,
      changed: () => burningBranch.setColours(branchLook),
    },
    // Every fire's own size, place and lamp, in the flames folder with the look they share, read live.
    fires: {
      look: fireLook,
      shadows: { look: fireShadowLook },
      each: [
        { name: "dead tree's brazier", look: fireLooks.tree, lamp: true, offset: true },
        { name: "cage's campfire", look: fireLooks.cage, lamp: true, offset: true },
        { name: 'fire pit', look: pitFireLook, lamp: true },
        { name: 'burning tree crown', look: crownFireLook, lamp: true },
        { name: 'burning tree trunk', look: trunkFireLook },
        { name: 'burning tree foot', look: footFireLook },
      ],
    },
    // The well's colours, a material at a time.
    well: { colours: gooseScenes.wellColours, glows: gooseScenes.wellGlows, changed: gooseScenes.wellChanged, bucket: gooseScenes.bucketOffset, fire: goosePlay.settings.wellFire, reach: goosePlay.settings, ground: { look: wellGroundLook, changed: () => ground.setWellGround(wellGroundLook) }, shine: { look: gooseScenes.wellShine, changed: lookChanged }, pit: { look: gooseScenes.pitLook, changed: gooseScenes.pitChanged, shine: gooseScenes.pitShine, shineChanged: lookChanged } },
    // The dead tree's colour, size and perch, read live; where he calls its gosling down, and where the gosling lands; its brazier's
    // place, its flame and lamp, where he fills his torch at it and how far it holds the rats.
    tree: { look: gooseScenes.tree, jump: goosePlay.settings, fire: { at: goosePlay.settings.treeFire, ...sceneFirePanel('tree') } },
    // The cage: where he opens it, where its key lies by the body and where he picks it up; its campfire's place and lamp's strength,
    // where he fills his torch at it and how far it holds the rats.
    cage: { hold: goosePlay.settings, key: { beside: goosePlay.settings.keyBeside, inWing: gooseScenes.keyInWing, bones: RIGHT_WING }, fire: { at: goosePlay.settings.cageFire, ...sceneFirePanel('cage'), lamp: fireLooks.cage }, look: gooseScenes.cage, colours: { colours: gooseScenes.cageColours, glows: gooseScenes.cageGlows, changed: gooseScenes.cageChanged }, shine: { cart: gooseScenes.cartShine, skull: gooseScenes.skullShine, changed: lookChanged }, wood: { look: gooseScenes.cartWood, changed: gooseScenes.cartWoodChanged } },
    // The see-through round him: its hole and its noise, read live.
    seeThrough: { look: gooseSeeLook, changed: () => gooseSee.set(gooseSeeLook) },
    // The camera: its follow's lag; where it is from him, captured to the clipboard and kept for the next load.
    camera: { follow: view.cameraFollow, lens: view.gooseLens, capture: () => view.captureGooseCamera(), forget: () => localStorage.removeItem(GOOSE_CAMERA_KEPT) },
    reseed(seed) {
      url.set('seed', String(seed))
      location.search = url.toString()
    },
  },
}, tilt && {
  shift: tilt,
  // The diorama's camera put in place, or the kept one back, as the tilt's folder moves it or turns it off.
  placed() {
    view.setGooseCamera(view.kind, false)
    view.gooseLens.fov = view.keptGooseCamera()?.fov ?? CAMERA_FOV
    view.controls.update()
  },
})
}
