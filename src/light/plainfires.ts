// The fires on the plain, the torch's flame burning on each: the scenes' and the fire pits', the burning tree and its strike,
// and the burning branch.
import { type Scene, type PerspectiveCamera, type Mesh, type NodeMaterial, Vector3, Frustum, Matrix4, Sphere } from 'three/webgpu'
import type { GoosePlay, FireScene } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Look } from '../settings'
import type { gooseThemeOf } from '../look/goosethemes'
import type { Lights } from './lights'
import type { Beats } from '../game/beats'
import type { Opening } from '../game/opening'
import { type GooseScenes, type SceneFireLook, TREE_FIRE_BOWL, PIT_BOWL } from '../game/goosescenes'
import type { Goose } from '../characters/goose'
import type { Roadside } from '../world/roadside'
import type { SkyFog } from '../look/skyfog'
import type { NightLights } from './nightlights'
import type { Rats } from '../swarm/rats'
import { createFlames, type Flame } from './flame'
import { leaveUnshaded } from '../look/post'
import { createBranch, branchColours, branchPose, carriedPose, lyingPose } from './branch'
import { createEmbers } from './embers'
import { createLightning } from '../world/lightning'
import { litShare, flameGrown, OPENING, afterglow, branchAt, branchFlare } from '../game/openingscript'
import { flashAt } from '../world/weather'
import { calm } from '../game/address'
import type { FixedLight } from '../swarm/swarm'
import { shownOf } from '../world/plain'

/** How many times brighter the rats' eyes glow at the height of a strike's flash. */
const EYES_FLASH = 4

/** The plain's fires on what the page has made. */
export function createPlainFires({ scene, goosePlay, burningTreeLight, look, gooseTheme, lights, beats, standAt, groundAt, camera, opening, gooseScenes, goose, roadside, skyFog, nightLights, rats }: {
  scene: Scene
  goosePlay: GoosePlay<PlaySwarm>
  burningTreeLight: number
  look: Look
  gooseTheme: ReturnType<typeof gooseThemeOf>
  lights: Lights
  beats: Beats
  standAt: (x: number, z: number) => number
  groundAt: (x: number, z: number) => number
  camera: PerspectiveCamera
  opening: Opening
  gooseScenes: GooseScenes
  goose: Goose
  roadside: Roadside
  skyFog: SkyFog
  nightLights: NightLights
  rats: Rats
}) {
  /**
   * A scene's fire as it starts: its flame's foot `foot` m up, `height` m tall and `width` m wide, burning in the torch's
   * look; its lamp as bright as the lights' brazier lamp (lights.ts).
   */
  const sceneFire = (foot: number, height: number, width: number): SceneFireLook => ({ height, width, foot, x: 0, z: 0, intensity: 12 })
  /**
   * What every fire on the plain shares, the flames folder's: how bright its flame glows, times the torch's colours, the
   * torch glowing as its own, from as bright; and its lamp's colour, the lights' brazier lamp's, or the theme's.
   */
  const fireLook = { glow: look.flame.glow, lamp: gooseTheme?.fireLamp ?? 0xff7a28 }
  /**
   * Each scene's fire burns the torch's flame (flame.ts), in the fog, standing upright: the brazier by each dead tree in its
   * bowl, the cage's campfire on its logs. Each kind of scene's as its folder sets it, read live: the
   * flame's size, foot, offset off its fire and colours, and its lamp's colour and brightness; each wavering on channels of its own.
   */
  const fireLooks: Record<FireScene, SceneFireLook> = {
    tree: sceneFire(TREE_FIRE_BOWL - 0.05, 0.5, 0.28),
    // The campfire's lamp dimmer than the braziers' since 2026-11-01, and dimmer again later that day.
    cage: { ...sceneFire(0.24, 1.05, 0.55), intensity: 3.5 },
  }
  /**
   * The fires on the plain, drawn together (flame.ts), in the fog like everything else there, which flame.ts leaves the
   * torch's out of; and a flame for one of them.
   */
  const plainFlames = createFlames()
  plainFlames.object.traverse((o) => {
    o.castShadow = false
    if (!(o as Mesh).isMesh) return
    const material = (o as Mesh).material as NodeMaterial
    leaveUnshaded(material)
    material.fog = true
  })
  scene.add(plainFlames.object)
  const plainFlame = () => plainFlames.add()
  /** Each scene's fire, a flame a scene. */
  const sceneFires = goosePlay.scenes.flatMap((owner) => (owner.kind === 'well' ? [] : [{ owner, light: goosePlay.fireLightOf(owner), fire: plainFlame() }]))
  /** The fire pit's flame (goosescenes.ts), on its logs, its light's: the one by each well. */
  const pitFires = goosePlay.wellFires.map(({ brazier, light }) => ({ brazier, light, fire: plainFlame() }))
  const pitFireLook = sceneFire(PIT_BOWL - 0.04, 0.75, 0.42)
  /**
   * The burning tree's fires (goosescenes.ts): a flame on each cluster of its crown, each its own size, `crownFireLook`'s
   * times its own share; and one at its foot, a branch fallen burning, where he lights the torch, FOOT_FIRE m off its
   * trunk toward where he starts. Its lamp the crown's.
   */
  const crownFireLook = sceneFire(-0.5, 1.9, 1.05)
  const footFireLook = sceneFire(0.02, 0.5, 0.34)
  const FOOT_FIRE = 0.45
  const crownFires: { fire: Flame; size: number; drawnAt: number }[] = []
  const crownAt: Vector3[] = []
  /** The flames climbing its trunk, from the strike at its foot to its crown, each out on the trunk's side toward the camera. */
  const trunkFireLook = sceneFire(-0.1, 0.95, 0.5)
  const trunkFires: { fire: Flame; size: number; drawnAt: number }[] = []
  const trunkAt: Vector3[] = []
  const footFire = burningTreeLight < 0 ? undefined : plainFlame()
  /**
   * The burning branch (branch.ts), where the route lays one: snapped off the burning tree's crown in the opening, BRANCH_FROM_UP
   * m up and BRANCH_FROM_OUT m out from its trunk toward where it lands, it falls, tumbling, to lie with its broken end
   * where the play's branch is, BRANCH_LIFT m up off the ground and its broken end raised BRANCH_RISE rad, lying back
   * along its fall from the tree, BRANCH_TURN rad off it; burning there, a flame of its own on its broken end and its
   * own embers, until he picks it up. Then it is drawn in his beak where his own torch lay, the play's torch burning on it.
   */
  const burningBranch = goosePlay.branch ? createBranch() : undefined
  const branchLook = branchColours()
  if (burningBranch) scene.add(burningBranch.object)
  const branchFire = burningBranch ? plainFlame() : undefined
  const branchFireLook = sceneFire(0.02, 0.42, 0.26)
  const branchEmbers = burningBranch ? createEmbers() : undefined
  if (branchEmbers) {
    branchEmbers.object.castShadow = false
    leaveUnshaded(branchEmbers.object.material as NodeMaterial)
    scene.add(branchEmbers.object)
  }
  const BRANCH_FROM_UP = 3
  const BRANCH_FROM_OUT = 1.1
  const BRANCH_LIFT = 0.06
  const BRANCH_RISE = 0.05
  const BRANCH_TURN = 0.6
  /** How many sparks it throws as it lands, and how fast, m/s. */
  const BRANCH_SPARKS = 18
  const BRANCH_SPARK_SPEED = 2
  /**
   * How often each of the burning tree's flames is drawn again, a second: smooth, never the stop motion's held beats, each
   * on a beat of its own, so only some are drawn a frame. Drawn every frame at 240 Hz, the forty of them cost over 3 ms
   * a frame (2026-10-27), when each flame's shells were laid out on the page; the vertex shader lays them out now.
   */
  const TREE_FLAME_RATE = 60
  /** How far up the fire's climb the crown's lowest cluster is, 0 the tree's foot to 1 its crown's top. */
  const CROWN_FROM = 0.4
  /** Whether flame `k` of the burning tree is due to be drawn again: at TREE_FLAME_RATE, each flame's beat its own way round the second. Its first drawing at once. */
  function treeFlameDue(own: { drawnAt: number }, k: number): boolean {
    const beat = Math.floor(beats.clock * TREE_FLAME_RATE + ((k * 0.618034) % 1))
    if (beat === own.drawnAt) return false
    own.drawnAt = beat
    return true
  }
  /** The camera's view, the crown's flames out of it left alone. */
  const crownView = new Frustum()
  const crownMatrix = new Matrix4()
  const crownSphere = new Sphere()
  /** How far past the burning tree's crown and its flames the camera's view must reach to draw its fire, m. */
  const TREE_FIRE_ROOM = 1
  /** Whether the strike's flash showed last frame, to lay the night back once it is over. */
  let strikeFlashing = false
  const footFireAt = new Vector3()
  /** The strike on the burning tree as the opening has it, its bolt and sparks the hollow log's of 2026-10-24, its sparks shorter-lived. */
  const strike = opening.on && burningTreeLight >= 0 ? createLightning(1, { rising: false }) : undefined
  if (strike) {
    Object.assign(strike.look.bolt, { foot: 0xffbb00, top: 0x34a4f9, fade: 8, brightness: 1.3, thickness: 0.15, height: 0.45, jagged: 1.15, seconds: 0.8, drift: 1.05, ease: 7.5 })
    Object.assign(strike.look.sparks, { near: 0xff822e, far: 0xff7b00, fade: 4, brightness: 2.6, count: 128, size: 0.055, seconds: 0.55, reach: 4.5, ease: 7.5, fall: 0.6, round: true })
    strike.look.flash = 0.73
  }
  if (strike) scene.add(strike.object)
  const sceneFireFoot = new Vector3()
  /** A strike's flash, 0 to 1, laid on the night: the fog and sky gone pale, the fill and the sun up, the rats' eyes flaring. */
  function flashFrame(flash: number) {
    skyFog.flash(look.fog.color, flash)
    nightLights.fill.intensity = look.fill.intensity * (1 + 6 * flash)
    nightLights.sun.intensity = look.sun.intensity * (1 + 3 * flash)
    rats.setGlow('eyes', look.rats.glow * (1 + EYES_FLASH * flash))
  }
  /**
   * The burning tree: its lamp as lit as the opening has it; a flame on each cluster of its crown, grown in as the fire
   * reaches it from the top down, swaying with its branch; one at its foot once the fire is down to its lowest; and the
   * strike that lights it, its bolt on the crown's top and its flash on the night.
   */
  function burningTreeFrame(newBeat: boolean) {
    if (burningTreeLight < 0) return
    const stop = look.stopMotion
    lights.setLamp(burningTreeLight, fireLook.lamp, crownFireLook.intensity * litShare(opening.t))
    const { height, width, foot } = crownFireLook
    const tree = roadside.burningTree
    if (!tree) return
    camera.updateMatrixWorld()
    crownView.setFromProjectionMatrix(crownMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem)
    // The whole tree out of the camera's view, its flames' height round it: none of its fire drawn, placed or shaped.
    const { x: treeX, z: treeZ, height: treeHeight, width: treeWidth } = tree
    const treeMiddle = sceneFireFoot.set(treeX, groundAt(treeX, treeZ) + treeHeight / 2, treeZ)
    const treeSeen = crownView.intersectsSphere(crownSphere.set(treeMiddle, Math.hypot(treeHeight, treeWidth) / 2 + crownFireLook.height + TREE_FIRE_ROOM))
    if (!treeSeen) for (const own of [...crownFires, ...trunkFires]) if (own) own.fire.object.visible = false
    ;(treeSeen ? gooseScenes.burningFlames(tree, crownAt) : []).forEach(({ up }, k) => {
      const own = (crownFires[k] ??= { fire: plainFlame(), size: 0.7 + 0.6 * ((k * 0.618034) % 1), drawnAt: -Infinity })
      const size = own.size * flameGrown(opening.t, CROWN_FROM + (1 - CROWN_FROM) * up)
      // Out of the camera's view, neither drawn nor shaped: the crown is mostly over the game's frame.
      const seen = crownView.intersectsSphere(crownSphere.set(crownAt[k]!, crownFireLook.height * own.size))
      own.fire.object.visible = look.flame.enabled && size > 0 && seen
      if (!own.fire.object.visible) return
      own.fire.set({ ...look.flame, height: height * size, width: width * size, glow: fireLook.glow, lean: 0 })
      if (treeFlameDue(own, k)) own.fire.shape((channel) => beats.flameDraw(channel + 7 * (40 + k)), 0, 0)
      own.fire.place(sceneFireFoot.copy(crownAt[k]!).setY(crownAt[k]!.y + foot * size))
    })
    ;(treeSeen ? gooseScenes.burningTrunk(tree, trunkAt) : []).forEach(({ radius }, k, all) => {
      const own = (trunkFires[k] ??= { fire: plainFlame(), size: 0.8 + 0.4 * ((k * 0.618034 + 0.3) % 1), drawnAt: -Infinity })
      const size = own.size * flameGrown(opening.t, (CROWN_FROM * (k + 1)) / (all.length + 1))
      own.fire.object.visible = look.flame.enabled && size > 0
      if (!own.fire.object.visible) return
      // Out on the trunk's side toward the camera, wrapping it.
      const at = trunkAt[k]!
      const away = Math.hypot(camera.position.x - at.x, camera.position.z - at.z) || 1
      const side = ((k % 2) * 2 - 1) * 0.5
      const ox = (camera.position.x - at.x) / away
      const oz = (camera.position.z - at.z) / away
      sceneFireFoot.set(at.x + (ox + oz * side) * radius * 0.85, at.y + trunkFireLook.foot * size, at.z + (oz - ox * side) * radius * 0.85)
      own.fire.set({ ...look.flame, height: trunkFireLook.height * size, width: trunkFireLook.width * size, glow: fireLook.glow, lean: 0 })
      if (treeFlameDue(own, 40 + k)) own.fire.shape((channel) => beats.flameDraw(channel + 7 * (80 + k)), 0, 0)
      own.fire.place(sceneFireFoot)
    })
    if (footFire) {
      const at = goosePlay.layout.lights[burningTreeLight]!
      const { start } = goosePlay.plain
      const d = Math.hypot(start.x - at.x, start.z - at.z) || 1
      const x = at.x + ((start.x - at.x) / d) * FOOT_FIRE
      const z = at.z + ((start.z - at.z) / d) * FOOT_FIRE
      const grown = flameGrown(opening.t, 0)
      footFire.object.visible = look.flame.enabled && grown > 0 && treeSeen
      if (footFire.object.visible) {
        footFire.set({ ...look.flame, height: footFireLook.height * grown, width: footFireLook.width * grown, glow: fireLook.glow, lean: 0 })
        if (!stop.enabled || newBeat) footFire.shape((channel) => beats.flameDraw(channel + 7 * 39), 0, 0)
        footFire.place(footFireAt.set(x, standAt(x, z) + footFireLook.foot, z))
      }
    }
    if (strike) {
      const struck = opening.t >= OPENING.strike ? OPENING.strike : Number.NaN
      strike.update(opening.t, [{ at: tree, due: OPENING.strike, time: struck }], goosePlay.holder, standAt)
      const flash = Math.max(flashAt(opening.t - OPENING.strike), afterglow(opening.t)) * strike.look.flash * (calm ? 0.2 : 1)
      if (flash > 0 || strikeFlashing) flashFrame(flash)
      strikeFlashing = flash > 0
    }
  }

  const branchFrom = new Vector3()
  const branchTo = new Vector3()
  const branchAtNow = new Vector3()
  const branchFlameAt = new Vector3()
  const branchButt = new Vector3()
  const branchLaid = branchPose()
  /** Whether the burning branch had landed as of the last frame: landing, it throws its sparks. */
  let branchDown = true
  /**
   * The burning branch as the play and the opening have it: hidden in the crown until it snaps; falling, tumbling, its
   * flame and embers on its broken end; lying there burning, its lamp lit; and once he has it, in his beak, where his own
   * torch lay, his torch's flame burning on it, its own out.
   */
  function branchFrame(newBeat: boolean, held: number) {
    const branch = goosePlay.branch
    if (!burningBranch || !branchFire || !branchEmbers || !branch) return
    const stop = look.stopMotion
    lights.setLamp(branch.light, fireLook.lamp, branchFireLook.intensity)
    // As long lying as carried, as he is drawn now.
    const { carrier, butt, end } = goose.held
    const length = carrier.localToWorld(branchButt.copy(butt)).distanceTo(carrier.localToWorld(branchAtNow.copy(end)))
    if (branch.carried) {
      burningBranch.object.visible = goose.object.visible
      burningBranch.place(carriedPose(goose.held, branchLaid))
      branchFire.object.visible = branchEmbers.object.visible = false
      return
    }
    // Where it lies, and where it falls from: over the tree's trunk, on the side toward where it lands.
    const tree = burningTreeLight >= 0 ? goosePlay.layout.lights[burningTreeLight]! : branch
    const away = Math.atan2(branch.z - tree.z, branch.x - tree.x)
    branchTo.set(branch.x, standAt(branch.x, branch.z) + BRANCH_LIFT, branch.z)
    branchFrom.set(tree.x + Math.cos(away) * BRANCH_FROM_OUT, groundAt(tree.x, tree.z) + BRANCH_FROM_UP, tree.z + Math.sin(away) * BRANCH_FROM_OUT)
    const fall = opening.on ? branchAt(opening.t, branchFrom, branchTo) : { at: branchTo, tumble: 0, shown: true, landed: true }
    burningBranch.object.visible = fall.shown
    burningBranch.place(lyingPose(branchAtNow.set(fall.at.x, fall.at.y, fall.at.z), away + BRANCH_TURN, length, BRANCH_RISE, fall.tumble, branchLaid))
    burningBranch.end(branchFlameAt)
    // Landing, a spray of sparks off it.
    if (fall.landed && !branchDown) branchEmbers.burst(BRANCH_SPARKS, BRANCH_SPARK_SPEED)
    branchDown = fall.landed
    branchFire.object.visible = look.flame.enabled && fall.shown
    branchEmbers.object.visible = look.flame.embers.enabled && fall.shown
    if (branchFire.object.visible) {
      branchFire.set({ ...look.flame, height: branchFireLook.height, width: branchFireLook.width, glow: fireLook.glow, lean: 0 })
      if (!stop.enabled || newBeat) branchFire.shape((channel) => beats.flameDraw(channel + 7 * 37), 0, 0)
      branchFire.place(sceneFireFoot.copy(branchFlameAt).setY(branchFlameAt.y + branchFireLook.foot))
    }
    if (branchEmbers.object.visible) branchEmbers.update(held, branchFlameAt)
  }
  /** The lights as the rats feel them, the burning branch's flaring as it lands in the opening. */
  function branchFlared<T extends FixedLight>(placed: readonly T[]): readonly T[] {
    const k = goosePlay.branch?.light
    if (k === undefined || !opening.running()) return placed
    const flare = branchFlare(opening.t)
    return flare === 1 ? placed : placed.map((one, j) => (j === k ? { ...one, reach: one.reach * flare } : one))
  }
  return {
    fireLook, fireLooks, pitFireLook, crownFireLook, trunkFireLook, footFireLook,
    branchLook, burningBranch, branchEmbers, branchFire,
    plainFlames, plainFlame, sceneFires, pitFires, crownFires, trunkFires, footFire,
    sceneFireFoot,
    burningTreeFrame, branchFrame, branchFlared,
    /** The scenes' fires and the pits' a frame on. */
    frame(newBeat: boolean) {
      const stop = look.stopMotion
      // The scenes' fires burn while their lights are lit, drawn again as the torch's is, each in its own look, its lamp with it.
      sceneFires.forEach(({ owner, light, fire }, i) => {
        const own = fireLooks[owner.kind]
        lights.setLamp(light, fireLook.lamp, own.intensity)
        const at = goosePlay.layout.lights[light]!
        fire.object.visible = look.flame.enabled && at.on
        if (!fire.object.visible) return
        // Raised and sized with its brazier as the edit mode draws it.
        const { y, size } = shownOf(goosePlay.plain.braziers[owner.brazier], 'fire')
        fire.set({ ...look.flame, height: own.height * size, width: own.width * size, glow: fireLook.glow, lean: 0 })
        if (!stop.enabled || newBeat) fire.shape((channel) => beats.flameDraw(channel + 7 * (i + 1)), 0, 0)
        fire.place(sceneFireFoot.set(at.x + own.x, standAt(at.x + own.x, at.z + own.z) + own.foot * size + y, at.z + own.z))
      })
      pitFires.forEach(({ brazier, light, fire }, p) => {
        lights.setLamp(light, fireLook.lamp, pitFireLook.intensity)
        const at = goosePlay.layout.lights[light]!
        fire.object.visible = look.flame.enabled && at.on
        if (!fire.object.visible) return
        const { height, width, foot } = pitFireLook
        const { y, size } = shownOf(goosePlay.plain.braziers[brazier], 'fire')
        fire.set({ ...look.flame, height: height * size, width: width * size, glow: fireLook.glow, lean: 0 })
        if (!stop.enabled || newBeat) fire.shape((channel) => beats.flameDraw(channel + 7 * (sceneFires.length + 1 + p)), 0, 0)
        fire.place(sceneFireFoot.set(at.x, standAt(at.x, at.z) + foot * size + y, at.z))
      })
    },
  }
}

/** The plain's fires as the page has them. */
export type PlainFires = ReturnType<typeof createPlainFires>
