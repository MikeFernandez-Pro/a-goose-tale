// What draws the game: the renderer, on WebGPU or WebGL 2 as the device can, and what it does when it cannot.
import { phone, benchOn, url } from '../game/address'
import { watchForDrawFailure, nextAfterFailure } from '../ui/cannotdraw'
import { WebGPURenderer, type Object3D, PCFShadowMap, VSMShadowMap } from 'three/webgpu'
import { maxPixelRatio } from './quality'

/** The renderer made and put on the page, and what a device and the address ask of its frame. */
export async function createDrawing() {
  /** Where a phone has found this tab's WebGPU cannot draw the game: it stays on WebGL 2 for the tab. */
  const WEBGL_FOR_THE_TAB = 'a-goose-tale.webgl'
  const webglAsked = url.has('webgl') || (phone && sessionStorage.getItem(WEBGL_FOR_THE_TAB) === '1')
  type Adapter = { limits: { maxStorageBuffersInVertexStage?: number; maxTextureDimension2D: number; maxComputeWorkgroupSizeX: number; maxComputeInvocationsPerWorkgroup: number; maxComputeWorkgroupStorageSize: number } }
  const gpu = (navigator as { gpu?: { requestAdapter(options: { featureLevel: string }): Promise<Adapter | null> } }).gpu
  // The kind of adapter three asks for itself: a phone with only WebGPU's compatibility mode has no other, a Xiaomi Mi 9 among them.
  const adapter = webglAsked ? null : await gpu?.requestAdapter({ featureLevel: 'compatibility' })
  // The rats' vertices read storage buffers, and WebGPU's compatibility mode may allow none: no use trying, and failing, and
  // reloading. WebGL 2 from the first, as a Xiaomi Mi 9 needs.
  const forceWebGL = webglAsked || adapter?.limits.maxStorageBuffersInVertexStage === 0
  // A playback row a rat, and WebGPU's default limit is 8,192 rows: ask for what
  // the adapter can give, so the count reaches its top.
  // As much as the adapter has: past a device's defaults, the swarm's scan was refused and no rat drawn on a Xiaomi Mi 9.
  const requiredLimits = adapter && !forceWebGL
    ? {
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
        maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
        maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
        maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
      }
    : undefined
  const timestamps = url.has('timestamps')
  /** The phone's bench's tools (phonebench.ts), fetched under `?bench` alone. */
  const benchTools = benchOn ? await import('../dev/phonebench') : undefined
  benchTools?.logPageTrouble()
  // A phone that cannot draw the game tries WebGL 2, else says so (cannotdraw.ts), rather than playing on with no goose.
  const cannotDraw = { stop: () => {} }
  if (phone) {
    watchForDrawFailure(
      () => {
        if (nextAfterFailure(forceWebGL ? 'WebGL 2' : 'WebGPU') === 'give up') return false
        sessionStorage.setItem(WEBGL_FOR_THE_TAB, '1')
        location.reload()
        return true
      },
      () => cannotDraw.stop(),
    )
  }
  // `?bench=load&cold`: a first visit's load, whatever this phone has compiled before.
  if (url.has('cold')) benchTools?.makeShadersNew()
  /** Whether a phone has built all it builds before Enter; and what is being drawn, for the log of what came after it. */
  let allBuilt = false
  let drawingNow = ''
  benchTools?.logLatePipelines(() => allBuilt, () => drawingNow)
  if (url.get('bench') === 'load') benchTools?.logPipelineTimes(url.has('serial'))
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL, requiredLimits, trackTimestamp: timestamps })
  // The most the pixel ratio is drawn at, held to a 4K frame; the quality's steps take it lower, or `?dpr=N` sets it.
  const maxDpr = Number(url.get('dpr')) || maxPixelRatio(devicePixelRatio, innerWidth, innerHeight)
  renderer.setPixelRatio(maxDpr)
  renderer.setSize(innerWidth, innerHeight)
  renderer.domElement.setAttribute('role', 'img')
  renderer.domElement.setAttribute('aria-label', 'A Goose Tale, a game played by eye: a gander with a torch crosses a night full of rats to bring his goslings to their mother. WASD or the arrow keys walk, Space interacts, Escape pauses, M mutes.')
  const pageMain = document.querySelector('main') ?? document.body
  pageMain.append(renderer.domElement)
  await renderer.init()
  cannotDraw.stop = () => renderer.setAnimationLoop(null)
  if (phone) {
    // A phone can take the GPU from a page it has put away: the page again, and the run kept takes up where it was
    // (keptrun.ts), not a dead screen. Lost again at once, it has nothing more to try.
    const LOST_AT = 'a-goose-tale.lost'
    const LOST_APART = 15000
    renderer.onDeviceLost = () => {
      const lastAt = Number(sessionStorage.getItem(LOST_AT) ?? 0)
      if (Date.now() - lastAt < LOST_APART) return
      sessionStorage.setItem(LOST_AT, String(Date.now()))
      location.reload()
    }
  }
  /**
   * A phone's skeletons in a texture, and never in a uniform buffer: the driver of a Xiaomi Mi 9 (Adreno 640) refused to link
   * every skinned shader over a buffer's bones, on WebGPU and WebGL 2 alike, and so drew no goose. Three takes the texture
   * for bones past this limit: past 16 here, every skeleton the game has. `?bones=buffer` to see it refused.
   */
  const PHONE_BONES_LIMIT = 16 * 64
  if (phone && url.get('bones') !== 'buffer') {
    const { capabilities } = renderer.backend as unknown as { capabilities: { getUniformBufferLimit(): number } }
    capabilities.getUniformBufferLimit = () => PHONE_BONES_LIMIT
  }
  if (benchOn) {
    const drawObject = renderer.renderObject.bind(renderer)
    renderer.renderObject = (object, scene, camera, geometry, material, group, lightsNode, clippingContext, passId) => {
      if (allBuilt) {
        const parents: string[] = []
        for (let o: Object3D | null = object; o && parents.length < 3; o = o.parent) if (o.name) parents.push(o.name)
        drawingNow = `${object.type} ${parents.join(' < ') || '(no name)'} ${material.type} ${material.name} ${passId ?? ''}`
      }
      drawObject(object, scene, camera, geometry, material, group, lightsNode, clippingContext, passId)
    }
  }
  if (benchOn) renderer.domElement.addEventListener('webglcontextlost', () => benchTools?.logToServer({ kind: 'error', what: 'context lost', ms: Math.round(performance.now()) }))
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL 2'
  /**
   * A phone's frame, which never has the AO, the outlines, the bloom or the tilt's blur: the scene pass writes less (post.ts).
   * It keeps the tilt's camera and its grade, which the look stands on. `?lean=0` to measure against it, `?lean` to try it elsewhere.
   */
  const lean = url.get('lean') !== '0' && (phone || url.has('lean'))
  /**
   * The moon's shadows, `?moon=vsm`, `pcf` or `none`, `none` taking the fires' shadows of him and his goslings with them:
   * on a phone none. They were what stood between it and 60 fps: 29 to 30 ms a frame with three's variance maps, which
   * blur twice at each drawing and draw into the map all that receives shadows, the ground too, 23 to 24 ms with PCF, 17
   * to 18 ms with none (iPhone 15 Pro Max, dpr 2, 1,000 rats, 2026-11-02).
   */
  const moon = url.get('moon') ?? (lean ? 'none' : 'vsm')
  // Ready for the sun and the lamp to cast, each while its shadows toggle is on.
  // Variance shadow maps, blurred before they are read, so the sun's softness
  // smooths the rats' shadows instead of graining them: three's WebGPU build has
  // no soft PCF, and its PCF takes five samples. The lamp, a point light, cannot
  // use them and keeps three's PCF.
  renderer.shadowMap.enabled = moon !== 'none'
  renderer.shadowMap.type = moon === 'pcf' ? PCFShadowMap : VSMShadowMap
  /**
   * The GPU's queue, on WebGPU: Chrome takes a pipeline at once and builds it
   * on the GPU's side after, so a frame drawn is not a pipeline built. Without
   * waiting for it the loading screen went at 6 s and the game stood 6 s more
   * (2026-10-27).
   */
  const gpuQueue = (renderer.backend as unknown as { device?: { queue: { onSubmittedWorkDone(): Promise<void> } } }).device?.queue
  return {
    renderer,
    backend,
    lean,
    moon,
    maxDpr,
    timestamps,
    benchTools,
    gpuQueue,
    /** All a phone builds before Enter is built. */
    allBuilt() {
      allBuilt = true
    },
  }
}
