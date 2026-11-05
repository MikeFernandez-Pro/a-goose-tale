// A Goose Tale: a swarm of rats held off by a light (ADR-0044). The goose, the torch in his beak, crosses the night
// plain one way on the route
// saved in gooseroute.json (plain.ts), from brazier to brazier to the pond, played by the goose play
// (gooseplay.ts), which the page feeds the keys and draws: his goslings waiting at the braziers and in his circle,
// as the goose in miniature (goslings.ts), and the pond, a hollow in the floor inside a noisy shore (pond.ts).
// The swarm steps at a fixed rate, on the GPU on WebGPU and in a worker on WebGL 2 (ADR-0053); each frame the
// crowd stands every rat where the swarm had it a step ago, between two steps. The run (run.ts), the play's own,
// holds the torch: it burns down and a fire refills it. The swarm is handed the torch and the lights as the run
// has them. Each light's lit area is worked out on the page for the drawing and the GPU step, and in the worker
// for its own (ADR-0054).
import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  type NodeMaterial,
  type Object3D,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  Timer,
  Vector2,
  Vector3,
} from 'three/webgpu'
import { int, pointShadow, uniform } from 'three/tsl'
import { loadVAT } from 'three-vat'
import { getMaxTextureSize, type VATTimeUniform } from 'three-vat/tsl'
import { benchOn, debugOn, featureOn, filming, noPanel, phone, post0, url } from './game/address'
import { FLOOR_LOOKS, GOOSE_EYES, copyInto, measuringSwitches, startingLook } from './look/startinglook'
import { createPost, defaultDark, leaveUnshaded } from './look/post'
import { DEATH_DOWN } from './characters/goosedeath'
import { defaultBedLook, defaultRoadLook, defaultWellGroundLook, floor } from './world/ground'
import { defaultRoadShape } from './world/road'
import { type DeadTreeShape } from './world/deadtrees'
import type { GooseFeel, Settings } from './settings'
import { lightAndPause } from './ui/lightandpause'
import type { PlaySwarm } from './swarm/play'
import { PipelineSlices } from './look/pipelineslices'
import { GoosePlay, MOST_BITERS, eased, inZone, type FireScene, type SceneState, type Zone } from './game/gooseplay'
import { createGoslingBadge, mountBadgeControls } from './ui/goslingbadge'
import { createGoslings, defaultGoslingSpeeds, GOSLING_HEIGHT } from './characters/goslings'
import { layPieces, BURNING_LIGHT, CAGE_FIRE_LIGHT, PIT_LIGHT, RIGHT_WING, spawnTree, TREE_FIRE_LIGHT, TREE_LIGHT, WELL_LIGHT, createGooseScenes, type EditPiece } from './game/goosescenes'
import { besideOf, createHoldHint, promptedOf, type PadButton, padBeside } from './ui/holdhint'
import { BUTTON_RADIUS, STICK_REACH, touchLayout } from './ui/goosetouch'
import { createGooseSounds, type Loop as SoundLoop } from './sound/goosesounds'
import { createGooseMusic } from './sound/goosemusic'
import { callAt, createCallHint, createPeepWords, type CallAt } from './ui/callhint'
import { FURTHEST, defaultPondLook, islandMiddle, islandShoreAt, shoreAt, standingIn, swimmingIn, widestShore, type PondLook } from './world/pond'
import { OUTRO, goslingOf, outroDue, peepsOf } from './game/gooseoutro'
import { ROUTE, WADE, keptShown, laid, toSave, type Plain, type Route } from './world/plain'
import { defaultRollingLook, rollAgain, rollingGround } from './world/rolling'
import { createLights, litMask, type LightLook } from './light/lights'
import { LitAreas } from './swarm/litareas'
import { seenTexture } from './swarm/seen'
import { Walls } from './swarm/walls'
import { RAT, Rats } from './swarm/rats'
import { createGoose } from './characters/goose'
import { createFlame } from './light/flame'
import { createEmbers } from './light/embers'
import { createFeathers } from './characters/feathers'
import { createSmoke } from './light/smoke'
import { defaultTuning, shoreLight, sightEdge, type Dark, type FixedLight, type Ground, type Light } from './swarm/swarm'
import { createTiltShift } from './look/tiltshift'
import { createFallingLeaves, defaultFallLook, mountFallControls } from './world/fallingleaves'
import { createFakeLamps, shown as drawnInScene } from './light/fakelamps'
import { createFireShadow, defaultFireShadowLook } from './light/fireshadow'
import type { BenchCost, BenchPlace, PhoneBench } from './dev/phonebench'
import { keptRun, keepRun } from './game/keptrun'
import { CROWD, LIGHT_SPEED, RAT_SPEEDS, SIZE_BY_SPEED } from './game/gameplay'
import { CHAT, INTRO, cowering, litShare, ratsOut, rumbleAt, startled } from './game/gooseintro'
import { RemoteSwarm } from './swarm/swarm-remote'
import { createBeats } from './game/beats'
import { createDrawing } from './look/drawing'
import { ladder, startingStep, Quality, PHONE_SLOW_FRAME } from './look/quality'
import { createSkyFog } from './look/skyfog'
import { createNightLights } from './light/nightlights'
import { createOpening } from './game/opening'
import { createOpeningShow } from './ui/openingshow'
import { createEnding } from './game/ending'
import { createGooseInput, DIAL, DIAL_RATE } from './ui/gooseinput'
import { createPauseVeil } from './ui/pauseveil'
import { CAMERA_FOV, fitToPage, createGooseView, GOOSE_CAMERA_KEPT, type GooseCamera } from './game/gooseview'
import { createRoadside } from './world/roadside'
import { createPlainFires } from './light/plainfires'
import { createPondWorld } from './world/pondworld'
import { MOST_FRAME, GpuSwarm } from './swarm/gpuswarm'

/** How fast the light walks under `?film`, m/s: a take covers more ground in its few seconds. */
const FILM_LIGHT_SPEED = 2
/** The count's top, where the device's textures allow it: a playback row a rat. */
const MAX_RATS = 16384
const SEED = 7
/** The developer's page's tools, fetched on that page alone. */
const dev = debugOn ? await import('./dev/devtools') : undefined
/** The light's height above the ground where its holder carries it, when it is not in the torch. */
const LIGHT_HEIGHT = 1.1
/**
 * The most game time a frame carries, s: as much as the swarm can catch up in one, so that on a slow phone he keeps the
 * rats' pace, and a hitch moves the light, the clock and the camera no further.
 */
const FRAME_CAP = MOST_FRAME
/** How far past the goose game's plain the floor runs, m: out of sight in the fog from anywhere he can stand. */
const FLOOR_PAST = 20
/** How far past the fog's far edge the swarm may set a rat down, m, before the walk's own margin: a rat's length at the panel's usual scale, and the placing step's run. */
const DARK_MARGIN = 0.5

const { look, gooseTheme } = startingLook()
const beats = createBeats(look.stopMotion)

// ---------------------------------------------------------------- renderer
const { renderer, backend, lean, moon, maxDpr, timestamps, benchTools, gpuQueue, allBuilt } = await createDrawing()
const camera = new PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, 0.1, 100)
const scene = new Scene()
const skyFog = createSkyFog(scene, camera)
fitToPage(camera, renderer)

const nightLights = createNightLights(scene, moon)
const { sun, lamp } = nightLights

// The goose game's pond bed: the floor gives way to sand down its bank (ground.ts), as the pond folder's bed edits it.
const bedLook = defaultBedLook()
// And the ground under its wells, fading into the dirt round each, as the well folder's texture edits it.
const wellGroundLook = defaultWellGroundLook()
// And the old road up the plain from fire to fire, in stone (road.ts), as the road folder edits its way and its look.
const roadShape = defaultRoadShape()
const roadLook = defaultRoadLook()
// `?groundcut=wells,bed,noise,hue,strokes,normals`: what the bench prices of the floor's shader, each left out of it.
const groundCut = new Set(url.get('groundcut')?.split(','))
const ground = await floor(look.floor.texture, {
  slopes: true,
  bed: groundCut.has('bed') ? undefined : bedLook,
  wellGround: groundCut.has('wells') ? undefined : wellGroundLook,
  road: roadLook,
  cut: groundCut,
  // `?groundzones=0` and `?noisemap=0` for the bench to price them.
  zones: lean && moon === 'none' && url.get('groundzones') !== '0',
  noiseMap: lean && url.get('noisemap') !== '0',
})
// Starting by the burning tree's branch, he carries no torch of his own: the branch, picked up, is his torch.
/** The burning branch, where the route lays one, held by its butt in his bill: out to his right, forward and up, under half as long as he is tall, a fifth of it back past his bill. */
const BRANCH_HELD = { way: [-0.75, 0.42, 0.5], length: 0.4, behind: 0.2 } as const
const goose = await createGoose(ROUTE.start.branch !== undefined ? { torchless: BRANCH_HELD } : {})
scene.add(goose.object)
// The panel starts the goose's parts at the colours its character or its file has.
look.goose.parts = goose.parts.map((part) => ({ ...part }))
const flame = createFlame()
scene.add(flame.object)
const embers = createEmbers()
scene.add(embers.object)
// Feathers a bite knocks off him (biteFrame).
const feathers = createFeathers()
scene.add(feathers.object)
// The smoke: a trail of the flame's tip, in the world as the embers are.
const smoke = createSmoke()
scene.add(smoke.object)
// None of the torch casts a shadow, and all of it is unshaded: the flame is light,
// and darkens nothing round it by its occlusion; and the occlusion and the outlines of what stands behind it are not drawn over it.
for (const torch of [flame.object, embers.object, smoke.object]) {
  torch.traverse((o) => {
    o.castShadow = false
    if ((o as Mesh).isMesh) leaveUnshaded((o as Mesh).material as NodeMaterial)
  })
}
/** Where the torch's end and its flame's light are, this frame. */
const torchEnd = new Vector3()
/** Where the torch rests this frame, the head's sway left out: the swarm's light stands there. */
const torchRest = new Vector3()
const flameAt = new Vector3()
const flameTip = new Vector3()
const flameOffset = new Vector3()
scene.add(ground.mesh)
// The frame goes through one scene pass and the effects after it: the ambient occlusion under its fog, the outlines, the palette.
// With `?tilt` (the goose game's default), the tilt-shift: the depth of field's blur by a band across the screen (tiltshift.ts).
const tilt = featureOn('tilt') ? createTiltShift() : undefined
// With the tilt, the depth of field off as the page opens: the tilt's band is the blur (the dof folder still turns it on).
if (tilt) look.dof.enabled = false
const post = createPost(renderer, scene, camera, { color: skyFog.onScreen, amount: skyFog.amount }, tilt, lean)

// ---------------------------------------------------------------- swarm
const tuning = defaultTuning()
// The game's crowd (gameplay.ts).
Object.assign(tuning, CROWD)
/** How far off the goose game's rats notice him, m: short of every theme's fog, so the rats further off are seen wandering.
 * 6 since 2026-10-29 (4.5 from 2026-10-27), set from the rats' pull folder. */
const GOOSE_NOTICE = 6
// The goose game's rats notice him within GOOSE_NOTICE m, his goslings drawing them from as far as he does, each running
// at the nearest of them; the rats further off ignore him and run about at their own pace, bending back his way only as they
// roam more than 16 m past that (2026-10-26).
Object.assign(tuning, { notice: GOOSE_NOTICE, wander: 1, roam: 16 })
// The goose game's rats pile up a fifth of a rat's height since 2026-11-02 (a whole one from 2026-10-29); and since
// 2026-10-25 they lunge and weave, softly, a harder lunge reading too
// aggressive here; a little more since 2026-10-26: about once in 3.5 s each, at 2.1 times its pace
// for 0.13 s, swerving up to 0.4 rad.
Object.assign(tuning, { pull: tuning.notice, pile: 0.2, dashRate: 1 / 3.5, dashSpeed: 2.1, dashTime: 0.13, weave: 0.4 })
// The goose game's rats quick to answer since 2026-10-29, the calmer answer of 2026-10-25 read
// as too tame; but still no bolt at once, from the light or into a lunge.
Object.assign(tuning, { reaction: 0.25, turnRate: 10, fleeReaction: 0.3, fleeTurn: 1.5 })
/** The collision disc at the usual size: the rat scale and the spacing multiply it. */
const RAT_RADIUS = tuning.ratRadius
const maxTextureSize = getMaxTextureSize(renderer)
/** The count's top: 16,384, or what this device's textures hold. */
const capacity = Math.min(MAX_RATS, maxTextureSize)
/** The goose game's rats to start, 100 since 2026-11-02, more coming with each gosling found: ?rats=N asks for others. */
const GOOSE_RATS = 100
// The goose game's rats as set from the panel on 2026-10-26: quicker to come on, and quicker still from the light, bigger; bigger again, 2.2, since 2026-10-29, and spaced 1.2 the same day (1.8 read as too tame).
const GOOSE_SPEEDS = { minSpeed: 3, maxSpeed: 4, fleeMinSpeed: 4, fleeMaxSpeed: 4.5 }
const GOOSE_RAT_SIZE = 2.2
const GOOSE_SPACING = 1.2
/** How far off the goose game's rats out of view come round from, m, with no fog to hide them nearer, set on 2026-10-26. */
const GOOSE_ROUND_PAST = 30
/** The count the address asks for, ?rats=N: zero included. */
const askedRats = Math.round(Number(url.get('rats') ?? GOOSE_RATS))
// The start, saved from the panel on 2026-10-05: the game's rats, their size and speeds (gameplay.ts), each as
// big as it is fast, a dim light that walks as fast as they run, and the run played at the rat's own pace.
const settings: Settings = {
  rats: Math.min(Math.max(Number.isNaN(askedRats) ? GOOSE_RATS : askedRats, 0), capacity),
  ...RAT_SPEEDS,
  ...GOOSE_SPEEDS,
  size: GOOSE_RAT_SIZE,
  sizeBySpeed: SIZE_BY_SPEED,
  spacing: GOOSE_SPACING,
  on: true,
  // The debug keys on the developer's page, and in a take, which the keys run.
  debug: debugOn || url.has('film'),
  shadows: url.has('shadows'),
  runAnimation: 1.7,
  lightSpeed: url.has('film') ? FILM_LIGHT_SPEED : LIGHT_SPEED,
  paused: false,
  bringRound: true,
  // The goose game's rats come round from out of the camera's view or past GOOSE_ROUND_PAST m, the fog nearer where it is on.
  roundPast: GOOSE_ROUND_PAST,
  // ?nocharacter starts with the character hidden, its torch, flame, embers and smoke with it, as the panel's toggle does.
  character: !url.has('nocharacter'),
}
/**
 * How he feels to play (the panel's feel folder, GooseFeel): his walk all but at the keys' pace, or stopped, in
 * `inertia` s, `?inertia=` to start at another; and a rat's bite on him, the pained honk, `?bite=hiss` to start with
 * the hiss. Pushed past real, as the game is drawn: a long red flash, the camera snapped and springing back, the
 * edges closing in dark red.
 */
const askedInertia = Number(url.get('inertia'))
const feel: GooseFeel = {
  inertia: url.has('inertia') && askedInertia >= 0 ? askedInertia : 0.15,
  bite: { sound: url.get('bite') === 'hiss' ? 'hiss' : 'honk', gap: 0.7, lasts: 0.22, squash: 0.12, flash: 1.2, flashColour: 0xfe9590, flashLasts: 0.45, edge: 0.55, edgeColour: 0x5d0909, knock: 0.16, knockLasts: 0.4 },
  feathers: { look: feathers.look, changed: () => feathers.set() },
  // His death (goosedeath.ts) as made; the dark's timing follows it.
  death: { speed: 1, changed: () => deathTimed() },
  // Its flight into his wing is the scenes', handed over once they are made.
  key: { taken: undefined, peep: 0.8, peepAfter: 0.3 },
  lean: { from: 5, near: 1.5, pull: 0.35, most: 0.9, ease: 0.8, low: true },
  torch: { low: 0.3, gutter: 1.5, dips: 0.6, thin: 0.5, rise: 0.4, flare: 0.9, reach: 0.25, flareLasts: 0.7, pop: 0.45, popLasts: 0.45, sparks: 16, sparkSpeed: 2.4, knock: 0.05, knockLasts: 0.35 },
  // Small, a fifth of the opening's strike; over as its sound all but is, the rumble played an octave down.
  rumble: { shake: 0.03, lasts: 4 },
}
tuning.minSpeed = settings.minSpeed
tuning.maxSpeed = settings.maxSpeed
tuning.fleeMinSpeed = settings.fleeMinSpeed
tuning.fleeMaxSpeed = settings.fleeMaxSpeed
tuning.ratRadius = RAT_RADIUS * settings.size * settings.spacing

// ---------------------------------------------------------------- run
// The ground each light sees against the walls: worked out here for the drawing, and on WebGPU read by the
// swarm's step from the same texture. The worker works out its own the same way. Its walls are the level's,
// once there is one.
const areas = new LitAreas(new Walls([]))
const seen = seenTexture(areas)
const vat = await loadVAT(RAT.url)
const time: VATTimeUniform = uniform(0)
/** The goose game's plain as its play lays it, known before the play is, so the rats can be made on its ground. */
const goosePlain = laid(ROUTE)
/** How far the pond was moved by hand from where it falls past home, m (the pond folder's, 2026-10-29; z 2026-10-30). */
const POND_MOVED = { x: 3.37, z: -0.7 }
/** How far off the island's waterline the 6 debug key stands him, m. */
const ISLAND_BY = 1
// The goose game's pond, as the pond folder edits it: past the last brazier, at the end of the route, the water the
// rats are held off.
const pondLook = pondPastHome(goosePlain)
/**
 * The pond drawn where the plain has it, past the last brazier: on along the last leg, its shore toward him WADE short
 * of home, so he is home as he wades in. The drawn pond is wider than the play's, so it lies further on.
 */
function pondPastHome(p: Plain): PondLook {
  const look = defaultPondLook(p.pond)
  const way = Math.atan2(p.pond.z - p.home.z, p.pond.x - p.home.x)
  const reach = shoreAt(look, way + Math.PI) - WADE
  // Its island's shore turned across his way.
  const island = { ...look.island, turn: (way * 180) / Math.PI + 90 }
  return { ...look, x: p.home.x + Math.cos(way) * reach + POND_MOVED.x, z: p.home.z + Math.sin(way) * reach + POND_MOVED.z, island }
}
/** The box the goose game's floor is laid over: the plain's, and round the drawn pond at its widest shore, which lies on past the play's, FLOOR_PAST more. */
const gooseFloorBox = (() => {
  const b = goosePlain.bounds
  const r = pondLook.radius * FURTHEST
  return {
    minX: Math.min(b.minX, pondLook.x - r) - FLOOR_PAST,
    maxX: Math.max(b.maxX, pondLook.x + r) + FLOOR_PAST,
    minZ: Math.min(b.minZ, pondLook.z - r) - FLOOR_PAST,
    maxZ: Math.max(b.maxZ, pondLook.z + r) + FLOOR_PAST,
  }
})()
/** How the goose game's plain rolls, as the ground folder edits it; and where the pond is, flat round it. */
const rollingLook = defaultRollingLook()
const pondPlace = { x: pondLook.x, z: pondLook.z, widest: widestShore(pondLook) }
/** The goose game's rolling ground (rolling.ts) over its floor: what the floor is laid on, and the rats, the goose and the scenes stand on. */
const gooseGround = rollingGround(goosePlain, pondPlace, gooseFloorBox, rollingLook)
// Leaves falling round him, to the rolling ground (fallingleaves.ts), with a panel of their own.
const fallingLeaves = url.get('leaves') === '0' ? undefined : createFallingLeaves(gooseGround, defaultFallLook())
if (fallingLeaves) scene.add(fallingLeaves.object)
// On WebGPU the rats are culled and drawn on the GPU (ADR-0052); WebGL 2, or `?batch`, draws them as the batch.
const rats = new Rats(vat, RAT, capacity, maxTextureSize, time, settings.runAnimation, backend === 'WebGPU' && !url.has('batch') ? renderer : undefined, gooseGround)
// The rats' depth laid first, so each pixel is shaded for the nearest rat alone; `?prepass=0` shades them all, to measure against.
// A phone's GPU hides what lies behind by itself: there the pre-pass only cost, 0.8 ms at a pixel ratio of 3 (iPhone 15 Pro Max, 2026-11-02).
const prepassOn = url.has('prepass') ? url.get('prepass') !== '0' : !lean
rats.setPrepass(prepassOn)
// The swarm steps on the GPU where the GPU culls the rats (ADR-0053); in the worker on WebGL 2, under `?batch` or `?cpustep`.
const arenaScale = 1
const gpuCull = url.has('cpustep') ? undefined : rats.gpuCull
/** The page's swarm made on `ground`, the goose play's to set its rats down in and the page's to step. */
const playSwarm = (ground: Ground) =>
  (gpuCull ? new GpuSwarm(gpuCull, renderer, capacity, SEED, 0, arenaScale, undefined, ground, seen.texture) : new RemoteSwarm(capacity, SEED, 0, arenaScale, ground))
/**
 * The goose game, on its saved route, its rats the panel's budget and `?seed`'s, walking at the panel's pace. The
 * dead tree stands where the route has it, or `?tree=N` m ahead of his start.
 */
const treeAhead = Number(url.get('tree')) || null
const goosePlay = new GoosePlay<GpuSwarm | RemoteSwarm>(
  { rats: settings.rats, pace: settings.lightSpeed, seed: Math.round(Number(url.get('seed') ?? 1)) || 1, treeAhead, lastGuides: true },
  { tuning, swarm: playSwarm },
)
/** The ground's height under (x, z): the goose game's rolling plain. */
const groundAt = (x: number, z: number) => gooseGround.at(x, z)
/** How high he stands at (x, z): on the ground, down the pond's bank and into its water, afloat where it is too deep (pond.ts). */
const standAt = (x: number, z: number) => groundAt(x, z) + standingIn(pondLook, x, z, pondLook.goose)
/** Where he is heard from: his middle, where the play has him. */
const hisAt = () => {
  const { x, z } = goosePlay.holder
  return { x, y: standAt(x, z) + 0.4, z }
}
/** The goose game's sounds (goosesounds.ts): none in a take, or with `?mute`; M mutes them. */
const gooseSounds = !filming && !url.has('mute') ? createGooseSounds(camera) : undefined
/** Whether his torch has been full once: starting with it out, he lights it first, and no gosling peeps for him nor turns the camera till then. */
let torchFilled = false
const torchFilledOnce = () => (torchFilled ||= goosePlay.run.fuel >= 0.99)
/** The burning tree's light, where the plain starts by one. */
const pitLight = spawnTree(goosePlay.plain)

// The level and its rules, the goose play's. Its torch: it burns down, its light shrinking with the
// fuel in a straight line to nothing, and grows back as he fills it at a fire. A and E (Q and E on a QWERTY keyboard)
// turn its reach up and down; F gives it a light that never burns down, and puts it out again.
const level = goosePlay.level
const runTuning = goosePlay.runTuning
/** The run, the goose play's. */
const run = goosePlay.run
// The lit areas see every wall that stops the rats.
areas.setWalls(new Walls(run.walls()))
const opening = createOpening(goosePlay, spawnTree(goosePlay.plain))
/** The torch as the swarm reads it: where the holder is, its reach as a share of the swarm's full light, and lit. */
const light: Light = { x: run.holder.x, z: run.holder.z, strength: 0, on: false }
/** Hand the swarm the torch as the run has it, and the debug switch: true if it went out or was relit. */
function torchChanged(): boolean {
  const torch = run.torch
  light.x = torch.x
  light.z = torch.z
  light.strength = torch.reach / tuning.ringMax
  const on = torch.lit && settings.on
  if (on === light.on) return false
  light.on = on
  return true
}
torchChanged()
/**
 * The torch as the swarm and the lit areas read it: where the torch rests,
 * the head's sway left out; `light` stands at
 * the holder, for the walk, the camera and the fog. Its reach and its lit
 * are the torch's.
 */
const swarmLight: Light = { x: light.x, z: light.z, strength: 0, on: false }
/** The swarm's time, which the lights' flames lean at, in the drawing as in the step. */
const swarmTime = uniform(0)
/** The burning branch's light: its lamp alone, as low over the ground as it lies, the page burning its flame. */
const BRANCH_LIGHT: LightLook = { lampOnly: true, height: 0.35 }
// The dead tree burns bare, high on its trunk (#190), the well's light in its lantern, the brazier by the tree, after
// the braziers, on its own bowl, and the cage's over its campfire's logs: their lamps alone, the page burning the
// torch's flame on each.
const looks = goosePlay.level.lights.map((_, k) => {
  const b = goosePlay.plain.braziers[k]
  if (goosePlay.wellFires.some(({ light }) => light === k)) return PIT_LIGHT
  // The burning branch, lying on the ground, burns on its broken end, its lamp low over it.
  if (k === goosePlay.branch?.light) return BRANCH_LIGHT
  return b === undefined ? TREE_FIRE_LIGHT : k === spawnTree(goosePlay.plain) ? BURNING_LIGHT : b.scene === 'tree' ? TREE_LIGHT : b.scene === 'well' ? WELL_LIGHT : b.scene === 'cage' ? CAGE_FIRE_LIGHT : undefined
})
// The braziers and ghosts lit as fake lamps (fakelamps.ts): one loop in each lit shader, not a point light written out
// in each; the torch's lamp stays a point light.
const fakeLamps = createFakeLamps()
scene.add(fakeLamps)
// The braziers' lamps are not cut to their lit areas: the plain has no walls (see the torch's lamp below).
const lights = createLights(level.lights, seen.texture, swarmTime, level.start, { looks, groundAt, masked: false, lamps: fakeLamps })
scene.add(lights.object)
/** The pond's water as drawn, the swarm's to hold the rats off: its shore, as the pond folder last laid it. */
const pondWater = (look: PondLook) => shoreLight(look.x, look.z, (angle) => shoreAt(look, angle))
goosePlay.setWater(pondWater(pondLook))
// The goose game's goslings, afloat once out of their depth in the pond.
const goslingSpeeds = defaultGoslingSpeeds()
const goslingSize = { height: GOSLING_HEIGHT }
const goslings = await createGoslings(goosePlay, pondLook, goslingSpeeds, groundAt, goslingSize)
// The goose game's scenes: the well and the dead tree (#190).
const gooseScenes = await createGooseScenes(goosePlay, (x, z) => groundAt(x, z) + standingIn(pondLook, x, z, pondLook.goose))
scene.add(gooseScenes.object)
feel.key.taken = gooseScenes.keyTaken
// Its shell laid now, before the panel reads the cart's and the corpse's highlight and rim, which start as it.
gooseScenes.setShell(look.goose)
scene.add(goslings.object)
/** How far round a gosling's feet the camera's view must reach to draw him, m: the bird and his shadow on the ground. */
const GOSLING_SEEN = 1
const openingShow = createOpeningShow({ opening, goosePlay, goose, camera, renderer, gooseSounds, hisAt, fakeLamps, scene, standAt })
// The ground laid under each well, where the play stands it.
ground.setWells(goosePlay.scenes.filter((s) => s.kind === 'well'))
const roadside = await createRoadside({ scene, goosePlay, lights, fakeLamps, backend, renderer, groundAt, pondLook, gooseFloorBox, roadShape, roadLook, ground, look, gooseTheme, gooseScenes, fallingLeaves, dev })
const { graveyard, ghosts, graves, graveCandles, arches, archLook, archStone, archShell, archesChanged, archesShell, layArches, roadWalls, roadWallLook, wallStone, wallShell, layWalls, deadTreesMesh, deadTreeLook, deadTreeShape, deadTreeShine, deadTreeBark, deadTreeGrass, deadTreeLeaves, deadTreeWind, leavesFallAsTrees, layTrees, bushesMesh, bushLook, bushShape, bushLeaves, layBushes, gooseSee, gooseSeeLook, gooseSeeZone, cutSeenThrough, layRoad } = roadside
const fires = createPlainFires({ scene, goosePlay, pitLight, look, gooseTheme, lights, beats, standAt, groundAt, camera, opening, gooseScenes, goose, roadside, skyFog, nightLights, rats })
const { fireLook, fireLooks, pitFireLook, crownFireLook, trunkFireLook, footFireLook, branchLook, burningBranch, branchEmbers, branchFire, plainFlames, sceneFires, pitFires, crownFires, trunkFires, footFire, branchFlared } = fires
const pondWorld = await createPondWorld({ scene, nightLights, beats, ground, gooseFloorBox, pondLook, gooseGround, gooseScenes, fires, fakeLamps, goose, goslingSize, roadside, look })
const { waterLook, water, pond, nest, nestLook, nestLeaves, nestNeedles, layNest, islandFireLook, layIslandFire, tent, picnic, islandTree, layIslandTree, islandGeese } = pondWorld
const ending = createEnding({ goosePlay, pondLook, islandGeese, tent, look, waterLook, water, ground, deadTreesMesh, deadTreeGrass, islandTree, nightLights, light, gooseSounds, goose, camera, renderer })
// The bed under the pond's water takes less light, as deep as the water lies.
ground.setWaterLevel(pondLook.water)

/**
 * DEBUG: where things are done, as rings on the ground: orange, a flame's dip, or a scene's fire's zone, the interact
 * key held to fill the torch; red, where the interact key works a scene, the well's
 * winch, the dead tree's trunk, the cage and its key. `?zones`, or the run folder's switch.
 */
const refillZones = { show: url.has('zones') || url.has('refill') }

/**
 * His fall: his death played in the open over the dark folder's `after` s, then the dark closing over its `finish` s,
 * his torch dying under both, then black DARK_HELD s, then he wakes.
 */
const DARK_HELD = 0.3
/** Where in his death the dark starts closing, s: he is down on his side and the rats' first tug has jolted him. */
const DEATH_DARK_AT = DEATH_DOWN + 0.25
/** How his life's dark looks: the dark folder's. */
const darkLook = defaultDark()
/** His fall timed to his death as it plays now: the dark waits till he is down and tugged at, the rats tugging on under it. */
function deathTimed() {
  darkLook.after = Math.round((DEATH_DARK_AT / Math.max(feel.death.speed, 1e-3)) * 100) / 100
  goosePlay.settings.fall = { lasts: darkLook.after + darkLook.finish + DARK_HELD, dims: darkLook.after + darkLook.finish }
}
deathTimed()
const refillRings = new Group()
scene.add(refillRings)
const dipRing = new MeshBasicNodeMaterial({ color: 0xff8a2a, fog: false, depthWrite: false })
/** A flat ring `radius` m round, its band a few centimetres wide, in `material`. */
const refillRing = (radius: number, material: MeshBasicNodeMaterial) => {
  const ring = new Mesh(new RingGeometry(Math.max(0, radius - 0.05), radius, 64).rotateX(-Math.PI / 2), material)
  ring.renderOrder = 10
  refillRings.add(ring)
  return ring
}
const dipRings = level.lights.map(() => refillRing(1, dipRing))
const workRing = new MeshBasicNodeMaterial({ color: 0xff2a2a, fog: false, depthWrite: false })
const workRings = goosePlay.scenes.map(() => refillRing(1, workRing))
const keyRings = goosePlay.scenes.flatMap((s) => (s.kind === 'cage' ? [refillRing(1, workRing)] : []))
/** The rings where the torch is filled now: every lit flame's dip. */
function refillZonesFrame(placed: readonly FixedLight[]) {
  refillRings.visible = refillZones.show
  if (!refillZones.show) return
  placed.forEach((light, k) => {
    const ring = dipRings[k]!
    const own = level.lights[k]!
    ring.visible = own.flame && light.on
    if (!ring.visible) return
    const zone = goosePlay.dipZoneOf(k)
    ring.scale.set(zone.rx, 1, zone.rz)
    ring.position.set(zone.x, standAt(zone.x, zone.z) + 0.03, zone.z)
  })
  goosePlay.scenes.filter((s) => s.kind === 'cage').forEach((cage, c) => {
    if (cage.kind !== 'cage') return
    const { x, z, rx, rz } = goosePlay.keyZoneOf(cage)
    keyRings[c]!.scale.set(rx, 1, rz)
    keyRings[c]!.position.set(x, standAt(x, z) + 0.03, z)
  })
  goosePlay.scenes.forEach((s, k) => {
    const { x, z, rx, rz } = goosePlay.zoneOf(s)
    workRings[k]!.scale.set(rx, 1, rz)
    workRings[k]!.position.set(x, standAt(x, z) + 0.03, z)
  })
}

/** Where the see-through's hole is cut round: the holder, at its chest. */
const seeThroughAt = new Vector3()
// The torch's lamp lights only what the torch sees: its lamp's shadow is its lit area, the walls alone cutting it,
// its own falloff ending it. Under `?shadows`, the lamp's own cube of shadows as well. In the goose game no light but the
// sun casts or is cut (2026-10-21): the plain has no walls to cut a light, and the cut cost every rat's pixel a turn and
// two texture reads a light, about 1.2 ms of a 7 ms frame at 8,000 rats on a screen twice the pixels.
const torchCentre = uniform(new Vector2(light.x, light.z))
const torchSees = litMask(seen.texture, int(0), torchCentre, uniform(0), swarmTime)
lamp.castShadow = false
lamp.shadow.shadowNode = settings.shadows ? torchSees.mul(pointShadow(lamp) as unknown as Node<'float'>) : torchSees

/** The swarm, the goose play's, made on its ground (playSwarm). */
const swarm = goosePlay.swarm
// Their buffers freed when the page leaves for good, the step's with them; one kept for going back to holds them.
addEventListener('pagehide', (event) => {
  if (event.persisted) return
  rats.dispose()
  if (swarm instanceof GpuSwarm) swarm.dispose()
})
rats.setSize(settings.size)
rats.setSizeBySpeed(settings.sizeBySpeed)
scene.add(rats.object)
// The goose and his goslings shadow the fire he stands in, away from its flame, on the ground (fireshadow.ts): a
// projector's mask of them, drawn every frame, the floor's shader reading it.
const fireShadowLook = defaultFireShadowLook()
const fireShadow = moon === 'none' ? undefined : createFireShadow(renderer, fakeLamps, fireShadowLook, [ground.mesh])
const fireCasters = [goose.object, goslings.object]
const gooseMiddle = new Vector3()
/** The fire's shadow not drawn, and the share of the rats asked for: for `?bench` to price them. */
let fireShadowsHeld = false
let benchRatShare = 1
function layFireShadows(): void {
  if (!fireShadow || fireShadowsHeld) return
  goose.object.getWorldPosition(gooseMiddle)
  const ground = groundAt(gooseMiddle.x, gooseMiddle.z)
  gooseMiddle.y = ground + look.goose.height * 0.5
  fireShadow.update(drawnInScene(goose.object) ? fireCasters : [], gooseMiddle, look.goose.height, ground)
}
// The panel starts each part at the colour the model was made in.
look.rats.parts = rats.parts.map((part) => ({ ...part }))
for (const part of look.rats.parts) if (part.name === 'eyes') part.color = gooseTheme?.eyes ?? GOOSE_EYES

// ---------------------------------------------------------------- panel

/**
 * What the shadows were last drawn from: the swarm's places and its state,
 * the run's time, where the sun and the lamp stood; and whether the look
 * changed since. They are drawn again only when one of those moved, and only
 * on a frame a new state of the swarm came in: held, on the beat; smooth, at
 * the swarm's own rate whatever the screen's, a step at most behind their rats.
 */
const shadowed = { version: -1, steps: -1, held: Number.NaN, sun: new Vector3(Number.NaN), lamp: new Vector3(Number.NaN), at: -Infinity, dirty: true }
/** How often the shadows are drawn again while the intro holds the swarm, ms: as often as the swarm steps once it goes. */
const HELD_SHADOW_MS = 1000 / 60

/** Everything the look folders set, with this beat's variation where the stop motion asks for it; the lamp's reach also follows the light's strength. */
function lookChanged() {
  shadowed.dirty = true
  const stop = look.stopMotion
  const shade = (channel: number) => (stop.shadeWobble ? stop.shadeAmount * beats.vary(channel) : 0)
  rats.setBoil(stop.enabled && stop.boil ? stop.boilAmount : 0, stop.boilScale, beats.beat)
  const nudge = (channel: number) => (stop.strokeJitter ? stop.strokeAmount * beats.vary(channel) : 0)

  nightLights.set(look, light.on, beats.vary)
  skyFog.set(look.fog)

  rats.material.color.set(look.rats.color)
  rats.material.set(look.rats)
  rats.material.setToon(look.rats.toon)
  rats.material.setPaint(look.rats.paint)
  rats.material.setBeat(shade(5), nudge(6), nudge(7))
  look.rats.parts.forEach((part, i) => rats.setPartColor(i, part.color))
  rats.setVariants(look.rats.variants)
  rats.setGlow('eyes', look.rats.glow)
  rats.setLevels(look.rats.levels)
  // The far crowd's staggered steps: the swarm's tuning steps by them (the CPU step's alone), the rats tint by them.
  tuning.stagger = look.rats.stagger.n
  tuning.staggerFrom = look.rats.stagger.from
  rats.setStagger(look.rats.stagger)
  // The trails: on the beat a held frame's streak; smooth, a streak laid again every frame, and wiggling.
  rats.setTrails({ ...look.trails, wiggle: stop.enabled ? 0 : look.trails.wiggle })
  ground.set(look.floor)
  deadTreesMesh.setGrass(deadTreeGrass, look.floor)
  islandTree.setGrass(look.floor)
  ground.material.set(look.floor.shell)
  ground.material.setPaint(look.floor.paint)
  ground.material.setToon(look.floor.toon)
  goose.set(look.goose)
  // The goslings' down the goose's white, glowing as his does.
  const white = look.goose.parts.find((part) => part.glow !== undefined)
  if (white) goslings.setDown(white.color, white.glow!)
  if (white) islandGeese.setDown(white.color, white.glow!)
  // Their rim his.
  goslings.setRim(look.goose)
  islandGeese.setRim(look.goose)
  gooseScenes.setShell(look.goose)
  graves?.setShell(look.goose)
  graveCandles?.setShell(look.goose)
  tent.setShell(look.goose)
  picnic.setShell(look.goose)
  islandTree.setShell({ ...look.goose, ...deadTreeShine })
  // The dead trees in the scenes' shell, with a highlight and a rim of their own: none of either to start, matt since
  // 2026-10-26, the dead trees folder's to give them.
  deadTreesMesh.setShell({ ...look.goose, ...deadTreeShine })
  bushesMesh.setShell(look.goose)
  flame.set(look.flame)
  embers.set(look.flame.embers)
  smoke.set(look.flame.smoke)
  // The burning branch in the dead trees' shell, as their wood is; its embers the torch's.
  burningBranch?.setShell({ ...look.goose, ...deadTreeShine })
  branchEmbers?.set(look.flame.embers)
  // The torch out, burnt down or put out: its flame, its smoke and its embers go with it.
  flame.object.visible &&= light.on
  embers.object.visible &&= light.on
  smoke.object.visible &&= light.on
  // The character hidden takes its torch with it: the lamp alone stays, burning where the flame would.
  goose.object.visible &&= settings.character
  flame.object.visible &&= settings.character
  embers.object.visible &&= settings.character
  smoke.object.visible &&= settings.character
  ground.material.setBeat(shade(8), nudge(9), nudge(10))
  // The frame's jitter: the camera nudged a pixel or two, as a camera between photographs.
  if (stop.frameJitter && beats.beat >= 0) {
    camera.setViewOffset(innerWidth, innerHeight, stop.frameAmount * beats.vary(11), stop.frameAmount * beats.vary(12), innerWidth, innerHeight)
  } else if (camera.view !== null) {
    camera.clearViewOffset()
  }
  // The quality's step takes the depth of field and the AO away, never the panel's own settings.
  const ao = { ...look.ao, enabled: look.ao.enabled && quality.step.ao }
  // The deep output drawn for the tilt's band too; the glow, a bright point's lit disc, the depth of field's alone.
  const depthOn = look.dof.enabled && quality.step.dof
  // With the cheap halo, the tilt's blur spreads them too, by its own glow.
  const blurGlow = look.bloom.enabled && look.bloom.cheap ? look.bloom.blurGlow : 0
  const dof = { ...look.dof, enabled: depthOn || (!lean && !!tilt?.look.enabled), glow: depthOn ? look.dof.glow : blurGlow }
  post.set({ ao, outline: look.outline, hatch: look.hatch, palette: look.palette, grain: look.grain, vignette: look.vignette, screen: look.screen, dof, bloom: look.bloom })
}

/**
 * The lamp's shadows: a cube of six passes, so a switch to measure, `?shadows`,
 * read at the start: the lamp's shadow is the torch's lit area either way. The
 * rats are culled by `rats.draw` either way, never by three, so every pass
 * draws the same rats (see rats.ts).
 */
function shadowsChanged() {
  shadowed.dirty = true
}

measuringSwitches(look, backend, lean)

// The quality: a phone starts without depth of field or AO, anything else with
// the whole look, and the step moves as the frames come. A measuring switch
// holds it, so what is measured is what was asked for.
/**
 * A phone on WebGL 2, the swarm stepped on its CPU: a number of rats of its own, none coming with the goslings, so the
 * crowd never thins or swells with how the frames come. `?rats=N` to try others.
 */
const fewRats = phone && backend !== 'WebGPU'
const FEW_RATS = Number(url.get('rats')) || 200
const wholeLadder = ladder(maxDpr)
// A lean frame has no AO to step up to, so no steps with one.
const steps = (lean ? wholeLadder.slice(startingStep(wholeLadder, true)) : wholeLadder).filter((step) => !fewRats || step.rats === 1)
const askedStep = Number(url.get('step'))
// A phone on WebGL 2 starts at its lowest, the opening held at it, and climbs from there once it is over.
const quality = new Quality(steps, Number.isInteger(askedStep) && url.has('step') ? Math.min(Math.max(askedStep, 0), steps.length - 1) : fewRats ? steps.length - 1 : startingStep(steps, phone), phone ? PHONE_SLOW_FRAME : undefined)
// `?bench=soak` and `load` let it move: what a phone settles on is what they read.
const adapt = url.get('adapt') !== '0' && !['ao', 'dof', 'bloom', 'dpr', 'post'].some((key) => url.has(key)) && (!url.has('bench') || ['soak', 'load'].includes(url.get('bench') ?? ''))
/** Draw at the quality's step: its pixel ratio, its look; its share of the rats is read where the count is sent. */
function qualityChanged() {
  if (renderer.getPixelRatio() !== quality.step.dpr) renderer.setPixelRatio(quality.step.dpr)
  lookChanged()
}

// In the goose game F, a debug key, gives the torch a light that never burns down, held full each frame; and puts it out
// again for real, its fuel gone, so nothing holds the rats off his circle until a fire fills it. Taken here first, before the panel's own F, which only hides the light from the rats. 0 to 5 on the
// top row, debug keys too, stand him back where he starts, by the well's zone, the dead tree's, the
// cage's and, on 5, the pond; on 6 in the water just off its island, facing it. Any other number, or 0 to 5 on the keypad, gives him that many goslings at
// once, 0 none (the key's place, so the AZERTY row needs no shift).
/** The goose game's torch held full each frame, its F debug key's. */
let torchEverlasting = false
/** ISLAND_BY m off the island's waterline on the camera's side (+z), facing it. */
function standOffIsland() {
  const middle = islandMiddle(pondLook)
  const { holder, facing } = goosePlay.run
  holder.x = middle.x
  holder.z = middle.z + islandShoreAt(pondLook.island, Math.PI / 2) + ISLAND_BY
  facing.x = 0
  facing.z = -1
}
/** At the graveyard's entrance, facing in. */
function standAtGraveyard() {
  if (!graveyard) return
  const { holder, facing } = goosePlay.run
  holder.x = graveyard.entrance.x
  holder.z = graveyard.entrance.z
  facing.x = graveyard.entrance.facing.x
  facing.z = graveyard.entrance.facing.z
}
addEventListener(
  'keydown',
  (event) => {
    if (event.repeat || !settings.debug || event.target instanceof HTMLInputElement) return
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)
    if (event.code === 'KeyF') run.fuel = (torchEverlasting = !torchEverlasting) ? 1 : 0
    else if (event.code === 'KeyK' && !goosePlay.down) {
      // K: his life gone where he stands, as if bitten away, to try his death.
      goosePlay.life = 0
      goosePlay.bittenAt = goosePlay.t
    }
    // J: his death clip played through where he stands, whole, without dying, to see it.
    else if (event.code === 'KeyJ' && !goosePlay.down) deathShownAt = goosePlay.t
    else if (event.code === 'Digit0') goosePlay.standAtStart()
    else if (event.code === 'Digit1') goosePlay.standBy('well')
    else if (event.code === 'Digit2') goosePlay.standBy('tree')
    else if (event.code === 'Digit3') goosePlay.standBy('cage')
    else if (event.code === 'Digit5') goosePlay.standByPond()
    else if (event.code === 'Digit6') standOffIsland()
    else if (event.code === 'Digit4' && graveyard) standAtGraveyard()
    else if (digit) goosePlay.giveGoslings(Number(digit[1]))
    else return
    event.preventDefault()
    event.stopImmediatePropagation()
  },
  { capture: true },
)
if (dev && fallingLeaves && !noPanel) mountFallControls(fallingLeaves, dev.GUI)
const view = createGooseView({ camera, renderer, light, goslings, run, feel, opening, ending, torchFilledOnce, tilt, standAt, groundAt, goosePlay, look })
const panel = noPanel || filming ? undefined : dev?.createPanel(settings, tuning, look, capacity, {
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
    refillZones,
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
// Without the panel, P still pauses, and F, a debug key, still puts the torch out.
if (!panel) lightAndPause(settings, () => torchChanged() && lookChanged())
qualityChanged()
shadowsChanged()
// After the backend, the step and what it, or the address, turned off: so a phone shows what it draws.
const readouts = filming || !dev ? () => {} : dev.createReadouts(() =>
  [
    backend,
    `step ${quality.level}/${steps.length - 1}${adapt ? '' : ' held'}`,
    `dpr ${renderer.getPixelRatio()}`,
    look.ao.enabled && quality.step.ao ? '' : 'no AO',
    look.dof.enabled && quality.step.dof ? '' : 'no DOF',
    look.bloom.enabled ? '' : 'no bloom',
    post0 ? 'no post' : '',
    quality.step.rats < 1 ? `rats x${quality.step.rats}` : '',
    // Rats in view at each level of detail, and each level's triangles.
    rats.levels.length > 0 && look.rats.levels.on ? `levels ${rats.levels.map(({ drawn, triangles }) => `${drawn} x ${triangles}`).join(' / ')} tris` : '',
    `torch ${Math.round(run.fuel * 100)}%`,
    `light ${goosePlay.left.toFixed(1)} s · goslings ${goosePlay.circle}`,
  ]
    .filter(Boolean)
    .join(' · '),
)

/** The reach as dialled, before the slider's step rounds it. */
let dialled = runTuning.torchReach
const input = createGooseInput({ settings, opening, ending, editing: () => editMode?.on, setPaused })

// ---------------------------------------------------------------- loop
const timer = new Timer()
/** The light as shown: where the lamp, its pool and the fog ring stand, a beat behind the light when the stop motion holds it. */
const shown = { x: light.x, z: light.z }
/** Whether a circle of `radius` m round (x, z) comes within `reach` m of him, where he is drawn. */
const within = (x: number, z: number, radius: number, reach: number) => Math.hypot(x - shown.x, z - shown.z) - radius < reach
/** Where the lamp hangs: easing after the light's shown place by the lamp's lag, the held frames' worth of it on the beat. */
const lampAt = { x: light.x, z: light.z }
let lampOwed = 0
/** The light's own pace, m/s, as of the last frame: the goose runs by it. */
const lightPace = { x: 0, z: 0, wasX: light.x, wasZ: light.z }
/** How high he stands, m: easing after the ground under him, so a step up is a step, not a jump. */
let stood = Number.NaN
const STAND_EASE = 0.08
const { plantsView } = view
/** The way to the sun, as the dead trees and bushes are kept for the shadows they throw into the view. */
const plantsSunward = new Vector3()
goslings.seen = (x, y, z) => view.inView(x, z, GOSLING_SEEN, y)
/**
 * Carry the lamp, the fog's centre and the sun's aim to the light, and the
 * camera after it: by a share of how far the light has got ahead of it, so
 * the camera keeps wherever the mouse put it from the light, and glides. An
 * infinite `dt` snaps it there, for the first frame.
 */
function follow(dt: number, newBeat: boolean, frame: number) {
  const stop = look.stopMotion
  if (!(stop.enabled && stop.light) || newBeat) {
    shown.x = light.x
    shown.z = light.z
  }
  if (dt > 0) {
    lightPace.x = (light.x - lightPace.wasX) / dt
    lightPace.z = (light.z - lightPace.wasZ) / dt
  }
  lightPace.wasX = light.x
  lightPace.wasZ = light.z
  lampOwed += dt
  if (!(stop.enabled && stop.light) || newBeat) {
    const k = look.lamp.lag > 0 && Number.isFinite(lampOwed) ? 1 - Math.exp(-lampOwed / look.lamp.lag) : 1
    lampAt.x += (shown.x - lampAt.x) * k
    lampAt.z += (shown.z - lampAt.z) * k
    lampOwed = 0
  }
  const under = standAt(shown.x, shown.z)
  stood = Number.isNaN(stood) ? under : stood + (under - stood) * (1 - Math.exp(-dt / STAND_EASE))
  goose.object.position.set(shown.x, stood, shown.z)
  // The flame drawn again on the beat, or every frame smooth, where it wavers on the clock.
  if (!stop.enabled || newBeat) flame.shape(beats.flameDraw, lightPace.x, lightPace.z)
  flame.place(goose.tip(torchEnd, flame.offset(flameOffset)))
  goose.restTip(torchRest, flameOffset)
  flame.centre(flameAt)
  fires.frame(newBeat)
  pondWorld.bonfireFrame(newBeat, ending.firesLeft)
  fires.burningTreeFrame(newBeat)
  openingShow.introLightFrame()
  // In the torch, the lamp burns where the torch rests, the head's sway left out (2026-10-11): it moves with him
  // and never swings with his head. Else it hangs over the goose, easing after it.
  if (look.lamp.inFlame) lamp.position.copy(torchRest)
  else lamp.position.set(lampAt.x, LIGHT_HEIGHT + stood, lampAt.z)
  skyFog.centre.value.set(shown.x, shown.z)
  // The sun stays over the light, so its shadows always cover the view.
  sun.target.position.set(shown.x, 0, shown.z)
  sun.position.copy(sun.target.position).add(look.sun)
  view.glide(dt, newBeat, frame, stood)
  // The dead trees' and bushes' stretches past the fog's solid edge, its wisps and all, left undrawn: they would draw as
  // the fog. Those out of the camera's view too, now it has moved, unless their shadow is in it.
  const plantsReach = look.fog.enabled ? skyFog.edge + 1.5 * look.fog.wisp + 0.5 : Infinity
  view.lookedFrom()
  const plantsSun = sun.castShadow ? plantsSunward.subVectors(sun.position, sun.target.position).normalize() : undefined
  deadTreesMesh.cullPast(shown.x, shown.z, plantsReach, plantsView, plantsSun)
  bushesMesh.cullPast(shown.x, shown.z, plantsReach, plantsView, plantsSun)
}
follow(Infinity, true, 0)
view.start()

/**
 * The goose game's edit mode, E on and off (gooseedit.ts): the play paused and the camera the free orbit while it is
 * on, both put back as they were after; the scenes' pieces, and each plain brazier and its waiting gosling, to pick,
 * move, turn, raise and size; saved as the route, the page loaded again on it. The pieces raised and sized as the
 * route keeps them, edit mode or not.
 */
layPieces([...gooseScenes.pieces(goosePlay), ...plainPieces()])
// The tree's gosling lands a little ahead of where he is drawn sitting.
goosePlay.landingOf = (tree) => gooseScenes.landingOf(goosePlay, tree)
let editWasPaused = false
let editWasCamera: GooseCamera = 'fixed'
const editMode =
  dev && !filming
    ? dev.createEditMode({
        camera,
        dom: renderer.domElement,
        scene,
        pieces: () => [...gooseScenes.pieces(goosePlay), ...plainPieces()],
        entered() {
          editWasPaused = settings.paused
          setPaused(true)
          editWasCamera = view.kind
          view.setGooseCamera('orbit', false)
        },
        left() {
          setPaused(editWasPaused)
          view.setGooseCamera(editWasCamera, false)
        },
        cameraTakes(takes) {
          view.controls.enableZoom = takes
        },
        save: saveEditedRoute,
      })
    : undefined
if (editMode) {
  addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || event.target instanceof HTMLInputElement) return
    editMode.toggle()
  })
}

/** The plain braziers, those with no scene, and their goslings while waiting, and the fire pit by each well, as edit pieces: moved only. */
function plainPieces(): EditPiece[] {
  const play = goosePlay
  // The well's fire pit saved where it stands before the settings' offset, as the dead tree's brazier is.
  const wellPits = play.wellFires.flatMap(({ brazier, place }, w): EditPiece[] => {
    const object = gooseScenes.wellPits[w]
    if (!object) return []
    return [
      {
        name: `well fire ${brazier + 1}`,
        object,
        shown: keptShown(play.plain.braziers[brazier]!, 'fire'),
        move(dx, dz) {
          place.x += dx
          place.z += dz
        },
        save(braziers) {
          braziers[brazier]!.fire = { ...place }
        },
      },
    ]
  })
  return [...wellPits, ...plainBraziers(play)]
}

/** The plain braziers, those with no scene, and their goslings while waiting, as edit pieces. */
function plainBraziers(play: GoosePlay<PlaySwarm>): EditPiece[] {
  return play.plain.braziers.flatMap((b, k): EditPiece[] => {
    if (b.scene || b.follows !== undefined) return []
    const light = play.level.lights[k]!
    const stand = (k === pitLight ? gooseScenes.pit : undefined) ?? lights.object.children[k]
    const g = play.goslings[k]
    const bird = goslings.object.children[k]
    const pieces: EditPiece[] = []
    if (stand) {
      pieces.push({
        name: `brazier ${k + 1}`,
        object: stand,
        shown: keptShown(b, 'fire'),
        move(dx, dz) {
          light.x += dx
          light.z += dz
        },
        save(braziers) {
          braziers[k]!.x = light.x
          braziers[k]!.z = light.z
        },
      })
    }
    if (bird && g?.state === 'waiting') {
      pieces.push({
        name: `gosling ${k + 1}`,
        object: bird,
        shown: keptShown(b, 'gosling'),
        move(dx, dz) {
          g.x += dx
          g.z += dz
          play.waitsAt[k]!.x += dx
          play.waitsAt[k]!.z += dz
        },
        // Where he waits, not where a searching gosling has paced to.
        save(braziers) {
          braziers[k]!.gosling = { ...play.waitsAt[k]! }
        },
      })
    }
    return pieces
  })
}

/**
 * The route the edited pieces now make, written over src/world/gooseroute.json by the dev server,
 * and the page loaded again on it; or why not. Not with a debug placement on, which would be saved with it.
 */
async function saveEditedRoute(pieces: EditPiece[]): Promise<string | undefined> {
  if (goosePlay.settings.treeAhead !== null || goosePlay.settings.wellAhead !== null) return 'not saved: a debug placement (?tree) is on'
  const { start, pond } = goosePlay.plain
  const braziers = structuredClone(goosePlay.plain.braziers)
  for (const piece of pieces) piece.save?.(braziers)
  // The road as the route laid it, by hand or not at all: the edit mode moves none of it.
  const { road } = goosePlay.plain
  const route: Route = { start: { ...start }, braziers, pond: { ...pond }, ...(road ? { road: structuredClone(road) } : {}) }
  // To the millimetre.
  const body = JSON.stringify(toSave(route), (_, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))
  const response = await fetch('/goose-route', { method: 'POST', body }).catch(() => undefined)
  if (!response?.ok) return `not saved: ${response ? await response.text() : 'no dev server'}`
  location.reload()
  return undefined
}

/** How far off the dark starts, m, before the walk's margin: the fog's far edge, or with `roundPast` that distance, the fog nearer where it is on. */
function darkRadius(): number {
  if (settings.roundPast === undefined) return skyFog.edge
  return look.fog.enabled ? Math.min(skyFog.edge, settings.roundPast) : settings.roundPast
}

/**
 * How far past the fog's far edge, as drawn this frame, a rat brought round
 * is set down, m, so that it is first drawn past it: the fog's centre walks
 * on while the rat goes unseen, and the rat runs in meanwhile. The dark sent
 * this frame is read by the worker's next step, up to a step away, and that
 * step's state comes in a step after it: a step as the worker paces them,
 * longer than STEP when its steps overrun. The page places a moved rat at
 * that state on its next frame, and the light walks at most FRAME_CAP of its
 * speed in a frame. The stop motion adds a beat for each of its holds, at the
 * beat's longest: holding the light, the fog's centre at the send is up to a
 * beat behind the light; holding the swarm, the rat's state waits up to a
 * beat to be placed. At worst the light walks at its top speed all that
 * while, toward where the rat was set down. And while the swarm is held, the
 * rat runs in for the light at its own speed, the fastest rat's at worst, for
 * the beat it waits and the frame that then stands it at the latest state.
 */
function darkMargin(): number {
  const stop = look.stopMotion
  const lightHeld = stop.enabled && stop.light ? beats.length(stop.uneven) : 0
  const swarmHeld = stop.enabled && stop.swarm ? beats.length(stop.uneven) : 0
  const unseen = 2 * swarm.pace + FRAME_CAP + lightHeld + swarmHeld
  const running = swarmHeld > 0 ? swarmHeld + FRAME_CAP : 0
  return DARK_MARGIN + settings.lightSpeed * unseen + tuning.maxSpeed * running
}

/** A scene's fire as its folder edits it: its reach, which holds the rats off; its flame the flames folder's, its zone the interaction zones folder's. */
function sceneFirePanel(kind: FireScene) {
  return { reach: goosePlay.settings.fireReach, kind }
}

/** The goose's bones by name, the cage's key carried on one of them. */
const gooseBone = (name: string) => goose.bone(name)

/** When a bite on him was last heard and seen, s of the play; how hard it was, 0 to 1; and which way it came from, on the ground. */
let biteCued = Number.NEGATIVE_INFINITY
let biteHard = 0
const biteCame = { x: 0, z: 0 }
/** How hard a bite by one rat is, of the hardest, MOST_BITERS of them at once. */
const BITE_SOFTEST = 0.6
/**
 * A rat's bite on him, heard and seen: at once as the first bites, then at most once a `feel.bite.gap` s however many
 * bite him, so six at once never chatter; the harder the more there are. Heard as the pained honk or the hiss; seen as
 * his flinch, squashed down from his feet at once and springing back a little past his height, then still; as his
 * body flashing, held a moment and fading, the frame's edges closing in with it, the more as his life runs low; as the
 * camera snapped the way the bite came and springing back past where it was; as feathers puffing off him away from
 * the bite; and in his goslings with him, cowering, a frightened peep from one or two.
 */
function biteFrame() {
  const { t, biters } = goosePlay
  const { bite } = feel
  if (biters > 0 && t - biteCued >= bite.gap) {
    biteCued = t
    biteHard = BITE_SOFTEST + ((1 - BITE_SOFTEST) * (Math.min(biters, MOST_BITERS) - 1)) / (MOST_BITERS - 1)
    gooseSounds?.play(bite.sound === 'honk' ? 'bite_honk' : 'bite_hiss', hisAt(), biteHard)
    biteCame.x = goosePlay.biteFrom.x
    biteCame.z = goosePlay.biteFrom.z
    biteBody.set(goose.object.position.x, goose.object.position.y + BITE_BODY, goose.object.position.z)
    feathers.burst(biteBody, biteCame, biteHard)
    goslingsFright(t)
  }
  const since = t - biteCued
  /** How far through a part of it lasting `lasts` s the bite is, 0 to 1; 1 over, or none yet. */
  const through = (lasts: number) => (since >= 0 ? Math.min(1, since / Math.max(lasts, 1e-3)) : 1)
  // Squashed at the bite, through his height a third of the way back, stretched a little two thirds back, still at the end.
  const flinch = through(bite.lasts)
  const squash = bite.squash * biteHard * Math.cos(flinch * 1.5 * Math.PI) * (1 - flinch)
  goose.object.scale.set(1 + squash / 2, 1 - squash, 1 + squash / 2)
  // The flash, held whole a moment and fading; the edges with it, the more as his life runs low.
  const fade = through(bite.flashLasts)
  const flash = biteHard * (fade < FLASH_HELD ? 1 : ((1 - fade) / (1 - FLASH_HELD)) ** 2)
  goose.material.flash.color.value.set(bite.flashColour)
  goose.material.flash.strength.value = bite.flash * flash
  post.hurt(bite.edge * flash * (EDGE_FULL_LIFE + (1 - EDGE_FULL_LIFE) * (1 - goosePlay.life)), bite.edgeColour)
  // The knock: the camera snapped the way the bite pushes him, away from the rats, and a little down, at once; springing
  // back past where it was, then settling.
  const settle = through(bite.knockLasts)
  const knock = bite.knock * biteHard * (1 - settle) ** 2 * Math.cos(2.5 * Math.PI * settle)
  view.cameraKnock.set(-biteCame.x * knock, -knock * 0.5, -biteCame.z * knock)
}
/** How high on him the feathers puff off, m over his feet. */
const BITE_BODY = 0.3
const biteBody = new Vector3()
/** The share of the flash held whole before it fades. */
const FLASH_HELD = 0.15
/** The share of the edges a bite closes in with his life full; all of it with his life gone. */
const EDGE_FULL_LIFE = 0.6
/** How long his goslings cower after a bite, s; how long between their frightened peeps at the least, s; and how many peep at once at most. */
const GOSLING_FRIGHT = 0.9
const FRIGHT_PEEPS_GAP = 1.6
const FRIGHT_PEEPERS = 2
let frightPeeped = Number.NEGATIVE_INFINITY
goslings.cowering = (k) => goosePlay.goslings[k]?.state === 'circle' && goosePlay.t - biteCued < GOSLING_FRIGHT
/** A bite at `t`: his goslings with him cower (goslings.ts `cowering`), and one or two peep, not more often than FRIGHT_PEEPS_GAP. */
function goslingsFright(t: number) {
  if (!gooseSounds || t - frightPeeped < FRIGHT_PEEPS_GAP) return
  const withHim = goosePlay.goslings.flatMap((g, k) => (g?.state === 'circle' ? [k] : []))
  if (withHim.length === 0) return
  frightPeeped = t
  for (let n = 0; n < Math.min(FRIGHT_PEEPERS, withHim.length); n++) {
    const [k] = withHim.splice(Math.floor(Math.random() * withHim.length), 1)
    const g = goosePlay.goslings[k!]!
    gooseSounds.play('cower_peep', { x: g.x, y: standAt(g.x, g.z) + 0.2, z: g.z }, 1, 0.05 + Math.random() * 0.15)
  }
}

/** When the torch's last catch was seen, s of the play, NaN none; and how hard it was, 0 to 1. */
let torchCaughtSeen = Number.NaN
let torchHard = 0
/** Whether the catch last seen was his first: lit from nothing, the game's first light his own. */
let torchFirst = false
/** His first catch's flare: how far past its reach it throws the light, of its reach, and how long it takes to settle, s, over a catch's own. */
const FIRST_FLARE_REACH = 0.8
const FIRST_FLARE_LASTS = 1.4
/** The torch's crackle this frame: its level, of its own; and how much faster it plays. */
const torchHeard = { level: 0, faster: 1 }
/** How hard the catch of a torch topped up from all but full is, of one lit from out. */
const TORCH_SOFTEST = 0.35
/** How long the flare takes to reach its height, s: a whoomph, not a blink. */
const FLARE_IN = 0.06
/** How often the guttering may dip the torch, s of the held time; how often a step dips it with the torch all but out, and how deep, of the panel's dips. */
const GUTTER_STEP = 0.09
const GUTTER_CHANCE = 0.45
const GUTTER_DEPTH = [0.5, 1] as const
/** How long the crackle's speed takes to follow where it goes, s; how loud a topped-up torch's catch sounds, of a lit one's. */
const CRACKLE_EASE = 0.12
const TOPPED_IGNITE = 0.8
/** A draw from 0 to 1 by `n`, the same for the same `n`. */
const drawOf = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const awayFromLook = new Vector3()
/**
 * The torch, felt: its flame smaller as its light fades, in a straight line; running low, past `low` of its fuel, its flame wilder, the lamp guttering, dipping now
 * and then, the more often the lower, its crackle thinner; filled at a fire, the crackle rising as it fills, from
 * nothing while it is out. And catching full (GoosePlay.caughtAt), the harder the lower it was: a spray of sparks, the
 * light flaring past its reach and the lamp past its glow, the rats at its edge thrown back with it, then settling;
 * the flame popping up tall, dipping back past its height and still; the camera nudged back off him, springing back.
 */
function torchFrame(dt: number, held: number) {
  const { torch } = feel
  const { run, t, caughtAt, caughtFrom, kindled } = goosePlay
  const lit = run.torch.lit
  const low = lit ? Math.max(0, 1 - run.fuel / Math.max(torch.low, 1e-3)) : 0
  // A dip on this step of the held time or none, so on the stop motion's beat it holds with the rest.
  const step = Math.floor(held / GUTTER_STEP)
  const dip = drawOf(step) < low * GUTTER_CHANCE ? GUTTER_DEPTH[0] + (GUTTER_DEPTH[1] - GUTTER_DEPTH[0]) * drawOf(step + 0.5) : 0
  if (!Number.isNaN(caughtAt) && caughtAt !== torchCaughtSeen) {
    torchFirst = Number.isNaN(torchCaughtSeen)
    torchCaughtSeen = caughtAt
    torchHard = TORCH_SOFTEST + (1 - TORCH_SOFTEST) * (1 - caughtFrom)
    embers.burst(torch.sparks * torchHard, torch.sparkSpeed)
    // Lit from out, its ignite is heard already (scenesHeardFrame); a top-up's catch is heard here.
    if (caughtFrom > 0) gooseSounds?.play('ignite', hisAt(), torchHard * TOPPED_IGNITE)
  }
  const since = t - caughtAt
  const caught = since >= 0
  /** How far through a part of the catch lasting `lasts` s it is, 0 to 1; 1 over, or none yet. */
  const through = (lasts: number) => (caught ? Math.min(1, since / Math.max(lasts, 1e-3)) : 1)
  // His first catch, the branch picked up or his torch first lit, flares further and longer: the ring of rats opens round him.
  const flareLasts = torchFirst ? FIRST_FLARE_LASTS : torch.flareLasts
  const flare = caught ? torchHard * Math.min(1, since / FLARE_IN) * (1 - through(flareLasts)) ** 2 : 0
  nightLights.torchFlare = 1 + (torchFirst ? FIRST_FLARE_REACH : torch.reach) * flare
  nightLights.torchGlow = (1 + torch.flare * flare) * (1 - torch.dips * dip)
  const popped = through(torch.popLasts)
  const pop = torch.pop * torchHard * (1 - popped) ** 2 * Math.cos(2.5 * Math.PI * popped)
  // Its flame its full size, as see-through as its light is short of a full torch's: fading in a straight line as the light fades out.
  const left = lit ? run.torch.reach / Math.max(goosePlay.runTuning.torchReach, 1e-3) : 0
  flame.burning(1 - 0.5 * torch.dips * dip + pop, 1 + 0.4 * pop, 1 + torch.gutter * low, left)
  const filling = goosePlay.atRefill && input.commands.interact
  const faster = filling ? 1 + torch.rise * (lit ? run.fuel : kindled) : 1
  torchHeard.faster += (faster - torchHeard.faster) * (1 - Math.exp(-dt / CRACKLE_EASE))
  torchHeard.level = lit ? 1 - torch.thin * low : filling ? kindled : 0
  // Nudged back along the camera's look, off him, at once; springing back past where it was, then settling.
  const settled = through(torch.knockLasts)
  const knock = torch.knock * torchHard * (1 - settled) ** 2 * Math.cos(2.5 * Math.PI * settled)
  if (knock !== 0) view.cameraKnock.add(awayFromLook.subVectors(camera.position, view.controls.target).normalize().multiplyScalar(knock))
}

/** When a found gosling's rats last rumbled in, on the play's time; none yet, NaN. */
let rumbledAt = Number.NaN
/** The ground shaking the camera under a found gosling's rats, for as long as their rumble is heard. */
function rumbleFrame() {
  const { x, y, z } = rumbleAt(goosePlay.t - rumbledAt, feel.rumble.shake, feel.rumble.lasts)
  view.cameraKnock.x += x
  view.cameraKnock.y += y
  view.cameraKnock.z += z
}

/** When J last showed his death clip whole, s of the play. */
let deathShownAt = Number.NEGATIVE_INFINITY
/** How long past its end the shown death holds its last frame, s. */
const DEATH_SHOWN_HOLD = 0.8
/**
 * How far into his death he is, s of it, at the feel folder's speed: as he falls, from his fall's start; or shown
 * whole by J; none, he is not dying.
 */
function dyingAt(): number | undefined {
  const { fallen, t } = goosePlay
  const { speed } = feel.death
  if (!Number.isNaN(fallen)) return fallen * speed
  const shown = (t - deathShownAt) * speed
  return shown >= 0 && shown < goose.deathLength + DEATH_SHOWN_HOLD ? shown : undefined
}

/** The goose game's frame past the play, `dt` of play on, at the held time `held`: the goslings where it has them. */
function gooseFrame(dt: number, held: number) {
  roadside.ratWallsFrame(goosePlay.holder, () => run.walls(), swarm)
  gooseScenes.update(goosePlay, dt, gooseBone)
  // The dead trees' pumpkins where the tree folder and the edit mode have them now, for him and his goslings to keep out of.
  goosePlay.setPumpkins(gooseScenes.pumpkinBodies(goosePlay))
  deadTreesMesh.placeOwn(gooseScenes.ownTrees(goosePlay))
  // Calm until the strike: he and his goslings walk. Struck, he jumps in fright and they cower, till they bolt.
  const calm = opening.running() && opening.t < INTRO.strike
  goose.setCalm(calm)
  goose.setStartle(opening.running() ? startled(opening.t) : undefined)
  goose.setDying(dyingAt())
  goslings.calm = calm
  goslings.scared = opening.running() && cowering(opening.t)
  openingShow.shoutFrame()
  biteFrame()
  torchFrame(dt, held)
  rumbleFrame()
  view.cameraLeanFrame(dt, stood)
  gooseSoundsFrame(dt)
  islandGeese.direct(ending.cue())
  ending.frame()
  if (opening.on && !opening.settled) opening.goslingsFrame()
  // Bolting in the opening, none is in its scene yet: up its tree or down its well.
  islandGeese.object.visible = ending.running() || islandNear()
  if (islandGeese.object.visible) islandGeese.update(dt, held)
  goslings.update(goosePlay, dt, held, !opening.on || opening.settled ? (k) => gooseScenes.lift(goosePlay, k) : undefined, ending.running() ? ending.act : undefined)
  openingShow.skipHintFrame(input.commands)
}

/** How far past the island's waterline the camera's view wakes its geese, m: their shadows and a little more. */
const ISLAND_SHADOWS = 2
/** Whether the island, its widest waterline round and ISLAND_SHADOWS more, is in the camera's view: else its geese are neither played nor drawn. */
function islandNear(): boolean {
  const middle = islandMiddle(pondLook)
  let widest = 0
  for (let k = 0; k < 16; k++) widest = Math.max(widest, islandShoreAt(pondLook.island, (k / 16) * Math.PI * 2))
  return view.inView(middle.x, middle.z, widest + ISLAND_SHADOWS)
}

/** Whether the rats have rushed in yet. */
let rushed = false
/**
 * How far past the edge of the view the rats are set down for the rush, m, at the nearest and the farthest: fewest
 * near it and more the further out, so they come in one by one at first, then thicker, never as a block.
 */
const RUSH_FROM = [0.6, 18] as const
/** How far either side of the way spared the rats of a rush do not come from, rad. */
const RUSH_SPARED = Math.PI / 4
/**
 * Rats `from` to `to` set down out of view, on every side of him, to rush in: few just past its edge, more and more
 * behind. Given `notFrom`, a way over the ground, none come from within RUSH_SPARED rad of it.
 */
function rushIn(dark: Dark, from: number, to: number, notFrom?: number) {
  const [near, far] = RUSH_FROM
  const spared = notFrom === undefined ? 0 : RUSH_SPARED
  const start = (notFrom ?? 0) + spared
  for (let i = from; i < to; i++) {
    const way = start + Math.random() * (2 * Math.PI - 2 * spared)
    const ux = Math.cos(way)
    const uz = Math.sin(way)
    // More the further out: the nearest share s of the way out holds s² of them.
    const r = sightEdge(dark, ux, uz) + near + Math.sqrt(Math.random()) * (far - near)
    swarm.setDown(i, dark.x + ux * r, dark.z + uz * r)
  }
}

/**
 * More rats for every gosling he finds, RATS_PER_GOSLING of them (`?ratsPerGosling=N` for others): the little one's
 * peeps were heard in the dark. They come RATS_AFTER s after the find, once he has him back, rushing in from out of
 * view as the opening's do over a lower rumble, but never from the bottom of the screen. None while the game's rats
 * are at none, and none for a ghost's gosling.
 */
const askedPerGosling = Number(url.get('ratsPerGosling'))
const RATS_PER_GOSLING = url.has('ratsPerGosling') && askedPerGosling >= 0 ? Math.round(askedPerGosling) : 300
const RATS_AFTER = 1.2
const RUMBLE_GAIN = 0.5
/** How many goslings' rats have come; how long till the next gosling's do, s, or none due. */
let ratsCameFor = 0
let ratsDueIn = -1
/** The rats come for the goslings found so far, over the game's own. */
const ratsForGoslings = () => (settings.rats > 0 ? ratsCameFor * RATS_PER_GOSLING : 0)
/** Whether a found gosling's rats come this frame, `dt` s on: one gosling's at a time, RATS_AFTER s apart. */
function ratsComeFrame(dt: number): boolean {
  const circle = goosePlay.circleHeard
  // Through the opening, or the play started again: none come for those with him.
  if (opening.running() || circle < ratsCameFor) {
    ratsCameFor = circle
    ratsDueIn = -1
    return false
  }
  if (ratsDueIn < 0 && circle > ratsCameFor) ratsDueIn = RATS_AFTER
  if (ratsDueIn < 0 || (ratsDueIn -= dt) > 0) return false
  ratsCameFor++
  ratsDueIn = -1
  return true
}

/**
 * Its music: the track looped under it all (goosesounds.ts' `music`); or, with `?lullaby`, the lullaby made as it plays
 * (goosemusic.ts), growing with his goslings, `?music=N` holding it at layer N. Neither with `?nomusic`.
 */
const lullaby = url.has('lullaby') || url.has('music')
const gooseMusic = gooseSounds && lullaby && !url.has('nomusic') ? createGooseMusic(gooseSounds) : undefined
if (gooseMusic && url.has('music')) gooseMusic.layers = Number(url.get('music'))
const backgroundMusic = gooseSounds && !lullaby && !url.has('nomusic') ? gooseSounds.loop('music') : undefined
/**
 * The track silent through the opening, its strike and its quake; once the game is his, coming up from its start over
 * MUSIC_FADE s, slow at first, only while it can be heard (not paused, loaded, the page clicked); going down over
 * MUSIC_FADE_OUT s as the ending starts, its own music (`outro`) played once in its place. `musicIn` how far up.
 */
const MUSIC_FADE = 8
const MUSIC_FADE_OUT = 3
let musicIn = 0
if (gooseSounds) {
  addEventListener('keydown', (event) => {
    if (event.code !== 'KeyM' || event.repeat || event.target instanceof HTMLInputElement) return
    gooseSounds.muted = !gooseSounds.muted
  })
  if (!noPanel) {
    dev?.mountSoundPanel(gooseSounds, gooseMusic)
    // The takes as ElevenLabs gave them come from the dev server alone.
    if (import.meta.env.DEV) dev?.mountTakesPanel()
  }
}
/** Whether the strike's fright has been heard; which goslings were with him last frame. */
let frightHeard = false
const withHer: boolean[] = []
/**
 * A gosling seeing him come: the nearest still waiting, once the goose is EXCITED_FROM m off, peeps happily now and then,
 * the pause between, s, shrinking from its calmest to its quickest as the goose comes to EXCITED_NEAR m, slowly at first
 * and then faster, each drawn EXCITED_JITTER times it, never on a beat; now and then two peeps close together,
 * EXCITED_TWICE of the time; louder as the goose comes. Found, as he comes back to the goose, he peeps FOUND_PEEPS times
 * running, each FOUND_GAP s after the last; a happy peep is written over him, small (`createPeepWords`).
 */
const EXCITED_FROM = 7
const EXCITED_NEAR = 1.2
const EXCITED_PAUSE = [2.4, 0.8] as const
const EXCITED_JITTER = [0.6, 1.6] as const
const EXCITED_TWICE = 0.2
const EXCITED_GAIN = [0.6, 1] as const
const FOUND_PEEPS = [4, 5] as const
const FOUND_GAP = [0.09, 0.32] as const
const peepWords = !filming ? createPeepWords() : undefined
/** How far over a gosling's head his *peep* is written, m. */
const PEEP_OVER = 0.06
const peepHead = new Vector3()
/** A happy peep from gosling `k`, `after` s from now: heard and written over his head as drawn, up a tree or down a well. */
function happyPeep(k: number, gain: number, after = 0) {
  const g = goosePlay.goslings[k]
  if (!g) return
  goslings.headOf(k, peepHead)
  peepAt({ x: peepHead.x, y: peepHead.y, z: peepHead.z }, gain, after)
}
/** A happy peep from a gosling whose head is at `at`, `after` s from now: heard and written over him. */
function peepAt(at: { x: number; y: number; z: number }, gain: number, after = 0) {
  gooseSounds?.play('happy_peep', at, gain, after)
  peepWords?.peep({ x: at.x, y: at.y + PEEP_OVER, z: at.z }, after)
}
/** How loud each gosling's peeps are as he hops for joy in the ending's ring, many at once; and how far into the ending they have been heard, s. */
const OUTRO_PEEP_GAIN = 0.7
let outroHeard = -1
/**
 * The island's goslings seeing their father come: once he is within ISLAND_SEES m of its waterline, one of them, any,
 * peeps now and then, the pause between, s, shrinking as he nears the shore, each drawn ISLAND_JITTER times it, never
 * on a beat, and louder; on through the ending at its quickest, his goslings with them, as they run down to meet
 * him and round the two of them, until they settle in the ring, where each peeps a run of his own (`outroPeepsFrame`).
 */
const ISLAND_SEES = 12
const ISLAND_PAUSE = [1.8, 0.45] as const
const ISLAND_JITTER = [0.6, 1.4] as const
const ISLAND_GAIN = [0.45, 0.75] as const
let islandCallWait = 0
function islandCallsFrame(dt: number) {
  if (!pondLook.island.show || opening.running()) return
  const stage = ending.stage
  let close = 1
  if (stage) {
    if (ending.t >= OUTRO.settle) return
  } else {
    const { holder } = goosePlay
    const { middle } = ending.island
    const dx = holder.x - middle.x
    const dz = holder.z - middle.z
    const off = Math.hypot(dx, dz) - ending.island.shoreAt(Math.atan2(dz, dx))
    if (off > ISLAND_SEES) {
      islandCallWait = 0
      return
    }
    close = Math.min(1, Math.max(0, (ISLAND_SEES - off) / (ISLAND_SEES - OUTRO.near)))
  }
  islandCallWait -= dt
  if (islandCallWait > 0) return
  islandCallWait = (ISLAND_PAUSE[0] + (ISLAND_PAUSE[1] - ISLAND_PAUSE[0]) * close) * (ISLAND_JITTER[0] + Math.random() * (ISLAND_JITTER[1] - ISLAND_JITTER[0]))
  const island = stage ? [...ending.brood.map((k) => goosePlay.goslings[k]!), ...stage.island.map((_, j) => goslingOf(stage, false, j, ending.t).at)] : islandGeese.cast().goslings
  const at = island[Math.floor(Math.random() * island.length)]
  if (at) peepAt({ x: at.x, y: standAt(at.x, at.z) + GOSLING_HEAD, z: at.z }, ISLAND_GAIN[0] + (ISLAND_GAIN[1] - ISLAND_GAIN[0]) * close)
}
/** Every gosling in the ending's ring, his and the island's, peep peep peep as he hops for joy: those due since the last frame. */
function outroPeepsFrame() {
  const stage = ending.stage
  if (!stage || !ending.running()) return
  const from = outroHeard
  outroHeard = ending.t
  const due = (brood: boolean, k: number) => peepsOf(stage, brood, k).some((t) => t > from && t <= ending.t)
  ending.brood.forEach((k, i) => due(true, i) && happyPeep(k, OUTRO_PEEP_GAIN))
  stage.island.forEach((_, j) => {
    if (!due(false, j)) return
    const { at, act } = goslingOf(stage, false, j, ending.t)
    peepAt({ x: at.x, y: standAt(at.x, at.z) + (act?.lift ?? 0) + GOSLING_HEAD, z: at.z }, OUTRO_PEEP_GAIN)
  })
}
const peepOn = new Vector3()
/** The peeps' words laid out where the camera sees their goslings, `dt` s on. */
function peepWordsFrame(dt: number) {
  if (!peepWords) return
  const box = renderer.domElement.getBoundingClientRect()
  peepWords.update(dt, (at) => {
    peepOn.set(at.x, at.y, at.z).project(camera)
    if (peepOn.z > 1 || Math.abs(peepOn.x) > 1 || Math.abs(peepOn.y) > 1) return null
    return { x: box.left + ((peepOn.x + 1) / 2) * box.width, y: box.top + ((1 - peepOn.y) / 2) * box.height }
  })
}
let excitedWait = 0
/** The nearest gosling still waiting, if the goose has lit his torch once and the gosling is within EXCITED_FROM m, peeping the quicker the nearer the goose comes. */
function excitedFrame(dt: number) {
  if (!gooseSounds || opening.running() || dt <= 0 || !torchFilledOnce()) return
  const { holder } = goosePlay
  let near = -1
  let off = EXCITED_FROM
  goosePlay.goslings.forEach((g, k) => {
    const d = g?.state === 'waiting' ? Math.hypot(g.x - holder.x, g.z - holder.z) : Infinity
    if (d < off) {
      near = k
      off = d
    }
  })
  if (near < 0) return
  excitedWait -= dt
  if (excitedWait > 0) return
  const close = Math.min(1, Math.max(0, (EXCITED_FROM - off) / (EXCITED_FROM - EXCITED_NEAR)))
  const eased = close * close
  excitedWait = (EXCITED_PAUSE[0] + (EXCITED_PAUSE[1] - EXCITED_PAUSE[0]) * eased) * (EXCITED_JITTER[0] + Math.random() * (EXCITED_JITTER[1] - EXCITED_JITTER[0]))
  const gain = EXCITED_GAIN[0] + (EXCITED_GAIN[1] - EXCITED_GAIN[0]) * close
  happyPeep(near, gain)
  if (Math.random() < EXCITED_TWICE) happyPeep(near, gain * 0.9, FOUND_GAP[0] + Math.random() * (FOUND_GAP[1] - FOUND_GAP[0]))
}
/**
 * The last gosling waiting ahead for the goose to follow: once he has stood GUIDE_CALLS_AFTER s, a small peep, quieter than
 * his happy ones, and another every GUIDE_CALL_PAUSE s or so for as long as the goose keeps him waiting.
 */
const GUIDE_CALLS_AFTER = 1.5
const GUIDE_CALL_PAUSE = [2.5, 5] as const
const GUIDE_CALL_GAIN = 0.6
let guideCallWait = 0
function guideCallFrame(dt: number) {
  if (ending.running() || goosePlay.guideWaits < GUIDE_CALLS_AFTER) {
    guideCallWait = 0
    return
  }
  guideCallWait -= dt
  if (guideCallWait > 0) return
  guideCallWait = GUIDE_CALL_PAUSE[0] + Math.random() * (GUIDE_CALL_PAUSE[1] - GUIDE_CALL_PAUSE[0])
  happyPeep(goosePlay.guide, GUIDE_CALL_GAIN)
}
/**
 * The goslings' fright in the opening: at the strike each peeps twice as they cower, at his own times, s after it;
 * bolting, each peeps over and over as he runs, every so often, s: heard going off
 * every way into the dark. A gosling runs while he goes faster than PANIC_PACE m/s, and slower than a jump to his place.
 */
const COWER_PEEPS = [
  [0.05, 0.35],
  [0.45, 0.8],
] as const
const PANIC_PEEPS = [0.16, 0.28] as const
const PANIC_PACE = [1.5, 20] as const
const panicWait: number[] = []
const goslingWas: ({ x: number; z: number } | undefined)[] = []
/**
 * His honks after his shouts, heard only, s into the opening and how loud: he goes on calling after his goslings
 * once they are out of sight, a little quieter.
 */
const CALLS_AFTER = [{ at: INTRO.rush + 1, gain: 0.85 }] as const
/**
 * The opening's chatter as they walk (CHAT): a gosling's happy peep, written over him, or the goose's soft answer, heard and
 * written over his head as small as a peep, HIS_WORD; how loud the goslings are, and how far over him the word goes, m.
 */
const HIS_WORD = '*honk*'
const CHAT_GAIN = 0.75
const HIS_HEAD = 0.95
let chatHeard = 0
function chatFrame() {
  for (let line = CHAT[chatHeard]; line && opening.t >= line.at; line = CHAT[++chatHeard]) {
    // Skipped past, or come to the strike: unsaid.
    if (!opening.running() || opening.t >= INTRO.strike) continue
    if (typeof line.who === 'number') {
      const found = opening.brood()
      if (found.length) happyPeep(found[line.who % found.length]!, CHAT_GAIN)
      continue
    }
    gooseSounds?.play(line.who, hisAt())
    const { position } = goose.object
    peepWords?.peep({ x: position.x, y: position.y + HIS_HEAD, z: position.z }, 0, HIS_WORD)
  }
}
/** The opening's own clock, s, run on past its end for his last honks; whether it was skipped, which hushes them. */
let openingClock = 0
let openingSkipped = false
let callsAfterHeard = 0
/** The pause between his sounds of his own as he walks, s, and the share of them that are a soft questioning honk, the rest muttered grunts. */
const MUTTER_PAUSE = [14, 32] as const
const QUERIES = 0.35
let mutterWait = MUTTER_PAUSE[1]
/** The fires as heard: the burning tree's crackle, every other lit fire's calm burning, his torch's; the pond; the wind and the leaves everywhere. */
const fireLoops: SoundLoop[] = []
const torchLoop = gooseSounds?.loop('torch')
const pondLoop = gooseSounds?.loop('river_calm')
const windLoop = gooseSounds?.loop('wind')
const leavesLoop = gooseSounds?.loop('leaves')
/**
 * His sounds, `dt` s on: his feet on land and his paddling in the pond, his goslings' after his; the fright as the
 * strike lands and his calls after them once they bolt; a gosling's happy peeps as he comes to the little one, and as the little one comes
 * back to him; a sound of his own now and then; the fires, the pond, the wind and the leaves; the rats. Paused or
 * loading, all hushed.
 */
function gooseSoundsFrame(dt: number) {
  if (!gooseSounds) return
  gooseSounds.hushed = settings.paused || !loaded
  gooseMusic?.frame(!opening.running(), goosePlay.circle, goosePlay.goslings.filter(Boolean).length)
  if (backgroundMusic) {
    if (ending.running()) musicIn = Math.max(0, musicIn - dt / MUSIC_FADE_OUT)
    else if (!opening.running() && !gooseSounds.hushed && gooseSounds.context.state === 'running') musicIn = Math.min(1, musicIn + dt / MUSIC_FADE)
    backgroundMusic.set(musicIn * musicIn)
  }
  const at = hisAt()
  gooseSounds.walk(at, dt, swimmingIn(pondLook, at.x, at.z, pondLook.goose), goose.footfalls)
  goosePlay.goslings.forEach((g, k) => {
    if (!g) return
    const here = { x: g.x, y: standAt(g.x, g.z) + 0.1, z: g.z }
    gooseSounds.patter(k, here, dt, swimmingIn(pondLook, g.x, g.z, pondLook.gosling))
    const back = g.state !== 'waiting'
    // Back with him: a run of happy peeps, each after the last at a gap of its own.
    if (back && withHer[k] === false && !opening.running()) {
      const [least, most] = FOUND_PEEPS
      const peeps = least + Math.floor(Math.random() * (most - least + 1))
      for (let p = 0, after = 0; p < peeps; p++, after += FOUND_GAP[0] + Math.random() * (FOUND_GAP[1] - FOUND_GAP[0])) happyPeep(k, 1, after)
    }
    withHer[k] = back
  })
  excitedFrame(dt)
  guideCallFrame(dt)
  islandCallsFrame(dt)
  outroPeepsFrame()
  chatFrame()
  if (opening.on && !openingSkipped) {
    openingClock += dt
    if (!opening.running() && openingClock < INTRO.end - 0.1) openingSkipped = true
  }
  if (opening.running() && !frightHeard && opening.t >= INTRO.strike) {
    frightHeard = true
    gooseSounds.play('fright', at)
    const tree = run.lights()[pitLight]
    if (tree) gooseSounds.play('thunder', { x: tree.x, y: standAt(tree.x, tree.z) + 2, z: tree.z })
    opening.brood().forEach((k) => {
      const g = goosePlay.goslings[k]!
      const here = { x: g.x, y: standAt(g.x, g.z) + 0.2, z: g.z }
      for (const [soonest, latest] of COWER_PEEPS) gooseSounds.play('cower_peep', here, 1, soonest + Math.random() * (latest - soonest))
    })
  }
  goosePlay.goslings.forEach((g, k) => {
    const was = goslingWas[k]
    goslingWas[k] = g && { x: g.x, z: g.z }
    if (!g || !was || dt <= 0 || !opening.running() || opening.t < INTRO.bolt || goosePlay.plain.braziers[k]!.follows !== undefined) return
    const pace = Math.hypot(g.x - was.x, g.z - was.z) / dt
    if (pace < PANIC_PACE[0] || pace > PANIC_PACE[1]) return
    panicWait[k] = (panicWait[k] ?? Math.random() * PANIC_PEEPS[0]) - dt
    if (panicWait[k]! > 0) return
    panicWait[k] = PANIC_PEEPS[0] + Math.random() * (PANIC_PEEPS[1] - PANIC_PEEPS[0])
    gooseSounds.play('panic_peep', { x: g.x, y: standAt(g.x, g.z) + 0.2, z: g.z })
  })
  const after = CALLS_AFTER[callsAfterHeard]
  if (after && !openingSkipped && openingClock >= after.at) {
    callsAfterHeard++
    gooseSounds.play('honk', at, after.gain)
  }
  if (!opening.running() && dt > 0) {
    mutterWait -= dt
    if (mutterWait <= 0) {
      mutterWait = MUTTER_PAUSE[0] + Math.random() * (MUTTER_PAUSE[1] - MUTTER_PAUSE[0])
      gooseSounds.play(Math.random() < QUERIES ? 'query' : 'mutter', at)
    }
  }
  run.lights().forEach((light, k) => {
    const loop = (fireLoops[k] ??= gooseSounds.loop(k === pitLight ? 'fire_crackling' : 'fire_calm'))
    loop.set(k === pitLight ? litShare(opening.t) : light.on ? 1 : 0, { x: light.x, y: standAt(light.x, light.z) + 0.6, z: light.z })
  })
  torchLoop?.set(torchHeard.level, { x: at.x, y: at.y + 0.5, z: at.z }, torchHeard.faster)
  // From the shore nearest him, or from him once he is in.
  const dx = at.x - pondLook.x
  const dz = at.z - pondLook.z
  const off = Math.hypot(dx, dz) || 1
  const shore = Math.min(off, shoreAt(pondLook, Math.atan2(dz, dx)))
  pondLoop?.set(1, { x: pondLook.x + (dx / off) * shore, y: at.y, z: pondLook.z + (dz / off) * shore })
  windLoop?.set(1)
  leavesLoop?.set(1)
  ratsHeardFrame()
  scenesHeardFrame(dt, at)
}
/** How far from him a ghost is heard, m, and the pause between its moans, s. */
const GHOST_HEARD = 18
const GHOST_PAUSE = [5, 11] as const
let ghostWait = GHOST_PAUSE[0]
/** How far past the graveyard's ground the camera's view wakes its ghosts, m: woken out of sight, their cloth settles before it shows. */
const GHOST_SETTLE = 3
/**
 * Whether the graveyard's ghosts may be seen or heard: its ground, their lamps' reach and GHOST_SETTLE round it, in
 * the camera's view, or within earshot of him. Else they are neither walked nor drawn, and walk on from where the
 * play's clock has them once woken. Without the graveyard they walk round him, always awake.
 */
function ghostsNear(): boolean {
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
  return within(x, z, radius, GHOST_HEARD) || (!!ghosts && view.inView(x, z, radius + ghosts.look.reach + GHOST_SETTLE))
}
/** Now and then, the ghost nearest him moans, from where it walks, if near enough. */
function ghostsHeardFrame(dt: number) {
  if (!ghosts || !gooseSounds || opening.running() || dt <= 0) return
  ghostWait -= dt
  if (ghostWait > 0) return
  ghostWait = GHOST_PAUSE[0] + Math.random() * (GHOST_PAUSE[1] - GHOST_PAUSE[0])
  const { holder } = goosePlay
  const away = (g: { x: number; z: number }) => Math.hypot(g.x - holder.x, g.z - holder.z)
  const nearest = ghosts.lights.reduce<(typeof ghosts.lights)[number] | undefined>((best, g) => (!best || away(g) < away(best) ? g : best), undefined)
  if (nearest && away(nearest) < GHOST_HEARD) gooseSounds.play('moan', { x: nearest.x, y: standAt(nearest.x, nearest.z) + 1, z: nearest.z })
}
/**
 * His torch catching, heard once each time: as it lights, out, at a fire; and lit, as he starts holding to top it up
 * there, not quite full. The well's winch, heard while its bucket winds up, and quicker as it drops back; the cage's padlock giving
 * and its door creaking open as it unlocks.
 */
let litWas = true
let toppingWas = false
const winchUp = gooseSounds?.loop('winch')
const winchDown = gooseSounds?.loop('winch', 1.8)
const woundWas: number[] = []
const unlockedWas: boolean[] = []
/** When each cage's key was last heard taken, s of the play. */
const takenHeard: number[] = []
let fallingWas = false
function scenesHeardFrame(dt: number, at: { x: number; y: number; z: number }) {
  if (!gooseSounds || dt <= 0) return
  const lit = goosePlay.run.torch.lit
  const topping = lit && goosePlay.atRefill && input.commands.interact
  if ((lit && !litWas) || (topping && !toppingWas && goosePlay.run.fuel < 0.98)) gooseSounds.play('ignite', { x: at.x, y: at.y + 0.5, z: at.z })
  litWas = lit
  toppingWas = topping
  // His death, as he falls.
  const falling = !Number.isNaN(goosePlay.fallen)
  if (falling && !fallingWas) gooseSounds.play('death')
  fallingWas = falling
  let up = 0
  let down = 0
  let well = at
  goosePlay.scenes.forEach((scene, s) => {
    const here = { x: scene.x, y: standAt(scene.x, scene.z) + 0.8, z: scene.z }
    if (scene.kind === 'well') {
      const turned = scene.wound - (woundWas[s] ?? scene.wound)
      woundWas[s] = scene.wound
      if (turned > 0) up = 1
      if (turned < 0) down = 1
      if (turned !== 0) well = here
    } else if (scene.kind === 'cage') {
      const unlocked = !Number.isNaN(scene.unlockedAt)
      if (unlocked && unlockedWas[s] === false) gooseSounds.play('padlock', here)
      unlockedWas[s] = unlocked
      // Its key taken up: heard from where it lay, and the gosling in the cage, seeing it, peeps once.
      if (!Number.isNaN(scene.takenAt) && scene.takenAt !== takenHeard[s]) {
        takenHeard[s] = scene.takenAt
        gooseSounds.play('key', { x: scene.key.x, y: standAt(scene.key.x, scene.key.z) + 0.2, z: scene.key.z })
        if (feel.key.peep > 0) happyPeep(scene.brazier, feel.key.peep, feel.key.peepAfter)
      }
    }
  })
  winchUp?.set(up, well)
  winchDown?.set(down, well)
}
/**
 * The swarm heard in its three rings (goosesounds.ts), all as the rats in view are many, RATS_LOUD and more the most;
 * none before the rush: the far ring first, full at a share FAR_FULL of that; the near ring as they are many. And as
 * A Plague Tale's rats tell the player of their state, the edge, the rats running hardest at his light's edge: a little,
 * EDGE[0] of it, while his torch burns well, the more as it burns down past DANGER_FROM of its fuel, all of it once out.
 */
const RATS_LOUD = 300
const FAR_FULL = 0.4
const EDGE = [0.1, 1] as const
const DANGER_FROM = 0.3
const swarmFar = gooseSounds?.loop('swarm_far')
const swarmNear = gooseSounds?.loop('swarm_near')
const swarmEdge = gooseSounds?.loop('swarm_edge')
function ratsHeardFrame() {
  if (!gooseSounds) return
  const many = rats.object.visible ? Math.min(1, rats.drawn / RATS_LOUD) : 0
  const { torch, fuel } = goosePlay.run
  const danger = !torch.lit ? 1 : Math.max(0, 1 - fuel / DANGER_FROM)
  swarmFar?.set(Math.min(1, many / FAR_FULL))
  swarmNear?.set(many)
  swarmEdge?.set(many * (EDGE[0] + (EDGE[1] - EDGE[0]) * danger))
}

/**
 * The goose game's hold indicator, over the goose while he is by the burning branch lying there, at the well or the dead tree (#190), at the cage's skull
 * or the cage (#191); none in a take. A scene the key works now before a fire's dip it overlaps. Where the key does nothing yet, what to do first: at the dead tree with his torch out.
 * At the cage without its key, the hint over the cage says it.
 */
const holdHint = !filming ? createHoldHint() : undefined
/** How high over the ground he stands on the indicator's foot, m: over his head. */
const HINT_HEIGHT = 1.15
const hintAt = new Vector3()
/**
 * The hold indicator over him as the camera now sees him: filling as the bucket comes up at the well, as the dead tree
 * catches, as the torch fills at a fire; hidden elsewhere.
 */
function holdHintFrame() {
  holdShown = false
  if (!holdHint) return
  holdHint.prompt(promptedOf(input.commands))
  if (opening.running() || ending.running() || goosePlay.down) return holdHint.update(null, 0)
  const well = goosePlay.scenes.find((s) => s.kind === 'well' && s.near)
  const winching = well?.kind === 'well'
  const tree = goosePlay.scenes.find((s) => s.kind === 'tree' && s.near)
  const lighting = tree?.kind === 'tree'
  // At the cage with its key, a hold; at the key: one press.
  const cage = goosePlay.scenes.find((s) => s.kind === 'cage' && s.near && s.carried)
  const unlocking = cage?.kind === 'cage'
  const pressing = !unlocking && goosePlay.scenes.some((s) => s.kind === 'cage' && s.near)
  // In a scene's zone, its gosling still in it, the key doing nothing yet.
  const { holder } = goosePlay
  const waiting = (s: { brazier: number }) => goosePlay.goslings[s.brazier]!.state === 'waiting'
  const unlit = goosePlay.scenes.some((s) => s.kind === 'tree' && waiting(s) && Number.isNaN(s.calledAt) && !goosePlay.run.torch.lit && inZone(goosePlay.zoneOf(s), holder))
  // By the burning branch, lying there: one press.
  const branch = goosePlay.atBranch
  if (!winching && !lighting && !unlocking && !pressing && !unlit && !branch && !goosePlay.atRefill) return holdHint.update(null, 0)
  holdShown = true
  hintAt.set(shown.x, stood + HINT_HEIGHT, shown.z).project(camera)
  const box = renderer.domElement.getBoundingClientRect()
  const at = { x: box.left + ((hintAt.x + 1) / 2) * box.width, y: box.top + ((1 - hintAt.y) / 2) * box.height }
  if (branch) holdHint.update(at, 0, 'pick it up!')
  else if (winching) holdHint.update(at, well.wound)
  else if (lighting) holdHint.update(at, tree.catching)
  else if (unlocking) holdHint.update(at, cage.unlocking, 'hold to unlock')
  else if (pressing) holdHint.update(at, 0, 'pick it up')
  else if (goosePlay.atRefill) holdHint.update(at, goosePlay.run.torch.lit ? goosePlay.run.fuel : goosePlay.kindled, torchFilledOnce() ? 'hold to refill' : 'light your torch')
  else holdHint.update(at, 0, 'light your torch', false)
}

/**
 * His fall and wake: black as he falls; waking, the black lifting over WAKE_BLACK s
 * of it, the fire he wakes by flaring, its light reaching WAKE_FLARE more at its height, up and back over
 * WAKE_FLARE_AT s, and his colour coming back over WAKE_COLOUR s. His torch catches between (gooseplay.ts RISE_CATCH).
 */
const fallenBlack = document.getElementById('fallen')
const WAKE_BLACK = [0.15, 0.7] as const
const WAKE_FLARE = 0.8
const WAKE_FLARE_AT = [0.1, 0.55, 1.6] as const
const WAKE_COLOUR = [1, 2.2] as const
/** How many times he had fallen as of the last frame: one more, he has woken, and the camera is put on him at once. */
let fallsSeen = 0

/** Where he is on the screen, 0 to 1 from its top left: where his life's dark closes on. */
const darkOn = new Vector3()

/** His life, shown on the frame alone: its colour draining with it, grey as it runs out; his death's dark swirling in as he falls, black, coming back as he wakes; in full colour and clear through the opening and the ending. */
function lifeFrame() {
  const { fallen, woken } = goosePlay
  const scripted = opening.running() || ending.running()
  const { after, finish, progress } = darkLook
  // The fall as long as his death and the dark take, read live; his torch dying over both, so the rats close in slowly
  // and never bury him as he dies.
  goosePlay.settings.fall.lasts = after + finish + DARK_HELD
  goosePlay.settings.fall.dims = after + finish
  let black = 0
  if (fallen >= after + finish) black = 1
  else if (!Number.isNaN(woken)) black = 1 - eased(woken, ...WAKE_BLACK)
  if (fallenBlack) fallenBlack.style.opacity = String(black)
  const colour = Number.isNaN(woken) ? goosePlay.life : eased(woken, ...WAKE_COLOUR)
  post.colour(scripted ? 1 : colour)
  // His death's dark: swirling in over `finish` s once his death has played `after` s; or held at the folder's progress, to see it.
  const falling = !Number.isNaN(fallen)
  const dark = progress >= 0 ? progress : falling && !scripted ? Math.min(1, Math.max(0, fallen - after) / Math.max(finish, 1e-3)) : 0
  darkOn.set(goose.object.position.x, goose.object.position.y + 0.4, goose.object.position.z).project(camera)
  post.dark(dark, (darkOn.x + 1) / 2, (1 - darkOn.y) / 2, falling ? fallen : beats.clock, darkLook)
}

/** The lights as drawn, the fire he wakes by flaring while he wakes: the lit flame nearest where he wakes. */
function wakeFlare(placed: readonly FixedLight[]): readonly FixedLight[] {
  const { woken } = goosePlay
  if (Number.isNaN(woken)) return placed
  const [from, top, to] = WAKE_FLARE_AT
  const up = woken < top ? eased(woken, from, top) : 1 - eased(woken, top, to)
  const { restAt, level } = goosePlay
  let nearest = -1
  let best = Number.POSITIVE_INFINITY
  level.lights.forEach((one, k) => {
    const off = Math.hypot(one.x - restAt.x, one.z - restAt.z)
    if (one.flame && one.on && off < best) [nearest, best] = [k, off]
  })
  return placed.map((one, k) => (k === nearest ? { ...one, reach: one.reach * (1 + WAKE_FLARE * up) } : one))
}

/**
 * `?marker` (the goose game's default, the portrait) or `?marker=doodle`: the calling gosling's badge
 * (goslingbadge.ts), there all the time he calls and on over his head as the goose comes, quiet, till the goose has
 * him; its honks small, said rather than shouted, over
 * the gosling's head in view alone, none by the badge, and heard barely far off, louder as the goose comes; and his torch
 * out, or at the cage with its key, what to do written over where it is done (aheadFrame).
 */
const badgeLook = url.get('marker') === 'doodle' ? 'doodle' : 'portrait'
/**
 * On a phone, the badge fitted to the screen: as drawn on a short side of BADGE_FIT_SIDE px, smaller on a smaller one,
 * never larger, and read each frame, so it follows the phone turned; elsewhere as drawn.
 */
const BADGE_FIT_SIDE = 800
const badgeFit = () => (phone ? Math.min(1, Math.min(innerWidth, innerHeight) / BADGE_FIT_SIDE) : 1)
const callBadge = !filming && featureOn('marker') ? createGoslingBadge(badgeLook, badgeFit) : undefined
if (dev && callBadge && badgeLook === 'portrait' && !noPanel) mountBadgeControls(dev.GUI)
/** The badge's honk, as said, and how big it is written; whether its gosling is in view, for it to be written at all. */
const BADGE_WORD = '*honk*'
const BADGE_CALL = 0.5
let callSeen = false
/** How loud the badge's gosling calls, far off (CALL_FAR m) and near (CALL_QUIET m): barely heard, then louder as the goose comes. */
const BADGE_HEARD = [0.08, 1] as const
/** The nearest waiting gosling's call, over him or at the screen's edge on his side (callhint.ts); none in a take. */
const callHint =
  !filming
    ? createCallHint(
        (far) => {
          const heard = callBadge ? BADGE_HEARD[1] + (BADGE_HEARD[0] - BADGE_HEARD[1]) * far : CALL_HEARD[0] + (CALL_HEARD[1] - CALL_HEARD[0]) * far
          gooseSounds?.play('call', callHeard, heard)
          callBadge?.pop()
        },
        // Out of view, written nowhere.
        callBadge && (() => (callSeen ? BADGE_WORD : '')),
      )
    : undefined
/** Where the gosling calling is heard from, m; how loud he calls, near and far: louder far, as his word is bigger. */
const callHeard = new Vector3()
const CALL_HEARD = [0.7, 1.3] as const
/** How near the goose comes for him to call his smallest, m. */
const CALL_QUIET = 3
/** How big he calls at CALL_QUIET m off, growing to CALL_LOUDEST at CALL_FAR m off or further: a far gosling calls louder for the goose. */
const CALL_NEAREST = 0.85
const CALL_LOUDEST = 1.5
const CALL_FAR = 20
/** How near the goose comes for the badge to start shrinking, m, smallest at CALL_QUIET m: he is nearly there. */
const BADGE_SHRINKS_FROM = 10
/** How fast the goose walks away from the gosling for him to call his most urgently, m/s; how long his urgency takes to follow the goose, s. */
const CALL_HURRY = 1
const CALL_SETTLE = 0.4
/** How far in from the screen's edge a call out of view sits, px, whatever its size. */
const CALL_MARGIN = 120
/** How far in from it the badge sits out of view, px, further in than the words, fitted to a phone's screen as the badge is. */
const BADGE_MARGIN = 160
/** How far clear of the touch stick and button a badge out of view keeps, px. */
const BADGE_THUMBS_GAP = 10
/** A badge out of view reaching `reach` px from `at` lifted clear of the touch stick and button while they show. */
function clearOfThumbs(at: CallAt, reach: number) {
  if (!input.thumbsShown || !at.out) return
  const layout = touchLayout(input.viewport())
  for (const [middle, radius] of [[layout.stick, STICK_REACH], [layout.button, BUTTON_RADIUS]] as const) {
    const clear = radius + reach + BADGE_THUMBS_GAP
    const across = at.x - middle.x
    if (Math.abs(across) < clear) at.y = Math.min(at.y, middle.y - Math.sqrt(clear * clear - across * across))
  }
}
const CALL_HEIGHT = 0.05
const GOSLING_HEAD = 0.3
const callFrom = new Vector3()
/** The gosling calling, how far off the goose was last frame, m, and how urgently he calls, -1 the goose comes to 1 the goose goes. */
let calling = -1
let callAway = 0
let callUrgency = 0
/** How long the calls rest after a gosling is found, s; how long is left of it; and how many goslings were still waiting. */
const CALL_REST = 2
let callRest = 0
let stillWaiting = -1
/**
 * Whether what to do is written this frame, over him (holdHintFrame) or where it is done (aheadFrame): he is there,
 * so the badge, saying where to go, hides in view, lest it lie over the words.
 */
let holdShown = false
let aheadShown = false
/** But a well's gosling's badge stays over him with the words till the goose is this near him, m: nearly at the well. */
const BADGE_AT_WELL = 4
const badgeShown = (at: CallAt, kid: number, off: number) => {
  const atWell = goosePlay.scenes.some((s) => s.brazier === kid && s.kind === 'well') && off > BADGE_AT_WELL
  return !at.out && (holdShown || (aheadShown && !atWell)) ? 0 : 1
}
/** How long after the opening the first gosling calls, the goose's torch lit or not, s; and how long since it ended. */
const CALL_AFTER_INTRO = 1
let sinceIntro = 0
/**
 * The nearest gosling still waiting calling him, till he finds the little one: only the nearest, so one passed by falls quiet as
 * he goes on, and he need not find them all. Once he is within EXCITED_FROM m the gosling stops calling: the little one has seen him
 * coming, and peeps happily instead (excitedFrame). With none left waiting, the badge stays on the gosling leading him home, quiet, till the ending.
 */
function callHintFrame(dt: number) {
  if (!callHint || opening.running()) return
  if (ending.running()) {
    callBadge?.update(null, 0, dt)
    return callHint.update(null, dt)
  }
  // One just found, the rest wait CALL_REST s before the next calls: he has the little one back first.
  const waiting = goosePlay.goslings.filter((g) => g?.state === 'waiting').length
  if (stillWaiting >= 0 && waiting < stillWaiting) callRest = CALL_REST
  stillWaiting = waiting
  callRest = Math.max(0, callRest - dt)
  sinceIntro += dt
  const { holder } = goosePlay
  const away = (g: { x: number; z: number }) => Math.hypot(g.x - holder.x, g.z - holder.z)
  let next = -1
  goosePlay.goslings.forEach((g, k) => {
    if (g?.state === 'waiting' && (next < 0 || away(g) < away(goosePlay.goslings[next]!))) next = k
  })
  // Found the moment the goose is in the pond's water, the last has all the way to the island still to lead him: no rest for his badge.
  const guiding = next < 0 && !!callBadge && goosePlay.goslings[goosePlay.guide]?.state === 'guiding'
  if (guiding) next = goosePlay.guide
  const g = goosePlay.goslings[next]
  const off = g ? away(g) : Infinity
  // Let out of his cage, he is found: no badge, no call, while its door opens and he walks out.
  const freed = goosePlay.scenes.some((s) => s.brazier === next && s.kind === 'cage' && s.open)
  if (!g || freed || (callRest > 0 && !guiding) || sinceIntro < CALL_AFTER_INTRO) {
    calling = -1
    callBadge?.update(null, 0, dt)
    return callHint.update(null, dt)
  }
  // Over his head as drawn, up a tree or down a well.
  goslings.headOf(next, callFrom)
  callFrom.y += CALL_HEIGHT
  callHeard.copy(callFrom)
  callFrom.project(camera)
  const box = renderer.domElement.getBoundingClientRect()
  const at = callAt(callFrom, box, callBadge ? BADGE_MARGIN * badgeFit() : CALL_MARGIN)
  if (callBadge) clearOfThumbs(at, callBadge.edgeReach)
  const close = Math.min(1, Math.max(0, (BADGE_SHRINKS_FROM - off) / (BADGE_SHRINKS_FROM - CALL_QUIET)))
  // Seen the goose, he peeps instead; his badge stays over him till the goose has him.
  if (off < EXCITED_FROM || guiding) {
    calling = -1
    callBadge?.update(at, badgeShown(at, next, off), dt, next, close)
    return callHint.update(null, dt)
  }
  if (next !== calling) {
    calling = next
    callUrgency = 0
  } else if (dt > 0) {
    const going = Math.min(1, Math.max(-1, (off - callAway) / dt / CALL_HURRY))
    callUrgency += (going - callUrgency) * (1 - Math.exp(-dt / CALL_SETTLE))
  }
  callAway = off
  const far = Math.min(1, Math.max(0, (off - CALL_QUIET) / (CALL_FAR - CALL_QUIET)))
  const size = CALL_NEAREST + (CALL_LOUDEST - CALL_NEAREST) * far
  if (!callBadge) return callHint.update({ ...at, size, far, urgency: callUrgency }, dt)
  callBadge.update(at, badgeShown(at, next, off), dt, next, close)
  callSeen = !at.out
  callHint.update({ x: at.x, y: at.y, size: BADGE_CALL, far, urgency: callUrgency }, dt)
}

/**
 * `?marker`: what to do, written over where it is done, at the screen's edge on its side out of view, only
 * where the badge does not already say it: near the well, over its winch; near the dead tree, over where the gosling is called
 * down, or with the goose's torch out, over its fire; at the cage, over the cage, to find its key, then with it to unlock it;
 * nothing near a ghost's gosling. Never over a fire for his torch out: the hold indicator over him says it once he is at one.
 * But for the start: 'pick it up!' over the burning branch from the moment it lands, the opening still playing, till he
 * is by it; or, with no branch, his torch never yet lit, START_HINT_AFTER s after the opening without his going to it,
 * 'light your torch' over the burning tree's foot, till he lights it.
 * Gone once he can work it, the hold indicator over him then.
 */
const aheadHint = callBadge ? createHoldHint() : undefined
/** How near its gosling he is for it, m; how high over the ground it is written, m. */
const AHEAD_FROM = EXCITED_FROM + 1
const AHEAD_HEIGHT = 0.9
/** How high over the ground it is written over the burning branch, m: lower, for the branch lies flat. */
const AHEAD_BRANCH_HEIGHT = 0.6
/** How long after the opening, his torch never lit and he not at the burning tree's fire, the burning tree's hint waits, s. */
const START_HINT_AFTER = 4
const aheadAt = new Vector3()
function aheadFrame() {
  aheadShown = false
  if (!aheadHint) return
  const { branch } = goosePlay
  const branchLying = branch !== undefined && !branch.carried && branch.landed
  // In the opening, the branch's alone, Space skipping it till it ends.
  if ((opening.running() && !branchLying) || ending.running() || goosePlay.atRefill || (goosePlay.atBranch && !opening.running()) || goosePlay.scenes.some((s) => s.near)) return aheadHint.update(null, 0)
  const { holder } = goosePlay
  const box = renderer.domElement.getBoundingClientRect()
  if (branch && branchLying) {
    aheadAt.set(branch.x, standAt(branch.x, branch.z) + AHEAD_BRANCH_HEIGHT, branch.z).project(camera)
    aheadShown = true
    const at = callAt(aheadAt, box, CALL_MARGIN)
    return aheadHint.update(at, 0, 'pick it up!', false, at.out ? Math.atan2(at.out.y, at.out.x) : Math.PI / 2)
  }
  if (!branch && pitLight >= 0 && !torchFilledOnce() && sinceIntro >= START_HINT_AFTER) {
    const tree = goosePlay.level.lights[pitLight]!
    aheadAt.set(tree.x, standAt(tree.x, tree.z) + AHEAD_HEIGHT, tree.z).project(camera)
    aheadShown = true
    return aheadHint.update(callAt(aheadAt, box, CALL_MARGIN), 0, 'light your torch', false)
  }
  const scene = goosePlay.scenes.find((s) => {
    const g = goosePlay.goslings[s.brazier]
    return g?.state === 'waiting' && Math.hypot(g.x - holder.x, g.z - holder.z) < AHEAD_FROM
  })
  const ahead = scene && aheadOf(scene)
  if (!ahead) return aheadHint.update(null, 0)
  const { x, z } = ahead.zone
  aheadAt.set(x, standAt(x, z) + AHEAD_HEIGHT, z).project(camera)
  aheadShown = true
  // An arrow under the words, down at the place in view, out toward it at the edge, as the badge's.
  const at = callAt(aheadAt, box, CALL_MARGIN)
  aheadHint.update(at, 0, ahead.word, false, at.out ? Math.atan2(at.out.y, at.out.x) : Math.PI / 2)
}
/**
 * What to do at `scene` now, and where, where the badge does not say it: the well's winch; the dead tree, from where
 * the gosling is called down, or its fire with the goose's torch out; the cage, its key to find or with it.
 */
function aheadOf(scene: SceneState): { zone: Zone; word: string } | undefined {
  const play = goosePlay
  if (scene.kind === 'well') return { zone: play.zoneOf(scene), word: 'winch it up' }
  if (scene.kind === 'tree') {
    if (!Number.isNaN(scene.calledAt)) return undefined
    return play.run.torch.lit ? { zone: play.zoneOf(scene), word: 'call him down' } : { zone: play.fireZoneOf(scene), word: 'light your torch' }
  }
  if (scene.kind === 'cage' && !scene.open) return { zone: play.zoneOf(scene), word: scene.carried ? 'unlock it' : 'find the key' }
  return undefined
}

/** Whether what the game hides until its moment has been drawn once unseen, to build its pipelines. */
let unseenBuilt = false
/** Whether the page has loaded: every pipeline built, the GPU done building them, and the loading screen fading. */
let loaded = false
/**
 * Show what is hidden until its moment, and draw what stands out of sight;
 * the function returned puts it all back. Hidden until their moment, the rats,
 * the rain's streaks, the flames of the lights not yet lit, the torch's flame,
 * embers and smoke while it starts out, would build their pipelines only then,
 * and stall the strike, the rain's coming or the torch's first lighting (108 ms
 * on the goose game, 2026-10-27); and what stands out of the cameras' sight at
 * the start, the sun's shadow camera's too, stalls his arrival where it stands
 * (150-200 ms at the goose game's well, cage and pond); and the graveyard's
 * ghosts, asleep till he comes near, stalled him at the dead tree beside it
 * (350-550 ms, 2026-10-30); and the goslings out of sight, the moon's shadow
 * of the first to come into it (50 ms at the well); and the island's geese, drawn only near it, the mother stalled him
 * in the graveyard, in sight of it, on a phone's first visit (749 ms, 2026-11-03).
 */
function showUnseen(placed: readonly FixedLight[]): () => void {
  const ratsShown = rats.object.visible
  rats.object.visible = true
  const islanders = [islandGeese.object, ...islandGeese.object.children]
  const islandersShown = islanders.map((part) => part.visible)
  for (const part of islanders) part.visible = true
  const ghostsShown = ghosts?.object.visible
  if (ghosts) ghosts.object.visible = true
  // Each gosling, hidden while the camera does not see him, as the first in sight (goslings.ts): his shadow is not the goose's.
  const birds = goslings.object.children
  const birdsShown = birds.map((bird) => bird.visible)
  for (const bird of birds) bird.visible = true
  lights.update(placed.map((light) => ({ ...light, on: true })))
  const fireShown = sceneFires.map(({ fire }) => fire.object.visible)
  for (const { fire } of sceneFires) fire.object.visible = true
  const pitShown = pitFires.map(({ fire }) => fire.object.visible)
  for (const { fire } of pitFires) fire.object.visible = true
  const torchParts = [flame.object, embers.object, smoke.object, ...crownFires.map(({ fire }) => fire.object), ...trunkFires.map(({ fire }) => fire.object), ...(footFire ? [footFire.object] : [])]
  // The burning branch, hidden in the crown till it snaps, its flame and its embers.
  if (burningBranch && branchFire && branchEmbers) torchParts.push(burningBranch.object, branchFire.object, branchEmbers.object)
  const torchShown = torchParts.map((part) => part.visible)
  for (const part of torchParts) part.visible = true
  const culled: Object3D[] = []
  scene.traverse((object) => {
    if (!object.frustumCulled) return
    object.frustumCulled = false
    culled.push(object)
  })
  return () => {
    for (const object of culled) object.frustumCulled = true
    lights.update(placed)
    sceneFires.forEach(({ fire }, i) => (fire.object.visible = fireShown[i]!))
    pitFires.forEach(({ fire }, p) => (fire.object.visible = pitShown[p]!))
    torchParts.forEach((part, i) => (part.visible = torchShown[i]!))
    rats.object.visible = ratsShown
    islanders.forEach((part, k) => (part.visible = islandersShown[k]!))
    if (ghosts) ghosts.object.visible = ghostsShown!
    birds.forEach((bird, k) => (bird.visible = birdsShown[k]!))
  }
}

/** Draw everything at once, shown and in sight, shadows and all, under the frame the page shows: the last of the loading. */
function buildUnseen(placed: readonly FixedLight[]) {
  unseenBuilt = true
  const back = showUnseen(placed)
  sun.shadow.needsUpdate = lamp.shadow.needsUpdate = true
  post.render()
  back()
  shadowed.dirty = true
}

/** The loading screen, index.html's: the share of the scene built so far on it, and gone once all of it is. */
const loadingScreen = document.getElementById('loading')
const loadingShare = loadingScreen?.querySelector<HTMLElement>('.share')
loadingScreen?.addEventListener('transitionend', (event) => {
  if (event.target === loadingScreen && loadingScreen.classList.contains('loaded')) loadingScreen.remove()
})
/** How many pipelines' objects a frame of the loading draws: a couple, so a frame takes a fifth of a second or so. */
const PIPELINES_A_SLICE = 2
/** The share of the loading screen's count the scene pass's pipelines take, built all at once before the slices. */
const COMPILED_SHARE = 0.6
/** Whether the scene pass's pipelines are built: undefined until asked for, false while they build (Post.compileScene). */
let sceneCompiled: boolean | undefined
/** The loading's frames with nothing of the scene drawn: the post's own pipelines built on the first, the step's on the second. */
const EMPTY_FRAMES = 2
/** The loading's one frame the swarm steps on, to build the step's pipelines: a step or two, which moves no rat to speak of. */
const STEP_FRAME = 1
/** The scene's drawn objects in slices, made on the loading's first frame, the scene all there by then. */
let loadSlices: PipelineSlices | undefined
/** How many frames the loading has drawn. */
let loadFrame = 0
/** Whether the loading's last frame is still being built on the GPU: no more is drawn until it is. */
let loadWaiting = false

/** Once the GPU has done all that is drawn so far, `then`; at once without a queue to ask. */
function whenBuilt(then: () => void) {
  if (!gpuQueue) return then()
  loadWaiting = true
  void gpuQueue.onSubmittedWorkDone().then(() => {
    loadWaiting = false
    then()
  })
}

/** The share built, 0 to 1, on the loading screen: its count. */
function showLoaded(share: number) {
  if (!loadingShare) return
  const percent = Math.round(share * 100)
  loadingShare.textContent = `${percent} %`
  loadingShare.setAttribute('aria-valuenow', String(percent))
}

/** When the bench last logged how the loading stands, ms. */
let loadWatchedAt = -Infinity
/** Under `?bench`, how the loading stands each second: on a phone that stops at a share, which step it stopped at. */
function loadWatched() {
  const now = performance.now()
  if (!benchOn || now - loadWatchedAt < 1000) return
  loadWatchedAt = now
  benchTools?.logToServer({ kind: 'load', ms: Math.round(now), backend, compiled: sceneCompiled, frame: loadFrame, slices: loadSlices?.slices.length, waiting: loadWaiting, ready: swarm.ready, unseenBuilt })
}

/**
 * A frame of the loading, drawn behind its screen in place of the game's:
 * shown and in sight as for `buildUnseen`, but one slice of the scene alone,
 * so its pipelines are built a couple a frame, each frame is shown, and the
 * screen counts them, each once the GPU has built it; past the slices, once
 * the rats stand, everything at once for what no slice drew, the game's first
 * frame over it, and once the GPU has built that, the screen fades.
 */
function loadSlice(placed: readonly FixedLight[]) {
  loadWatched()
  if (loadWaiting) return
  if (buildsApart) return loadFirstFrame(placed)
  // First the scene pass's pipelines, everything shown and in sight for the call, built many at once while the
  // screen goes on being drawn; then the slices, for what that cannot build: the shadows, the post, the step.
  if (sceneCompiled === undefined) {
    sceneCompiled = false
    loadWaiting = true
    const back = showUnseen(placed)
    const built = post.compileScene((done, of) => showLoaded((COMPILED_SHARE * done) / of))
    back()
    void built
      .catch((error: unknown) => console.warn('the scene pass was not built ahead', error))
      .then(() => {
        sceneCompiled = true
        loadWaiting = false
      })
    return
  }
  loadSlices ??= new PipelineSlices(scene, PIPELINES_A_SLICE)
  const frames = EMPTY_FRAMES + loadSlices.slices.length
  const k = loadFrame
  if (k < frames) {
    loadFrame++
    const back = showUnseen(placed)
    const backSlice = loadSlices.only(k - EMPTY_FRAMES)
    sun.shadow.needsUpdate = lamp.shadow.needsUpdate = true
    post.render()
    backSlice()
    back()
    shadowed.dirty = true
    whenBuilt(() => showLoaded(COMPILED_SHARE + ((1 - COMPILED_SHARE) * (k + 1)) / (frames + 1)))
    return
  }
  if (!swarm.ready || unseenBuilt) return
  buildUnseen(placed)
  post.render()
  whenBuilt(loadDone)
}

/** All that has to be built before the game shows, built: Enter, or the game. */
function loadDone() {
  showLoaded(1)
  if (benchOn) {
    // Under `?bench=load`, sound on: what a first visit fetched by the time Enter shows, and once the sounds are in.
    benchTools?.logFetched('ready')
    // Which material each pipeline's label names: on what, how many, skinned or instanced.
    const worn = new Map<number, { type: string; on: string[]; meshes: number; skinned: boolean; instanced: boolean }>()
    scene.traverse((object) => {
      const { material } = object as Mesh
      for (const one of material ? (Array.isArray(material) ? material : [material]) : []) {
        const entry = worn.get(one.id) ?? { type: one.type, on: [], meshes: 0, skinned: false, instanced: false }
        entry.meshes++
        if (entry.on.length < 3) entry.on.push(object.name || object.parent?.name || object.parent?.parent?.name || object.type)
        entry.skinned ||= (object as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh === true
        entry.instanced ||= (object as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh === true
        worn.set(one.id, entry)
      }
    })
    benchTools?.logToServer({ kind: 'materials', list: [...worn].map(([id, entry]) => ({ id, ...entry })) })
    setTimeout(() => benchTools?.logFetched('after 20 s'), 20000)
  }
  enterWhenAsked(() => {
    loadingScreen?.classList.add('loaded')
    loaded = true
  })
}

/**
 * A phone's first visit took 37 s here, 32 s of it building every pipeline in the game, much of that frozen and in
 * slices it does not need (iPhone 15 Pro Max, 2026-11-02; a second visit 3 s, the browser's cache holding them). So a
 * phone builds them apart from the page, so the screen goes on counting: first what the first frame draws, then the rest.
 * All of it before Enter: built behind the opening, it played the opening at 2 to 5 fps for as long as it took, 13 s.
 */
const buildsApart = lean
/** The share of the loading screen's count the first frame's pipelines fill. */
const FIRST_FRAME_SHARE = 0.6
/** A phone's loading: the first frame drawn, the swarm's first step taken with it, then all the rest, then Enter. */
function loadFirstFrame(placed: readonly FixedLight[]) {
  // What the first frame's camera sees, as things now stand: nothing hidden shown, nothing out of sight.
  if (sceneCompiled === undefined) {
    sceneCompiled = false
    loadWaiting = true
    void post
      .compileScene((done, of) => showLoaded((FIRST_FRAME_SHARE * done) / of))
      .catch((error: unknown) => console.warn('the first frame was not built ahead', error))
      .then(() => {
        sceneCompiled = true
        loadWaiting = false
      })
    return
  }
  if (loadFrame <= STEP_FRAME || !swarm.ready) {
    loadFrame++
    post.render()
    whenBuilt(() => {})
    return
  }
  if (unseenBuilt) return
  unseenBuilt = true
  post.render()
  loadWaiting = true
  const back = showUnseen(placed)
  const built = post.compileScene((done, of) => showLoaded(FIRST_FRAME_SHARE + ((1 - FIRST_FRAME_SHARE) * done) / of))
  back()
  void built
    .catch((error: unknown) => console.warn('the scene was not built', error))
    .then(() => {
      allBuilt()
      loadWaiting = false
      if (benchOn) benchTools?.logToServer({ kind: 'built', ms: Math.round(performance.now()) })
      whenBuilt(loadDone)
    })
}

/**
 * The goose game, built, waits on its loading screen for the player to enter, by its button or the controls' confirm:
 * their click, key or pad's press is what lets the browser play sounds, so the opening is heard from its first moment.
 * Safari takes no pad's press for it: it enters all the same, heard from the first click or key.
 * Filmed or driven by a tool, it goes straight in.
 */
const askToEnter = !!gooseSounds && !filming && !navigator.webdriver
/** The loading screen's Enter pressed, once it shows. */
let enterAsked: (() => void) | undefined
/** On a pad, its button beside the loading screen's Enter. */
let enterPad: PadButton | undefined
function enterWhenAsked(go: () => void) {
  if (!askToEnter || !loadingScreen) return go()
  // In the share's place, so the title stays where it is.
  const slot = loadingShare?.parentElement ?? loadingScreen
  loadingShare?.remove()
  const enter = document.createElement('button')
  enter.className = 'enter'
  enter.textContent = 'Enter'
  enterPad = padBeside(enter)
  let entered = false
  const once = () => {
    if (entered) return
    entered = true
    enterAsked = undefined
    enter.disabled = true
    // From a pad's press, the sounds' own unlock on a click or key never ran.
    gooseSounds?.unlock()
    go()
  }
  enter.addEventListener('click', once)
  enterAsked = once
  slot.append(enter)
  enter.focus()
}

/** The game paused or going on, the panel's pause button saying which. */
function setPaused(on: boolean) {
  settings.paused = on
  panel?.refresh()
}
/** Whether the game pauses on its own here: in the opening, the play or the ending's card, not in edit mode. */
const pausesHere = () => loaded && !editMode?.on && !ending.againShown()
const pauseVeil = createPauseVeil({ settings, input, gooseSounds, loaded: () => loaded, editing: () => editMode?.on, setPaused })
// Losing the window pauses the game where it would pause on Start, typing in a field or not, and so does the page
// hidden, a phone switched to another app or locked; coming back leaves it paused. Not filmed or driven by a tool,
// whose windows come and go.
if (!filming && !navigator.webdriver && !benchOn) {
  addEventListener('blur', () => pausesHere() && setPaused(true))
  document.addEventListener('visibilitychange', () => document.hidden && pausesHere() && setPaused(true))
}
// In the chase camera, Escape lets the locked pointer go before the page hears the key: the lock lost, the game pauses
// as on Escape. Turning to another camera lets it go too, the chase already left.
document.addEventListener('pointerlockchange', () => {
  if (view.chasing && !document.pointerLockElement && !filming && pausesHere()) setPaused(true)
})

// ---------------------------------------------------------------- the phone's bench
// `?bench` (phonebench.ts) reads the game's places and what each thing drawn costs, on whatever it runs on, and posts it
// to the dev server's log. For a phone: `pnpm phone`, then `?bench&intro=0&outro=0&mute` at the address it prints,
// the screen left on for a few minutes. `?bench=all` reads every cost and place; `?bench=load`, with no `mute`, what a
// first visit fetches, the sounds with it, waiting at Enter. `?bench=soak` walks him up the road and
// back for five minutes, with a stand between, which shows a phone heating up, and with the quality free to move, which
// step it settles on. Otherwise the step is held where the device starts. The goose never dies, and his torch never
// burns down. The late game's load after the first place: every gosling with him, and their rats. Elsewhere
// `&budget=` says a vsync, ms, where it isn't 60 Hz. The load is raised by the pixel ratio, up to BENCH_DPRS.
/** `objects` not drawn, in any pass: by layer, since the page sets their visibility itself, each frame. */
function benchHide(name: string, ...objects: (Object3D | undefined | false)[]): BenchCost {
  const masks = new Map<Object3D, number>()
  return {
    name,
    off() {
      for (const object of objects) {
        if (!object) continue
        object.traverse((part) => {
          masks.set(part, part.layers.mask)
          part.layers.set(31)
        })
      }
    },
    on() {
      for (const [part, mask] of masks) part.layers.mask = mask
      masks.clear()
    },
  }
}
/** A look taken off and put back. */
function benchLook(name: string, set: (on: boolean) => void): BenchCost {
  const change = (on: boolean) => {
    set(on)
    lookChanged()
  }
  return { name, off: () => change(false), on: () => change(true) }
}
const BENCH_DPRS = [2.5, 3, 4]
/** How long `?bench=soak` goes on, in rounds of a walk up, a walk back and a stand, each reading 5 s. */
const SOAK_ROUNDS = 20
function createBench(): PhoneBench | undefined {
  if (!benchTools || url.get('bench') === 'load') return undefined
  const play = goosePlay
  const everyGosling = () => play.giveGoslings(play.goslings.length)
  torchEverlasting = true
  const benchMode = url.get('bench')
  const soaking = benchMode === 'soak'
  const everything = benchMode === 'all'
  // Time for each gosling's rats to come, RATS_AFTER s apart.
  const ratsCome = 3000 + play.goslings.length * RATS_AFTER * 1000
  /** The key held down, as a player's would be: the bench walks him as a keyboard does. */
  let heldKey = ''
  const hold = (code: string) => {
    if (heldKey) dispatchEvent(new KeyboardEvent('keyup', { code: heldKey }))
    heldKey = code
    if (code) dispatchEvent(new KeyboardEvent('keydown', { code }))
  }
  const walks: BenchPlace[] = [{ name: 'gathering', go: everyGosling, settle: ratsCome }]
  for (let round = 1; round <= SOAK_ROUNDS; round++) {
    const settle = 2000
    walks.push({ name: `${round} up`, go: () => hold('KeyW'), settle }, { name: `${round} back`, go: () => hold('KeyS'), settle }, { name: `${round} stand`, go: () => hold(''), settle })
  }
  const places: BenchPlace[] = soaking ? walks : !everything ? [
    { name: 'start', go: everyGosling, settle: ratsCome },
    { name: 'dead tree', go: () => play.standBy('tree') },
    { name: 'pond', go: () => play.standByPond() },
  ] : [
    { name: 'start, no gosling', go: () => play.standAtStart() },
    { name: 'start', go: everyGosling, settle: ratsCome },
    { name: 'well', go: () => play.standBy('well') },
    { name: 'dead tree', go: () => play.standBy('tree') },
    { name: 'cage', go: () => play.standBy('cage') },
    ...(graveyard ? [{ name: 'graveyard', go: standAtGraveyard }] : []),
    { name: 'pond', go: () => play.standByPond() },
    { name: 'island', go: standOffIsland },
  ]
  const printed = { hatch: look.hatch.enabled, vignette: look.vignette.enabled, grain: look.grain.grain, paper: look.grain.paper, bloom: look.bloom.enabled, tilt: tilt?.look.enabled ?? false }
  const setTilt = (on: boolean) => {
    if (!tilt) return
    tilt.look.enabled = on && printed.tilt
    tilt.set()
  }
  const setGrain = (on: boolean) => {
    look.grain.grain = on && printed.grain
    look.grain.paper = on && printed.paper
  }
  const waterMeshes: Object3D[] = []
  scene.traverse((part) => {
    if ((part as { material?: unknown }).material === water.material) waterMeshes.push(part)
  })
  /** The pixel ratio the costs are read at, raised till the frames run over budget. */
  let benchDpr = quality.step.dpr
  const raise = () => {
    const next = BENCH_DPRS.find((dpr) => dpr > benchDpr)
    if (next === undefined) return false
    renderer.setPixelRatio((benchDpr = next))
    return true
  }
  const costs: BenchCost[] = soaking ? [] : [
    { name: 'rats at a tenth', off: () => (benchRatShare = 0.1), on: () => (benchRatShare = 1) },
    // Where the load was not raised, the first reads the same both ways: what a price of nothing looks like.
    ...[2, 1.5, 1].map((dpr): BenchCost => ({ name: `dpr ${dpr}`, off: () => renderer.setPixelRatio(dpr), on: () => renderer.setPixelRatio(benchDpr) })),
    benchLook('every effect after the scene', (on) => {
      setTilt(on)
      setGrain(on)
      look.bloom.enabled = on && printed.bloom
      look.hatch.enabled = on && printed.hatch
      look.vignette.enabled = on && printed.vignette
    }),
    benchHide('rats', rats.object),
    benchHide('dead trees and bushes', deadTreesMesh.object, deadTreesMesh.own, bushesMesh.object),
    benchHide('ground', ground.mesh),
    ...(!everything ? [] : [
      benchLook('tilt', setTilt),
      benchLook('moon shadows', (on) => (look.sun.shadows = on)),
      benchLook('bloom', (on) => (look.bloom.enabled = on && printed.bloom)),
      benchLook('hatch', (on) => (look.hatch.enabled = on && printed.hatch)),
      benchLook('grain and paper', setGrain),
      benchLook('vignette', (on) => (look.vignette.enabled = on && printed.vignette)),
      { name: 'fire shadows', off: () => (fireShadowsHeld = true), on: () => (fireShadowsHeld = false) },
      benchLook('rat trails', (on) => (look.trails.enabled = on)),
      { name: 'rat depth pre-pass', off: () => rats.setPrepass(!prepassOn), on: () => rats.setPrepass(prepassOn) },
      benchHide('falling leaves', fallingLeaves?.object),
      benchHide('goose and goslings', goose.object, goslings.object),
      ...(graveyard && ghosts ? [{ ...benchHide('ghosts', ghosts.object), place: 'graveyard' }] : []),
      ...(waterMeshes.length > 0 ? [{ ...benchHide('water', ...waterMeshes), place: 'pond' }] : []),
    ]),
  ]
  const line = document.createElement('div')
  line.style.cssText = 'position:fixed;top:8px;left:8px;z-index:100;font:12px monospace;color:#fff;background:#000a;padding:2px 6px;pointer-events:none'
  document.body.append(line)
  const device = (renderer.backend as unknown as { device?: { lost: Promise<{ reason: string; message: string }>; features: Set<string>; adapterInfo?: { vendor: string; architecture: string } } }).device
  const runs = Number(sessionStorage.getItem('goose-bench-runs') ?? 0) + 1
  sessionStorage.setItem('goose-bench-runs', String(runs))
  benchTools?.logToServer({
    kind: 'start',
    // A second run in one tab: the phone killed the first, or it was opened again.
    run: runs,
    address: location.search,
    agent: navigator.userAgent,
    backend,
    gpu: device?.adapterInfo && { vendor: device.adapterInfo.vendor, architecture: device.adapterInfo.architecture },
    // Whether the GPU's own clock can be asked for, should the frames' prices not do.
    timestampQuery: device?.features.has('timestamp-query'),
    loadMs: Math.round(performance.now()),
    size: [innerWidth, innerHeight],
    devicePixelRatio,
    step: quality.level,
    dpr: renderer.getPixelRatio(),
    lean,
    moon,
  })
  void device?.lost.then((lost) => benchTools?.logToServer({ kind: 'error', what: 'device lost', detail: `${lost.reason}: ${lost.message}` }))
  // The screen kept on for it where the phone allows: some only from a tap.
  const keepAwake = () => void navigator.wakeLock?.request('screen').catch(() => {})
  keepAwake()
  addEventListener('pointerdown', keepAwake, { once: true })
  const bench: PhoneBench = new benchTools.PhoneBench(places, costs, {
    report: (reading) =>
      benchTools?.logToServer({ kind: 'reading', ...reading, lean, moon, step: quality.level, goose: [run.holder.x, run.holder.z], rats: swarm.count, drawn: rats.drawn, drawCalls: renderer.info.render.drawCalls, dpr: renderer.getPixelRatio() }),
    budget: Number(url.get('budget')) || undefined,
    raise: soaking ? undefined : raise,
    timeQueue:
      gpuQueue &&
      ((record) => {
        const from = performance.now()
        void gpuQueue.onSubmittedWorkDone().then(() => record(performance.now() - from))
      }),
    show(shown) {
      line.textContent = `bench ${shown}`
      if (shown === 'done') benchTools?.logToServer({ kind: 'done', priced: bench.priced })
    },
  })
  return bench
}
// ---------------------------------------------------------------- the run kept
// On a phone the page can go at any moment, dropped behind another app or a locked screen, and come back from nothing.
// So the run is kept (keptrun.ts) and taken up where he last filled his torch, past the opening. `?keep` tries it elsewhere.
/** How often the run is kept, s of the page: a phone may drop it with no warning. */
const KEEP_EVERY = 2
const keeping = !filming && !benchOn && (phone || url.has('keep'))
let runToTakeUp = keeping ? keptRun() : undefined
let keepIn = KEEP_EVERY
/** The run kept now, unless he is yet to have a run worth keeping, or it is over. */
function keepTheRun() {
  if (!keeping || !goosePlay.armed || opening.running() || ending.running() || goosePlay.down) return
  keepRun(goosePlay.saved())
}
if (keeping) {
  document.addEventListener('visibilitychange', () => document.hidden && keepTheRun())
  addEventListener('pagehide', keepTheRun)
}
/** A frame of the page past its loading: the kept run taken up on the first, as if the opening were skipped; and kept again as it goes. */
function keptRunFrame(frame: number) {
  if (!keeping) return
  if (runToTakeUp) {
    opening.skip()
    rushed = true
    goosePlay.restore(runToTakeUp)
    ratsCameFor = goosePlay.circleHeard
    ratsDueIn = -1
    // What was done before, not heard again.
    goosePlay.scenes.forEach((scene, s) => {
      if (scene.kind === 'cage') takenHeard[s] = scene.takenAt
    })
    runToTakeUp = undefined
  }
  if ((keepIn -= frame) > 0) return
  keepIn = KEEP_EVERY
  keepTheRun()
}

/** Under `?bench=load`, the frames of each second in play: how many, the longest and the second longest, ms; for the hitches of what is still building. */
const watched = { frames: 0, worst: 0, next: 0, from: -1 }
function watchFrames(ms: number) {
  const now = performance.now()
  if (watched.from < 0) watched.from = now
  watched.frames++
  if (ms > watched.worst) [watched.worst, watched.next] = [ms, watched.worst]
  else if (ms > watched.next) watched.next = ms
  if (now - watched.from < 1000) return
  benchTools?.logToServer({ kind: 'second', ms: Math.round(now), opening: Math.round(opening.t * 10) / 10, frames: watched.frames, worst: Math.round(watched.worst), next: Math.round(watched.next), rats: swarm.count, drawn: rats.drawn, step: quality.level })
  Object.assign(watched, { frames: 0, worst: 0, next: 0, from: now })
}

/** Whether the quality has moved to a step not yet drawn at. */
let qualityDue = false
/** Built on the first frame the game is in, with the load's time known. */
let bench: PhoneBench | undefined
let benchMade = false

// What is drawn over the game for the eye, its hints and marks: a screen reader has the canvas's words instead. Not on
// the developer's page, whose panels are read.
if (!debugOn) {
  for (const child of document.body.children) {
    if (child !== pauseVeil.element && child !== ending.card && child.tagName !== 'MAIN' && child.tagName !== 'BUTTON') child.setAttribute('aria-hidden', 'true')
  }
}

renderer.setAnimationLoop(() => {
  const start = performance.now()
  if (qualityDue) {
    qualityDue = false
    qualityChanged()
  }
  timer.update()
  const frame = timer.getDelta()
  // Paused, no time passes for the run, the light's walk or the camera's follow; the mouse still moves the camera.
  // Loading, none either: the scene is being built behind the loading screen, a slice a frame (loadSlice).
  const loading = !loaded
  if (!loading) keptRunFrame(frame)
  const dt = settings.paused || loading ? 0 : Math.min(frame, FRAME_CAP)
  beats.clock += dt
  if (opening.running()) opening.t = Math.min(INTRO.end, opening.t + dt)
  if (ending.running()) ending.t = Math.min(OUTRO.end, ending.t + dt)
  input.frame(loading)
  // The chase camera's hold on the mouse let go, for a click to reach the veil.
  if (input.commands.pause) {
    setPaused(true)
    document.exitPointerLock?.()
  }
  if (input.commands.resume) setPaused(false)
  pauseVeil.frame()
  if (input.commands.confirm) {
    enterAsked?.()
    ending.playAgain?.()
  }
  enterPad?.update(besideOf(input.commands))
  ending.againPad?.update(besideOf(input.commands))
  if (!loading) opening.skipFrame(input.commands.skip, frame)
  const newBeat = beats.frame(lookChanged)
  const stop = look.stopMotion
  // The run's time: held on the beat, and on a baked frame of the clip when snapping, so a held pose is a pose and not a blend.
  let held = stop.enabled && stop.run ? beats.beatAt : beats.clock
  if (stop.enabled && stop.snap) held = Math.floor(held / rats.poseStep) * rats.poseStep
  time.value = held
  skyFog.time.value = held
  water.update(held)
  // In the pond he swims, afloat, his water clips taking over from his land ones.
  goose.setSwimming(swimmingIn(pondLook, shown.x, shown.z, pondLook.goose))
  // The goose, standing, turned the way the play has him face: to the chase camera's look.
  goose.pose(held, lightPace.x, lightPace.z, Math.atan2(goosePlay.facing.x, goosePlay.facing.z))
  post.seed(stop.enabled && look.grain.grainOnBeat ? beats.beat : Math.floor(beats.clock * look.grain.grainSpeed), stop.enabled && stop.paperOnBeat ? beats.beat : 0)

  // Q and E, the debug keys, turn the torch's reach up and down: it moves at the dial's rate while one is held, and the panel shows it.
  let dial = 0
  if (settings.debug) for (const code of input.pressed) dial += DIAL[code] ?? 0
  if (dial !== 0 && dt > 0) {
    // Dialled smoothly, shown at the slider's own step; a slider moved by hand is picked up from where it was left.
    if (Math.abs(dialled - runTuning.torchReach) >= 0.01) dialled = runTuning.torchReach
    dialled = Math.min(tuning.ringMax, Math.max(0, dialled + dial * DIAL_RATE * dt))
    runTuning.torchReach = Math.round(dialled * 100) / 100
    panel?.showReach()
  }

  // The play, a frame of it: he walks where the keys send him, the torch burns, a fire refills it. Paused, it holds.
  if (!settings.paused && !loading) {
    if (ending.running()) {
      ending.walk()
    } else if (!opening.running()) {
      // His walk eased to the one asked: a little weight to him, starting and stopping.
      const share = view.walkFrame(view.heading(input.commands.walk), dt)
      // Slower in the water: his walking pace given way to his swimming one as he takes to it.
      const swimming = swimmingIn(pondLook, run.holder.x, run.holder.z, pondLook.goose)
      goosePlay.settings.pace = settings.lightSpeed * (1 + (pondLook.goose.pace - 1) * swimming) * share
      if (torchEverlasting) run.fuel = 1
      goosePlay.frame(dt, {
        heading: share > 0 ? { x: view.walking.x, z: view.walking.z } : null,
        interact: input.commands.interact,
        look: view.kind === 'chase' ? view.drawnForward : null,
      })
      // The ending's music asked for when the last gosling is found, not held all the game.
      if (ending.on && goosePlay.goslings[goosePlay.guide]?.state === 'guiding') void gooseSounds?.load('outro')
      if (ending.on && outroDue(ending.island, goosePlay.holder)) ending.start()
      // Woken at a fire, under the black: the camera, the lamp and his height there at once, not gliding after him.
      if (goosePlay.deaths !== fallsSeen) {
        fallsSeen = goosePlay.deaths
        view.onHim()
        lampOwed = Number.POSITIVE_INFINITY
        stood = Number.NaN
      }
    } else {
      opening.walk()
    }
  }
  gooseFrame(dt, held)
  if (torchChanged()) lookChanged()
  // The lamp's pool follows the torch's reach as it burns down, as the light's hard radius does; and flares with its catch.
  // Its reach on the ground: the lamp stands up in the flame, so a reach from it alone would leave the ground under him
  // dark while the torch still burns; this way the pool shrinks to nothing as the torch goes out, and not before.
  const lampUp = Math.max(0, lamp.position.y - standAt(lamp.position.x, lamp.position.z))
  lamp.distance = Math.hypot(look.lamp.reach * light.strength * nightLights.torchFlare, lampUp)
  lamp.intensity = nightLights.lampLit * nightLights.torchGlow
  const placed = run.lights()
  // What the swarm holds the rats off: the lights, and in the goose game the pond's water after them, drawn by nothing.
  // The burning branch's light flaring as it lands, before the dawn's comes first of them.
  const keptOff = ending.withDawn([...branchFlared(goosePlay.lights())])
  swarmTime.value = swarm.time
  const drawn = wakeFlare(branchFlared(opening.running() && pitLight >= 0 ? placed.map((p, k) => (k === pitLight ? { ...p, reach: p.reach * litShare(opening.t) } : p)) : placed))
  lights.update(drawn)
  skyFog.lightUp(drawn, run.torch, run.torch.lit && settings.on, nightLights.torchFlare)
  refillZonesFrame(drawn)
  // The lamp, the fog, the sun and the camera after the light, before the swarm is told what the fog hides: this frame's fog, not the last one's.
  follow(dt, newBeat, frame)
  fires.branchFrame(newBeat, held)
  holdHintFrame()
  lifeFrame()
  aheadFrame()
  callHintFrame(dt)
  peepWordsFrame(dt)
  editMode?.frame()
  view.orthoFrame()
  // The shots over the orbit, before anything reads the camera for this frame's drawing.
  const shot = view.standAtShots()
  seeThroughAt.set(shown.x, stood + 0.8, shown.z)
  gooseSee.subject.value.set(seeThroughAt.x, stood + gooseSeeLook.height, seeThroughAt.z)
  gooseSeeZone.update(gooseSee.subject.value, camera, gooseSeeLook)
  cutSeenThrough()
  // The swarm keeps the rats off the goose himself, his light centred on him and his goslings, as his lamp is.
  swarmLight.x = light.x
  swarmLight.z = light.z
  // Flaring as the torch catches: the rats at its edge thrown back with it.
  swarmLight.strength = light.strength * nightLights.torchFlare
  swarmLight.on = light.on
  // The ground each light sees: the torch's where it now is, the others' where they stand; the swarm reads the same, and the drawing at the swarm's time.
  areas.update(swarmLight, keptOff)
  seen.update()
  torchCentre.value.set(swarmLight.x, swarmLight.z)

  // What the fog hides, past the far edge it is drawn at this frame by the walk's margin: where rats left behind are brought round ahead unseen.
  // In the goose game, what the camera leaves out too, so they come back as near him as the view allows, and the
  // swarm seems to have no end.
  const margin = darkMargin()
  const dark: Dark | undefined =
    settings.bringRound ? { x: shown.x, z: shown.z, radius: darkRadius() + margin, view: view.groundView(margin) } : undefined
  const ratsCome = ratsComeFrame(dt)
  const wanted = fewRats ? Math.min(capacity, FEW_RATS) : Math.min(capacity, Math.round((settings.rats + ratsForGoslings()) * quality.step.rats * benchRatShare))
  // The goose game's goslings in the dark pull the rats near them (#188).
  // Held till the strike, but stepped once on the loading screen with the rest, so its first step builds nothing.
  const ratsHeld = opening.on && !ratsOut(opening.t) && !loading
  if (opening.on && !rushed && ratsOut(opening.t) && dark) {
    rushed = true
    rushIn(dark, 0, wanted)
    // The ground rumbles under them.
    gooseSounds?.play('quake')
  }
  // A found gosling's rats: the newcomers rush in, the ground rumbling lower under them, the camera shaking with it.
  if (ratsCome && dark && wanted > swarm.count) {
    const from = swarm.count
    swarm.setCount(wanted)
    rushIn(dark, from, wanted, Math.atan2(camera.position.z - dark.z, camera.position.x - dark.x))
    gooseSounds?.play('quake', undefined, RUMBLE_GAIN)
    rumbledAt = goosePlay.t
  }
  // Loading, it takes its step on STEP_FRAME, and goes on being asked till it has stood them: the worker of WebGL 2 reads
  // its input on a clock of its own, and asked for one frame alone it could miss it, and the loading wait for ever at 99 %.
  const loadHeld = loading && (loadFrame < STEP_FRAME || (loadFrame > STEP_FRAME && swarm.ready))
  swarm.send(wanted, swarmLight, tuning, settings.paused || loadHeld || ratsHeld, dark, keptOff, goosePlay.targets)
  // The places: every frame when smooth; on the beat when held; and the first time a state is there, whatever the beat.
  if (!(stop.enabled && stop.swarm) || !swarm.ready) swarm.sample(performance.now())
  else if (stop.stagger) swarm.sampleStaggered(performance.now(), beats.clock, stop.fps)
  else if (newBeat) swarm.hold(performance.now())
  // The smoke on the run's held time too, trailing from the flame's tip.
  smoke.update(held, flame.tip(flameTip), camera.position)
  // The embers on the run's held time, so they hold on the beat; born where the flame burns.
  embers.update(held, flameAt)
  feathers.update(held, groundAt)
  // The gaits belong to the stop motion: cut on the beat they read as frames; smooth, every rat runs, as before them.
  // The levels of detail count the depth of field: a rat it blurs is drawn no finer than it shows (ADR-0057).
  // The tilt's band blurs by the screen and not by distance: the levels count it by where a rat stands on the screen.
  const banded = !lean && tilt?.look.enabled ? tilt.look : undefined
  const blurred = look.dof.enabled && quality.step.dof && !banded
  const focus = look.dof.onLight ? camera.position.distanceTo(lamp.position) : look.dof.focus
  rats.staggerCentre(light.x, light.z)
  const smear = banded ? banded.blur : blurred ? look.dof.bokeh * 2 : 0
  rats.focusOn(focus, Math.max(0.05, look.dof.focal), smear * look.rats.levels.blur, banded)
  rats.draw(swarm, camera, stop.enabled)
  if (blurred && look.dof.onLight) post.focusAt(focus)
  // The shadows again only if what casts them moved, on a new state of the swarm, or as often as it would step while
  // the intro holds it, the goose and his goslings moving all the same; a changed look at once. The fire's shadow,
  // its mask, every frame.
  const now = performance.now()
  layFireShadows()
  const casting =
    swarm.version !== shadowed.version ||
    held !== shadowed.held ||
    (sun.castShadow && !sun.position.equals(shadowed.sun)) ||
    (settings.shadows && !lamp.position.equals(shadowed.lamp))
  if (shadowed.dirty || (casting && (swarm.steps !== shadowed.steps || (ratsHeld && now - shadowed.at >= HELD_SHADOW_MS)))) {
    sun.shadow.needsUpdate = lamp.shadow.needsUpdate = true
    shadowed.version = swarm.version
    shadowed.steps = swarm.steps
    shadowed.held = held
    shadowed.sun.copy(sun.position)
    shadowed.lamp.copy(lamp.position)
    shadowed.at = now
    shadowed.dirty = false
  }
  // In the opening, none till the strike brings them.
  if (opening.on) rats.object.visible = ratsOut(opening.t)
  fallingLeaves?.update(dt, view.followed.x, view.followed.z)
  islandTree.update(dt)
  if (ghosts) {
    ghosts.object.visible = ghostsNear()
    if (ghosts.object.visible) ghosts.update(dt, goosePlay.t)
  }
  ghostsHeardFrame(dt)
  plainFlames.update()
  if (loading) loadSlice(placed)
  else post.render()
  // The orbit's camera put back, for the mouse, the keys and the next frame's follow.
  if (shot) {
    view.backFromShots()
  }
  // The view's triangles: every rat on screen at its level of detail, and the ground. The shadow passes draw the rats again, off screen.
  const groundGeometry = ground.mesh.geometry
  const triangles = rats.triangles + (groundGeometry.getIndex()?.count ?? groundGeometry.getAttribute('position').count) / 3
  // Every draw of the frame: the view's and the shadow passes'.
  const drawCalls = renderer.info.render.drawCalls
  // The GPU's step time, from the timestamps once resolved; the render's resolved too, so its queries never pile up.
  if (timestamps && swarm instanceof GpuSwarm) {
    void renderer.resolveTimestampsAsync('compute').then(() => swarm.timeSteps(renderer))
    void renderer.resolveTimestampsAsync('render')
  }
  const steeringMs = swarm instanceof GpuSwarm ? swarm.gpuMs : swarm.ms
  readouts({ drawn: rats.drawn, count: swarm.count, triangles, drawCalls, steeringMs, states: swarm.steps, pageMs: performance.now() - start, frameMs: frame * 1000 })
  // The loading's frames are slow by design, and say nothing of the device; and the opening is the page's first
  // impression, not to be seen stepping up and down. A step is taken at the head of the next frame: resized here, past
  // this frame's drawing, the canvas would show empty, a black frame.
  if (adapt && !loading && !opening.running() && quality.frame(frame * 1000, start)) qualityDue = true
  if (!loading && url.get('bench') === 'load') watchFrames(frame * 1000)
  if (!loading) {
    if (!benchMade) {
      benchMade = true
      bench = createBench()
    }
    if (bench) goosePlay.life = 1
    bench?.frame(frame * 1000, performance.now() - start, performance.now())
  }
})
