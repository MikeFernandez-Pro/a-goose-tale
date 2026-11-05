// The sky behind the scene and the fog round the light: one node every material reads, moved by uniforms without a recompile.
import type { Look } from '../settings'
import { Color, type Scene, type PerspectiveCamera, Vector2, Vector4, Matrix4, type Node } from 'three/webgpu'
import { uniform, renderGroup, vec3, positionWorld, mx_noise_float, smoothstep, uniformArray, Fn, float, Loop, mix, cameraPosition, normalWorldGeometry, vec4, getViewPosition, screenUV, fog } from 'three/tsl'
import type { FixedLight } from '../swarm/swarm'

/** How many lights light the fog, the torch among them: the nearest him. */
const FOG_LIGHTS = 8
/** The colour the night goes in a strike's flash. */
const FLASH_COLOR = new Color(0xdfe4ff)

/** The sky and the fog on `scene`, as `camera` sees them. */
export function createSkyFog(scene: Scene, camera: PerspectiveCamera) {
  /** The night's colour behind the scene, the fog's. */
  const sky = new Color()
  scene.background = sky
  // The fog is a ring round the light: how thick it is at a point is how far
  // that point is from the light on the ground, not from the camera. Every
  // material reads the one node, so the uniforms move it without a recompile.
  // The ring's edge is frayed by noise: two octaves over the point's place in
  // the world, blown along the ground and churned over time, push the point's
  // distance from the light in and out by up to the wisp, so patches of thicker
  // fog drift through the ring and over the rats. The time is the run's held
  // time, so the stop motion steps the drift on the beat with everything else.
  // Every fog uniform is in the render's group, uploaded every frame: in the object group, a mesh that never moves
  // keeps the values it was first drawn with, and the well stood out of the fog as the ring moved on without it.
  const fogColor = uniform(new Color()).setGroup(renderGroup)
  const fogNear = uniform(0).setGroup(renderGroup)
  const fogFar = uniform(1).setGroup(renderGroup)
  const fogCentre = uniform(new Vector2()).setGroup(renderGroup)
  /**
   * How dense the fog is between near and far: 1 the plain ramp; more bends it
   * up, so the fog is thick soon past near and only creeps to solid at far.
   */
  const fogDensity = uniform(1).setGroup(renderGroup)
  /** How far the noise pushes the edge, m, 0 for a plain ring. */
  const fogWisp = uniform(0).setGroup(renderGroup)
  /** How wide one wisp is, m. */
  const fogScale = uniform(1).setGroup(renderGroup)
  /** How fast the wisps blow along the ground, m/s. */
  const fogDrift = uniform(0).setGroup(renderGroup)
  const fogTime = uniform(0).setGroup(renderGroup)
  const fogWind = fogDrift.mul(fogTime)
  // Blown across x and z at the drift, and rising through the noise's third axis at a third of it, so a wisp changes shape as it goes.
  const fogPoint = vec3(positionWorld.x.add(fogWind), positionWorld.z.add(fogWind.mul(0.6)), positionWorld.y.add(fogWind.mul(0.3))).div(fogScale)
  const fogNoise = mx_noise_float(fogPoint).add(mx_noise_float(fogPoint.mul(2.1).add(vec3(7.3, 1.9, 4.1))).mul(0.5))
  const fogRamp = smoothstep(fogNear, fogFar, positionWorld.xz.distance(fogCentre).add(fogNoise.mul(fogWisp)))
  // The ramp bent by the density: `1 - (1 - ramp)^density` keeps its ends and lifts its middle.
  const fogAmount = fogRamp.oneMinus().pow(fogDensity).oneMinus()
  // The fog lit by the lights in it: round each lit light, the torch first, the fog takes on the lit colour, full at the
  // light and gone a `spread` of its reach out, the lights summed and capped at one, by the strength. So a far light reads
  // as a warm haze in the dark, where it stands and about how far it reaches, and never shows the ground under it. Only
  // the FOG_LIGHTS nearest him; the rest are the page's sparks alone.
  const fogLights = uniformArray(Array.from({ length: FOG_LIGHTS }, () => new Vector4()), 'vec4').setGroup(renderGroup)
  const fogLit = uniform(0).setGroup(renderGroup)
  const fogLitColor = uniform(new Color()).setGroup(renderGroup)
  const fogLitSpread = uniform(1).setGroup(renderGroup)
  /** How lit the fog is at `at` on the ground, x and z, before its lit strength. */
  const glowAt = (at: Node<'vec2'>) =>
    Fn(() => {
      const glow = float(0).toVar()
      Loop(FOG_LIGHTS, ({ i }) => {
        // x, z, reach, and 1 lit or 0.
        const one = fogLights.element(i) as unknown as Node<'vec4'>
        const near = float(1).sub(smoothstep(0, one.z.mul(fogLitSpread).max(0.01), at.distance(one.xy)))
        glow.addAssign(near.mul(near).mul(one.w))
      })
      return glow.min(1)
    })() as unknown as Node<'float'>
  const fogGlow = glowAt(positionWorld.xz).mul(fogLit)
  // The fog's colour by where the eye looks: the horizon's where the look runs level, turning to the fog's own over
  // the band as it tips down to the ground or up overhead. The sky behind the scene takes the same, so the fog's far
  // edge melts into it; on the goose's fixed camera the frame's top looks out nearly level and his feet well down.
  const skyHorizon = uniform(new Color()).setGroup(renderGroup)
  /** How far the look tips from level before the colour is the fog's own: the sine of the angle. */
  const skyBand = uniform(1).setGroup(renderGroup)
  const skyAt = (along: Node<'vec3'>) => mix(skyHorizon as unknown as Node<'vec3'>, fogColor as unknown as Node<'vec3'>, smoothstep(0, skyBand, along.y.abs()))
  /** The sky along the look at this fragment, for what the scene draws. */
  const skyHere = skyAt(positionWorld.sub(cameraPosition).normalize())
  /** The sky behind the scene: three's background sphere, its normals the look. */
  const skyBehind = skyAt(normalWorldGeometry)
  // The sky along the look through this pixel, for the passes over the frame: the scene camera's matrices, not the quad's.
  const lookInverse = uniform(new Matrix4()).setGroup(renderGroup).onRenderUpdate(() => camera.projectionMatrixInverse)
  const lookWorld = uniform(new Matrix4()).setGroup(renderGroup).onRenderUpdate(() => camera.matrixWorld)
  const skyOnScreen = skyAt(lookWorld.mul(vec4(getViewPosition(screenUV, float(0.5), lookInverse), 0)).xyz.normalize())
  scene.fogNode = fog(skyHere.add((fogLitColor as unknown as Node<'vec3'>).mul(fogGlow)) as unknown as typeof fogColor, fogAmount)
  /** Where the fog goes solid, m from the light, as the panel has it: the ring the swarm brings rats round past, fog or no fog. */
  let fogEdge = 1
  /** The lights by the fog's lights' order: the torch, then the lit lights nearest him. */
  const fogNearest: FixedLight[] = []
  /** Light the fog round the torch, `flare` times its reach, and the lit lights nearest him, FOG_LIGHTS in all, the rest left dark. Water is no light. */
  function lightUp(placed: readonly FixedLight[], torch: { x: number; z: number; reach: number }, torchLit: boolean, flare: number) {
    fogNearest.length = 0
    for (const one of placed) if (one.on && one.reach > 0 && !one.shore) fogNearest.push(one)
    const off = (one: FixedLight) => Math.hypot(one.x - torch.x, one.z - torch.z)
    fogNearest.sort((a, b) => off(a) - off(b))
    const slots = fogLights.array as Vector4[]
    slots[0]!.set(torch.x, torch.z, torch.reach * flare, torchLit ? 1 : 0)
    for (let k = 1; k < FOG_LIGHTS; k++) {
      const one = fogNearest[k - 1]
      slots[k]!.set(one?.x ?? 0, one?.z ?? 0, one?.reach ?? 0, one ? 1 : 0)
    }
  }
  return {
    /** The fog's amount, and the sky through a pixel, for the passes over the frame. */
    amount: fogAmount,
    onScreen: skyOnScreen,
    /** The ring's centre on the ground, and the time its wisps blow by. */
    centre: fogCentre,
    time: fogTime,
    get edge() {
      return fogEdge
    },
    lightUp,
    /** All the fog folder sets. */
    set(fog: Look['fog']) {
      fogColor.value.set(fog.color)
      skyHorizon.value.set(fog.horizon ?? fog.color)
      skyBand.value = Math.sin((Math.max(fog.band ?? 15, 1) * Math.PI) / 180)
      sky.set(fog.color)
      scene.backgroundNode = fog.horizon !== undefined ? skyBehind : null
      fogEdge = Math.max(fog.far, fog.near + 0.5)
      fogNear.value = fog.near
      fogFar.value = fogEdge
      fogDensity.value = Math.max(fog.density, 1)
      fogWisp.value = fog.wisp
      fogScale.value = Math.max(fog.scale, 0.1)
      fogDrift.value = fog.drift
      fogLit.value = fog.lit ?? 0
      fogLitColor.value.set(fog.litColor ?? 0)
      fogLitSpread.value = fog.litSpread ?? 1
      // No fog, for now: its ring pushed out of reach, as the bare simulation's is.
      if (!fog.enabled) {
        fogNear.value = 1e6
        fogFar.value = 1e6 + 1
      }
    },
    /** A strike's flash, 0 to 1, on a fog and sky of colour `fog`. */
    flash(fog: number, flash: number) {
      fogColor.value.set(fog).lerp(FLASH_COLOR, flash * 0.7)
      sky.copy(fogColor.value)
    },
  }
}

/** The sky and the fog as the page has them. */
export type SkyFog = ReturnType<typeof createSkyFog>
