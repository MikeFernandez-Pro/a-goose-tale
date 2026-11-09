// A Goose Tale: a swarm of rats held off by a light (ADR-0044). The goose, the torch in his beak, crosses the night plain one
// way on the route saved in gooseroute.json (plain.ts), from brazier to brazier to the pond, played by the goose play
// (gooseplay.ts), which the page feeds the keys and draws. The swarm steps at a fixed rate, on the GPU on WebGPU and in a
// worker on WebGL 2 (ADR-0053); each frame the crowd stands every rat where the swarm had it a step ago, between two
// steps. The run (run.ts), the play's own, holds the torch: it burns down and a fire refills it. The swarm is handed the
// torch and the lights as the run has them. Each light's lit area is worked out on the page for the drawing and the GPU
// step, and in the worker for its own (ADR-0054).
//
// This file makes the page's parts, in the order they need each other, and plays them a frame at a time. Each part keeps
// its own state and is handed what it reads: the address (address.ts), the look (startinglook.ts), the renderer
// (drawing.ts), the sky and the night's lights (skyfog.ts, nightlights.ts), what stands along the road and at the pond
// (roadside.ts, pondworld.ts), the fires (plainfires.ts), the opening and the ending (opening.ts, openingshow.ts,
// ending.ts), the camera (gooseview.ts), the input (gooseinput.ts), what is heard, written and felt (gooseheard.ts,
// goosehints.ts, goosefelt.ts), and the loading (loadingscreen.ts). The developer's panels, route editor and benches are in src/dev.
import {
  Color,
  type Mesh,
  type Node,
  type NodeMaterial,
  PerspectiveCamera,
  Scene,
  Timer,
  Vector2,
  Vector3,
} from 'three/webgpu'
import { int, pointShadow, uniform } from 'three/tsl'
import { loadVAT } from 'three-vat'
import { getMaxTextureSize, type VATTimeUniform } from 'three-vat/tsl'
import { benchOn, debugOn, featureOn, filming, noPanel, phone, post0, url } from './game/address'
import { GOOSE_EYES, measuringSwitches, startingLook } from './look/startinglook'
import { createPost, defaultDark, leaveUnshaded } from './look/post'
import { DEATH_DOWN } from './characters/goosedeath'
import { defaultBedLook, defaultRoadLook, defaultWellGroundLook, floor } from './world/ground'
import { defaultRoadShape } from './world/road'
import { lightAndPause } from './ui/lightandpause'
import { GoosePlay, inZone } from './game/gooseplay'
import { createGoslings, defaultGoslingSpeeds, GOSLING_HEIGHT } from './characters/goslings'
import { layPieces, BURNING_LIGHT, CAGE_FIRE_LIGHT, PIT_LIGHT, spawnTree, TREE_FIRE_LIGHT, TREE_LIGHT, WELL_LIGHT, createGooseScenes } from './game/goosescenes'
import { besideOf } from './ui/holdhint'
import { createGooseSounds } from './sound/goosesounds'
import { FURTHEST, islandMiddle, islandShoreAt, shoreAt, standingIn, swimmingIn, widestShore, type PondLook } from './world/pond'
import { ENDING, endingDue } from './game/endingscript'
import { ROUTE, laid } from './world/plain'
import { defaultRollingLook, rollingGround } from './world/rolling'
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
import { shoreLight, type Dark, type Ground, type Light } from './swarm/swarm'
import { createTiltShift } from './look/tiltshift'
import { createFallingLeaves, defaultFallLook, mountFallControls } from './world/fallingleaves'
import { createFakeLamps, shown as drawnInScene } from './light/fakelamps'
import { createFireShadow, defaultFireShadowLook } from './light/fireshadow'
import type { Bench } from './dev/pagebench'
import { DARKENED_MOON, OPENING, cowering, litShare, ratsOut, skyDarkened, startled } from './game/openingscript'
import { RemoteSwarm } from './swarm/swarm-remote'
import { createDrawing } from './look/drawing'
import { ladder, startingStep, Quality } from './look/quality'
import { createSkyFog } from './look/skyfog'
import { createNightLights } from './light/nightlights'
import { leafGlow, leafLight } from './look/leaflight'
import { createMoonBake } from './light/moonbake'
import { createOpening } from './game/opening'
import { createOpeningShow } from './ui/openingshow'
import { createEnding } from './game/ending'
import { createGooseInput, DIAL, DIAL_RATE } from './ui/gooseinput'
import { createPauseVeil } from './ui/pauseveil'
import { CAMERA_FOV, fitToPage, createGooseView } from './game/gooseview'
import { createRoadside } from './world/roadside'
import { createPlainFires } from './light/plainfires'
import { createPondWorld, pondPastHome } from './world/pondworld'
import { MOST_FRAME, GpuSwarm } from './swarm/gpuswarm'
import { createGooseHeard } from './sound/gooseheard'
import { createGooseHints } from './ui/goosehints'
import { createGooseFelt } from './game/goosefelt'
import { createZoneRings } from './world/zonerings'
import { createRatsArrive, RUMBLE_GAIN, RATS_AFTER } from './game/ratsarrive'
import { createLoading, STEP_FRAME } from './ui/loadingscreen'
import { createRunKeeper } from './game/runkeeper'
import { createBeats } from './game/beats'
import { createDebugKeys } from './game/debugkeys'
import { createPlainPieces } from './game/plainpieces'
import { startingSettings, gooseTuning, startingFeel } from './game/gooserules'

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
/** How far past the game's plain the floor runs, m: out of sight in the fog from anywhere he can stand. */
const FLOOR_PAST = 20
/** How far past the fog's far edge the swarm may set a rat down, m, before the walk's own margin: a rat's length at the panel's usual scale, and the placing step's run. */
const DARK_MARGIN = 0.5

const { look, gooseTheme } = startingLook()
const beats = createBeats(look.stopMotion)

const { renderer, backend, lean, moon, maxDpr, timestamps, benchTools, gpuQueue, allBuilt } = await createDrawing()
const camera = new PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, 0.1, 100)
const scene = new Scene()
const skyFog = createSkyFog(scene, camera)
fitToPage(camera, renderer)

const nightLights = createNightLights(scene, moon)
const { sun, lamp } = nightLights

// The game's pond bed: the floor gives way to sand down its bank (ground.ts), as the pond folder's bed edits it.
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
  // `?groundzones=0`, `?roadzones=0`, `?shorezones=0` and `?noisemap=0` for the bench to price them.
  zones: lean && (moon === 'none' || moon === 'baked') && url.get('groundzones') !== '0',
  roadZones: url.get('roadzones') !== '0',
  shoreZones: url.get('shorezones') !== '0',
  noiseMap: lean && url.get('noisemap') !== '0',
  // No strokes on a lean frame: 4 to 6 ms of 30 to 50 (Mi 9, dpr 2, 2026-11-06), as asked; `?groundstrokes` for them.
  strokes: !lean || url.has('groundstrokes'),
})
// Starting by the burning tree's branch, he carries no torch of his own: the branch, picked up, is his torch.
/** The burning branch, where the route lays one, held by its butt in his bill: out to his right, forward and up, under half as long as he is tall, a fifth of it back past his bill. */
const BRANCH_HELD = { way: [-0.75, 0.42, 0.5], length: 0.4, behind: 0.2 } as const
const goose = await createGoose(ROUTE.start.branch !== undefined ? { torchless: BRANCH_HELD } : {})
goose.object.name = 'goose'
scene.add(goose.object)
// The panel starts the goose's parts at the colours its character or its file has.
look.goose.parts = goose.parts.map((part) => ({ ...part }))
const flame = createFlame()
flame.object.name = 'torch flame'
scene.add(flame.object)
const embers = createEmbers()
embers.object.name = 'torch embers'
scene.add(embers.object)
// Feathers a bite knocks off him (biteFrame).
const feathers = createFeathers()
scene.add(feathers.object)
// The smoke: a trail of the flame's tip, in the world as the embers are.
const smoke = createSmoke()
smoke.object.name = 'torch smoke'
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
ground.mesh.name = 'ground'
scene.add(ground.mesh)
// The frame goes through one scene pass and the effects after it: the ambient occlusion under its fog, the outlines, the palette.
// With `?tilt` (the game's default), the tilt-shift: the depth of field's blur by a band across the screen (tiltshift.ts).
const tilt = featureOn('tilt') ? createTiltShift() : undefined
// With the tilt, the depth of field off as the page opens: the tilt's band is the blur (the dof folder still turns it on).
if (tilt) look.dof.enabled = false
const post = createPost(renderer, scene, camera, { color: skyFog.onScreen, amount: skyFog.amount }, tilt, lean)

const maxTextureSize = getMaxTextureSize(renderer)
/** The count's top: 16,384, or what this device's textures hold. */
const capacity = Math.min(MAX_RATS, maxTextureSize)
const settings = startingSettings(capacity)
const { tuning, RAT_RADIUS } = gooseTuning(settings)
const feel = startingFeel(feathers, () => deathTimed())

// The ground each light sees against the walls: worked out here for the drawing, and on WebGPU read by the
// swarm's step from the same texture. The worker works out its own the same way. Its walls are the plain's,
// once there is one.
const areas = new LitAreas(new Walls([]))
const seen = seenTexture(areas)
const vat = await loadVAT(RAT.url)
const time: VATTimeUniform = uniform(0)
/** The game's plain as its play lays it, known before the play is, so the rats can be made on its ground. */
const goosePlain = laid(ROUTE)
// The game's pond, as the pond folder edits it: past the last brazier, at the end of the route, the water the
// rats are held off.
const pondLook = pondPastHome(goosePlain)
/** The box the game's floor is laid over: the plain's, and round the drawn pond at its widest shore, which lies on past the play's, FLOOR_PAST more. */
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
/** How the game's plain rolls, as the ground folder edits it; and where the pond is, flat round it. */
const rollingLook = defaultRollingLook()
const pondPlace = { x: pondLook.x, z: pondLook.z, widest: widestShore(pondLook) }
/** The game's rolling ground (rolling.ts) over its floor: what the floor is laid on, and the rats, the goose and the scenes stand on. */
const gooseGround = rollingGround(goosePlain, pondPlace, gooseFloorBox, rollingLook)
// Leaves falling round him, to the rolling ground (fallingleaves.ts), with a panel of their own.
const fallingLeaves = url.get('leaves') === '0' ? undefined : createFallingLeaves(gooseGround, defaultFallLook())
if (fallingLeaves) scene.add(Object.assign(fallingLeaves.object, { name: 'falling leaves' }))
// On WebGPU the rats are culled and drawn on the GPU (ADR-0052); WebGL 2, or `?batch`, draws them as the batch.
/** How much bigger a lean frame draws its rats, their spacing as it was: fewer of them, and smaller on a phone's screen. */
const LEAN_RAT_SCALE = 1.15
// On a lean frame no boil, no trails and the rats drawn a little bigger (LEAN_RAT_SCALE): at the start, 200 rats round
// him were 14 ms of 46, the boil and the trails 3.5 each (Mi 9, WebGL 2, dpr 2, 2026-11-06), as asked.
const rats = new Rats(vat, RAT, capacity, maxTextureSize, time, settings.runAnimation, backend === 'WebGPU' && !url.has('batch') ? renderer : undefined, gooseGround, { boil: !lean })
// The rats' depth laid first, so each pixel is shaded for the nearest rat alone; `?prepass=0` shades them all, to measure against.
// A phone's GPU hides what lies behind by itself: there the pre-pass only cost, 0.8 ms at a pixel ratio of 3 (iPhone 15 Pro Max, 2026-11-02).
const prepassOn = url.has('prepass') ? url.get('prepass') !== '0' : !lean
rats.setPrepass(prepassOn)
// The swarm steps on the GPU where the GPU culls the rats (ADR-0053); in the worker on WebGL 2, under `?batch` or `?cpustep`.
const rangeScale = 1
const gpuCull = url.has('cpustep') ? undefined : rats.gpuCull
/** The page's swarm made on `ground`, the goose play's to set its rats down in and the page's to step. */
const playSwarm = (ground: Ground) =>
  (gpuCull ? new GpuSwarm(gpuCull, renderer, capacity, SEED, 0, rangeScale, undefined, ground, seen.texture) : new RemoteSwarm(capacity, SEED, 0, rangeScale, ground))
/**
 * The game, on its saved route, its rats the panel's budget and `?seed`'s, walking at the panel's pace. The
 * dead tree stands where the route has it, or `?tree=N` m ahead of his start.
 */
const treeAhead = Number(url.get('tree')) || null
const goosePlay = new GoosePlay<GpuSwarm | RemoteSwarm>(
  { rats: settings.rats, pace: settings.goosePace, seed: Math.round(Number(url.get('seed') ?? 1)) || 1, treeAhead, lastGuides: true },
  { tuning, swarm: playSwarm },
)
/** The ground's height under (x, z): the game's rolling plain. */
const groundAt = (x: number, z: number) => gooseGround.at(x, z)
/** How high he stands at (x, z): on the ground, down the pond's bank and into its water, afloat where it is too deep (pond.ts). */
const standAt = (x: number, z: number) => groundAt(x, z) + standingIn(pondLook, x, z, pondLook.goose)
/** Where he is heard from: his middle, where the play has him. */
const hisAt = () => {
  const { x, z } = goosePlay.holder
  return { x, y: standAt(x, z) + 0.4, z }
}
/** Whether his torch has been full once: starting with it out, he lights it first, and no gosling peeps for him nor turns the camera till then. */
let torchFilled = false
const torchFilledOnce = () => (torchFilled ||= goosePlay.run.fuel >= 0.99)
/** The burning tree's light, where the plain starts by one. */
const burningTreeLight = spawnTree(goosePlay.plain)

// The plain's layout and its rules, the goose play's. Its torch: it burns down, its light shrinking with the
// fuel in a straight line to nothing, and grows back as he fills it at a fire. A and E (Q and E on a QWERTY keyboard)
// turn its reach up and down; F gives it a light that never burns down, and puts it out again.
const layout = goosePlay.layout
const runTuning = goosePlay.runTuning
/** The run, the goose play's. */
const run = goosePlay.run
// The lit areas see every wall that stops the rats.
areas.setWalls(new Walls(run.walls()))
const opening = createOpening(goosePlay, burningTreeLight)
/** The moon the page opened on, which the opening darkens to DARKENED_MOON's as the rats come out; how far it has, as last set. */
const openingMoon = look.sun.color
let skyShare = 0
const moonFrom = new Color()
const moonTo = new Color()
/** The torch as the swarm reads it: where the holder is, its reach as a share of the swarm's full light, and lit. */
const light: Light = { x: run.holder.x, z: run.holder.z, strength: 0, on: false }
/** The torch gone out, its smoke goes on off the charred tip for this long, s, from this much thicker, thinning to nothing. */
const SMOKE_DIES = 3.5
const SMOKE_THICK = 1.5
/** When the torch last went out, on the beats' clock, and whether its smoke is still dying away. */
let wentOut = Number.NEGATIVE_INFINITY
let smokeDying = false
/** Hand the swarm the torch as the run has it, and the debug switch: true if it went out or was relit. */
function torchChanged(): boolean {
  const torch = run.torch
  light.x = torch.x
  light.z = torch.z
  light.strength = torch.reach / tuning.ringMax
  const on = torch.lit && settings.on
  if (on === light.on) return false
  light.on = on
  smokeDying = !on
  if (!on) wentOut = beats.clock
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
// The dead tree burns bare, high on its trunk (#190), the brazier by the tree, after the braziers, on its own bowl, and
// the cage's over its campfire's logs: their lamps alone, the page burning the torch's flame on each. The well's place
// draws nothing, the fire pit by it its light.
const looks = goosePlay.layout.lights.map((_, k) => {
  const b = goosePlay.plain.braziers[k]
  if (goosePlay.wellFires.some(({ light }) => light === k)) return PIT_LIGHT
  // The burning branch, lying on the ground, burns on its broken end, its lamp low over it.
  if (k === goosePlay.branch?.light) return BRANCH_LIGHT
  return b === undefined ? TREE_FIRE_LIGHT : k === burningTreeLight ? BURNING_LIGHT : b.scene === 'tree' ? TREE_LIGHT : b.scene === 'well' ? WELL_LIGHT : b.scene === 'cage' ? CAGE_FIRE_LIGHT : undefined
})
// The braziers and ghosts lit as fake lamps (fakelamps.ts): one loop in each lit shader, not a point light written out
// in each; the torch's lamp stays a point light.
const fakeLamps = createFakeLamps()
fakeLamps.name = 'fire lamps'
scene.add(fakeLamps)
// Those whose reach the camera does not see left out; `?lampcull=0` for the bench to price it.
if (url.get('lampcull') !== '0') fakeLamps.view = camera
// The braziers' lamps are not cut to their lit areas: the plain has no walls (see the torch's lamp below).
const lights = createLights(layout.lights, seen.texture, swarmTime, layout.start, { looks, groundAt, masked: false, lamps: fakeLamps })
lights.object.name = 'braziers'
scene.add(lights.object)
/** The pond's water as drawn, the swarm's to hold the rats off: its shore, as the pond folder last laid it. */
const pondWater = (look: PondLook) => shoreLight(look.x, look.z, (angle) => shoreAt(look, angle))
goosePlay.setWater(pondWater(pondLook))
// The game's goslings, afloat once out of their depth in the pond.
const goslingSpeeds = defaultGoslingSpeeds()
const goslingSize = { height: GOSLING_HEIGHT }
const goslings = await createGoslings(goosePlay, pondLook, goslingSpeeds, groundAt, goslingSize)
// The game's scenes: the well and the dead tree (#190).
const gooseScenes = await createGooseScenes(goosePlay, standAt)
gooseScenes.object.name = 'scenes'
scene.add(gooseScenes.object)
feel.key.taken = gooseScenes.keyTaken
// Its shell laid now, before the panel reads the cart's and the corpse's highlight and rim, which start as it.
gooseScenes.setShell(look.goose)
goslings.object.name = 'goslings'
scene.add(goslings.object)
/** How far round a gosling's feet the camera's view must reach to draw him, m: the bird and his shadow on the ground. */
const GOSLING_SEEN = 1
// The ground laid under each well, where the play stands it.
ground.setWells(goosePlay.scenes.filter((s) => s.kind === 'well'))
const roadside = await createRoadside({ scene, goosePlay, lights, fakeLamps, backend, renderer, groundAt, pondLook, gooseFloorBox, roadShape, roadLook, ground, look, gooseTheme, gooseScenes, fallingLeaves, dev, lean })
const { graveyard, ghosts, graves, graveCandles, deadTreesMesh, deadTreeShine, deadTreeGrass, bushesMesh, gooseSee, gooseSeeLook, gooseSeeZone, cutSeenThrough } = roadside
const fires = createPlainFires({ scene, goosePlay, burningTreeLight, look, gooseTheme, lights, beats, standAt, groundAt, camera, opening, gooseScenes, goose, roadside, skyFog, nightLights, rats })
const { burningBranch, branchEmbers, plainFlames, branchFlared } = fires
const pondWorld = await createPondWorld({ scene, nightLights, beats, ground, gooseFloorBox, pondLook, gooseGround, gooseScenes, fires, fakeLamps, goose, goslingSize, roadside, look, lean })
const { waterLook, water, tent, picnic, islandTree, islandGeese } = pondWorld
const debugKeys = createDebugKeys({ settings, run, goosePlay, pondLook, graveyard, showDeath: () => (felt.deathShownAt = goosePlay.t) })
/** The game's sounds (goosesounds.ts): none in a take, or with `?mute`; M mutes them. */
const gooseSounds = !filming && !url.has('mute') ? createGooseSounds(camera) : undefined
const openingShow = createOpeningShow({ opening, goosePlay, goose, camera, renderer, gooseSounds, hisAt, fakeLamps, scene, standAt })
const ending = createEnding({ goosePlay, pondLook, islandGeese, tent, look, waterLook, water, ground, deadTreesMesh, deadTreeGrass, islandTree, nightLights, light, gooseSounds, goose, camera, renderer })
/**
 * The moon's map over the whole level, drawn once, of what stands still (moonbake.ts): with `?moon=baked` from the start,
 * aimed before the loading screen, whose drawings of it build its pipelines; a live moon's at the quality's last step.
 * `&bakecm=N` for another texel, cm, `&bakeblur=N` for another least blur, texels.
 */
const moonBake = moon !== 'none'
  ? createMoonBake(sun, scene, [goose.object, goslings.object, rats.object, ghosts?.object, islandGeese.object, feathers.object, flame.object, embers.object, smoke.object, fallingLeaves?.object, fires.burningBranch?.object, fires.branchEmbers?.object], nightLights.sunShadowTargets, Number(url.get('bakecm')) / 100 || undefined, Number(url.get('bakeblur')) || undefined)
  : undefined
const liveTexel = nightLights.texel
if (moon === 'baked') {
  moonBake?.aim(look.sun)
  nightLights.texel = moonBake?.texel ?? liveTexel
  nightLights.blurAtLeast = moonBake?.blur ?? 0
}
// The bed under the pond's water takes less light, as deep as the water lies.
ground.setWaterLevel(pondLook.water)

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
const zoneRings = createZoneRings(scene, goosePlay, standAt)

/** Where the see-through's hole is cut round: the holder, at its chest. */
const seeThroughAt = new Vector3()
// The torch's lamp lights only what the torch sees: its lamp's shadow is its lit area, the walls alone cutting it,
// its own falloff ending it. Under `?shadows`, the lamp's own cube of shadows as well. In the game no light but the
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
rats.setSize(settings.size * (lean ? LEAN_RAT_SCALE : 1))
rats.setSizeBySpeed(settings.sizeBySpeed)
rats.object.name = 'rats'
scene.add(rats.object)
// The goose and his goslings shadow the fire he stands in, away from its flame, on the ground (fireshadow.ts): a
// projector's mask of them, drawn every frame, the floor's shader reading it. None on a lean frame, the floor's shader
// built without it, nor at the quality's last step, which bakes the moon, its mask no longer drawn (as asked, 2026-11-06).
const fireShadowLook = defaultFireShadowLook()
const fireShadow = moon === 'none' || lean ? undefined : createFireShadow(renderer, fakeLamps, fireShadowLook, [ground.mesh])
const fireCasters = [goose.object, goslings.object]
const gooseMiddle = new Vector3()
/** The fire's shadow not drawn and the share of the rats asked for, for `?bench` to price them; the walk and the interact key of `?bench=route`'s player. */
const benchHolds = { fireShadows: false, ratShare: 1, toward: null as { x: number; z: number } | null, interact: false }
function layFireShadows(): void {
  if (!fireShadow) return
  goose.object.getWorldPosition(gooseMiddle)
  const ground = groundAt(gooseMiddle.x, gooseMiddle.z)
  gooseMiddle.y = ground + look.goose.height * 0.5
  // With no casters it shadows no lamp, and the floor's shader skips its taps.
  const casts = !benchHolds.fireShadows && quality.step.moon && drawnInScene(goose.object)
  fireShadow.update(casts ? fireCasters : [], gooseMiddle, look.goose.height, ground)
}
// The panel starts each part at the colour the model was made in.
look.rats.parts = rats.parts.map((part) => ({ ...part }))
for (const part of look.rats.parts) if (part.name === 'eyes') part.color = gooseTheme?.eyes ?? GOOSE_EYES


/**
 * What the shadows were last drawn from: the swarm's places and its state,
 * the run's time, where the sun and the lamp stood; and whether the look
 * changed since. They are drawn again only when one of those moved, and only
 * on a frame a new state of the swarm came in: held, on the beat; smooth, at
 * the swarm's own rate whatever the screen's, a step at most behind their rats.
 */
const shadowed = { version: -1, steps: -1, held: Number.NaN, sun: new Vector3(Number.NaN), lamp: new Vector3(Number.NaN), at: -Infinity, dirty: true }
/** How often the shadows are drawn again while the opening holds the swarm, ms: as often as the swarm steps once it goes. */
const HELD_SHADOW_MS = 1000 / 60

/** Everything the look folders set, with this beat's variation where the stop motion asks for it; the lamp's reach also follows the light's strength. */
function lookChanged() {
  shadowed.dirty = true
  const stop = look.stopMotion
  const shade = (channel: number) => (stop.shadeWobble ? stop.shadeAmount * beats.vary(channel) : 0)
  rats.setBoil(stop.enabled && stop.boil ? stop.boilAmount : 0, stop.boilScale, beats.beat)
  const nudge = (channel: number) => (stop.strokeJitter ? stop.strokeAmount * beats.vary(channel) : 0)

  nightLights.set(look, light.on, beats.vary)
  leafGlow.value = look.leaves.glow
  leafLight.value = look.leaves.light
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
  rats.setTrails({ ...look.trails, enabled: look.trails.enabled && !lean, wiggle: stop.enabled ? 0 : look.trails.wiggle })
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
  // The torch out, burnt down or put out: its flame and its embers go with it, its smoke once it has died away.
  flame.object.visible &&= light.on
  embers.object.visible &&= light.on
  smoke.object.visible &&= light.on || smokeDying
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
 * A phone: a number of rats of its own, none coming with the goslings, so the crowd never thins or swells with how the
 * frames come; 100 since 2026-11-06, each about 0.07 ms on a Mi 9 at dpr 2, as asked, on WebGPU too since 2026-11-07,
 * where each gosling found brought 300 more. `?rats=N` to try others.
 */
const fewRats = phone
const FEW_RATS = Number(url.get('rats')) || 100
const wholeLadder = ladder(maxDpr)
// A lean frame has no AO to step up to, so no steps with one; a moon not drawn live, no step baking it.
const steps = (lean ? wholeLadder.slice(startingStep(wholeLadder, true)) : wholeLadder).filter((step) => step.moon || step.islandBush || moon === 'vsm' || moon === 'pcf')
const askedStep = Number(url.get('step'))
// A phone on WebGL 2, the swarm stepped on its CPU, starts at its lowest, the opening held at it, and climbs from there
// once it is over.
const lowestFirst = phone && backend !== 'WebGPU'
const quality = new Quality(steps, Number.isInteger(askedStep) && url.has('step') ? Math.min(Math.max(askedStep, 0), steps.length - 1) : lowestFirst ? steps.length - 1 : startingStep(steps, phone))
// `?bench=soak` and `load` let it move: what a phone settles on is what they read.
const adapt = url.get('adapt') !== '0' && !['ao', 'dof', 'bloom', 'dpr', 'post'].some((key) => url.has(key)) && (!url.has('bench') || ['soak', 'load'].includes(url.get('bench') ?? ''))
/** Draw at the quality's step: its pixel ratio, its look, the moon live or baked. */
function qualityChanged() {
  if (renderer.getPixelRatio() !== quality.step.dpr) renderer.setPixelRatio(quality.step.dpr)
  if (moonBake && moon !== 'baked' && moonBake.on === quality.step.moon) {
    if (quality.step.moon) moonBake.release()
    else moonBake.aim(look.sun)
    nightLights.texel = moonBake.on ? moonBake.texel : liveTexel
    nightLights.blurAtLeast = moonBake.on ? moonBake.blur : 0
  }
  lookChanged()
}

if (dev && fallingLeaves && !noPanel) mountFallControls(fallingLeaves, dev.GUI)
const view = createGooseView({ camera, renderer, light, goslings, run, feel, opening, ending, torchFilledOnce, tilt, standAt, groundAt, goosePlay, look })
const panel = noPanel || filming ? undefined : dev?.mountPagePanel({ settings, tuning, look, capacity, rats, RAT_RADIUS, torchChanged, lookChanged, shadowsChanged, runTuning, layout, goosePlay, zoneRings, darkLook, feel, openingShow, pondLook, pondWorld, roadside, fires, ground, pondWater, bedLook, gooseGround, goosePlain, pondPlace, rollingLook, roadShape, roadLook, goslingSpeeds, goslingSize, burningTreeLight, fireShadowLook, gooseScenes, wellGroundLook, view, tilt })
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
    moonBake?.on ? 'baked moon' : '',
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
/** The torch's own velocity, m/s, as of the last frame: the goose runs by it. */
const torchVelocity = { x: 0, z: 0, wasX: light.x, wasZ: light.z }
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
    torchVelocity.x = (light.x - torchVelocity.wasX) / dt
    torchVelocity.z = (light.z - torchVelocity.wasZ) / dt
  }
  torchVelocity.wasX = light.x
  torchVelocity.wasZ = light.z
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
  if (!stop.enabled || newBeat) flame.shape(beats.flameDraw, torchVelocity.x, torchVelocity.z)
  flame.place(goose.tip(torchEnd, flame.offset(flameOffset)))
  goose.restTip(torchRest, flameOffset)
  flame.centre(flameAt)
  fires.frame(newBeat)
  pondWorld.bonfireFrame(newBeat, ending.firesLeft)
  fires.burningTreeFrame(newBeat)
  openingShow.openingLightFrame()
  // In the torch, the lamp burns where the torch rests, the head's sway left out (2026-10-11): it moves with him
  // and never swings with his head. Else it hangs over the goose, easing after it.
  if (look.lamp.inFlame) lamp.position.copy(torchRest)
  else lamp.position.set(lampAt.x, LIGHT_HEIGHT + stood, lampAt.z)
  skyFog.centre.value.set(shown.x, shown.z)
  // The sun stays over the light, so its shadows always cover the view.
  if (!moonBake?.on) {
    sun.target.position.set(shown.x, 0, shown.z)
    sun.position.copy(sun.target.position).add(look.sun)
  }
  view.glide(dt, newBeat, frame, stood)
  // The dead trees' and bushes' stretches past the fog's solid edge, its wisps and all, left undrawn: they would draw as
  // the fog. Those out of the camera's view too, now it has moved, unless their shadow is in it.
  const plantsReach = look.fog.enabled ? skyFog.edge + 1.5 * look.fog.wisp + 0.5 : Infinity
  view.lookedFrom()
  const plantsSun = sun.castShadow && !moonBake?.on ? plantsSunward.subVectors(sun.position, sun.target.position).normalize() : undefined
  deadTreesMesh.cullPast(shown.x, shown.z, plantsReach, plantsView, plantsSun)
  bushesMesh.cullPast(shown.x, shown.z, plantsReach, plantsView, plantsSun)
}
follow(Infinity, true, 0)
view.start()

const plainPieces = createPlainPieces(goosePlay, gooseScenes, lights, goslings, burningTreeLight)
layPieces([...gooseScenes.pieces(goosePlay), ...plainPieces()])
// The tree's gosling lands a little ahead of where he is drawn sitting.
goosePlay.landingOf = (tree) => gooseScenes.landingOf(goosePlay, tree)
const editMode = dev && !filming ? dev.createPageEdit({ camera, renderer, scene, gooseScenes, goosePlay, plainPieces, settings, setPaused, view }) : undefined

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
  return DARK_MARGIN + settings.goosePace * unseen + tuning.maxSpeed * running
}

/** The goose's bones by name, the cage's key carried on one of them. */
const gooseBone = (name: string) => goose.bone(name)

/** The game's frame past the play, `dt` of play on, at the held time `held`: the goslings where it has them. */
function gooseFrame(dt: number, held: number) {
  roadside.ratWallsFrame(goosePlay.holder, () => run.walls(), swarm)
  gooseScenes.update(goosePlay, dt, gooseBone)
  // The dead trees' pumpkins where the tree folder and the edit mode have them now, for him and his goslings to keep out of.
  goosePlay.setPumpkins(gooseScenes.pumpkinBodies(goosePlay))
  deadTreesMesh.placeOwn(gooseScenes.ownTrees(goosePlay))
  // Calm until the strike: he and his goslings walk. Struck, he jumps in fright and they cower, till they bolt.
  const calm = opening.running() && opening.t < OPENING.strike
  goose.setCalm(calm)
  goose.setStartle(opening.running() ? startled(opening.t) : undefined)
  goose.setDying(felt.dyingAt())
  goslings.calm = calm
  goslings.scared = opening.running() && cowering(opening.t)
  openingShow.shoutFrame()
  felt.biteFrame()
  felt.torchFrame(dt, held)
  felt.rumbleFrame()
  view.cameraLeanFrame(dt, stood)
  heard.frame(dt)
  islandGeese.direct(ending.cue())
  ending.frame()
  if (opening.on && !opening.settled) opening.goslingsFrame((g) => view.inView(g.x, g.z, GOSLING_SEEN))
  // Bolting in the opening, none is in its scene yet: up its tree or down its well.
  islandGeese.object.visible = ending.running() || islandNear()
  // The island's oak a bush at the quality ladder's foot, or an oak again: changed while the island is out of view.
  // `?islandbush=1` or `=0` holds it so, for the bench to price it at any step.
  const bushed = url.has('islandbush') ? url.get('islandbush') === '1' : quality.step.islandBush
  if (roadside.oakAsBush !== bushed && !ending.running() && !islandNear()) pondWorld.oakAsBush(bushed)
  if (islandGeese.object.visible) islandGeese.update(dt, held)
  goslings.update(goosePlay, dt, held, !opening.on || opening.settled ? (k) => gooseScenes.lift(goosePlay, k) : undefined, ending.running() ? ending.act : opening.act)
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

const arrive = createRatsArrive({ goosePlay, settings, opening, swarm })
const heard = createGooseHeard({ gooseSounds, goosePlay, goslings, goose, rats, ghosts, islandGeese, pondLook, burningTreeLight, run, settings, feel, opening, ending, input, camera, renderer, dev, hisAt, standAt, torchFilledOnce, loaded: () => loadingPage.loaded })
const hints = createGooseHints({ goosePlay, goslings, gooseSounds, opening, ending, input, camera, renderer, dev, standAt, torchFilledOnce, burningTreeLight })
/** How many times he had fallen as of the last frame: one more, he has woken, and the camera is put on him at once. */
let fallsSeen = 0
const felt = createGooseFelt({ goosePlay, feel, gooseSounds, hisAt, standAt, goose, feathers, embers, flame, post, goslings, nightLights, torchHeard: heard.torchHeard, input, camera, view, beats, opening, ending, darkLook, darkHeld: DARK_HELD })

const loadingPage = createLoading({ scene, post, rats, islandGeese, ghosts, goslings, lights, fires, flame, embers, smoke, sun, lamp, shadowed, swarm, gpuQueue, lean, benchTools, backend, allBuilt, gooseSounds })

/** The game paused or going on, the panel's pause button saying which. */
function setPaused(on: boolean) {
  settings.paused = on
  panel?.refresh()
}
/** Whether the game pauses on its own here: in the opening, the play or the ending's card, not in edit mode. */
const pausesHere = () => loadingPage.loaded && !editMode?.on && !ending.againShown()
const pauseVeil = createPauseVeil({ settings, input, gooseSounds, loaded: () => loadingPage.loaded, editing: () => editMode?.on, setPaused })
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

/** The phone's bench on the page, fetched under `?bench` alone. */
const pageBench = benchOn ? await import('./dev/pagebench') : undefined
const keptRunFrame = createRunKeeper({ goosePlay, opening, ending, heard, arrive })

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
let bench: Bench | undefined
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
  const loading = !loadingPage.loaded
  if (!loading) keptRunFrame(frame)
  const dt = settings.paused || loading ? 0 : Math.min(frame, FRAME_CAP)
  beats.clock += dt
  if (opening.running()) opening.t = Math.min(OPENING.end, opening.t + dt)
  // The sky darkening as the rats come out: into the look, the panel's and the dawn's from there on. Skipped, or no
  // opening, it is dark from the start.
  const darkened = skyDarkened(opening.t)
  if (darkened !== skyShare) {
    skyShare = darkened
    look.sun.color = moonFrom.setHex(openingMoon).lerp(moonTo.setHex(DARKENED_MOON), darkened).getHex()
    nightLights.set(look, light.on, beats.vary)
  }
  if (ending.running()) ending.t = Math.min(ENDING.end, ending.t + dt)
  input.frame(loading)
  // The chase camera's hold on the mouse let go, for a click to reach the veil.
  if (input.commands.pause) {
    setPaused(true)
    document.exitPointerLock?.()
  }
  if (input.commands.resume) setPaused(false)
  pauseVeil.frame()
  if (input.commands.confirm) {
    loadingPage.enterAsked?.()
    ending.playAgain?.()
  }
  loadingPage.enterPad?.update(besideOf(input.commands))
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
  goose.pose(held, torchVelocity.x, torchVelocity.z, Math.atan2(goosePlay.facing.x, goosePlay.facing.z))
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
      const share = view.walkFrame(benchHolds.toward ?? view.heading(input.commands.walk), dt)
      // Slower in the water: his walking pace given way to his swimming one as he takes to it.
      const swimming = swimmingIn(pondLook, run.holder.x, run.holder.z, pondLook.goose)
      goosePlay.settings.pace = settings.goosePace * (1 + (pondLook.goose.pace - 1) * swimming) * share
      if (debugKeys.torchEverlasting) run.fuel = 1
      goosePlay.frame(dt, {
        heading: share > 0 ? { x: view.walking.x, z: view.walking.z } : null,
        interact: input.commands.interact || benchHolds.interact,
        look: view.kind === 'chase' ? view.drawnForward : null,
      })
      // The ending's music asked for when the last gosling is found, not held all the game.
      if (ending.on && goosePlay.goslings[goosePlay.guide]?.state === 'guiding') void gooseSounds?.load('ending')
      if (ending.on && endingDue(ending.island, goosePlay.holder)) ending.start()
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
  // What the swarm holds the rats off: the lights, and in the game the pond's water after them, drawn by nothing.
  // The burning branch's light flaring as it lands, before the dawn's comes first of them.
  const keptOff = ending.withDawn([...branchFlared(goosePlay.lights())])
  swarmTime.value = swarm.time
  const drawn = felt.wakeFlare(branchFlared(opening.running() && burningTreeLight >= 0 ? placed.map((p, k) => (k === burningTreeLight ? { ...p, reach: p.reach * litShare(opening.t) } : p)) : placed))
  lights.update(drawn)
  skyFog.lightUp(drawn, run.torch, run.torch.lit && settings.on, nightLights.torchFlare)
  zoneRings.frame(drawn)
  // The lamp, the fog, the sun and the camera after the light, before the swarm is told what the fog hides: this frame's fog, not the last one's.
  follow(dt, newBeat, frame)
  fires.branchFrame(newBeat, held, light.on)
  input.thumbsFrame(hints.holdHintFrame(shown, stood))
  felt.lifeFrame()
  hints.aheadFrame()
  hints.goslingCallFrame(dt)
  heard.wordsFrame(dt)
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
  // In the game, what the camera leaves out too, so they come back as near him as the view allows, and the
  // swarm seems to have no end.
  const margin = darkMargin()
  const dark: Dark | undefined =
    settings.bringRound ? { x: shown.x, z: shown.z, radius: darkRadius() + margin, view: view.groundView(margin) } : undefined
  const ratsCome = arrive.comeFrame(dt)
  const wanted = Math.round((fewRats ? Math.min(capacity, FEW_RATS) : Math.min(capacity, settings.rats + arrive.forGoslings())) * benchHolds.ratShare)
  // Held till the strike, but stepped once on the loading screen with the rest, so its first step builds nothing.
  const ratsHeld = opening.on && !ratsOut(opening.t) && !loading
  if (opening.on && !arrive.rushed && ratsOut(opening.t) && dark) {
    arrive.rushed = true
    arrive.rushIn(dark, 0, wanted)
    // The ground rumbles under them.
    gooseSounds?.play('quake')
  }
  // A found gosling's rats: the newcomers rush in, the ground rumbling lower under them, the camera shaking with it.
  if (ratsCome && dark && wanted > swarm.count) {
    const from = swarm.count
    swarm.setCount(wanted)
    arrive.rushIn(dark, from, wanted, Math.atan2(camera.position.z - dark.z, camera.position.x - dark.x))
    gooseSounds?.play('quake', undefined, RUMBLE_GAIN)
    felt.rumbledAt = goosePlay.t
  }
  // Loading, it takes its step on STEP_FRAME, and goes on being asked till it has stood them: the worker of WebGL 2 reads
  // its input on a clock of its own, and asked for one frame alone it could miss it, and the loading wait for ever at 99 %.
  const loadHeld = loading && (loadingPage.frame < STEP_FRAME || (loadingPage.frame > STEP_FRAME && swarm.ready))
  // The goslings in the dark pull the rats near them (#188).
  swarm.send(wanted, swarmLight, tuning, settings.paused || loadHeld || ratsHeld, dark, keptOff, goosePlay.targets)
  // The places: every frame when smooth; on the beat when held; and the first time a state is there, whatever the beat.
  if (!(stop.enabled && stop.swarm) || !swarm.ready) swarm.sample(performance.now())
  else if (stop.stagger) swarm.sampleStaggered(performance.now(), beats.clock, stop.fps)
  else if (newBeat) swarm.hold(performance.now())
  // The smoke on the run's held time too, trailing from the flame's tip; the torch out, from its charred tip, thinning
  // away to nothing and then gone.
  // A clock turned back since it went out, the smoke is long gone.
  const out = beats.clock < wentOut ? SMOKE_DIES : Math.max(0, held - wentOut)
  if (smokeDying && out >= SMOKE_DIES) {
    smokeDying = false
    smoke.object.visible = false
  }
  const smokeFrom = light.on ? flame.tip(flameTip) : (burningBranch?.end(flameTip) ?? flame.tip(flameTip))
  smoke.update(held, smokeFrom, camera.position, light.on ? 1 : SMOKE_THICK * Math.max(0, 1 - out / SMOKE_DIES))
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
  // the opening holds it, the goose and his goslings moving all the same; a changed look at once. The fire's shadow,
  // its mask, every frame.
  const now = performance.now()
  layFireShadows()
  const casting =
    swarm.version !== shadowed.version ||
    held !== shadowed.held ||
    (sun.castShadow && !sun.position.equals(shadowed.sun)) ||
    (settings.shadows && !lamp.position.equals(shadowed.lamp))
  if (shadowed.dirty || (casting && (swarm.steps !== shadowed.steps || (ratsHeld && now - shadowed.at >= HELD_SHADOW_MS)))) {
    // Baked, the moon's map is drawn the once, below.
    sun.shadow.needsUpdate = !moonBake?.on
    lamp.shadow.needsUpdate = true
    shadowed.version = swarm.version
    shadowed.steps = swarm.steps
    shadowed.held = held
    shadowed.sun.copy(sun.position)
    shadowed.lamp.copy(lamp.position)
    shadowed.at = now
    shadowed.dirty = false
  }
  // Baked, the moon's map drawn the once, on the first frame in play since, every stretch of the trees and bushes in it.
  if (moonBake && !loading && moonBake.frame()) {
    deadTreesMesh.cullPast(0, 0, Infinity)
    bushesMesh.cullPast(0, 0, Infinity)
  }
  // In the opening, none till the strike brings them.
  if (opening.on) rats.object.visible = ratsOut(opening.t)
  fallingLeaves?.update(dt, view.followed.x, view.followed.z)
  islandTree.update(dt)
  if (ghosts) {
    ghosts.object.visible = roadside.ghostsNear(within, view.inView)
    if (ghosts.object.visible) ghosts.update(dt, goosePlay.t)
  }
  heard.ghostsFrame(dt)
  plainFlames.update()
  if (loading) loadingPage.slice(placed)
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
  // The loading's frames are slow by design, and say nothing of the device; the opening is the page's first
  // impression, not to be seen stepping up and down; nor the ending, its oak not to turn to a bush before the player. A
  // step is taken at the head of the next frame: resized here, past this frame's drawing, the canvas would show empty,
  // a black frame.
  if (adapt && !loading && !opening.running() && !ending.running() && quality.frame(frame * 1000, start)) qualityDue = true
  if (!loading && url.get('bench') === 'load') watchFrames(frame * 1000)
  if (!loading) {
    if (!benchMade) {
      benchMade = true
      bench = pageBench?.createBench({ benchTools, goosePlay, look, tilt, scene, water, quality, renderer, lookChanged, rats, deadTreesMesh, bushesMesh, ground, prepassOn, fallingLeaves, goose, goslings, graveyard, ghosts, backend, lean, moon, run, swarm, gpuQueue, debugKeys, holds: benchHolds, url, ratsAfter: RATS_AFTER, opening, ending, inZone, fakeLamps, camera })
    }
    if (bench) goosePlay.life = 1
    bench?.frame(frame * 1000, performance.now() - start, performance.now())
  }
})
