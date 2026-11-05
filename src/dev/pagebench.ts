// `?bench` (phonebench.ts) reads the game's places and what each thing drawn costs, on whatever it runs on, and posts it
// to the dev server's log. For a phone: `pnpm phone`, then `?bench&intro=0&outro=0&mute` at the address it prints,
// the screen left on for a few minutes. `?bench=all` reads every cost and place; `?bench=load`, with no `mute`, what a
// first visit fetches, the sounds with it, waiting at Enter. `?bench=soak` walks him up the road and
// back for five minutes, with a stand between, which shows a phone heating up, and with the quality free to move, which
// step it settles on. Otherwise the step is held where the device starts. The goose never dies, and his torch never
// burns down. The late game's load after the first place: every gosling with him, and their rats. Elsewhere
// `&budget=` says a vsync, ms, where it isn't 60 Hz. The load is raised by the pixel ratio, up to BENCH_DPRS.
import type { GoosePlay } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Look } from '../settings'
import type { TiltShift } from '../look/tiltshift'
import type { Scene, WebGPURenderer, Object3D } from 'three/webgpu'
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
  holds: { ratShare: number; fireShadows: boolean }
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
const BENCH_DPRS = [2.5, 3, 4]
/** How long `?bench=soak` goes on, in rounds of a walk up, a walk back and a stand, each reading 5 s. */
const SOAK_ROUNDS = 20
export function createBench({ benchTools, goosePlay, look, tilt, scene, water, quality, renderer, lookChanged, rats, deadTreesMesh, bushesMesh, ground, prepassOn, fallingLeaves, goose, goslings, graveyard, ghosts, backend, lean, moon, run, swarm, gpuQueue, debugKeys, holds, url, ratsAfter }: BenchParts): PhoneBench | undefined {
  if (!benchTools || url.get('bench') === 'load') return undefined
  const play = goosePlay
  const everyGosling = () => play.giveGoslings(play.goslings.length)
  debugKeys.torchEverlasting = true
  const benchMode = url.get('bench')
  const soaking = benchMode === 'soak'
  const everything = benchMode === 'all'
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
  const costs: BenchCost[] = soaking ? [] : [
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
    ...(!everything ? [] : [
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
