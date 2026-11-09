// The night's three lights: a faint fill, the moon, and the one warm lamp over the goose.
import type { Look } from '../settings'
import { type Scene, HemisphereLight, DirectionalLight, Color, PointLight, type Node } from 'three/webgpu'
import { uniform, renderGroup, mix, vec3, shadow } from 'three/tsl'
import type { ShadowTargets } from './moonbake'

/**
 * How far the sun's shadows reach around the light it follows, in metres:
 * enough to cover the view, so no shadow ends on screen. And how deep they
 * reach: past the ground from the furthest place the panel can put the sun.
 */
const SUN_SHADOW_REACH = 16
const SUN_SHADOW_DEPTH = 80
/**
 * The sun's shadow map, texels a side: three centimetres a texel over its
 * reach. Twice as fine cost up to 0.6 ms of a 4 ms frame at 8,192 rats on an
 * RTX 5080, redrawn every frame. The panel's softness is in texels of the
 * 2,048 the look was set at, so it blurs as far on the ground at any size.
 */
const SUN_SHADOW_SIZE = 1024
const SOFTNESS_TEXELS = 2048

/** The night's lights on `scene`, the moon's shadows as `moon` asks (drawing.ts). */
export function createNightLights(scene: Scene, moon: string) {
  // A faint night-sky fill, a low waning moon, and the one warm light.
  const fill = new HemisphereLight()
  scene.add(fill)

  const sun = new DirectionalLight()
  sun.shadow.mapSize.set(SUN_SHADOW_SIZE, SUN_SHADOW_SIZE)
  Object.assign(sun.shadow.camera, {
    left: -SUN_SHADOW_REACH,
    right: SUN_SHADOW_REACH,
    top: SUN_SHADOW_REACH,
    bottom: -SUN_SHADOW_REACH,
    near: 1,
    far: SUN_SHADOW_DEPTH,
  })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = -0.0005
  // The sun's shadow in a colour: three's own shadow, 0 in it and 1 out of it as far as the darkness has it, taken from
  // the colour to white, so black is three's shadow as it was and any other colour lets that much of the sun's light in.
  const sunShadowColor = uniform(new Color(0x000000)).setGroup(renderGroup)
  const sunShadowNode = shadow(sun)
  const sunShadow = mix(sunShadowColor, vec3(1), sunShadowNode as unknown as Node<'float'>)
  sun.shadow.shadowNode = sunShadow
  scene.add(sun, sun.target)

  const lamp = new PointLight()
  lamp.shadow.mapSize.set(1024, 1024)
  // The frame renders the scene twice, through two cameras, and three renders a
  // shadow once per camera per frame: asked for by hand, it renders once, and
  // only on the frames the loop asks (see `shadowed`). A frame not asked keeps
  // the last map and the matrix it was drawn with, so the shadows hold still.
  sun.shadow.autoUpdate = lamp.shadow.autoUpdate = false
  lamp.shadow.camera.near = 0.05
  lamp.shadow.camera.far = 30
  scene.add(lamp)
  /** The panel's softness, in texels of the 2,048 the look was set at, in texels of the map drawn, so it blurs as far on the ground. */
  const softnessTexels = (softness: number) => Math.max(lights.blurAtLeast, (softness * (2 * SUN_SHADOW_REACH)) / SOFTNESS_TEXELS / lights.texel)
  const lights = {
    fill,
    sun,
    lamp,
    /** The targets of three's node for the moon's shadow (moonbake.ts). */
    sunShadowTargets: sunShadowNode as unknown as ShadowTargets,
    /** The lamp's intensity as the look and the ending set it, before the torch's guttering and its catch's flare (torchFrame). */
    lampLit: 0,
    /** The torch's light this frame, times its own: its reach, as the swarm, the lamp and the fog read it; and the lamp's glow. */
    torchFlare: 1,
    torchGlow: 1,
    /** The moon's map's texel, m: the live map's over its reach, or the bake's over the level (moonbake.ts). */
    texel: (2 * SUN_SHADOW_REACH) / SUN_SHADOW_SIZE,
    /** The least the moon's map is blurred, texels: none live; baked, its texels coarse, enough that its edges fade and do not step. */
    blurAtLeast: 0,
    /** All the look's folders set of them, `lit` the torch, on the stop motion's variations by channel. */
    set(look: Look, lit: boolean, vary: (channel: number) => number) {
      const stop = look.stopMotion
      const flicker = (channel: number) => (stop.lightFlicker ? 1 + stop.lightAmount * vary(channel) : 1)
      lamp.color.set(look.lamp.color)
      // The lamp's flicker drifts its hue a little too, warm to cool, as a flame's photographs do.
      if (stop.lightFlicker) lamp.color.offsetHSL(0.02 * stop.lightAmount * vary(4), 0, 0)
      // The intensity holds whatever the strength: the torch burning down pulls its reach in, not its glow.
      lights.lampLit = (lit ? look.lamp.intensity : 0) * flicker(1)
      lamp.intensity = lights.lampLit * lights.torchGlow
      lamp.decay = look.lamp.falloff

      sun.color.set(look.sun.color)
      sun.intensity = look.sun.intensity * flicker(2)
      sun.castShadow = look.sun.shadows && moon !== 'none'
      sun.shadow.radius = softnessTexels(look.sun.softness)
      // A uniform the shadow reads: the slider recompiles nothing.
      sun.shadow.intensity = look.sun.darkness
      sunShadowColor.value.set(look.sun.shadowColor)

      fill.color.set(look.fill.sky)
      fill.groundColor.set(look.fill.ground)
      fill.intensity = look.fill.intensity * flicker(3)
    },
    /** Them as the dawn has brought the look, `lit` the torch: casting, whatever the look's switch. */
    dawned(look: Look, lit: boolean) {
      sun.color.set(look.sun.color)
      sun.intensity = look.sun.intensity
      sun.castShadow = moon !== 'none'
      sun.shadow.radius = softnessTexels(look.sun.softness)
      sun.shadow.intensity = look.sun.darkness
      sunShadowColor.value.set(look.sun.shadowColor)
      fill.color.set(look.fill.sky)
      fill.groundColor.set(look.fill.ground)
      fill.intensity = look.fill.intensity
      lights.lampLit = lit ? look.lamp.intensity : 0
      lamp.intensity = lights.lampLit * lights.torchGlow
    },
  }
  return lights
}

/** The night's lights as the page has them. */
export type NightLights = ReturnType<typeof createNightLights>
