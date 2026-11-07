// `?bench` (phonebench.ts) reads the game's places and what each thing drawn costs, on whatever it runs on, and posts it
// to the dev server's log. For a phone: `pnpm phone`, then `?bench&opening=0&ending=0&mute` at the address it prints,
// the screen left on for a few minutes. `?bench=all` reads every cost and place; `?bench=load`, with no `mute`, what a
// first visit fetches, the sounds with it, waiting at Enter. `?bench=route` plays the whole game through, opening to
// ending, as a player would (routebench.ts), and logs each second of it: where on the way the frames are slow.
// `?bench=cage` plays the route up to the cage and prices every cost where he stands at it, with the rats he has
// brought, every thing in the scene among them; `?bench=ending` plays it through and prices them over the ending's card.
// `?bench=soak` walks him up the road and
// back for five minutes, with a stand between, which shows a phone heating up, and with the quality free to move, which
// step it settles on. Otherwise the step is held where the device starts. The goose never dies, and his torch never
// burns down. The late game's load after the first place: every gosling with him, and their rats. Elsewhere
// `&budget=` says a vsync, ms, where it isn't 60 Hz. The load is raised by the pixel ratio, up to BENCH_DPRS.
import type { GoosePlay, Zone } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Look } from '../settings'
import type { TiltShift } from '../look/tiltshift'
import type { Scene, WebGPURenderer, Object3D, Camera } from 'three/webgpu'
import { Box3, Frustum, Matrix4 } from 'three/webgpu'
import type { Water } from '../world/water'
import type { Quality } from '../look/quality'
import type { Rats } from '../swarm/rats'
import type { DeadTreesMesh } from '../world/deadtrees'
import type { BushesMesh } from '../world/bushes'
import type { Floor } from '../world/ground'
import type { createFallingLeaves } from '../world/fallingleaves'
import type { Goose } from '../characters/goose'
import type { Goslings } from '../characters/goslings'
import type { Graveyard } from '../world/graveyard'
import type { Ghosts } from '../characters/ghosts'
import type { GpuSwarm } from '../swarm/gpuswarm'
import type { RemoteSwarm } from '../swarm/swarm-remote'
import type { BenchCost, PhoneBench, BenchPlace } from './phonebench'
import type { Point } from '../world/plain'
import type { Opening } from '../game/opening'
import { routeStep, type RouteStep } from './routebench'

/** The parts of the page the bench takes off and puts back. */
export interface BenchParts {
  benchTools: typeof import('./phonebench') | undefined
  goosePlay: GoosePlay<PlaySwarm>
  look: Look
  tilt: TiltShift | undefined
  scene: Scene
  water: Water
  quality: Quality
  renderer: WebGPURenderer
  lookChanged: () => void
  rats: Rats
  deadTreesMesh: DeadTreesMesh
  bushesMesh: BushesMesh
  ground: Floor
  prepassOn: boolean
  fallingLeaves: ReturnType<typeof createFallingLeaves> | undefined
  goose: Goose
  goslings: Goslings
  graveyard: Graveyard | undefined
  ghosts: Ghosts | undefined
  backend: string
  lean: boolean
  moon: string
  run: GoosePlay<PlaySwarm>['run']
  swarm: GpuSwarm | RemoteSwarm
  gpuQueue: { onSubmittedWorkDone(): Promise<void> } | undefined
  debugKeys: { torchEverlasting: boolean; standOffIsland(): void; standAtGraveyard(): void }
  /** What the bench holds the page to: the fire's shadow not drawn, the share of the rats asked for, and the route's player's walk and interact key. */
  holds: { ratShare: number; fireShadows: boolean; toward: Point | null; interact: boolean }
  opening: Opening
  ending: { running(): boolean; againShown(): boolean; island: { middle: Point } }
  /** The play's own test of a zone (gooseplay.ts), handed over. */
  inZone: (zone: Zone, p: Point) => boolean
  /** The fire lamps' one light (fakelamps.ts): its intensity at 0 puts them all out. */
  fakeLamps: { intensity: number }
  camera: Camera
  /** The address the bench was asked for on. */
  url: URLSearchParams
  /** How long after a gosling's find his rats come, s. */
  ratsAfter: number
}

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
function benchLook(lookChanged: () => void, name: string, set: (on: boolean) => void): BenchCost {
  const change = (on: boolean) => {
    set(on)
    lookChanged()
  }
  return { name, off: () => change(false), on: () => change(true) }
}
/** Whether `object` draws anything. */
function drawsAnything(object: Object3D): boolean {
  let draws = false
  object.traverse((part) => {
    const drawn = part as { isMesh?: boolean; isSprite?: boolean; isPoints?: boolean; isLine?: boolean }
    draws ||= !!(drawn.isMesh || drawn.isSprite || drawn.isPoints || drawn.isLine)
  })
  return draws
}
/** The things in the scene priced a part at a time: the scenes' group a scene at a time, the island tree its wood, leaves and falling leaves apart. */
const PRICED_BY_PART = ['scenes', 'island tree']
/**
 * Every thing in `scene` that draws, each taken off whole, those PRICED_BY_PART a part at a time, read only where
 * `seen` says it is in view; but those in `priced`, priced already.
 */
function thingsOf(scene: Scene, priced: Set<Object3D | undefined>, seen: (thing: Object3D) => boolean): BenchCost[] {
  const things = scene.children.flatMap((thing) => (PRICED_BY_PART.includes(thing.name) ? thing.children : [thing]))
  return things.filter((thing) => !priced.has(thing) && drawsAnything(thing)).map((thing, k) => ({ ...benchHide(thing.name || `unnamed ${thing.type} ${k}`, thing), seen: () => seen(thing) }))
}
const viewFrustum = new Frustum()
const viewMatrix = new Matrix4()
const viewBox = new Box3()
/** Whether any of `object` is in `camera`'s view, by its box. */
function inViewOf(camera: Camera, object: Object3D): boolean {
  viewFrustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
  return viewFrustum.intersectsBox(viewBox.setFromObject(object))
}
const BENCH_DPRS = [2.5, 3, 4]
/** How long `?bench=soak` goes on, in rounds of a walk up, a walk back and a stand, each reading 5 s. */
const SOAK_ROUNDS = 20
/** Under `?bench=route`, how long he may go moving less than STUCK_MOVE m before he is set NUDGE m on toward his aim, ms: against something a player would walk round. */
const STUCK_AFTER = 3000
const STUCK_MOVE = 0.3
const NUDGE = 1.5
/** How long he may make for one aim before it is given him, ms: its gosling, or, at the island, the run ended. */
const GIVE_UP = 90_000
/** How long the ending's card is read for before the route is done, ms. */
const CARD_READ = 3000

/** What the page asks of a bench each frame. */
export interface Bench {
  frame(frameMs: number, pageMs: number, now: number): void
}
export function createBench({ benchTools, goosePlay, look, tilt, scene, water, quality, renderer, lookChanged, rats, deadTreesMesh, bushesMesh, ground, prepassOn, fallingLeaves, goose, goslings, graveyard, ghosts, backend, lean, moon, run, swarm, gpuQueue, debugKeys, holds, url, ratsAfter, opening, ending, inZone, fakeLamps, camera }: BenchParts): Bench | undefined {
  if (!benchTools || url.get('bench') === 'load') return undefined
  const play = goosePlay
  const everyGosling = () => play.giveGoslings(play.goslings.length)
  // Back at the start first: the costs are read at the slowest place after the tour, and giving the goslings moves no one.
  const atTheStart = () => {
    play.standAtStart()
    everyGosling()
  }
  debugKeys.torchEverlasting = true
  const benchMode = url.get('bench')
  const soaking = benchMode === 'soak'
  const everything = benchMode === 'all'
  const routing = benchMode === 'route'
  const atCage = benchMode === 'cage'
  const atEnding = benchMode === 'ending'
  const pricing = atCage || atEnding
  // Time for each gosling's rats to come, RATS_AFTER s apart.
  const ratsCome = 3000 + play.goslings.length * ratsAfter * 1000
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
  const places: BenchPlace[] = soaking ? walks : atCage ? [
    { name: 'cage', go: () => {} },
  ] : atEnding ? [
    { name: 'ending', go: () => {} },
  ] : !everything ? [
    { name: 'start', go: atTheStart, settle: ratsCome },
    { name: 'dead tree', go: () => play.standBy('tree') },
    { name: 'pond', go: () => play.standByPond() },
  ] : [
    { name: 'start, no gosling', go: () => play.standAtStart() },
    { name: 'start', go: atTheStart, settle: ratsCome },
    { name: 'well', go: () => play.standBy('well') },
    { name: 'dead tree', go: () => play.standBy('tree') },
    { name: 'cage', go: () => play.standBy('cage') },
    ...(graveyard ? [{ name: 'graveyard', go: debugKeys.standAtGraveyard }] : []),
    { name: 'pond', go: () => play.standByPond() },
    { name: 'island', go: debugKeys.standOffIsland },
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
  const costs: BenchCost[] = soaking || routing ? [] : [
    { name: 'rats at a tenth', off: () => (holds.ratShare = 0.1), on: () => (holds.ratShare = 1) },
    // Where the load was not raised, the first reads the same both ways: what a price of nothing looks like.
    ...[2, 1.5, 1].map((dpr): BenchCost => ({ name: `dpr ${dpr}`, off: () => renderer.setPixelRatio(dpr), on: () => renderer.setPixelRatio(benchDpr) })),
    benchLook(lookChanged, 'every effect after the scene', (on) => {
      setTilt(on)
      setGrain(on)
      look.bloom.enabled = on && printed.bloom
      look.hatch.enabled = on && printed.hatch
      look.vignette.enabled = on && printed.vignette
    }),
    benchHide('rats', rats.object),
    benchHide('dead trees and bushes', deadTreesMesh.object, deadTreesMesh.own, bushesMesh.object),
    benchHide('ground', ground.mesh),
    ...(!everything && !pricing ? [] : [
      benchLook(lookChanged, 'tilt', setTilt),
      benchLook(lookChanged, 'moon shadows', (on) => (look.sun.shadows = on)),
      benchLook(lookChanged, 'bloom', (on) => (look.bloom.enabled = on && printed.bloom)),
      benchLook(lookChanged, 'hatch', (on) => (look.hatch.enabled = on && printed.hatch)),
      benchLook(lookChanged, 'grain and paper', setGrain),
      benchLook(lookChanged, 'vignette', (on) => (look.vignette.enabled = on && printed.vignette)),
      { name: 'fire shadows', off: () => (holds.fireShadows = true), on: () => (holds.fireShadows = false) },
      benchLook(lookChanged, 'rat trails', (on) => (look.trails.enabled = on)),
      { name: 'rat depth pre-pass', off: () => rats.setPrepass(!prepassOn), on: () => rats.setPrepass(prepassOn) },
      benchHide('falling leaves', fallingLeaves?.object),
      benchHide('goose and goslings', goose.object, goslings.object),
      ...(graveyard && ghosts ? [{ ...benchHide('ghosts', ghosts.object), place: 'graveyard', seen: () => inViewOf(camera, ghosts.object) }] : []),
      ...(waterMeshes.length > 0 ? [{ ...benchHide('water', ...waterMeshes), place: 'pond', seen: () => waterMeshes.some((part) => inViewOf(camera, part)) }] : []),
    ]),
    ...(!pricing ? [] : [
      { name: 'fire lamps', off: () => (fakeLamps.intensity = 0), on: () => (fakeLamps.intensity = 1) },
      ...thingsOf(scene, new Set([rats.object, deadTreesMesh.object, deadTreesMesh.own, bushesMesh.object, ground.mesh, goose.object, goslings.object, fallingLeaves?.object, ghosts?.object]), (thing) => inViewOf(camera, thing)),
    ]),
    // At their own place where it is among the places; else where the costs are read, if seen there.
  ].map((cost) => (cost.place === undefined || places.some((p) => p.name === cost.place) ? cost : { ...cost, place: undefined }))
  const line = document.createElement('div')
  line.style.cssText = 'position:fixed;top:8px;left:8px;z-index:100;font:12px monospace;color:#fff;background:#000a;padding:2px 6px;pointer-events:none'
  document.body.append(line)
  const device = (renderer.backend as unknown as { device?: { lost: Promise<{ reason: string; message: string }>; features: Set<string>; adapterInfo?: { vendor: string; architecture: string } } }).device
  const runs = Number(sessionStorage.getItem('goose-bench-runs') ?? 0) + 1
  sessionStorage.setItem('goose-bench-runs', String(runs))
  benchTools.logToServer({
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
  // At the cage, with its key, where he would hold the interact key to open it.
  if (routing || pricing) return routeBench(pricing ? phoneBench : undefined, atCage ? (step) => step.aim.startsWith('cage') && step.to === null : undefined)
  return phoneBench()

  /** The places stood at and the costs priced there. */
  function phoneBench(): PhoneBench {
    const bench: PhoneBench = new benchTools!.PhoneBench(places, costs, {
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

  /**
   * `?bench=route`: the route's player walks him and works each scene, and each second is logged with where he is;
   * `then`'s bench takes over, if any, where `at` says, or else at the ending's card.
   */
  function routeBench(then?: () => Bench, at?: (step: RouteStep) => boolean): Bench {
    const tools = benchTools!
    const holder = play.holder
    let phase = ''
    let aim = ''
    let aimSince = 0
    let tapped = false
    const stuck = { x: holder.x, z: holder.z, since: 0 }
    let cardSince = Number.NaN
    let done = false
    let next: Bench | undefined
    const found = () => play.goslings.filter((g) => g && g.state !== 'waiting').length
    const tenths = (v: number) => Math.round(v * 10) / 10
    const seconds = new tools.Seconds((second) =>
      tools.logToServer({ kind: 'second', phase, aim, goose: [tenths(holder.x), tenths(holder.z)], found: found(), rats: swarm.count, drawn: rats.drawn, drawCalls: renderer.info.render.drawCalls, dpr: renderer.getPixelRatio(), step: quality.level, ...second }),
    )
    const finish = (why: string) => {
      done = true
      holds.toward = null
      holds.interact = false
      line.textContent = 'bench done'
      tools.logToServer({ kind: 'done', why })
    }
    return {
      frame(frameMs, pageMs, now) {
        if (next) return next.frame(frameMs, pageMs, now)
        if (done) return
        phase = opening.running() ? 'opening' : ending.running() ? 'ending' : 'play'
        holds.toward = null
        holds.interact = false
        if (phase === 'play') walk(now)
        seconds.frame(frameMs, pageMs, now)
        line.textContent = `bench route ${phase}${phase === 'play' ? ` ${aim}` : ''}`
        if (at || !ending.againShown()) return
        if (Number.isNaN(cardSince)) cardSince = now
        else if (now - cardSince > CARD_READ) {
          if (!then) return finish('ending')
          tools.logToServer({ kind: 'done', why: 'ending' })
          next = then()
        }
      },
    }

    function walk(now: number) {
      const step = routeStep(play, ending.island.middle, inZone)
      if (step.aim !== aim) {
        aim = step.aim
        aimSince = now
        stuck.since = 0
        tools.logToServer({ kind: 'aim', aim, found: found(), goose: [tenths(holder.x), tenths(holder.z)] })
      }
      if (then && at?.(step)) {
        tools.logToServer({ kind: 'done', why: aim })
        next = then()
        return
      }
      // A fresh press each other frame, as a tap is.
      tapped = step.interact === 'tap' && !tapped
      holds.interact = step.interact === 'hold' || tapped
      if (now - aimSince > GIVE_UP) {
        if (aim === 'island') return finish('no ending')
        tools.logToServer({ kind: 'given', aim })
        play.giveGoslings(found() + 1)
        aimSince = now
      }
      // Standing to work a scene is not stuck: the watch starts again once he walks.
      if (!step.to) {
        stuck.since = 0
        return
      }
      const dx = step.to.x - holder.x
      const dz = step.to.z - holder.z
      const d = Math.hypot(dx, dz) || 1
      holds.toward = { x: holder.x + dx / d, z: holder.z + dz / d }
      if (Math.hypot(holder.x - stuck.x, holder.z - stuck.z) > STUCK_MOVE || stuck.since === 0) Object.assign(stuck, { x: holder.x, z: holder.z, since: now })
      else if (now - stuck.since > STUCK_AFTER) {
        const by = Math.min(NUDGE, d)
        holder.x += (dx / d) * by
        holder.z += (dz / d) * by
        tools.logToServer({ kind: 'nudged', aim, goose: [tenths(holder.x), tenths(holder.z)] })
        Object.assign(stuck, { x: holder.x, z: holder.z, since: now })
      }
    }
  }
}
