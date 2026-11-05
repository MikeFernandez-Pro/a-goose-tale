// The see-through (ADR-0049): a surface nearer the camera than the goose, inside
// a circle round him as the camera sees it (measured by angle from the camera,
// so the hole is the same size on screen whatever the surface's depth), is
// dithered away through its material's `maskNode`, its shadow kept whole:
// Utanomori's see-through for its hero behind the trees, cut the way three's
// occlusion dither cuts. The ground is never cut.
import { BufferGeometry, Group, LineBasicNodeMaterial, LineLoop, Vector3, type Camera, type Node, type NodeMaterial } from 'three/webgpu'
import { bool, cameraPosition, cameraViewMatrix, float, mix, mx_noise_float, output, positionWorld, renderGroup, select, smoothstep, time, uniform, vec3, vec4 } from 'three/tsl'

/** What the see-through is set by. */
export interface SeeThrough {
  /** Whether anything is cut at all. */
  enabled: boolean
  /** How much of the surface goes at the hole's core: 0 none, 1 all of it. */
  strength: number
  /** The hole's radius round the goose, m, as the camera sees it. */
  radius: number
  /** How much of the radius is the hole's core, 0 to 1, before it fades out to the edge. */
  inner: number
  /** A surface must be this much nearer the camera than the goose to be cut, m. */
  bias: number
}

/**
 * The see-through's dither is Perlin noise, laid in the world, on the
 * surfaces, so the hole's edge breaks up into blots that stay on a surface as
 * the camera moves past it. Nor is
 * the hole a circle: as the Portfolio's intro iris does, its edge is pushed in
 * and out by a second noise, taken round the hole as the camera sees it and
 * slowly turning over in time, so it opens as a blot that keeps changing shape.
 */
export interface NoiseSeeThrough extends SeeThrough {
  /** How high over the ground under the subject the hole is centred, m. */
  height: number
  /** How big the noise's blots are, m. */
  noiseScale: number
  /** How hard the blots' edges are: 1 the noise as it comes, higher harder, so the hole opens in fewer, sharper blots. */
  contrast: number
  /** How fast the noise rises through the surfaces, m/s: 0 still. */
  drift: number
  /** How far the hole's edge is pushed in and out, as a share of its radius: 0 a circle. */
  wobble: number
  /** How many lobes the edge has: the edge's noise, a radius to a unit of it. */
  wobbleScale: number
  /** How fast the edge changes shape. */
  wobbleSpeed: number
  /**
   * The zone shown, to set it by: what the see-through would take away drawn red in its place, the hole's fade a red
   * wash over the rest, and rings round him at its radius and its clear core's (`seeThroughZone`).
   */
  debug: boolean
}

/** A hole two metres round the goose, centred at his neck, clear over its inner two fifths, its blots a third of a metre and still, its edge pushed a third of its radius in and out. */
export const defaultNoiseSeeThrough = (): NoiseSeeThrough => ({ enabled: true, strength: 1, radius: 2, inner: 0.4, bias: 0.5, height: 0.4, noiseScale: 0.35, contrast: 1.6, drift: 0, wobble: 0.35, wobbleScale: 1.8, wobbleSpeed: 0.15, debug: false })

/**
 * The see-through, for any material to take: where the hole is cut round, a
 * uniform to move, and the mask that cuts it. A material given it is dithered
 * away round the subject, its shadow kept whole. Its look is on uniforms:
 * `set` takes another, and recompiles nothing.
 */
export function noiseSeeThrough(look: NoiseSeeThrough = defaultNoiseSeeThrough()): SeeThroughCut<NoiseSeeThrough> {
  const wobble = shared(0)
  const wobbleScale = shared(1)
  const wobbleSpeed = shared(0)
  const hole = holeRound((round) => mx_noise_float(vec3(round.mul(wobbleScale), time.mul(wobbleSpeed))).mul(wobble))
  const scale = shared(1)
  const contrast = shared(1)
  const drift = shared(0)
  // Perlin's noise lies about 0, mostly within ±1: spread by the contrast and
  // moved to [0, 1), so a full cut still removes every fragment.
  const at = positionWorld.add(vec3(0, time.mul(drift).negate(), 0)).div(scale)
  const threshold = mx_noise_float(at).mul(contrast).mul(0.5).add(0.5).clamp(0, 255 / 256)
  const debug = shared(0)
  // What the see-through takes away, as the noise falls under the hole's fade.
  const away = threshold.lessThan(hole.cut)
  const set = (next: NoiseSeeThrough) => {
    hole.set(next)
    debug.value = next.debug ? 1 : 0
    scale.value = Math.max(0.01, next.noiseScale)
    contrast.value = Math.max(0.1, next.contrast)
    drift.value = next.drift
    wobble.value = next.wobble
    wobbleScale.value = Math.max(0.01, next.wobbleScale)
    wobbleSpeed.value = next.wobbleSpeed
  }
  set(look)
  // Shown, nothing is taken away: what would be is drawn red, and the fade over the rest a red wash.
  const cut = (m: NodeMaterial, kept?: Node<'bool'>) => {
    const taken = kept ? away.and(kept.not()) : away
    m.maskNode = taken.not().or(debug.greaterThan(0.5))
    m.maskShadowNode = bool(true)
    const red = select(taken, float(1), hole.cut.mul(0.4)).mul(debug)
    m.outputNode = vec4(mix(output.rgb, vec3(1, 0, 0), red), output.a)
  }
  return { subject: hole.subject, set, cut }
}

/**
 * The see-through's zone round its subject, for its debug: a red ring at the hole's radius and a fainter one at its
 * clear core's, facing the camera at the subject's depth, as the hole is measured; drawn over everything.
 */
export function seeThroughZone(): { object: Group; update(subject: Vector3, camera: Camera, look: NoiseSeeThrough): void } {
  const circle = new BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, k) => new Vector3(Math.cos((k / 96) * Math.PI * 2), Math.sin((k / 96) * Math.PI * 2), 0)))
  const ring = (opacity: number) => {
    const material = new LineBasicNodeMaterial({ color: 0xff0000, transparent: true, opacity, depthTest: false })
    const line = new LineLoop(circle, material)
    line.renderOrder = 10
    return line
  }
  const outer = ring(1)
  const core = ring(0.5)
  const object = new Group()
  object.add(outer, core)
  object.visible = false
  return {
    object,
    update(subject, camera, look) {
      object.visible = look.debug && look.enabled
      if (!object.visible) return
      object.position.copy(subject)
      object.quaternion.copy(camera.quaternion)
      outer.scale.setScalar(look.radius)
      core.scale.setScalar(look.radius * Math.min(look.inner, 0.99))
    },
  }
}

/** A see-through: where the hole is cut round, a uniform to move; a material to cut, but where `kept` holds; its look, taken again. */
export interface SeeThroughCut<Look> {
  subject: { value: Vector3 }
  cut(material: NodeMaterial, kept?: Node<'bool'>): void
  set(look: Look): void
}

// Every frame's or the panel's, read by things that never move: a uniform in
// the object group would keep the value they were first drawn with.
const shared = (value: number) => uniform(value).setGroup(renderGroup)

// The see-through's hole, before its dither: a surface nearer the camera than the
// subject, inside the circle the hole's radius makes round the subject as the
// camera sees it, fades out from the circle's core to its edge, and the dither
// cuts it where its threshold falls under the fade. The circle is measured by
// angle from the camera, the angle the radius subtends at the subject's depth,
// so it is one size on screen whatever the surface's depth. `warp`, where given,
// pushes the edge out where it is under 0 and in where over, read at a point
// round the hole as the camera sees it, its edge 1 from its centre.
function holeRound(warp?: (round: Node<'vec2'>) => Node<'float'>): { subject: { value: Vector3 }; cut: Node<'float'>; set(look: SeeThrough): void } {
  const subject = uniform(new Vector3()).setGroup(renderGroup)
  const on = shared(1)
  const strength = shared(1)
  const radius = shared(1)
  const inner = shared(0)
  const bias = shared(0)
  const toHere = positionWorld.sub(cameraPosition)
  const toSubject = subject.sub(cameraPosition)
  const here = toHere.length()
  const depth = toSubject.length()
  const angle = toHere.div(here).dot(toSubject.div(depth)).clamp(-1, 1).acos()
  const cone = radius.div(depth).atan()
  // Across the camera's view, so the point is the hole's own, whichever way the camera faces.
  const off = toHere.div(here).sub(toSubject.div(depth))
  const round = cameraViewMatrix.mul(vec4(off, 0)).xy.div(cone)
  const edge = warp ? angle.div(cone).add(warp(round)) : angle.div(cone)
  const fade = smoothstep(inner, 1, edge).oneMinus()
  const inFront = here.lessThan(depth.sub(bias))
  return {
    subject,
    cut: fade.mul(float(inFront)).mul(strength).mul(on),
    set(next) {
      on.value = next.enabled ? 1 : 0
      strength.value = next.strength
      radius.value = Math.max(0.05, next.radius)
      // Short of 1, so the fade's two edges never meet.
      inner.value = Math.min(next.inner, 0.99)
      bias.value = next.bias
    },
  }
}
