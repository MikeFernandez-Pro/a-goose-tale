// The loading: every pipeline the game will want built behind the screen, a slice a frame, so nothing stalls once it plays;
// and the screen's count, and its Enter.
import { Scene, DirectionalLight, PointLight, type Object3D, Mesh } from 'three/webgpu'
import { createPost } from '../look/post'
import { Rats } from '../swarm/rats'
import { type IslandGeese } from '../characters/islandgeese'
import { type Ghosts } from '../characters/ghosts'
import { type Goslings } from '../characters/goslings'
import { type Lights } from '../light/lights'
import { type PlainFires } from '../light/plainfires'
import { type Flame } from '../light/flame'
import { createEmbers } from '../light/embers'
import { createSmoke } from '../light/smoke'
import { GpuSwarm } from '../swarm/gpuswarm'
import { RemoteSwarm } from '../swarm/swarm-remote'
import { type GooseSounds } from '../sound/goosesounds'
import { type PadButton, padBeside } from './holdhint'
import { type FixedLight } from '../swarm/swarm'
import { PipelineSlices } from '../look/pipelineslices'
import { benchOn, filming } from '../game/address'

/** The loading's one frame the swarm steps on, to build the step's pipelines: a step or two, which moves no rat to speak of. */
export const STEP_FRAME = 1

/** The loading, on what the page has made. */
export function createLoading({ scene, post, rats, islandGeese, ghosts, goslings, lights, fires, flame, embers, smoke, sun, lamp, shadowed, swarm, gpuQueue, lean, benchTools, backend, allBuilt, gooseSounds }: {
  scene: Scene
  post: ReturnType<typeof createPost>
  rats: Rats
  islandGeese: IslandGeese
  ghosts: Ghosts | undefined
  goslings: Goslings
  lights: Lights
  fires: PlainFires
  flame: Flame
  embers: ReturnType<typeof createEmbers>
  smoke: ReturnType<typeof createSmoke>
  sun: DirectionalLight
  lamp: PointLight
  shadowed: { dirty: boolean }
  swarm: GpuSwarm | RemoteSwarm
  gpuQueue: { onSubmittedWorkDone(): Promise<void> } | undefined
  lean: boolean
  benchTools: typeof import('../dev/phonebench') | undefined
  backend: string
  allBuilt: () => void
  gooseSounds: GooseSounds | undefined
}) {
  const { sceneFires, pitFires, crownFires, trunkFires, footFire, burningBranch, branchFire, branchEmbers } = fires
  const loading = {
    /** Whether the page has loaded: every pipeline built, the GPU done building them, and the loading screen fading. */
    loaded: false,
    /** The loading screen's Enter pressed, once it shows. */
    enterAsked: undefined as (() => void) | undefined,
    /** On a pad, its button beside the loading screen's Enter. */
    enterPad: undefined as PadButton | undefined,
    slice: loadSlice,
    /** How many frames the loading has drawn. */
    get frame() {
      return loadFrame
    },
  }
  /** Whether what the game hides until its moment has been drawn once unseen, to build its pipelines. */
  let unseenBuilt = false
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
      loading.loaded = true
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
  function enterWhenAsked(go: () => void) {
    if (!askToEnter || !loadingScreen) return go()
    // In the share's place, so the title stays where it is.
    const slot = loadingShare?.parentElement ?? loadingScreen
    loadingShare?.remove()
    const enter = document.createElement('button')
    enter.className = 'enter'
    enter.textContent = 'Enter'
    loading.enterPad = padBeside(enter)
    let entered = false
    const once = () => {
      if (entered) return
      entered = true
      loading.enterAsked = undefined
      enter.disabled = true
      // From a pad's press, the sounds' own unlock on a click or key never ran.
      gooseSounds?.unlock()
      go()
    }
    enter.addEventListener('click', once)
    loading.enterAsked = once
    slot.append(enter)
    enter.focus()
  }
  return loading
}
