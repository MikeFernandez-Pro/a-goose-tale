// The camera over the goose: its lens, its follow of him, its kinds (the fixed one the player has, the others the
// developer's), what knocks it, and the shots that take it over in the opening and the ending. And his walk, which goes
// the way the camera sees the ground.
import { Vector3, type PerspectiveCamera, type WebGPURenderer, Spherical, Frustum, Matrix4, Sphere, Quaternion } from 'three/webgpu'
import { url, phone, filming, calm, debugOn } from './address'
import type { Light, ViewPlane } from '../swarm/swarm'
import type { Goslings } from '../characters/goslings'
import type { GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { GooseFeel, Look } from '../settings'
import type { Opening } from './opening'
import type { Ending } from './ending'
import type { TiltShift } from '../look/tiltshift'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Walk } from '../ui/goosecontrols'
import { shakeAt } from './openingscript'
import { pullOf } from './endingscript'

/**
 * Where the camera starts from the light, and its field of view: a third
 * person's view, behind and a little above the holder, looking at its head
 * (2026-10-10; before, high and close, (0, 3.6, 2.8) at the feet).
 * From there the mouse moves it freely, and it keeps wherever it was put
 * from the light as the light walks.
 */
const CAMERA_OFFSET = new Vector3(0, 2.3, 4.6)
const CAMERA_TARGET = new Vector3(0, 0.9, -0.4)
/** Where the camera starts from the light when filming, and where it looks, from the light: a take's start, copied from the Film panel, since removed, on 2026-10-08. */
const FILM_CAMERA = new Vector3(-0.07, 1.97, 3.94)
const FILM_TARGET = new Vector3(-0.03, -0.13, -0.54)
/** How far over the ground the camera always stays, m; and how far a pixel of the locked pointer turns it, radians. */
const CAMERA_ABOVE = 0.6
const LOOK_SPEED = 0.0025
/**
 * The game's cameras, V going round them (?orbit, ?locked or ?chase starts in one) (2026-10-24). The fixed one,
 * the page's own: GOOSE_CAMERA from his feet, looking at GOOSE_TARGET, the chosen framing, captured on the panel on
 * 2026-10-24, 22 degrees down from 5.5 m (or the panel's capture kept since); nothing the mouse does turns it, but the
 * mouse's place on the screen slides it a little, as Portfolio2024's camera does (a touch's does not): up to PARALLAX m across
 * and up, eased over PARALLAX_EASE s, the way it looks unchanged. The orbit, free, from the same framing. The locked
 * one, the same framing, never turned across; the drag tilts it only, between LOCKED_TILT's angles down from the
 * horizon. The chase, from CHASE_LOOK m over him, CHASE_CAMERA back and up, turning on the locked pointer, he turning
 * to it as he stands.
 */
const GOOSE_CAMERA = new Vector3(0.4, 2.67, 4.94)
const GOOSE_TARGET = new Vector3(0.02, 0.58, -0.12)
const PARALLAX = { x: 0.5, y: 0.3 }
const PARALLAX_EASE = 0.35
const LOCKED_TILT = [15, 80] as const
const CHASE_CAMERA = new Vector3(0, 1.6, 4)
const CHASE_LOOK = 0.9
export type GooseCamera = 'fixed' | 'orbit' | 'locked' | 'chase'
const GOOSE_CAMERAS: readonly GooseCamera[] = ['fixed', 'orbit', 'locked', 'chase']
/** Where the camera captured on the panel is kept between loads. */
export const GOOSE_CAMERA_KEPT = 'a-goose-tale.goose-camera'
/** A captured camera: where it stands and where it looks, m from his feet; and the follow's lag, s. */
interface CapturedCamera {
  camera: [number, number, number]
  target: [number, number, number]
  lag: number
  /** The field of view, degrees: none in a capture from before it was kept. */
  fov?: number
}
export const CAMERA_FOV = 42
/**
 * How far behind the light the camera's follow runs, in seconds: it closes
 * most of the gap in this long, so a key pressed or released reaches the
 * camera as a glide rather than a step.
 */
const GOOSE_CAMERA_FOLLOW = 0.6

/** The lens kept fitted to the page, and the drawing to its size. */
export function fitToPage(camera: PerspectiveCamera, renderer: WebGPURenderer): void {
  /**
   * How much a phone's lens zooms in, held sideways and upright: the frame's height is what the lens keeps, and a phone
   * sideways has little of it and upright little width. `?zoom=sideways,upright` to try others.
   */
  const askedZoom = (url.get('zoom') ?? '').split(',').map(Number)
  const ZOOM_SIDEWAYS = askedZoom[0] || 1.3
  const ZOOM_UPRIGHT = askedZoom[1] || 0.88
  /** The lens fitted to the page as it now is. */
  function fitLens() {
    camera.aspect = innerWidth / innerHeight
    camera.zoom = !phone ? 1 : camera.aspect < 1 ? ZOOM_UPRIGHT : ZOOM_SIDEWAYS
    camera.updateProjectionMatrix()
  }
  fitLens()
  addEventListener('resize', () => {
    fitLens()
    renderer.setSize(innerWidth, innerHeight)
  })
}

/** The camera on the page, as `light` walks. */
export function createGooseView({ camera, renderer, light, goslings, run, feel, opening, ending, torchFilledOnce, tilt, standAt, groundAt, goosePlay, look }: {
  camera: PerspectiveCamera
  renderer: WebGPURenderer
  light: Light
  goslings: Goslings
  run: GoosePlay<PlaySwarm>['run']
  feel: GooseFeel
  opening: Opening
  ending: Ending
  torchFilledOnce: () => boolean
  tilt: TiltShift | undefined
  standAt: (x: number, z: number) => number
  groundAt: (x: number, z: number) => number
  goosePlay: GoosePlay<PlaySwarm>
  look: Look
}) {
  /** His walk as it eases: the way he moves and the share of his pace he moves at, as x and z. */
  const walking = { x: 0, z: 0 }
  /** Under this share of his pace, no key held, he has stopped. */
  const STOPPED = 0.02
  /**
   * His walk eased toward where the walk sends him, `toward` (`heading`'s point as far past him, m, as the walk is
   * strong, or none) over `dt` s: within 5% of it in `feel.inertia` s, three of its time constants. The share of his
   * pace he walks at, 0 to 1.
   */
  function walkFrame(toward: { x: number; z: number } | null, dt: number): number {
    const wx = toward ? toward.x - run.holder.x : 0
    const wz = toward ? toward.z - run.holder.z : 0
    const k = feel.inertia > 0 ? 1 - Math.exp((-3 * dt) / feel.inertia) : 1
    walking.x += (wx - walking.x) * k
    walking.z += (wz - walking.z) * k
    if (!toward && Math.hypot(walking.x, walking.z) < STOPPED) walking.x = walking.z = 0
    return Math.min(1, Math.hypot(walking.x, walking.z))
  }
  /**
   * How far behind the light the camera's follow runs, s, as the panel's camera folder sets it.
   */
  const cameraFollow = { lag: GOOSE_CAMERA_FOLLOW }
  /** The camera's field of view, degrees, as the panel's camera folder sets it. */
  const gooseLens = {
    get fov() {
      return camera.fov
    },
    set fov(degrees: number) {
      camera.fov = degrees
      camera.updateProjectionMatrix()
    },
    ortho: false,
    orthoChanged: () => setOrtho(gooseLens.ortho),
  }
  /**
   * TEST: a near orthographic camera, as the panel's switch asks: not an orthographic camera, which every pass, the rats'
   * cull and the hints would have to learn, but a long lens from far off: ORTHO_FOV degrees, backed off so he stays the
   * size he was, the clip planes kept round him (orthoFrame) for the depth's sake. Off, the lens and distance as they were.
   */
  const ORTHO_FOV = 2
  const ORTHO_DEPTH = 80
  const unOrtho = { fov: CAMERA_FOV, minDistance: 0.5, maxDistance: 80 }
  function setOrtho(on: boolean) {
    const offset = new Vector3().subVectors(camera.position, controls.target)
    const half = (fov: number) => Math.tan((fov * Math.PI) / 360)
    const to = on ? ORTHO_FOV : unOrtho.fov
    if (on) Object.assign(unOrtho, { fov: camera.fov, minDistance: controls.minDistance, maxDistance: controls.maxDistance })
    offset.multiplyScalar(half(camera.fov) / half(to))
    camera.position.copy(controls.target).add(offset)
    controls.minDistance = on ? unOrtho.minDistance * (half(unOrtho.fov) / half(to)) : unOrtho.minDistance
    controls.maxDistance = on ? unOrtho.maxDistance * (half(unOrtho.fov) / half(to)) : unOrtho.maxDistance
    if (!on) {
      camera.near = 0.1
      camera.far = 100
    }
    gooseLens.fov = to
  }
  /** The clip planes round him while the lens is near orthographic, as far off as the camera now is. */
  function orthoFrame() {
    if (!gooseLens.ortho) return
    const distance = camera.position.distanceTo(controls.target)
    camera.near = Math.max(0.1, distance - ORTHO_DEPTH)
    camera.far = distance + ORTHO_DEPTH
    camera.updateProjectionMatrix()
  }
  // The camera: the mouse turns it round the light (left button), slides it
  // (right), and brings it in and out (wheel), as far as it likes; only the
  // ground stops it.
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2 - 0.05
  controls.minDistance = 0.5
  controls.maxDistance = 80
  // The chase camera: a click locks the pointer, and the pointer then turns the camera round him, up and down as far as
  // the orbit goes: the drag does not. Escape lets it go.
  /** The game's camera, and whether it turns on the locked pointer, as all but the orbit do. */
  let gooseCamera: GooseCamera = 'fixed'
  /** The pointer's place on the screen, -1 to 1 across and down; the fixed camera's parallax as now slid, m. */
  const pointerShare = { x: 0, y: 0 }
  const parallax = new Vector3()
  const parallaxAcross = new Vector3()
  const parallaxWanted = new Vector3()
  const parallaxStep = new Vector3()
  let chasing = false
  const orbit = new Spherical()
  const orbitOffset = new Vector3()
  renderer.domElement.addEventListener('click', () => {
    if (chasing && document.pointerLockElement !== renderer.domElement) void renderer.domElement.requestPointerLock()
  })
  addEventListener('mousemove', (event) => {
    // A shot in holds the orbit where it was, to hand back to.
    if (!chasing || document.pointerLockElement !== renderer.domElement || shotIn()) return
    orbit.setFromVector3(orbitOffset.copy(camera.position).sub(controls.target))
    orbit.theta -= event.movementX * LOOK_SPEED
    orbit.phi = Math.min(controls.maxPolarAngle, Math.max(0.15, orbit.phi - event.movementY * LOOK_SPEED))
    camera.position.copy(controls.target).add(orbitOffset.setFromSpherical(orbit))
  })

  /**
   * Up the screen along the ground as the walk reads it: the drawn camera's
   * forward, but while a shot is in, as of the last frame he was sent no way, so
   * a shot cutting in or out never turns a walk already asked; and the drawn
   * camera's forward, last frame.
   */
  const keysForward = { x: 0, z: -1 }
  const drawnForward = { x: 0, z: -1 }

  /**
   * A point past the light the way the walk points, as the camera sees the
   * ground wherever it is turned, as many metres past as the walk is strong: a
   * full push a metre, a light one less. Null when it is sent no way.
   */
  function heading(walk: Walk | null): { x: number; z: number } | null {
    if (!walk || !shotIn()) {
      keysForward.x = drawnForward.x
      keysForward.z = drawnForward.z
    }
    if (!walk) return null
    // Up the screen is the camera's forward along the ground; right is to its right.
    const fx = keysForward.x
    const fz = keysForward.z
    const wx = -fz * walk.x - fx * walk.y
    const wz = fx * walk.x - fz * walk.y
    return { x: run.holder.x + wx * walk.strength, z: run.holder.z + wz * walk.strength }
  }
  /** Where the camera's follow of the light has got to: it eases after the light, GOOSE_CAMERA_FOLLOW behind. */
  const followed = new Vector3(light.x, 0, light.z)
  const moved = new Vector3()
  /** The camera's follow owed since it last moved, s, while the stop motion holds the camera. */
  let owed = 0
  /** The camera's view, as the dead trees and bushes are culled to it. */
  const plantsView = new Frustum()
  const plantsMatrix = new Matrix4()
  const viewSphere = new Sphere()
  /** Whether the ground round (x, z), `radius` m out, is in the camera's view as last laid; or round (x, y, z), given `y`. */
  const inView = (x: number, z: number, radius: number, y = groundAt(x, z)) => plantsView.intersectsSphere(viewSphere.set(viewSphere.center.set(x, y, z), radius))
  followed.y = standAt(light.x, light.z)
  camera.position.set(light.x, followed.y, light.z).add(filming ? FILM_CAMERA : CAMERA_OFFSET)
  if (filming) controls.target.set(light.x, followed.y, light.z).add(FILM_TARGET)
  else controls.target.set(light.x, followed.y, light.z).add(CAMERA_TARGET)
  /**
   * The game's camera set to `to`. The fixed one put back at the framing, kept or the page's, the mouse doing
   * nothing to it but the parallax. The locked one put back where it stands over him, held to its one way across
   * and its tilts. The chase looks at him from behind as the camera now faces, CHASE_CAMERA back and up, the locked
   * pointer turning it round him; the drag neither turns nor slides it, the wheel still brings it in and out. The orbit
   * free again. `lock`: asked on a key, the chase's pointer locked at once; else on the first click.
   */
  function setGooseCamera(to: GooseCamera, lock: boolean) {
    gooseCamera = to
    chasing = to === 'chase'
    if (!chasing && document.pointerLockElement === renderer.domElement) document.exitPointerLock()
    const locked = to === 'locked'
    controls.enabled = to !== 'fixed'
    controls.enableRotate = !chasing
    controls.enablePan = to === 'orbit'
    controls.minAzimuthAngle = locked ? 0 : -Infinity
    controls.maxAzimuthAngle = locked ? 0 : Infinity
    controls.minPolarAngle = locked ? ((90 - LOCKED_TILT[1]) * Math.PI) / 180 : 0
    controls.maxPolarAngle = locked ? ((90 - LOCKED_TILT[0]) * Math.PI) / 180 : Math.PI / 2 - 0.05
    parallax.set(0, 0, 0)
    if (to === 'fixed') {
      const kept = keptGooseCamera()
      controls.target.copy(followed).add(kept ? new Vector3(...kept.target) : GOOSE_TARGET)
      camera.position.copy(followed).add(kept ? new Vector3(...kept.camera) : GOOSE_CAMERA)
      return
    }
    if (locked) {
      controls.target.copy(followed).add(GOOSE_TARGET)
      camera.position.copy(followed).add(GOOSE_CAMERA).setX(controls.target.x)
      return
    }
    if (!chasing) return
    controls.target.set(followed.x, followed.y + CHASE_LOOK, followed.z)
    orbit.setFromVector3(orbitOffset.copy(camera.position).sub(controls.target))
    const chase = new Spherical().setFromVector3(CHASE_CAMERA)
    orbit.radius = chase.radius
    orbit.phi = chase.phi
    camera.position.copy(controls.target).add(orbitOffset.setFromSpherical(orbit))
    if (lock) void renderer.domElement.requestPointerLock()
  }
  /**
   * The fixed camera slid after the pointer: toward where it is on the screen, -1 to 1 each way, up to PARALLAX m along
   * the camera's own across and up, camera and target together, so the way it looks never changes.
   */
  function parallaxFrame(dt: number) {
    if (gooseCamera !== 'fixed' || !(dt > 0) || !Number.isFinite(dt)) return
    parallaxAcross.set(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize()
    parallaxWanted.copy(parallaxAcross).multiplyScalar(pointerShare.x * PARALLAX.x)
    parallaxWanted.y = -pointerShare.y * PARALLAX.y
    parallaxStep.subVectors(parallaxWanted, parallax).multiplyScalar(1 - Math.exp(-dt / PARALLAX_EASE))
    parallax.add(parallaxStep)
    camera.position.add(parallaxStep)
    controls.target.add(parallaxStep)
  }

  /** The camera captured on an earlier load, if one is kept and reads right. */
  function keptGooseCamera(): CapturedCamera | undefined {
    // With the tilt on, the diorama's camera, high over him, in place of any kept one.
    if (tilt?.look.enabled) return tilt.camera(GOOSE_CAMERA_FOLLOW)
    try {
      const kept = JSON.parse(localStorage.getItem(GOOSE_CAMERA_KEPT) ?? 'null') as CapturedCamera | null
      return kept && kept.camera?.length === 3 && kept.target?.length === 3 && Number.isFinite(kept.lag) ? kept : undefined
    } catch {
      return undefined
    }
  }

  /**
   * Where the camera now is from his feet, where it looks, its angle and distance, and the follow's lag: kept for the next
   * load, copied to the clipboard and logged, as the text the panel shows.
   */
  function captureGooseCamera(): string {
    const round = (v: number) => Math.round(v * 100) / 100
    const from = (v: Vector3): [number, number, number] => [round(v.x - followed.x), round(v.y - followed.y), round(v.z - followed.z)]
    const captured: CapturedCamera = { camera: from(camera.position), target: from(controls.target), lag: cameraFollow.lag, fov: camera.fov }
    localStorage.setItem(GOOSE_CAMERA_KEPT, JSON.stringify(captured))
    const at = new Spherical().setFromVector3(orbitOffset.copy(camera.position).sub(controls.target))
    const text = JSON.stringify({
      ...captured,
      distance: round(at.radius),
      down: round(90 - (at.phi * 180) / Math.PI),
      turn: round((at.theta * 180) / Math.PI),
    })
    console.info('goose camera', text)
    void navigator.clipboard?.writeText(text).catch(() => {})
    return text
  }
  const viewFrustum = new Frustum()
  const viewMatrix = new Matrix4()
  const viewPlanes: ViewPlane[] = viewFrustum.planes.map(() => ({ a: 0, b: 0, c: 0 }))
  /**
   * The camera's frustum met with the ground, each plane pushed `margin` m out, so a rat set down past it shows no
   * part of itself: the game's dark, where the rats left behind are set down as near him as the view allows.
   */
  function groundView(margin: number): ViewPlane[] {
    camera.updateMatrixWorld()
    viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    viewFrustum.setFromProjectionMatrix(viewMatrix, camera.coordinateSystem)
    viewFrustum.planes.forEach(({ normal, constant }, k) => Object.assign(viewPlanes[k]!, { a: normal.x, b: normal.z, c: constant + margin }))
    return viewPlanes
  }
  /** The camera's knock this frame, m, a bite's, the torch's catch's and a rumble's, added over the orbit's for the drawing (standAtShots); zero, none. */
  const cameraKnock = new Vector3()
  /** How far the camera's follow leans off him toward a gosling still waiting, m, as it now leans (cameraLeanFrame). */
  const leanAim = { x: 0, y: 0, z: 0 }
  const leanHead = new Vector3()
  /**
   * The camera leaning toward the nearest gosling still waiting (the feel folder's `lean`): as he comes within `from` m of
   * the little one, the more the nearer, all of it by `near` m, `pull` of the way from him to the gosling as drawn, up a tree or
   * down a well, `most` m at most, up but never down; easing there over `ease` s, and back once the gosling is with him. Slid,
   * never turned, so the keys walk him the way they always do. Held back as his torch runs low, `low` on: every metre
   * framed toward him is a metre of the dark on his other side not seen.
   */
  function cameraLeanFrame(dt: number, stood: number) {
    const { lean } = feel
    let x = 0
    let y = 0
    let z = 0
    if (!opening.running() && !ending.running() && Number.isNaN(goosePlay.fallen) && torchFilledOnce()) {
      const { holder, run } = goosePlay
      let near = -1
      let off = lean.from
      goosePlay.goslings.forEach((g, k) => {
        const d = g?.state === 'waiting' ? Math.hypot(g.x - holder.x, g.z - holder.z) : Infinity
        if (d < off) {
          near = k
          off = d
        }
      })
      const g = goosePlay.goslings[near]
      if (g) {
        const c = Math.min(1, Math.max(0, (lean.from - off) / Math.max(lean.from - lean.near, 1e-3)))
        const close = c * c * (3 - 2 * c)
        const burning = !run.torch.lit ? 0 : lean.low ? Math.min(1, run.fuel / Math.max(feel.torch.low, 1e-3)) : 1
        goslings.headOf(near, leanHead)
        const share = lean.pull * close * burning
        x = (leanHead.x - holder.x) * share
        z = (leanHead.z - holder.z) * share
        y = Math.max(0, leanHead.y - (Number.isNaN(stood) ? standAt(holder.x, holder.z) : stood)) * share
        const length = Math.hypot(x, y, z)
        if (length > lean.most) {
          const cut = lean.most / length
          x *= cut
          y *= cut
          z *= cut
        }
      }
    }
    const k = lean.ease > 0 ? 1 - Math.exp(-dt / lean.ease) : 1
    leanAim.x += (x - leanAim.x) * k
    leanAim.y += (y - leanAim.y) * k
    leanAim.z += (z - leanAim.z) * k
  }
  /** Whether a shot is in over the orbit: the opening's or the ending's. */
  const shotIn = () => opening.running() || ending.running()
  /** The orbit's camera kept, to put back once the frame is drawn. */
  const orbitAt = new Vector3()
  const orbitTurn = new Quaternion()
  const looking = new Vector3()

  /** No shake, where less motion is asked for. */
  const STILL_CAMERA = { x: 0, y: 0, z: 0 }

  /** The camera stood at the shots as far in as they are, over the orbit, for this frame's drawing: true if it moved, to be put back after. */
  function standAtShots(): boolean {
    const knocked = !calm && !shotIn() && cameraKnock.lengthSq() > 0
    const moved = shotIn() || knocked
    if (moved && opening.running()) {
      orbitAt.copy(camera.position)
      orbitTurn.copy(camera.quaternion)
      // The game's own camera, thrown about by the strike.
      const shake = calm ? STILL_CAMERA : shakeAt(opening.t)
      camera.position.add(looking.set(shake.x, shake.y, shake.z))
      camera.lookAt(controls.target.x + shake.x * 0.6, controls.target.y + shake.y * 0.6, controls.target.z + shake.z * 0.6)
    } else if (moved && ending.running()) {
      orbitAt.copy(camera.position)
      orbitTurn.copy(camera.quaternion)
      // The game's own camera, drawn back along its look as the ending closes.
      looking.subVectors(camera.position, controls.target).normalize().multiplyScalar(pullOf(ending.t))
      camera.position.add(looking)
      camera.lookAt(controls.target)
    } else if (knocked) {
      orbitAt.copy(camera.position)
      orbitTurn.copy(camera.quaternion)
      // A bite on him: the camera knocked, its look with it a little behind, as the opening's strike throws it.
      camera.position.add(cameraKnock)
      camera.lookAt(controls.target.x + cameraKnock.x * 0.6, controls.target.y + cameraKnock.y * 0.6, controls.target.z + cameraKnock.z * 0.6)
    }
    camera.getWorldDirection(looking)
    const along = Math.hypot(looking.x, looking.z)
    if (along > 1e-3) {
      drawnForward.x = looking.x / along
      drawnForward.z = looking.z / along
    }
    return moved
  }
  return {
    controls,
    followed,
    plantsView,
    cameraFollow,
    gooseLens,
    cameraKnock,
    leanAim,
    drawnForward,
    walking,
    inView,
    setGooseCamera,
    keptGooseCamera,
    captureGooseCamera,
    groundView,
    walkFrame,
    heading,
    orthoFrame,
    standAtShots,
    cameraLeanFrame,
    get kind() {
      return gooseCamera
    },
    get chasing() {
      return chasing
    },
    /** The kind the address asks for, and where a capture left it: once he has been followed to where he starts. */
    start() {
      if (!filming) {
        addEventListener('keydown', (event) => {
          if (!debugOn || event.code !== 'KeyV' || event.repeat || event.target instanceof HTMLInputElement) return
          setGooseCamera(GOOSE_CAMERAS[(GOOSE_CAMERAS.indexOf(gooseCamera) + 1) % GOOSE_CAMERAS.length]!, true)
        })
        // A mouse's alone: a phone sends a mouse's move after each tap, which would slide the camera to every thumb.
        addEventListener('pointermove', (event) => {
          if (event.pointerType !== 'mouse') return
          pointerShare.x = (event.clientX / innerWidth) * 2 - 1
          pointerShare.y = (event.clientY / innerHeight) * 2 - 1
        })
        setGooseCamera(url.has('orbit') ? 'orbit' : url.has('locked') ? 'locked' : url.has('chase') ? 'chase' : 'fixed', false)
        // The fixed camera and the free orbit start where a capture left them, else at the chosen framing.
        if (gooseCamera === 'fixed' || gooseCamera === 'orbit') {
          const kept = keptGooseCamera()
          controls.target.copy(followed).add(kept ? new Vector3(...kept.target) : GOOSE_TARGET)
          camera.position.copy(followed).add(kept ? new Vector3(...kept.camera) : GOOSE_CAMERA)
          if (kept) cameraFollow.lag = kept.lag
          if (kept?.fov !== undefined) gooseLens.fov = kept.fov
          controls.update()
        }
      }
    },
    /** His walk stopped and the follow put on him at once, as he wakes. */
    onHim() {
      walking.x = walking.z = 0
      owed = Number.POSITIVE_INFINITY
    },
    /** Glided after him, `dt` s on, `stood` how high he stands; slid after the pointer and kept off the ground. */
    glide(dt: number, newBeat: boolean, frame: number, stood: number) {
      const stop = look.stopMotion
      // The same share of the gap a second whatever the frame rate; held, the frames' worth of it comes on the beat.
      owed += dt
      if (!(stop.enabled && stop.camera) || newBeat) {
        moved.set(light.x + ending.aim.x + leanAim.x, stood + leanAim.y, light.z + ending.aim.z + leanAim.z).sub(followed).multiplyScalar(cameraFollow.lag > 0 ? 1 - Math.exp(-owed / cameraFollow.lag) : 1)
        followed.add(moved)
        camera.position.add(moved)
        controls.target.add(moved)
        owed = 0
      }
      parallaxFrame(dt)
      controls.update(frame)
      // Never into the ground.
      const above = groundAt(camera.position.x, camera.position.z) + CAMERA_ABOVE
      if (camera.position.y < above) camera.position.y = above
    },
    /** The view as the camera now stands, for what is culled to it. */
    lookedFrom() {
      camera.updateMatrixWorld()
      plantsView.setFromProjectionMatrix(plantsMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem)
    },
    /** The orbit's camera put back, once the frame is drawn. */
    backFromShots() {
      camera.position.copy(orbitAt)
      camera.quaternion.copy(orbitTurn)
    },
  }
}

/** The camera as the page has it. */
export type GooseView = ReturnType<typeof createGooseView>
