// How the scene looks as the page opens: the look the panel's folders edit, each floor's own, and a theme laid over it.
import { Color, SRGBColorSpace } from 'three/webgpu'
import { featureOn, post0, url } from '../game/address'
import type { FloorName } from '../world/ground'
import type { Look } from '../settings'
import { RAT, LEVELS } from '../swarm/rats'
import { defaultAO } from './post'
import { defaultGoose } from '../characters/goose'
import { defaultFlame } from '../light/flame'
import { gooseThemeOf, layInto } from './goosethemes'

/**
 * A stylized floor's look to start: as painted, a tile two and a half metres
 * wide, unturned, its normal map as authored; no highlight, a rim since
 * 2026-11-09; the earth's strokes; three steps; and over that, `own`.
 */
const stylizedFloor = (texture: FloorName, own: Partial<Look['floor']> = {}): Look['floor'] => ({
  texture,
  lightness: 1,
  saturation: 1,
  hue: 0,
  scale: 2.5,
  relief: 1,
  rotation: 0,
  shell: { specular: 0, shininess: 53, softness: 0, specularColor: 0xffffff, rim: true, rimStrength: 0.25, rimWidth: 0, rimSoftness: 0, rimColor: 0xe6c3fe },
  paint: { strength: 4, density: 0.7, size: 3.35, rounding: 0.01 },
  toon: { steps: 3, three: [0.3, 0.51, 1] },
  ...own,
})
/**
 * Each floor's look, as last saved from the panel: picking a floor in the
 * floor folder lays its look with it, since a hue, a tile size or a relief
 * set for one painting is wrong for the other.
 */
export const FLOOR_LOOKS: Record<FloorName, Look['floor']> = {
  // The game's stylized sets, each set from the panel on 2026-10-21: the grass dark and turned to a warmer green,
  // in deep relief; the sand dark, a little warmer, flat; the stones grey, on smaller tiles, in deep relief.
  // Paler and yellower, on bigger tiles: set from the panel on 2026-10-25, the game's floor.
  stylized_grass_01: stylizedFloor('stylized_grass_01', { lightness: 0.25, saturation: 0.6, hue: 32, scale: 4.6, relief: 3 }),
  stylized_sand_01: stylizedFloor('stylized_sand_01', { lightness: 0.32, saturation: 0.63, hue: 14, relief: 0 }),
  stylized_stones_02: stylizedFloor('stylized_stones_02', { lightness: 0.52, saturation: 0, hue: 1, scale: 1.5, relief: 2.57 }),
}
/** `source` copied into `target` in place, nested objects and arrays included, so the panel's controls stay on them. */
export function copyInto<T extends object>(target: T, source: T): void {
  for (const key of Object.keys(source) as (keyof T)[]) {
    const value = source[key]
    if (Array.isArray(value)) (target[key] as unknown[]).splice(0, Infinity, ...value)
    else if (typeof value === 'object' && value !== null) copyInto(target[key] as object, value)
    else target[key] = value
  }
}
/** The game's rats' eyes, as the panel was set on 2026-10-24. */
export const GOOSE_EYES = 0x0aefff
/** How much paler the game's fog is toward the horizon, in lightness from 0 to 1. */
const HORIZON_LIFT = 0.12
/** `color` with its lightness raised by `lift`, as the eye sees it. */
function paler(color: number, lift: number): number {
  const hsl = new Color(color).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace)
  return new Color().setHSL(hsl.h, hsl.s, Math.min(hsl.l + lift, 1), SRGBColorSpace).getHex()
}
// `?theme=<name>` lays one of goosethemes.ts's moods over the look above; with none, the rainy
// night under a street lamp, put back on 2026-10-25 after the Halloween round (`00-current` the look above alone).
const GOOSE_THEME = '18-rainy-street-lamp'

/** The look the page starts on, and the theme laid over it, if any. */
export function startingLook() {
  /**
   * How the scene looks to start; the panel's look folders edit it. Saved from
   * the panel on 2026-10-05, chosen by eye; turned to Halloween on 2026-10-08,
   * a purple night round a pumpkin-orange torch, the rats' eyes blood red; and
   * from Halloween to a forest at night on 2026-10-11: a cold, waning moon
   * low in the sky, a dark blue night, nothing purple.
   */
  const look: Look = {
    // A hot lamp with no falloff, its intensity whatever the strength, its reach at full strength; at the strength
    // the light starts at it ends well inside the light's hard radius, so the
    // holder stands in a pool, and the front presses on from the dark.
    // The lamp burns in the goose's torch, half a metre up, rather than hanging over it. The warm orange
    // the torch had before Halloween (2026-10-11): the pumpkin orange clipped to flat red on the earth.
    lamp: { color: 0xff8442, intensity: 13, reach: 6.9, falloff: 0, lag: 0.08, inFlame: true },
    // The light and the fog as it was on 2026-10-08 (01304fa^), brought back on 2026-10-11, under the
    // effects as they stood before the 3D game (4aa332e): the look of the
    // goose's screenshots. A bright moon straight overhead, its shadows fairly sharp and not quite black, over the
    // ambient occlusion that carries the mass's volume.
    sun: { color: 0xb9c0bd, intensity: 3.2, x: 0, y: 23, z: 0, shadows: true, softness: 1.5, darkness: 0.9, shadowColor: 0x000000 },
    // A green fill, and a green fog to match it: the dark has a colour.
    fill: { sky: 0x268265, ground: 0x324d44, intensity: 0.7 },
    // A little of their own colour in the dark, as set on 2026-11-09; the trees' were 0.48 before. The lights under half
    // as strong on them: at full, the moon and the fires turned their colours (2026-11-09).
    leaves: { glow: 0.13, light: 0.4 },
    // Round the light, not the camera: the dark closes in on the holder from every side, further out than the lamp
    // reaches; on to start, a plain ring, its density 1 and no wisps (`?fog=0` or the folder's switch for none).
    fog: { enabled: url.get('fog') !== '0', color: 0x141916, near: 1, far: 5.5, density: 1, wisp: 0, scale: 2.75, drift: 0.6, lit: 0, litColor: 0xff7a2e, litSpread: 1.5 },
    // Matt rats in the creature's own colours, with no highlight: the mass is
    // one body, edged by its rim.
    // Its parts' colours are the model's own, read once it is loaded. Set from
    // the panel on 2026-10-05: long light strokes, and three steps from a
    // black shade to a dim half-light.
    rats: {
      color: RAT.color,
      parts: [],
      // Four kinds of rat, each a tint over the white fur and pale skin: the
      // fur's own near black and a warm dark grey make up most of the swarm,
      // with a few cool dark greys and a rare pale one among them. Set from
      // the panel on 2026-10-07.
      variants: [
        { tint: 0x282426, share: 0.25 },
        { tint: 0x313335, share: 0.05 },
        { tint: 0x3a3135, share: 0.23 },
        { tint: 0x7e7777, share: 0.02 },
      ],
      // The eyes glow twice their colour, points of light in the dark.
      glow: 2,
      rim: true,
      // Faint, wide and very soft, pale green: set from the panel on 2026-10-05, it slides over the rats rather than flashing.
      rimStrength: 0.17,
      rimWidth: 0.24,
      rimSoftness: 0.34,
      rimColor: 0xbefecd,
      toon: { steps: 3, three: [0, 0.38, 1] },
      paint: { strength: 1.3, density: 2.5, size: 1.75, rounding: 0 },
      // Drawn simpler the fewer pixels long a rat stands, on WebGPU (ADR-0057); `?lod=0` starts with every rat whole.
      levels: { on: url.get('lod') !== '0', show: false, split: 'none', blur: 1, levels: LEVELS.map((level) => ({ ...level })) },
      // The far crowd's staggered steps (2026-10-16): off to start, `?stagger=4&staggerFrom=5` starts with them.
      stagger: { n: url.has('stagger') ? Number(url.get('stagger')) || 4 : 1, from: Number(url.get('staggerFrom') ?? 5), show: false },
    },
    // The floor the page starts on, with its own look.
    floor: structuredClone(FLOOR_LOOKS.stylized_grass_01),
    // Ambient occlusion on, at half resolution, a deep green in the creases, reaching far and falling off hard: set from the panel on 2026-10-05.
    ao: { ...defaultAO(), color: 0x174f3e, radius: 1.73, thickness: 4, distanceExponent: 3.95, distanceFallOff: 2 },
    // Hatching, faint ink in the deepest shade only, nine pixels apart at the grout's slant, crossed: set from the panel on 2026-10-05.
    hatch: { enabled: true, color: 0x06110c, below: 0.02, cross: true, spacing: 9, angle: 45, width: 0.35, strength: 0.2 },
    // Paper in full, fine fibres; a faint grain that holds still: the strength set from the panel on 2026-10-10.
    grain: { grain: true, grainStrength: 0.08, grainSize: 1, grainOnBeat: false, grainSpeed: 0, paper: true, paperStrength: 1, paperScale: 2.5 },
    // A light vignette from near the centre: set from the panel on 2026-10-05.
    vignette: { enabled: true, strength: 0.21, inner: 0.18, outer: 1.16, own: false, colour: 0x000000 },
    // The frame as drawn, the screen folder washing it out or richer.
    screen: { saturation: 1 },
    // Stop motion on twos: the rats step twelve times a second, run and places
    // alike; the camera and the light stay smooth. Between beats, the strokes
    // and the paper move; the rest is off, set as the panel left it on 2026-10-05.
    stopMotion: {
      // On again (2026-10-11, the effects as they were before the 3D game): `?stop=0` for a smooth take.
      enabled: true,
      fps: 12,
      run: true,
      swarm: true,
      light: true,
      camera: false,
      shadeWobble: false,
      shadeAmount: 0.2,
      lightFlicker: false,
      lightAmount: 0.04,
      strokeJitter: true,
      strokeAmount: 0.01,
      frameJitter: false,
      frameAmount: 2.4,
      paperOnBeat: true,
      uneven: false,
      unevenShare: 0,
      stagger: false,
      // Poses blended, not snapped: set from the panel on 2026-10-05.
      snap: false,
    },
    // A tabletop's focus on the light, soft five metres past it: set from the panel on 2026-10-05.
    dof: { enabled: true, onLight: true, focus: 7.8, focal: 5, bokeh: 1.7, glow: 0.6 },
    // A halo round the eyes, at half the frame's resolution: on everywhere, it costs a fixed slice of the frame (benched 2026-10-10).
    bloom: { enabled: true, strength: 1, radius: 0.1, resolution: 0.5, cheap: featureOn('cheapbloom'), blurGlow: 0.6 },
    // The goose at the light, half a metre high, in its own colours, shaded as the rats start.
    goose: defaultGoose(),
    flame: defaultFlame(),
    // The eyes' trails as the panel left them on 2026-10-07: short, a centimetre wide, needle-tapered, swaying hard, bright amber; no wiggle yet.
    trails: { enabled: true, seconds: 0.11, width: 0.01, strength: 4, wave: 2, taper: 1.9, fade: 6, wiggle: 0, wiggleSpeed: 1.6, color: 0xffbe0a, eyeColour: false },
  }

  // The game plays smooth: no stop motion. Its lamp hangs over him, not in the flame at his beak, so his light is
  // centred on him and his goslings.
  look.stopMotion.enabled = false
  look.lamp.inFlame = false
  // Its night as the panel was set on 2026-10-24: a dimmer lamp, a blue moon low in the
  // west over a blue sky and brown ground, a teal fog ring, wide; the rats lit in teal-green, their eyes cyan
  // (set once their parts are read), their trails taking the eyes' colour.
  Object.assign(look.lamp, { intensity: 5, reach: 6.9, falloff: 0, lag: 0.08 })
  Object.assign(look.sun, { color: 0x67a8fe, intensity: 1.6, x: -30, y: 23, z: 0, shadows: true, softness: 1.5, darkness: 0.9 })
  Object.assign(look.fill, { sky: 0x67a8fe, ground: 0x633618, intensity: 0.75 })
  Object.assign(look.fog, { color: 0x0e6a7c, band: 15, near: 0, far: 15.75, density: 1, wisp: 0, scale: 0.5, drift: 0, lit: 0, litColor: 0xcc682e, litSpread: 0.8 })
  Object.assign(look.rats, { glow: 1.4, rim: true, rimStrength: 0.82, rimWidth: 0.24, rimSoftness: 0.34, rimColor: 0x58937f })
  Object.assign(look.trails, { enabled: true, seconds: 0.11, width: 0.01, taper: 1.9, wave: 2, strength: 4, fade: 6, wiggle: 0, wiggleSpeed: 1.6, eyeColour: true })
  const gooseTheme = gooseThemeOf(url.get('theme') ?? GOOSE_THEME)
  if (gooseTheme) layInto(look, gooseTheme.look)
  // The game's rats matt since 2026-10-26, whatever the theme: no highlight. Their rim, the theme's, back in violet since 2026-11-09.
  Object.assign(look.rats, { rim: true, rimColor: 0x875cff })
  // Since 2026-10-26: no fog, a pale violet moon, a mauve fill, and the rats all one dusty
  // mauve; the lamp, the moon and the fill as set from the panel, the lamp's light reaching less far.
  look.fog.enabled = false
  Object.assign(look.lamp, { color: 0xf09a60, intensity: 7, reach: 4.7, falloff: 0, lag: 0.08, inFlame: false })
  Object.assign(look.sun, { color: 0xa094ff, intensity: 2.5, x: -23.5, y: 27, z: 25, shadows: true, softness: 1.5, darkness: 0.64, shadowColor: 0x241d3a })
  Object.assign(look.fill, { sky: 0x754b8b, ground: 0x221a28, intensity: 0.8 })
  look.rats.variants = [{ tint: 0x5c4d5a, share: 1 }]
  // The torch's smoke faint, whatever the theme, since 2026-11-01; a pale lilac since 2026-11-09.
  Object.assign(look.flame.smoke, { color: 0xf3d6ff, opacity: 0.1 })
  // The fog paler toward the horizon (2026-10-25), whatever the theme: a soft gradient down the frame, the top of which
  // looks out nearly level. Its own colour lifted, so the horizon stays in the fog's family.
  look.fog.horizon ??= paler(look.fog.color, HORIZON_LIFT)
  // The goose (goose.ts) burns its torch at the cup's top: the flame sunk into it, as the panel set it on 2026-10-08;
  // and as bright as the plain's fires (`fireLook`), since 2026-10-29.
  Object.assign(look.flame, { lift: -0.09, offsetX: -0.009, offsetZ: 0.022, glow: 2.8 })
  return { look, gooseTheme }
}

/** The look as the backend and the address have it, once the backend is known: smooth or held, and the effects measured without. */
export function measuringSwitches(look: Look, backend: string, lean: boolean): void {
  // ?stop=0 plays the full look smooth, for filming: no stop motion, and nothing else changed; ?stop=1 holds it on the beat.
  if (url.has('stop')) look.stopMotion.enabled = url.get('stop') !== '0'
  // On WebGL 2 the motion is smooth to start (2026-10-16); `?stop=1` asks for stop motion there.
  else if (backend !== 'WebGPU') look.stopMotion.enabled = false

  // Switches for measuring on a phone, where the panel covers the readouts:
  // ?nopanel, ?dpr=1, ?ao=0, ?dof=0, ?bloom=0, and ?post=0 for every effect after the scene.
  if (post0 || url.get('ao') === '0') look.ao.enabled = false
  // `?ao=samples,resolution` for a cheaper AO, `?ao=8,0.25`: 16 at half the frame's resolution as it stands.
  const askedAO = (url.get('ao') ?? '').split(',').map(Number)
  if (askedAO.length === 2) {
    look.ao.samples = askedAO[0] || look.ao.samples
    look.ao.resolution = askedAO[1] || look.ao.resolution
  }
  if (post0 || url.get('dof') === '0') look.dof.enabled = false
  if (post0 || lean || url.get('bloom') === '0') look.bloom.enabled = false
  // On a phone the rats stand small, with no bloom round them: a wider, stronger rim to find them by in the dark.
  // `?rim=strength,width` to try others.
  if (lean) {
    const askedRim = (url.get('rim') ?? '').split(',').map(Number)
    Object.assign(look.rats, { rim: true, rimStrength: askedRim[0] || 1.4, rimWidth: askedRim[1] || 0.12, rimSoftness: 0.12, rimColor: 0xb48cff })
  }
  if (post0) {
    look.hatch.enabled = look.vignette.enabled = false
    look.grain.grain = look.grain.paper = false
  }
}
