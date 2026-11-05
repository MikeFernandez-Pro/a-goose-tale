// Where things are done, drawn on the ground, for the developer: the fills and the scenes' zones.
import { type Scene, Group, MeshBasicNodeMaterial, Mesh, RingGeometry } from 'three/webgpu'
import type { GoosePlay } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import { url } from '../game/address'
import type { FixedLight } from '../swarm/swarm'

/** The rings on `scene`, off till the zones are asked for. */
export function createZoneRings(scene: Scene, goosePlay: GoosePlay<PlaySwarm>, standAt: (x: number, z: number) => number) {
  const { layout } = goosePlay
  /**
   * DEBUG: where things are done, as rings on the ground: orange, a flame's dip, or a scene's fire's zone, Interact
   * held to fill the torch; red, where Interact works a scene, the well's
   * winch, the dead tree's trunk, the cage and its key. `?zones`, or the run folder's switch.
   */
  const refillZones = { show: url.has('zones') || url.has('refill') }
  const refillRings = new Group()
  scene.add(refillRings)
  const dipRing = new MeshBasicNodeMaterial({ color: 0xff8a2a, fog: false, depthWrite: false })
  /** A flat ring `radius` m round, its band a few centimetres wide, in `material`. */
  const refillRing = (radius: number, material: MeshBasicNodeMaterial) => {
    const ring = new Mesh(new RingGeometry(Math.max(0, radius - 0.05), radius, 64).rotateX(-Math.PI / 2), material)
    ring.renderOrder = 10
    refillRings.add(ring)
    return ring
  }
  const dipRings = layout.lights.map(() => refillRing(1, dipRing))
  const workRing = new MeshBasicNodeMaterial({ color: 0xff2a2a, fog: false, depthWrite: false })
  const workRings = goosePlay.scenes.map(() => refillRing(1, workRing))
  const keyRings = goosePlay.scenes.flatMap((s) => (s.kind === 'cage' ? [refillRing(1, workRing)] : []))
  /** The rings where the torch is filled now: every lit flame's dip. */
  function refillZonesFrame(placed: readonly FixedLight[]) {
    refillRings.visible = refillZones.show
    if (!refillZones.show) return
    placed.forEach((light, k) => {
      const ring = dipRings[k]!
      const own = layout.lights[k]!
      ring.visible = own.flame && light.on
      if (!ring.visible) return
      const zone = goosePlay.dipZoneOf(k)
      ring.scale.set(zone.rx, 1, zone.rz)
      ring.position.set(zone.x, standAt(zone.x, zone.z) + 0.03, zone.z)
    })
    goosePlay.scenes.filter((s) => s.kind === 'cage').forEach((cage, c) => {
      if (cage.kind !== 'cage') return
      const { x, z, rx, rz } = goosePlay.keyZoneOf(cage)
      keyRings[c]!.scale.set(rx, 1, rz)
      keyRings[c]!.position.set(x, standAt(x, z) + 0.03, z)
    })
    goosePlay.scenes.forEach((s, k) => {
      const { x, z, rx, rz } = goosePlay.zoneOf(s)
      workRings[k]!.scale.set(rx, 1, rz)
      workRings[k]!.position.set(x, standAt(x, z) + 0.03, z)
    })
  }
  return { zones: refillZones, frame: refillZonesFrame }
}
